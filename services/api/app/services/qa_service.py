import json
import logging
import re
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.providers import AIException, AIRequest, get_ai_provider
from app.database.models import Analysis, DocumentPage, DocumentVersion, User
from app.schemas.documents import CitationSchema, DocumentQAResponse
from app.services.document_access import verify_document_ownership

logger = logging.getLogger("legalai.qa")

SYSTEM_QA_PROMPT = """You are LegalAI Document Copilot, a strict, source-grounded legal assistant.
You must answer questions based STRICTLY and ONLY on the provided legal document text and structured clauses.
NEVER hallucinate, extrapolate, or invent dates, deadlines, rates, dollar amounts, or legal terms.

IMPORTANT RULES:
1. If the document does NOT contain the answer to the user's question, you must explicitly state that the information could not be found in the provided document. Set found_in_document to false.
2. MULTILINGUAL & CONVERSATION LANGUAGE HANDLING:
   - Carefully analyze the user's question. The user may ask in English, Hindi (Devanagari script), Hinglish (Hindi written in Latin letters, e.g. "isme paise kab tak jama karwane hain", "payment kab due hai", "samapti kab hogi"), or a mix.
   - Respond in the SAME language/style as the user's question:
     - If the user asks in Hindi or Hinglish: provide a natural, professional legal Hindi answer in clean Devanagari script (e.g. "दस्तावेज़ के अनुसार, भुगतान की अंतिम तिथि ... है।").
     - If the user asks in English: provide a professional English answer (e.g. "The payment is due by ...").
     - If the information is not in the document:
       - In English: "I could not find this information in the provided document."
       - In Hindi: "प्रदान किए गए दस्तावेज़ में यह जानकारी उपलब्ध नहीं है।"
3. Output MUST be valid JSON with the following structure:
{
  "answer": "string",
  "citations": [
    {
      "page": 1,
      "section": "Section name or title",
      "title": "Clause title",
      "text": "Exact excerpt from document",
      "explanation": "Brief explanation"
    }
  ],
  "found_in_document": true,
  "language_detected": "en" | "hi",
  "risk": null | {
    "severity": "HIGH" | "MEDIUM" | "LOW",
    "title": "Risk title",
    "explanation": "Risk explanation"
  }
}
"""


def detect_query_language(text: str) -> str:
    """Detect whether query is Hindi (Devanagari or Hinglish) or English."""
    # Check for Devanagari characters
    if re.search(r"[\u0900-\u097F]", text):
        return "hi"

    # Check for common Hinglish query markers
    hinglish_markers = {
        "kab", "kya", "hai", "hain", "paise", "jama", "karwane", "karwana",
        "bhugtan", "tarikh", "samapt", "samapti", "rokna", "shart", "shartein",
        "dastavez", "isme", "ismein", "kitna", "kitne", "dena", "hoga", "hogi",
        "late", "consequence", "jurmana", "harjana", "kanoon", "adhikar",
    }
    words = set(re.findall(r"\b\w+\b", text.lower()))
    if len(words.intersection(hinglish_markers)) >= 1:
        return "hi"

    return "en"


