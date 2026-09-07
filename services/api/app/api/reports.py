from datetime import datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.database.models import Analysis, Document, Report, User
from app.security.dependencies import require_permission
from app.security.permissions import Permission
from app.services.analysis_service import run_document_analysis
from app.services.document_access import verify_document_ownership
from app.services.risk_scoring import calculate_overall_risk

router = APIRouter()


class RiskCounts(BaseModel):
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0
    total: int = 0


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    document_id: UUID
    document_name: str
    version_id: UUID | None = None
    analysis_id: UUID | None = None
    format: str = "pdf"
    status: str  # "COMPLETED" | "PROCESSING" | "PENDING"
    risk_level: str  # "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
    risk_score: int = 0
    risk_counts: RiskCounts = RiskCounts()
    summary: str | None = None
    created_at: datetime
    analysis_created_at: datetime | None = None


class GenerateReportRequest(BaseModel):
    document_id: UUID
    force: bool = False


def _build_report_response_from_analysis(
    report_id: UUID,
    doc: Document,
    analysis: Analysis | None,
    created_at: datetime,
) -> ReportResponse:
    if not analysis:
        # Document without analysis yet
        doc_status = "COMPLETED" if doc.processing_status == "ready" else "PROCESSING"
        zero_risk = calculate_overall_risk([])
        return ReportResponse(
            id=report_id,
            document_id=doc.id,
            document_name=doc.name,
            version_id=None,
            analysis_id=None,
            format="pdf",
            status=doc_status,
            risk_level=zero_risk["level"],
            risk_score=zero_risk["score"],
            risk_counts=RiskCounts(**zero_risk["counts"]),
            summary=None,
            created_at=created_at,
            analysis_created_at=None,
        )

    # Compute or retrieve deterministic risk assessment
    structured = analysis.structured_data if isinstance(analysis.structured_data, dict) else {}
    risk_data = structured.get("risk_assessment")
    if not risk_data:
        risk_data = calculate_overall_risk(analysis.risks)

    counts_dict = risk_data.get("counts", {})
    risk_counts = RiskCounts(
        critical=counts_dict.get("critical", 0),
        high=counts_dict.get("high", 0),
        medium=counts_dict.get("medium", 0),
        low=counts_dict.get("low", 0),
        total=counts_dict.get("total", 0),
    )

    return ReportResponse(
        id=report_id,
        document_id=doc.id,
        document_name=doc.name,
        version_id=analysis.version_id,
        analysis_id=analysis.id,
        format="pdf",
        status="COMPLETED" if analysis.status == "completed" else "PROCESSING",
        risk_level=risk_data.get("level", "LOW"),
        risk_score=risk_data.get("score", 0),
        risk_counts=risk_counts,
        summary=analysis.summary or structured.get("executive_summary"),
        created_at=created_at,
        analysis_created_at=analysis.created_at,
    )


@router.get("", response_model=list[ReportResponse], status_code=status.HTTP_200_OK)
def list_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.DOCUMENT_VIEW)),
) -> list[ReportResponse]:
    """
    List all reports accessible to the current user.
    Enforces document tenancy boundary.
    Links each report deterministically to its source analysis and risk classification.
    """
    user_role = current_user.role.name.upper() if current_user.role else ""

    # 1. Fetch user accessible documents
    doc_query = select(Document)
    if user_role != "ADMIN":
        doc_query = doc_query.where(Document.owner_id == current_user.id)
    doc_query = doc_query.order_by(Document.created_at.desc())
    documents = list(db.scalars(doc_query).all())

    if not documents:
        return []

    doc_map = {d.id: d for d in documents}
    doc_ids = list(doc_map.keys())

    # 2. Fetch all completed analyses for these documents
    analyses = list(
        db.scalars(
            select(Analysis)
            .where(Analysis.document_id.in_(doc_ids))
            .where(Analysis.status == "completed")
            .order_by(Analysis.created_at.desc())
        ).all()
    )
    analysis_by_doc: dict[UUID, Analysis] = {}
    for a in analyses:
        if a.document_id and a.document_id not in analysis_by_doc:
            analysis_by_doc[a.document_id] = a

    # 3. Ensure Report records exist for completed analyses
    existing_reports = list(
        db.scalars(
            select(Report)
            .join(Analysis, Report.analysis_id == Analysis.id)
            .where(Analysis.document_id.in_(doc_ids))
            .order_by(Report.created_at.desc())
        ).all()
    )
    reports_by_analysis: dict[UUID, Report] = {r.analysis_id: r for r in existing_reports}

    # Auto-create missing Report entities for completed analyses
    needs_commit = False
    for doc_id, analysis in analysis_by_doc.items():
        if analysis.id not in reports_by_analysis:
            new_rep = Report(
                id=uuid4(),
                analysis_id=analysis.id,
                format="pdf",
            )
            db.add(new_rep)
            reports_by_analysis[analysis.id] = new_rep
            needs_commit = True

    if needs_commit:
        db.commit()

    # 4. Build deterministic responses
    results: list[ReportResponse] = []
    # If explicit reports exist, list them
    handled_docs = set()
    for analysis_id, rep in reports_by_analysis.items():
        analysis = next((a for a in analyses if a.id == analysis_id), None)
        if not analysis or not analysis.document_id:
            continue
        doc = doc_map.get(analysis.document_id)
        if not doc:
            continue
        handled_docs.add(doc.id)
        results.append(
            _build_report_response_from_analysis(
                report_id=rep.id,
                doc=doc,
                analysis=analysis,
                created_at=rep.created_at,
            )
        )

    # For documents without a completed analysis yet, provide their entry
    for doc in documents:
        if doc.id not in handled_docs:
            results.append(
                _build_report_response_from_analysis(
                    report_id=uuid4(),
                    doc=doc,
                    analysis=None,
                    created_at=doc.created_at,
                )
            )

    return results


@router.post("/generate", response_model=ReportResponse, status_code=status.HTTP_200_OK)
async def generate_report(
    payload: GenerateReportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.DOCUMENT_VIEW)),
) -> ReportResponse:
    """
    Generate or retrieve a report for a specific document.
    Reuses existing completed analysis unless force=True to ensure cost control and determinism.
    """
    doc = verify_document_ownership(db=db, user=current_user, document_id=payload.document_id)

    # Reuses existing analysis if force=False
    analysis = await run_document_analysis(
        db=db,
        user=current_user,
        document_id=doc.id,
        force=payload.force,
    )

    # Check for existing report for this analysis
    report = db.scalar(select(Report).where(Report.analysis_id == analysis.id))
    if not report:
        report = Report(
            id=uuid4(),
            analysis_id=analysis.id,
            format="pdf",
        )
        db.add(report)
        db.commit()
        db.refresh(report)

    return _build_report_response_from_analysis(
        report_id=report.id,
        doc=doc,
        analysis=analysis,
        created_at=report.created_at,
    )


@router.get("/{report_id}", response_model=ReportResponse, status_code=status.HTTP_200_OK)
def get_report_by_id(
    report_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.DOCUMENT_VIEW)),
) -> ReportResponse:
    """
    Retrieve a specific report by its ID.
    Enforces ownership through parent document to prevent data leakage.
    """
    report = db.scalar(select(Report).where(Report.id == report_id))
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )

    analysis = report.analysis
    if not analysis or not analysis.document_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis for this report not found.",
        )

    doc = verify_document_ownership(db=db, user=current_user, document_id=analysis.document_id)

    return _build_report_response_from_analysis(
        report_id=report.id,
        doc=doc,
        analysis=analysis,
        created_at=report.created_at,
    )

