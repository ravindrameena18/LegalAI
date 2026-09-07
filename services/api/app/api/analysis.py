from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ai.providers import get_ai_provider
from app.database.dependencies import get_db
from app.database.models import Analysis, Clause, Document, Report, Risk, User
from app.schemas.analysis import (
    AnalysisDetailResponse,
    AnalysisResponse,
    LegalAnalysisResult,
    ProviderStatusResponse,
    WorkspaceStatsResponse,
)
from app.security.dependencies import require_permission
from app.security.permissions import Permission
from app.services.analysis_service import run_document_analysis
from app.services.document_access import verify_document_ownership

router = APIRouter()


@router.post("/documents/{document_id}/analyze", response_model=AnalysisDetailResponse, status_code=status.HTTP_200_OK)
async def analyze_document(
    document_id: UUID,
    force: bool = Query(default=False, description="Force new analysis even if a completed version exists"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.DOCUMENT_VIEW)),
) -> AnalysisDetailResponse:
    """
    Trigger source-grounded Gemini legal analysis for a READY document.
    Enforces document ownership and validates response against 24 legal sections.
    """
    analysis = await run_document_analysis(
        db=db,
        user=current_user,
        document_id=document_id,
        force=force,
    )
    return _build_analysis_detail_response(analysis=analysis, db=db)


def _build_analysis_detail_response(analysis: Analysis, db: Session) -> AnalysisDetailResponse:
    risk_count = db.scalar(
        select(func.count(Risk.id)).where(Risk.analysis_id == analysis.id)
    ) or 0
    clause_count = db.scalar(
        select(func.count(Clause.id)).where(Clause.analysis_id == analysis.id)
    ) or 0

    raw_struct = dict(analysis.structured_data) if isinstance(analysis.structured_data, dict) else {}
    risk_assessment = raw_struct.get("risk_assessment")
    if not risk_assessment:
        from app.services.risk_scoring import calculate_overall_risk
        risks_db = list(db.scalars(select(Risk).where(Risk.analysis_id == analysis.id)).all())
        risk_assessment = calculate_overall_risk(risks_db)
        raw_struct["risk_assessment"] = risk_assessment

    structured_data = LegalAnalysisResult.model_validate(raw_struct)

    return AnalysisDetailResponse(
        id=analysis.id,
        document_id=analysis.document_id,
        version_id=analysis.version_id,
        status=analysis.status,
        summary=analysis.summary or structured_data.executive_summary,
        created_at=analysis.created_at,
        updated_at=analysis.updated_at,
        error_message=analysis.error_message,
        structured_data=structured_data,
        risk_count=risk_count,
        clause_count=clause_count,
        overall_risk=risk_assessment.get("level", "LOW"),
        risk_score=risk_assessment.get("score", 0),
        risk_assessment=risk_assessment,
    )


@router.get("/documents/{document_id}/analysis", response_model=AnalysisDetailResponse, status_code=status.HTTP_200_OK)
def get_document_latest_analysis(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.DOCUMENT_VIEW)),
) -> AnalysisDetailResponse:
    """
    Retrieve the latest completed analysis for a document.
    Enforces ownership boundary.
    """
    verify_document_ownership(db=db, user=current_user, document_id=document_id)

    analysis = db.scalar(
        select(Analysis)
        .where(Analysis.document_id == document_id)
        .order_by(Analysis.created_at.desc())
    )
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No analysis found for this document.",
        )

    return _build_analysis_detail_response(analysis=analysis, db=db)


@router.get("/analyses/{analysis_id}", response_model=AnalysisDetailResponse, status_code=status.HTTP_200_OK)
def get_analysis_by_id(
    analysis_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.DOCUMENT_VIEW)),
) -> AnalysisDetailResponse:
    """
    Retrieve an analysis by its ID.
    Enforces ownership through parent document to prevent data leakage.
    """
    analysis = db.scalar(select(Analysis).where(Analysis.id == analysis_id))
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found.",
        )

    if analysis.document_id:
        verify_document_ownership(db=db, user=current_user, document_id=analysis.document_id)

    return _build_analysis_detail_response(analysis=analysis, db=db)


@router.get("/analyses", response_model=list[AnalysisResponse], status_code=status.HTTP_200_OK)
def list_analyses(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.DOCUMENT_VIEW)),
) -> list[AnalysisResponse]:
    """
    List all analyses accessible to the current user.
    """
    user_role = current_user.role.name.upper() if current_user.role else ""
    query = select(Analysis).join(Document, Analysis.document_id == Document.id)

    if user_role != "ADMIN":
        query = query.where(Document.owner_id == current_user.id)

    query = query.order_by(Analysis.created_at.desc())
    analyses = list(db.scalars(query).all())
    return [AnalysisResponse.model_validate(a) for a in analyses]


@router.get("/analysis/provider-status", response_model=ProviderStatusResponse, status_code=status.HTTP_200_OK)
def get_ai_provider_status(
    current_user: User = Depends(require_permission(Permission.DOCUMENT_VIEW)),
) -> ProviderStatusResponse:
    """
    Safe status endpoint to verify whether AI provider is configured and reachable.
    Never exposes API keys or internal credentials.
    """
    provider = get_ai_provider()
    status_info = provider.test_connection()
    return ProviderStatusResponse(
        provider=status_info.get("provider", "unconfigured"),
        model=status_info.get("model", "none"),
        configured=status_info.get("configured", False),
    )


@router.get("/stats", response_model=WorkspaceStatsResponse, status_code=status.HTTP_200_OK)
def get_workspace_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.DOCUMENT_VIEW)),
) -> WorkspaceStatsResponse:
    """
    Get live workspace statistics for the current user's dashboard.
    """
    user_role = current_user.role.name.upper() if current_user.role else ""

    doc_query = select(func.count(Document.id))
    analysis_query = select(func.count(Analysis.id)).join(Document, Analysis.document_id == Document.id).where(Analysis.status == "completed")
    risk_query = select(func.count(Risk.id)).join(Analysis, Risk.analysis_id == Analysis.id).join(Document, Analysis.document_id == Document.id)
    report_query = select(func.count(Report.id)).join(Analysis, Report.analysis_id == Analysis.id).join(Document, Analysis.document_id == Document.id)

    if user_role != "ADMIN":
        doc_query = doc_query.where(Document.owner_id == current_user.id)
        analysis_query = analysis_query.where(Document.owner_id == current_user.id)
        risk_query = risk_query.where(Document.owner_id == current_user.id)
        report_query = report_query.where(Document.owner_id == current_user.id)

    doc_count = db.scalar(doc_query) or 0
    analysis_count = db.scalar(analysis_query) or 0
    risk_count = db.scalar(risk_query) or 0
    report_count = db.scalar(report_query) or 0

    return WorkspaceStatsResponse(
        document_count=doc_count,
        analysis_count=analysis_count,
        risk_count=risk_count,
        report_count=report_count,
    )