def _fallback_semantic_qa(
    question: str,
    pages: list[DocumentPage],
    analysis: Analysis | None,
    doc_name: str,
) -> DocumentQAResponse:
    """Intelligent semantic fallback when AI provider is offline, rate-limited, or in test mode."""
    q = question.lower()
    lang = detect_query_language(question)
    struct = analysis.structured_data if analysis and isinstance(analysis.structured_data, dict) else {}

    financial_terms = struct.get("financial_terms") or []
    termination = struct.get("termination") or {}
    obligations = struct.get("obligations") or []
    risks = struct.get("risks") or []

    citations: list[CitationSchema] = []

    # 1. Liquidated damages
    if any(k in q for k in ["liquidat", "pre-estimat", "harjana", "nuksan", "jurmana", "damage"]):
        has_liquidated = False
        for p in pages:
            if "liquidated damage" in (p.text or "").lower():
                has_liquidated = True
                break

        if not has_liquidated:
            if lang == "hi":
                answer = "प्रदान किए गए दस्तावेज़ में यह जानकारी उपलब्ध नहीं है।\n\nअनुबंध में परिनिर्धारित क्षतिपूर्ति (Liquidated Damages) या पूर्व-अनुमानित उल्लंघन दंड का कोई उल्लेख नहीं है।"
            else:
                answer = "I could not find this information in the provided document.\n\nThere is no mention of liquidated damages or pre-estimated breach penalties in the agreement."
            return DocumentQAResponse(
                answer=answer,
                citations=[],
                found_in_document=False,
                language_detected=lang,
            )

    # 2. Payment terms / due dates / deposit money
    if any(k in q for k in [
        "payment", "pay", "fee", "compensation", "invoic", "billing",
        "paise", "jama", "bhugtan", "due", "deposit", "rate", "hourly", "cost", "amount"
    ]):
        if financial_terms:
            first_term = financial_terms[0]
            term_name = first_term.get("term", "Payment Terms")
            amount = first_term.get("amount_or_rate", "")
            details = first_term.get("details", "")
            page_num = first_term.get("page", 1)

            citations.append(
                CitationSchema(
                    page=page_num,
                    title=term_name,
                    text=first_term.get("source_text") or f"{amount} - {details}",
                    explanation=f"Financial provision: {term_name}",
                )
            )

            if lang == "hi":
                answer = f"दस्तावेज़ के अनुसार, भुगतान की शर्तें निम्नलिखित हैं:\n\n• **{term_name}**: {amount}\n  {details}"
            else:
                answer = f"**Payment & Financial Terms:**\n\n• **{term_name}**: {amount}\n  {details}"

            return DocumentQAResponse(
                answer=answer,
                citations=citations,
                found_in_document=True,
                language_detected=lang,
            )

        # Look in page text
        for p in pages:
            text = p.text or ""
            if any(term in text.lower() for term in ["net 30", "net 15", "payable", "$", "invoice", "payment"]):
                citations.append(
                    CitationSchema(
                        page=p.page_number,
                        title="Payment Provision",
                        text=text[:200],
                        explanation="Payment clause located in document text",
                    )
                )
                if lang == "hi":
                    answer = f"दस्तावेज़ के पृष्ठ {p.page_number} के अनुसार, भुगतान की शर्तें:\n\n> {text[:200]}"
                else:
                    answer = f"According to Page {p.page_number} of the document, the payment terms are:\n\n> {text[:200]}"
                return DocumentQAResponse(
                    answer=answer,
                    citations=citations,
                    found_in_document=True,
                    language_detected=lang,
                )

        if lang == "hi":
            answer = "प्रदान किए गए दस्तावेज़ में यह जानकारी उपलब्ध नहीं है।\n\nदस्तावेज़ में भुगतान समयसीमा या शुल्क से संबंधित कोई स्पष्ट विवरण नहीं मिला।"
        else:
            answer = "I could not find this information in the provided document.\n\nNo specific payment schedule, rates, or invoicing terms were detected in the agreement."
        return DocumentQAResponse(
            answer=answer,
            citations=[],
            found_in_document=False,
            language_detected=lang,
        )

    # 3. Termination / Cancellation
    if any(k in q for k in ["terminat", "cancel", "cure", "exit", "samapt", "khatam", "band"]):
        for_cause = termination.get("for_cause")
        notice = termination.get("notice_period")
        if for_cause or notice:
            p_num = termination.get("page", 1)
            citations.append(
                CitationSchema(
                    page=p_num,
                    title="Termination Provisions",
                    text=for_cause or notice,
                    explanation=f"Notice: {notice}",
                )
            )
            if lang == "hi":
                answer = f"दस्तावेज़ के अनुसार, समाप्ति की शर्तें:\n\n• **उचित कारण (For Cause):** {for_cause}\n• **आवश्यक नोटिस:** {notice}"
            else:
                answer = f"**Termination Provisions:**\n\n• **For Cause:** {for_cause}\n• **Required Notice:** {notice}"
            return DocumentQAResponse(
                answer=answer,
                citations=citations,
                found_in_document=True,
                language_detected=lang,
            )

    # 4. Default: Search extracted pages
    for p in pages:
        text = p.text or ""
        words = [w for w in q.split() if len(w) > 3]
        if any(w in text.lower() for w in words):
            citations.append(
                CitationSchema(
                    page=p.page_number,
                    title="Document Reference",
                    text=text[:250],
                    explanation="Matching text found on page",
                )
            )
            if lang == "hi":
                answer = f"दस्तावेज़ **{doc_name}** के अनुसार संबंधित संदर्भ:\n\n> {text[:250]}"
            else:
                answer = f"Based on **{doc_name}**, here is the relevant excerpt found on Page {p.page_number}:\n\n> {text[:250]}"
            return DocumentQAResponse(
                answer=answer,
                citations=citations,
                found_in_document=True,
                language_detected=lang,
            )

    # Not found
    if lang == "hi":
        answer = "प्रदान किए गए दस्तावेज़ में यह जानकारी उपलब्ध नहीं है।"
    else:
        answer = "I could not find this information in the provided document."
    return DocumentQAResponse(
        answer=answer,
        citations=[],
        found_in_document=False,
        language_detected=lang,
    )


