import difflib
import hashlib
import json
import logging
import re
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.prompts import SYSTEM_LEGAL_COMPARISON_PROMPT, format_documents_for_comparison
from app.ai.providers import AIException, AIRateLimitError, AIRequest, get_ai_provider
from app.database.models import Comparison, Document, DocumentPage, DocumentVersion, User
from app.document_processing.extractor import ExtractedPage, extract_document_text
from app.schemas.comparison import (
    ClauseComparisonItem,
    ComparisonCreateRequest,
    ComparisonMetrics,
    ComparisonResultData,
    ImportantChangeItem,
)
from app.services.audit import record_audit_event
from app.services.document_access import verify_document_ownership
from app.storage import get_storage_service

logger = logging.getLogger("legalai.comparison")


def _clean_json_str(raw_text: str) -> str:
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
    return text


def parse_comparison_json_resilient(raw_text: str) -> dict[str, Any]:
    text = _clean_json_str(raw_text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Remove trailing commas
    cleaned = re.sub(r",\s*([\]}])", r"\1", text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as err:
        logger.warning("Resilient JSON parse failed: %s", err)
        raise


def _extract_amounts(text: str) -> list[str]:
    """Extract currency and monetary amounts from text."""
    pattern = re.compile(
        r"(?:₹|Rs\.?|INR|\$|USD)\s*[\d,]+(?:\.\d+)?\s*(?:lakh|crore|million|k|thousand)?|\b\d+(?:,\d+)*(?:\.\d+)?\s*(?:lakh|crore)\b",
        re.IGNORECASE,
    )
    return [m.group(0).strip() for m in pattern.finditer(text)]


def _extract_timelines(text: str) -> list[str]:
    """Extract payment timelines, notice periods, and durations."""
    pattern = re.compile(
        r"\b(?:net\s*\d+|\d+\s*(?:business\s*|calendar\s*)?days|\d+\s*months?|\d+\s*years?)\b",
        re.IGNORECASE,
    )
    return [m.group(0).strip() for m in pattern.finditer(text)]


def _extract_jurisdictions(text: str) -> list[str]:
    """Extract common legal forums and jurisdictions."""
    pattern = re.compile(
        r"\b(?:Delhi|Mumbai|Bengaluru|Bangalore|Kolkata|Chennai|Hyderabad|New York|California|Delaware|London|England|Singapore)\b",
        re.IGNORECASE,
    )
    return [m.group(0).strip() for m in pattern.finditer(text)]


def _deterministic_structural_comparison(
    pages_a: list[Any],
    pages_b: list[Any],
    label_a: str,
    label_b: str,
) -> ComparisonResultData:
    """
    High-reliability, directional, and semantic legal comparison engine.
    Calculates change classification and legal risk based on the actual detected delta
    from Document 1 (label_a) to Document 2 (label_b).
    """
    text_a = "\n".join(p.text or "" for p in pages_a)
    text_b = "\n".join(p.text or "" for p in pages_b)

    clean_a = re.sub(r"\s+", " ", text_a).strip()
    clean_b = re.sub(r"\s+", " ", text_b).strip()

    is_identical = clean_a == clean_b

    # Core contractual topics to evaluate
    topics = [
        ("Payment Terms", [r"payment", r"invoice", r"fee", r"compensation", r"net \d+", r"remuneration", r"consideration", r"₹", r"\$"]),
        ("Term & Duration", [r"term of this agreement", r"duration", r"effective date", r"commencement", r"expiration"]),
        ("Termination", [r"terminate", r"termination for cause", r"termination for convenience", r"written notice", r"notice period"]),
        ("Limitation of Liability", [r"limitation of liability", r"liability cap", r"consequential damages", r"aggregate liability", r"indirect damages"]),
        ("Indemnification", [r"indemnif", r"hold harmless", r"defend and indemnify", r"indemnity"]),
        ("Confidentiality", [r"confidential", r"proprietary information", r"non-disclosure"]),
        ("Intellectual Property", [r"intellectual property", r"work for hire", r"ownership of work", r"patent", r"copyright"]),
        ("Governing Law", [r"governing law", r"jurisdiction", r"laws of the state", r"venue", r"courts of"]),
        ("Dispute Resolution", [r"arbitration", r"dispute resolution", r"mediation", r"arbitral tribunal"]),
        ("Non-Compete & Restrictive", [r"non-compete", r"covenant not to compete", r"non-solicitation", r"restrictive covenant"]),
        ("Force Majeure", [r"force majeure", r"acts of god", r"beyond reasonable control"]),
        ("Warranties", [r"warrant", r"as is", r"representation and warranty", r"disclaimer of warranties"]),
    ]

    clause_items: list[ClauseComparisonItem] = []
    important_changes: list[ImportantChangeItem] = []

    added_count = 0
    removed_count = 0
    modified_count = 0
    unchanged_count = 0

    if is_identical:
        for topic_name, patterns in topics:
            regex = re.compile("|".join(patterns), re.IGNORECASE)
            for p in pages_a:
                m = regex.search(p.text or "")
                if m:
                    start = max(0, m.start() - 60)
                    end = min(len(p.text or ""), m.end() + 140)
                    snip = (p.text or "")[start:end].replace("\n", " ").strip()
                    clause_items.append(
                        ClauseComparisonItem(
                            topic=topic_name,
                            clause_title=f"{topic_name} Clause",
                            change_type="unchanged",
                            risk_level="NONE",
                            risk_score=0.0,
                            risk_reason="Clause text is identical across Document 1 and Document 2.",
                            legal_impact="No legal variation between documents.",
                            doc_a_text=snip[:240],
                            doc_b_text=snip[:240],
                            document_1_text=snip[:240],
                            document_2_text=snip[:240],
                            doc_a_page=p.page_number,
                            doc_b_page=p.page_number,
                            document_1_page=p.page_number,
                            document_2_page=p.page_number,
                            doc_a_section=f"{topic_name} Clause",
                            doc_b_section=f"{topic_name} Clause",
                            change_summary=f"{topic_name} is identical in both documents.",
                        )
                    )
                    unchanged_count += 1
                    break

        summary_text = (
            f"Comparative review of baseline '{label_a}' (Document 1) against '{label_b}' (Document 2) "
            f"confirmed identical contractual terms with no material discrepancies, additions, or removals detected."
        )

        return ComparisonResultData(
            executive_summary=summary_text,
            doc_a_title=label_a,
            doc_b_title=label_b,
            metrics=ComparisonMetrics(
                total_changes=0,
                added_count=0,
                removed_count=0,
                modified_count=0,
                unchanged_count=unchanged_count,
                overall_risk_impact="LOW",
            ),
            important_changes=[],
            clause_comparisons=clause_items,
            analysis_method="document_text_comparison",
            analysis_method_label="Document Text Comparison",
            ai_status_message="Documents are identical. Analyzed via direct document text comparison.",
            comparison_source="Fresh PDF extraction",
        )

    # Process each topic
    for topic_name, patterns in topics:
        regex = re.compile("|".join(patterns), re.IGNORECASE)

        snippet_a = None
        page_a = None
        for p in pages_a:
            m = regex.search(p.text or "")
            if m:
                start = max(0, m.start() - 60)
                end = min(len(p.text or ""), m.end() + 140)
                snippet_a = (p.text or "")[start:end].replace("\n", " ").strip()
                page_a = p.page_number
                break

        snippet_b = None
        page_b = None
        for p in pages_b:
            m = regex.search(p.text or "")
            if m:
                start = max(0, m.start() - 60)
                end = min(len(p.text or ""), m.end() + 140)
                snippet_b = (p.text or "")[start:end].replace("\n", " ").strip()
                page_b = p.page_number
                break

        # Case 1: Removed in Doc 2
        if snippet_a and not snippet_b:
            removed_count += 1
            if topic_name in ["Limitation of Liability", "Indemnification", "Termination", "Confidentiality"]:
                risk = "HIGH"
                score = 8.5 if topic_name in ["Limitation of Liability", "Indemnification"] else 7.5
                reason = (
                    f"Removal of {topic_name} in {label_b} eliminates liability protections established in {label_a}, "
                    f"materially expanding legal exposure."
                )
                impact = f"Party in {label_b} loses contractual liability shield or indemnity coverage provided under {label_a}."
            elif topic_name in ["Non-Compete & Restrictive"]:
                risk = "LOW"
                score = 2.0
                reason = f"Removal of restrictive covenants in {label_b} releases post-contractual restrictions without adding legal liability."
                impact = "Releases parties from non-compete and non-solicitation restrictions."
            else:
                risk = "MEDIUM"
                score = 5.0
                reason = f"{topic_name} provision present in {label_a} is omitted from {label_b}."
                impact = f"Contractual terms governing {topic_name} are no longer codified in {label_b}."

            summary = f"{topic_name} provision found in {label_a} is absent from {label_b}."
            clause_items.append(
                ClauseComparisonItem(
                    topic=topic_name,
                    clause_title=f"{topic_name} Clause",
                    change_type="removed",
                    risk_level=risk,
                    risk_score=score,
                    risk_reason=reason,
                    legal_impact=impact,
                    doc_a_text=snippet_a[:240],
                    doc_b_text=None,
                    document_1_text=snippet_a[:240],
                    document_2_text=None,
                    doc_a_page=page_a,
                    doc_b_page=None,
                    document_1_page=page_a,
                    document_2_page=None,
                    doc_a_section=f"{topic_name} Clause",
                    doc_b_section=None,
                    change_summary=summary,
                )
            )
            important_changes.append(
                ImportantChangeItem(
                    title=f"Removed: {topic_name}",
                    category=topic_name,
                    severity=risk if risk in ["HIGH", "MEDIUM", "LOW"] else "MEDIUM",
                    description=summary,
                    legal_impact=impact,
                )
            )

        # Case 2: Added in Doc 2
        elif not snippet_a and snippet_b:
            added_count += 1
            if topic_name in ["Indemnification", "Non-Compete & Restrictive"]:
                risk = "HIGH"
                score = 8.0
                reason = (
                    f"New {topic_name} clause introduced in {label_b} creates affirmative obligations "
                    f"and restrictions not present in {label_a}."
                )
                impact = f"Imposes new legal duty or operational restriction under {topic_name} in {label_b}."
            elif topic_name in ["Limitation of Liability"]:
                risk = "MEDIUM"
                score = 4.0
                reason = f"New limitation of liability introduced in {label_b} establishes liability caps not found in {label_a}."
                impact = "Introduces maximum damages ceilings for contractual breach."
            else:
                risk = "MEDIUM"
                score = 5.0
                reason = f"New {topic_name} provision introduced in {label_b} not present in {label_a}."
                impact = f"Imposes new operational or legal duties under {topic_name} in {label_b}."

            summary = f"New {topic_name} provision introduced in {label_b}."
            clause_items.append(
                ClauseComparisonItem(
                    topic=topic_name,
                    clause_title=f"{topic_name} Clause",
                    change_type="added",
                    risk_level=risk,
                    risk_score=score,
                    risk_reason=reason,
                    legal_impact=impact,
                    doc_a_text=None,
                    doc_b_text=snippet_b[:240],
                    document_1_text=None,
                    document_2_text=snippet_b[:240],
                    doc_a_page=None,
                    doc_b_page=page_b,
                    document_1_page=None,
                    document_2_page=page_b,
                    doc_a_section=None,
                    doc_b_section=f"{topic_name} Clause",
                    change_summary=summary,
                )
            )
            important_changes.append(
                ImportantChangeItem(
                    title=f"Newly Added: {topic_name}",
                    category=topic_name,
                    severity=risk if risk in ["HIGH", "MEDIUM", "LOW"] else "MEDIUM",
                    description=summary,
                    legal_impact=impact,
                )
            )

        # Case 3: Present in both
        elif snippet_a and snippet_b:
            snip_clean_a = re.sub(r"\s+", " ", snippet_a).strip()
            snip_clean_b = re.sub(r"\s+", " ", snippet_b).strip()

            if snip_clean_a.lower() == snip_clean_b.lower():
                unchanged_count += 1
                clause_items.append(
                    ClauseComparisonItem(
                        topic=topic_name,
                        clause_title=f"{topic_name} Clause",
                        change_type="unchanged",
                        risk_level="NONE",
                        risk_score=0.0,
                        risk_reason=f"{topic_name} terms remain consistent across both versions.",
                        legal_impact="No material change in legal obligations or exposure.",
                        doc_a_text=snippet_a[:240],
                        doc_b_text=snippet_b[:240],
                        document_1_text=snippet_a[:240],
                        document_2_text=snippet_b[:240],
                        doc_a_page=page_a,
                        doc_b_page=page_b,
                        document_1_page=page_a,
                        document_2_page=page_b,
                        doc_a_section=f"{topic_name} Clause",
                        doc_b_section=f"{topic_name} Clause",
                        change_summary=f"{topic_name} remains substantially consistent across both versions.",
                    )
                )
            else:
                modified_count += 1
                amt_a = _extract_amounts(snippet_a)
                amt_b = _extract_amounts(snippet_b)
                tl_a = _extract_timelines(snippet_a)
                tl_b = _extract_timelines(snippet_b)
                jur_a = _extract_jurisdictions(snippet_a)
                jur_b = _extract_jurisdictions(snippet_b)

                # 1. Check Amount differences
                if amt_a and amt_b and amt_a[0].lower().strip() != amt_b[0].lower().strip():
                    val_a = amt_a[0].strip()
                    val_b = amt_b[0].strip()
                    risk = "HIGH"
                    score = 8.5
                    reason = f"Payment obligation altered from {val_a} in {label_a} to {val_b} in {label_b}, representing a material change in financial consideration."
                    impact = f"Directly alters financial consideration and monetary exposure ({val_a} → {val_b})."
                    summary = f"{topic_name} amount modified from {val_a} in {label_a} to {val_b} in {label_b}."

                # 2. Check Timeline differences
                elif tl_a and tl_b and tl_a[0].lower().strip() != tl_b[0].lower().strip():
                    t_a = tl_a[0].strip()
                    t_b = tl_b[0].strip()
                    risk = "HIGH" if any(kw in snippet_a.lower() for kw in ["net ", "termination", "terminate"]) else "MEDIUM"
                    score = 7.0 if risk == "HIGH" else 5.0
                    reason = f"Timeline adjusted from {t_a} in {label_a} to {t_b} in {label_b}, impacting performance deadlines."
                    impact = f"Shifts operational deadlines and acceleration triggers ({t_a} → {t_b})."
                    summary = f"{topic_name} timeline modified from {t_a} in {label_a} to {t_b} in {label_b}."

                # 3. Check Jurisdiction differences
                elif jur_a and jur_b and jur_a[0].lower().strip() != jur_b[0].lower().strip():
                    j_a = jur_a[0].strip()
                    j_b = jur_b[0].strip()
                    risk = "HIGH"
                    score = 8.0
                    reason = f"Governing jurisdiction changed from {j_a} in {label_a} to {j_b} in {label_b}, altering judicial forum and governing law."
                    impact = f"Alters choice-of-law and dispute venue enforcement ({j_a} → {j_b})."
                    summary = f"Governing jurisdiction shifted from {j_a} to {j_b}."

                # 4. Check Termination convenience
                elif topic_name == "Termination" and "convenience" in snippet_b.lower() and "convenience" not in snippet_a.lower():
                    risk = "HIGH"
                    score = 8.0
                    reason = f"{label_b} introduces unilateral termination for convenience, removing the cause requirement from {label_a}."
                    impact = "Allows termination without default, substantially reducing contract stability."
                    summary = f"Termination for convenience introduced in {label_b}."

                # 5. General text diff
                else:
                    ratio = difflib.SequenceMatcher(None, snip_clean_a, snip_clean_b).ratio()
                    if ratio >= 0.88:
                        risk = "LOW"
                        score = 2.0
                        reason = f"Minor textual phrasing adjustments in {topic_name} without altering substantive legal duties."
                        impact = "Clarification of wording without shifting contractual risk."
                        summary = f"Minor phrasing adjustments to {topic_name}."
                    elif topic_name in ["Limitation of Liability", "Indemnification", "Termination", "Payment Terms"]:
                        risk = "HIGH"
                        score = 7.5
                        reason = f"Wording and obligations under {topic_name} were significantly revised from {label_a} to {label_b}."
                        impact = f"Modifies legal liability and risk allocation for {topic_name}."
                        summary = f"Substantive terms governing {topic_name} revised between versions."
                    else:
                        risk = "MEDIUM"
                        score = 5.0
                        reason = f"Terms governing {topic_name} were modified from {label_a} to {label_b}."
                        impact = f"Modifies operational and compliance standards under {topic_name}."
                        summary = f"Language governing {topic_name} was revised between versions."

                clause_items.append(
                    ClauseComparisonItem(
                        topic=topic_name,
                        clause_title=f"{topic_name} Clause",
                        change_type="modified",
                        risk_level=risk,
                        risk_score=score,
                        risk_reason=reason,
                        legal_impact=impact,
                        doc_a_text=snippet_a[:240],
                        doc_b_text=snippet_b[:240],
                        document_1_text=snippet_a[:240],
                        document_2_text=snippet_b[:240],
                        doc_a_page=page_a,
                        doc_b_page=page_b,
                        document_1_page=page_a,
                        document_2_page=page_b,
                        doc_a_section=f"{topic_name} Clause",
                        doc_b_section=f"{topic_name} Clause",
                        change_summary=summary,
                    )
                )
                if risk in ["HIGH", "MEDIUM"]:
                    important_changes.append(
                        ImportantChangeItem(
                            title=f"Modified: {topic_name}",
                            category=topic_name,
                            severity=risk if risk in ["HIGH", "MEDIUM", "LOW"] else "MEDIUM",
                            description=summary,
                            legal_impact=impact,
                        )
                    )

    total_changes = added_count + removed_count + modified_count
    if any(c.risk_level == "HIGH" for c in clause_items):
        overall_risk = "HIGH"
    elif any(c.risk_level == "MEDIUM" for c in clause_items) or total_changes > 0:
        overall_risk = "MEDIUM"
    else:
        overall_risk = "LOW"

    high_risk_topics = [c.topic for c in clause_items if c.risk_level == "HIGH"]
    highlights = f" High-risk modifications identified in: {', '.join(high_risk_topics[:3])}." if high_risk_topics else ""

    summary_text = (
        f"Comparative review of baseline '{label_a}' (Document 1) against revision '{label_b}' (Document 2) "
        f"identified {total_changes} distinct changes ({added_count} additions, {removed_count} removals, "
        f"and {modified_count} modifications). Overall risk impact is classified as {overall_risk}.{highlights}"
    )

    return ComparisonResultData(
        executive_summary=summary_text,
        doc_a_title=label_a,
        doc_b_title=label_b,
        metrics=ComparisonMetrics(
            total_changes=total_changes,
            added_count=added_count,
            removed_count=removed_count,
            modified_count=modified_count,
            unchanged_count=unchanged_count,
            overall_risk_impact=overall_risk,
        ),
        important_changes=important_changes,
        clause_comparisons=clause_items,
        analysis_method="document_text_comparison",
        analysis_method_label="Document Text Comparison",
        ai_status_message="Text comparison only — AI legal analysis unavailable.",
        comparison_source="Fresh PDF extraction",
    )


async def run_document_comparison(
    db: Session,
    user: User,
    request: ComparisonCreateRequest,
) -> Comparison:
    """
    Compares Document 1 (Doc A) against Document 2 (Doc B).
    Retrieves the actual PDF files from storage, freshly extracts text,
    computes content hashes, evaluates legal differences, handles same-doc comparisons,
    honestly surfaces AI analysis status, and persists comparison results.
    """
    is_same_document_id = request.doc_a_id == request.doc_b_id

    # 1. RBAC ownership / access validation
    doc_a = verify_document_ownership(db=db, user=user, document_id=request.doc_a_id)
    doc_b = doc_a if is_same_document_id else verify_document_ownership(db=db, user=user, document_id=request.doc_b_id)

    # 2. Status checks
    if doc_a.processing_status == "password_required" or doc_a.status == "password_required":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document '{doc_a.name}' is password-protected. Unlock it before comparing.",
        )
    if doc_b.processing_status == "password_required" or doc_b.status == "password_required":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document '{doc_b.name}' is password-protected. Unlock it before comparing.",
        )

    if doc_a.processing_status != "ready":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document '{doc_a.name}' is currently in status '{doc_a.processing_status.upper()}'. Both documents must be in READY status to compare.",
        )
    if doc_b.processing_status != "ready":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document '{doc_b.name}' is currently in status '{doc_b.processing_status.upper()}'. Both documents must be in READY status to compare.",
        )

    # 3. Fetch latest versions
    version_a = db.scalar(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == doc_a.id)
        .order_by(DocumentVersion.created_at.desc())
    )
    version_b = version_a if is_same_document_id else db.scalar(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == doc_b.id)
        .order_by(DocumentVersion.created_at.desc())
    )

    if not version_a or not version_b:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document version record could not be found for comparison.",
        )

    # 4. Retrieve actual current files from storage & compute content hashes
    storage = get_storage_service()
    try:
        content_a = storage.get_file(version_a.storage_key)
    except Exception as exc:
        logger.error("Failed to read Document 1 from storage key=%s: %s", version_a.storage_key, exc)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stored file for Document '{doc_a.name}' not found in storage.",
        ) from exc

    try:
        content_b = content_a if is_same_document_id else storage.get_file(version_b.storage_key)
    except Exception as exc:
        logger.error("Failed to read Document 2 from storage key=%s: %s", version_b.storage_key, exc)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stored file for Document '{doc_b.name}' not found in storage.",
        ) from exc

    file_hash_a = hashlib.sha256(content_a).hexdigest()
    file_hash_b = file_hash_a if is_same_document_id else hashlib.sha256(content_b).hexdigest()

    # 5. Extract text: attempt fresh extraction from current file bytes,
    # or reuse trusted processed document content for already-unlocked READY protected documents
    is_protected_a = bool(doc_a.is_encrypted)
    is_protected_b = bool(doc_b.is_encrypted)
    source_a = "Fresh PDF extraction"
    source_b = "Fresh PDF extraction"

    extraction_a = extract_document_text(content_a, doc_a.file_type)
    if extraction_a.status == "password_required":
        is_protected_a = True
        # If the document was already unlocked during upload/process and is in READY state, reuse processed pages
        if doc_a.processing_status == "ready" or doc_a.status == "ready":
            db_pages_a = list(
                db.scalars(
                    select(DocumentPage)
                    .where(DocumentPage.version_id == version_a.id)
                    .order_by(DocumentPage.page_number)
                ).all()
            )
            if db_pages_a and any((p.text or "").strip() for p in db_pages_a):
                pages_a = [ExtractedPage(page_number=p.page_number, text=p.text or "") for p in db_pages_a]
                source_a = "processed document content"
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Document '{doc_a.name}' is password-protected. Unlock it before comparing.",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Document '{doc_a.name}' is password-protected. Unlock it before comparing.",
            )
    elif extraction_a.pages and any((p.text or "").strip() for p in extraction_a.pages):
        pages_a = extraction_a.pages
        source_a = "Fresh PDF extraction"
    else:
        db_pages_a = list(
            db.scalars(
                select(DocumentPage)
                .where(DocumentPage.version_id == version_a.id)
                .order_by(DocumentPage.page_number)
            ).all()
        )
        pages_a = [ExtractedPage(page_number=p.page_number, text=p.text or "") for p in db_pages_a]
        source_a = "processed document content"

    if is_same_document_id:
        extraction_b = extraction_a
        is_protected_b = is_protected_a
        pages_b = pages_a
        source_b = source_a
    else:
        extraction_b = extract_document_text(content_b, doc_b.file_type)
        if extraction_b.status == "password_required":
            is_protected_b = True
            if doc_b.processing_status == "ready" or doc_b.status == "ready":
                db_pages_b = list(
                    db.scalars(
                        select(DocumentPage)
                        .where(DocumentPage.version_id == version_b.id)
                        .order_by(DocumentPage.page_number)
                    ).all()
                )
                if db_pages_b and any((p.text or "").strip() for p in db_pages_b):
                    pages_b = [ExtractedPage(page_number=p.page_number, text=p.text or "") for p in db_pages_b]
                    source_b = "processed document content"
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Document '{doc_b.name}' is password-protected. Unlock it before comparing.",
                    )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Document '{doc_b.name}' is password-protected. Unlock it before comparing.",
                )
        elif extraction_b.pages and any((p.text or "").strip() for p in extraction_b.pages):
            pages_b = extraction_b.pages
            source_b = "Fresh PDF extraction"
        else:
            db_pages_b = list(
                db.scalars(
                    select(DocumentPage)
                    .where(DocumentPage.version_id == version_b.id)
                    .order_by(DocumentPage.page_number)
                ).all()
            )
            pages_b = [ExtractedPage(page_number=p.page_number, text=p.text or "") for p in db_pages_b]
            source_b = "processed document content"

    if not pages_a or not pages_b:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or both documents do not contain extracted text pages.",
        )

    label_a = (request.doc_a_label or "").strip() or doc_a.name
    label_b = (request.doc_b_label or "").strip() or doc_b.name

    text_len_a = sum(len(p.text or "") for p in pages_a)
    text_len_b = sum(len(p.text or "") for p in pages_b)

    clean_all_a = re.sub(r"\s+", " ", "\n".join(p.text or "" for p in pages_a)).strip()
    clean_all_b = clean_all_a if is_same_document_id else re.sub(r"\s+", " ", "\n".join(p.text or "" for p in pages_b)).strip()

    is_identical_content = (
        is_same_document_id
        or file_hash_a == file_hash_b
        or clean_all_a == clean_all_b
    )

    comparison_data: ComparisonResultData | None = None
    ai_method: Any = "document_text_comparison"
    ai_method_label = "Document Text Comparison"
    ai_status_msg: str | None = None
    ai_analysis_log = "Local comparison"

    if is_identical_content:
        logger.info("Documents contain identical content. Utilizing deterministic comparison fast-path.")
        comparison_data = _deterministic_structural_comparison(
            pages_a=pages_a,
            pages_b=pages_b,
            label_a=label_a,
            label_b=label_b,
        )
        ai_method = "document_text_comparison"
        ai_method_label = "Document Text Comparison"
        ai_status_msg = "Documents are identical. Analyzed via direct document text comparison."
        ai_analysis_log = "Local comparison (Identical Documents)"
    else:
        # 6. Run AI comparison with structured prompt
        page_tuples_a = [(p.page_number, p.text) for p in pages_a]
        page_tuples_b = [(p.page_number, p.text) for p in pages_b]
        formatted_context = format_documents_for_comparison(
            page_tuples_a,
            page_tuples_b,
            doc_a_label=label_a,
            doc_b_label=label_b,
        )

        ai_request = AIRequest(
            system_instructions=SYSTEM_LEGAL_COMPARISON_PROMPT,
            user_instructions=(
                f"Compare baseline '{label_a}' (Document 1) against revised '{label_b}' (Document 2). "
                "Identify added, removed, and modified clauses with grounded page numbers and risk classifications."
            ),
            document_context=[formatted_context],
        )

        ai_provider = get_ai_provider()
        ai_success = False

        try:
            ai_response = await ai_provider.complete(ai_request)
            parsed_dict = parse_comparison_json_resilient(ai_response.content)
            # Inject resolved titles if missing
            if "doc_a_title" not in parsed_dict:
                parsed_dict["doc_a_title"] = label_a
            if "doc_b_title" not in parsed_dict:
                parsed_dict["doc_b_title"] = label_b
            comparison_data = ComparisonResultData.model_validate(parsed_dict)
            ai_method = "ai_analyzed"
            ai_method_label = "AI Analysis"
            ai_status_msg = None
            ai_analysis_log = "Gemini"
            ai_success = True
        except AIRateLimitError as rate_exc:
            logger.warning("Gemini rate limit or quota exceeded during comparison: %s", rate_exc)
            ai_method = "ai_unavailable"
            ai_method_label = "Text comparison only — AI legal analysis unavailable"
            ai_status_msg = (
                "AI comparison analysis is temporarily unavailable because the AI service quota/rate limit has been reached. "
                "The documents were not analyzed using stale results."
            )
            ai_analysis_log = "Unavailable (Quota/Rate Limit)"
        except Exception as exc:
            logger.warning(
                "AI provider unavailable during comparison (%s). Using deterministic structural comparison fallback.",
                exc,
            )
            ai_method = "document_text_comparison"
            ai_method_label = "Text comparison only — AI legal analysis unavailable"
            ai_status_msg = "Text comparison only — AI legal analysis unavailable."
            ai_analysis_log = "Local comparison (AI Unavailable)"

        if not ai_success:
            comparison_data = _deterministic_structural_comparison(
                pages_a=pages_a,
                pages_b=pages_b,
                label_a=label_a,
                label_b=label_b,
            )

    # Inject source tracking & hashes into comparison_data
    comparison_data.analysis_method = ai_method
    comparison_data.analysis_method_label = ai_method_label
    comparison_data.ai_status_message = ai_status_msg
    comparison_data.doc_a_file_hash = file_hash_a
    comparison_data.doc_b_file_hash = file_hash_b
    if source_a == "processed document content" and source_b == "processed document content":
        comp_source = "Processed document content"
    elif source_a == "processed document content" or source_b == "processed document content":
        comp_source = "Processed document content & Fresh PDF extraction"
    else:
        comp_source = "Fresh PDF extraction"
    comparison_data.comparison_source = comp_source

    # Development mode safe diagnostic log (Section 13 requirement)
    has_extracted_a = bool(pages_a and any((p.text or "").strip() for p in pages_a))
    has_extracted_b = bool(pages_b and any((p.text or "").strip() for p in pages_b))

    logger.info(
        "COMPARE DOCUMENT\n"
        "Document ID: %s\n"
        "Status: %s\n"
        "Password protected: %s\n"
        "Extracted content available: %s\n"
        "Comparison source: %s",
        str(doc_a.id),
        doc_a.processing_status.upper(),
        "true" if is_protected_a else "false",
        "true" if has_extracted_a else "false",
        source_a,
    )

    if not is_same_document_id:
        logger.info(
            "COMPARE DOCUMENT\n"
            "Document ID: %s\n"
            "Status: %s\n"
            "Password protected: %s\n"
            "Extracted content available: %s\n"
            "Comparison source: %s",
            str(doc_b.id),
            doc_b.processing_status.upper(),
            "true" if is_protected_b else "false",
            "true" if has_extracted_b else "false",
            source_b,
        )

    logger.info(
        "COMPARE REQUEST\n"
        "Document 1 ID: %s\n"
        "Document 2 ID: %s\n\n"
        "Document 1 file: %s\n"
        "Document 2 file: %s\n\n"
        "Document 1 content hash: %s\n"
        "Document 2 content hash: %s\n\n"
        "Extracted pages:\n"
        "Document 1: %d\n"
        "Document 2: %d\n\n"
        "Extracted text length:\n"
        "Document 1: %d chars\n"
        "Document 2: %d chars\n\n"
        "Comparison source:\n"
        "%s\n\n"
        "AI analysis:\n"
        "%s",
        doc_a.id,
        doc_b.id,
        doc_a.name,
        doc_b.name,
        file_hash_a,
        file_hash_b,
        len(pages_a),
        len(pages_b),
        text_len_a,
        text_len_b,
        comp_source,
        ai_analysis_log,
    )

    logger.info(
        "Comparison generated:\n"
        "%d clauses\n\n"
        "Risk calculated:\n"
        "%s",
        len(comparison_data.clause_comparisons),
        comparison_data.metrics.overall_risk_impact,
    )

    # 7. Persist Comparison record
    comparison = Comparison(
        id=uuid4(),
        user_id=user.id,
        doc_a_id=doc_a.id,
        doc_b_id=doc_b.id,
        doc_a_label=label_a,
        doc_b_label=label_b,
        status="completed",
        result_data=comparison_data.model_dump(),
    )
    try:
        db.add(comparison)
        db.commit()
        db.refresh(comparison)
    except Exception as exc:
        db.rollback()
        logger.exception(
            "Failed to save comparison record to database for user=%s doc_a=%s doc_b=%s: %s",
            user.id,
            doc_a.id,
            doc_b.id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error while saving comparison: {exc}",
        ) from exc

    # 8. Record audit log
    record_audit_event(
        db=db,
        actor_id=user.id,
        action="comparison.create",
        resource_type="comparison",
        resource_id=str(comparison.id),
        metadata={
            "doc_a_id": str(doc_a.id),
            "doc_b_id": str(doc_b.id),
            "doc_a_label": label_a,
            "doc_b_label": label_b,
            "total_changes": comparison_data.metrics.total_changes,
        },
    )

    return comparison


def get_comparison_by_id(db: Session, user: User, comparison_id: UUID) -> Comparison:
    """
    Retrieve a comparison by ID, verifying user permissions.
    """
    comparison = db.scalar(select(Comparison).where(Comparison.id == comparison_id))
    if not comparison:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comparison not found.",
        )

    user_role = getattr(user.role, "name", str(user.role)).upper()
    if user_role != "ADMIN" and comparison.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access to this comparison is forbidden.",
        )

    return comparison


def list_user_comparisons(db: Session, user: User) -> list[Comparison]:
    """
    List previous comparisons for the current user (or all if ADMIN).
    """
    user_role = getattr(user.role, "name", str(user.role)).upper()
    stmt = select(Comparison)
    if user_role != "ADMIN":
        stmt = stmt.where(Comparison.user_id == user.id)
    stmt = stmt.order_by(Comparison.created_at.desc())
    return list(db.scalars(stmt).all())

