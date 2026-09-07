import logging
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.prompts import SYSTEM_LEGAL_ANALYSIS_PROMPT, format_document_for_analysis
from app.ai.providers import AIException, AIRequest, get_ai_provider
from app.database.models import (
    Analysis,
    Clause,
    Document,
    DocumentPage,
    DocumentVersion,
    Finding,
    Risk,
    User,
)
from app.schemas.analysis import LegalAnalysisResult
from app.services.audit import record_audit_event
from app.services.document_access import verify_document_ownership
from app.services.risk_scoring import calculate_overall_risk

logger = logging.getLogger("legalai.analysis")


async def run_document_analysis(
    db: Session,
    user: User,
    document_id: UUID,
    force: bool = False,
) -> Analysis:
    """
    Run source-grounded legal analysis on a READY document using Gemini.
    Validates against 24-section legal schema and persists relational findings.
    """
    doc = verify_document_ownership(db=db, user=user, document_id=document_id)

    # 1. State check
    if doc.processing_status != "ready":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document cannot be analyzed in status '{doc.processing_status.upper()}'. Only READY documents with extracted text can be analyzed.",
        )

    # 2. Check latest document version
    version = db.scalar(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == document_id)
        .order_by(DocumentVersion.created_at.desc())
    )
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document version not found.",
        )

    # 3. Cost control: Reuse existing completed analysis if not forced
    existing_analysis = db.scalar(
        select(Analysis)
        .where(Analysis.document_id == document_id)
        .where(Analysis.status == "completed")
        .order_by(Analysis.created_at.desc())
    )
    if existing_analysis and not force:
        logger.info("Reusing completed analysis %s for document %s", existing_analysis.id, document_id)
        return existing_analysis

    # 4. Load extracted pages
    pages = list(
        db.scalars(
            select(DocumentPage)
            .where(DocumentPage.version_id == version.id)
            .order_by(DocumentPage.page_number)
        ).all()
    )
    if not pages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document contains no extracted text pages to analyze.",
        )

    total_text = "".join(p.text for p in pages)
    if not total_text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Extracted text from document is empty.",
        )

    # 5. Create or reuse Analysis record
    analysis = Analysis(
        id=uuid4(),
        document_id=document_id,
        version_id=version.id,
        status="processing",
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    # 6. Format prompt with page boundaries & prompt injection fencing
    page_tuples = [(p.page_number, p.text) for p in pages]
    formatted_content = format_document_for_analysis(page_tuples)

    ai_request = AIRequest(
        system_instructions=SYSTEM_LEGAL_ANALYSIS_PROMPT,
        user_instructions="Extract all 24 required sections. Adhere strictly to the requested JSON schema. Use 'Not found in the provided document.' whenever information is absent.",
        document_context=[formatted_content],
    )

    # 7. Execute AI completion
    ai_provider = get_ai_provider()
    try:
        ai_response = await ai_provider.complete(ai_request)
    except AIException as ai_exc:
        analysis.status = "failed"
        analysis.error_message = ai_exc.message
        db.commit()
        logger.error(
            "AI generation failed for document %s: %s (status=%s, code=%s)",
            document_id,
            ai_exc.message,
            ai_exc.status_code,
            ai_exc.error_code,
        )
        raise HTTPException(
            status_code=ai_exc.status_code,
            detail=ai_exc.message,
        ) from ai_exc
    except Exception as exc:
        analysis.status = "failed"
        analysis.error_message = f"AI generation error: {exc}"
        db.commit()
        logger.exception("AI generation failed for document %s: %s", document_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during document analysis.",
        ) from exc

    # 8. Schema validation against LegalAnalysisResult
    import json
    import re

    def parse_json_resilient(raw_text: str) -> dict:
        text = raw_text.strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        first = text.find("{")
        last = text.rfind("}")
        if first != -1 and last != -1 and last > first:
            text = text[first : last + 1]

        # Attempt 1: Direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Attempt 2: Clean trailing commas before } or ]
        cleaned = re.sub(r",\s*([\]}])", r"\1", text)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        # Attempt 3: Insert missing commas between lines
        lines = cleaned.split("\n")
        fixed_lines = []
        for i, line in enumerate(lines):
            stripped = line.strip()
            next_line_stripped = lines[i + 1].strip() if i + 1 < len(lines) else ""
            if stripped and next_line_stripped:
                if (
                    stripped[-1] in ('"', "}", "]", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "e", "l")
                    and not stripped.endswith(",")
                    and not stripped.endswith("{")
                    and not stripped.endswith("[")
                    and (next_line_stripped.startswith('"') or next_line_stripped.startswith("{"))
                ):
                    if not stripped.endswith(":"):
                        line = line + ","
            fixed_lines.append(line)
        repaired = "\n".join(fixed_lines)
        try:
            return json.loads(repaired)
        except json.JSONDecodeError:
            pass

        # Attempt 4: Truncation recovery if output reached token limit
        for cut in range(len(cleaned), 0, -1):
            candidate = cleaned[:cut].rstrip()
            if not candidate:
                break
            if candidate.endswith(","):
                candidate = candidate[:-1].rstrip()

            open_braces = 0
            open_brackets = 0
            in_string = False
            escaped = False
            valid_syntax = True

            for ch in candidate:
                if escaped:
                    escaped = False
                    continue
                if ch == "\\":
                    escaped = True
                    continue
                if ch == '"':
                    in_string = not in_string
                    continue
                if not in_string:
                    if ch == "{":
                        open_braces += 1
                    elif ch == "}":
                        open_braces -= 1
                        if open_braces < 0:
                            valid_syntax = False
                            break
                    elif ch == "[":
                        open_brackets += 1
                    elif ch == "]":
                        open_brackets -= 1
                        if open_brackets < 0:
                            valid_syntax = False
                            break

            if in_string or not valid_syntax or open_braces < 0 or open_brackets < 0:
                continue

            test_str = candidate + ("]" * open_brackets) + ("}" * open_braces)
            try:
                return json.loads(test_str)
            except Exception:
                continue

        # Final attempt: let json.loads raise original exception with location info
        return json.loads(text)

    try:
        parsed_json = parse_json_resilient(ai_response.content)
        result = LegalAnalysisResult.model_validate(parsed_json)
    except Exception as val_exc:
        analysis.status = "failed"
        analysis.error_message = f"AI output validation error: {val_exc}"
        db.commit()
        logger.error("AI output failed schema validation for document %s: %s", document_id, val_exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI output validation error: {val_exc}",
        )

    # 9. Store structured results and individual relational entities
    analysis.status = "completed"
    analysis.summary = result.executive_summary
    structured_dict = result.model_dump()
    risk_assessment = calculate_overall_risk(result.risks)
    structured_dict["risk_assessment"] = risk_assessment
    analysis.structured_data = structured_dict
    analysis.error_message = None

    # Save Risk entities
    for r in result.risks:
        sev = r.severity.upper().strip()
        if sev not in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}:
            sev = "MEDIUM"
        db.add(
            Risk(
                id=uuid4(),
                analysis_id=analysis.id,
                title=r.title,
                severity=sev,
                explanation=r.explanation,
                evidence={
                    "source_text": r.source_text,
                    "page": r.page,
                    "section": r.section,
                    "confidence": r.confidence,
                    "suggested_review_action": r.suggested_review_action,
                },
            )
        )

    # Save Clause entities
    for c in result.important_clauses:
        db.add(
            Clause(
                id=uuid4(),
                analysis_id=analysis.id,
                name=c.title,
                source_text=c.original_text,
                evidence={
                    "clause_type": c.clause_type,
                    "explanation": c.explanation,
                    "page": c.page,
                    "section": c.section,
                    "importance": c.importance,
                    "risk_level": c.risk_level,
                    "confidence": c.confidence,
                },
            )
        )

    # Save structured findings
    db.add(
        Finding(
            id=uuid4(),
            analysis_id=analysis.id,
            kind="parties",
            value={"parties": [p.model_dump() for p in result.parties]},
        )
    )
    db.add(
        Finding(
            id=uuid4(),
            analysis_id=analysis.id,
            kind="important_dates",
            value={"dates": [d.model_dump() for d in result.important_dates]},
        )
    )
    db.add(
        Finding(
            id=uuid4(),
            analysis_id=analysis.id,
            kind="financial_terms",
            value={"terms": [f.model_dump() for f in result.financial_terms]},
        )
    )
    db.add(
        Finding(
            id=uuid4(),
            analysis_id=analysis.id,
            kind="omissions",
            value={"omissions": [m.model_dump() for m in result.missing_or_unclear_information]},
        )
    )

    db.commit()
    db.refresh(analysis)

    record_audit_event(
        db=db,
        action="document.analyze",
        resource_type="analysis",
        actor_id=user.id,
        resource_id=str(analysis.id),
        metadata={
            "document_id": str(document_id),
            "status": "completed",
            "risks_count": len(result.risks),
            "clauses_count": len(result.important_clauses),
        },
    )

    return analysis