async def ask_document_qa(
    db: Session,
    user: User,
    document_id: UUID,
    question: str,
) -> DocumentQAResponse:
    """
    Multilingual, document-grounded question answering using Gemini with deterministic fallback.
    """
    doc = verify_document_ownership(db=db, user=user, document_id=document_id)

    if doc.processing_status != "ready" and doc.status != "ready":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Document '{doc.name}' cannot be queried in status '{doc.processing_status.upper()}'. Only READY documents can be analyzed.",
        )

    # Load version and pages
    version = db.scalar(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == document_id)
        .order_by(DocumentVersion.created_at.desc())
    )
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document version not found.")

    pages = list(
        db.scalars(
            select(DocumentPage)
            .where(DocumentPage.version_id == version.id)
            .order_by(DocumentPage.page_number)
        ).all()
    )

    # Also retrieve latest completed analysis if present
    analysis = db.scalar(
        select(Analysis)
        .where(Analysis.document_id == document_id)
        .where(Analysis.status == "completed")
        .order_by(Analysis.created_at.desc())
    )

    # Try Gemini provider
    ai_provider = get_ai_provider()
    try:
        pages_context = [
            f"--- PAGE {p.page_number} ---\n{p.text}" for p in pages[:15]
        ]
        if analysis and isinstance(analysis.structured_data, dict):
            pages_context.append(f"--- STRUCTURED LEGAL ANALYSIS ---\n{json.dumps(analysis.structured_data)}")

        ai_req = AIRequest(
            system_instructions=SYSTEM_QA_PROMPT,
            user_instructions=f"USER QUESTION: {question.strip()}",
            document_context=pages_context,
        )

        ai_res = await ai_provider.complete(ai_req)
        raw_json = ai_res.content.strip()
        if raw_json.startswith("```"):
            raw_json = re.sub(r"^```(?:json)?\n?", "", raw_json)
            raw_json = re.sub(r"\n?```$", "", raw_json)

        parsed = json.loads(raw_json)
        citations = [
            CitationSchema(
                page=c.get("page"),
                section=c.get("section"),
                title=c.get("title"),
                text=c.get("text"),
                explanation=c.get("explanation"),
            )
            for c in parsed.get("citations", [])
        ]

        return DocumentQAResponse(
            answer=parsed.get("answer") or "Information not found.",
            citations=citations,
            found_in_document=parsed.get("found_in_document", True),
            language_detected=parsed.get("language_detected", detect_query_language(question)),
            risk=parsed.get("risk"),
        )
    except Exception as exc:
        logger.info("Using semantic fallback QA resolver: %s", exc)
        return _fallback_semantic_qa(
            question=question,
            pages=pages,
            analysis=analysis,
            doc_name=doc.name,
        )

