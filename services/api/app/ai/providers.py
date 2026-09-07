import logging
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Protocol

from app.core.config import get_settings

logger = logging.getLogger("legalai.ai")


@dataclass(frozen=True)
class AIRequest:
    system_instructions: str
    user_instructions: str
    document_context: Sequence[str]


@dataclass(frozen=True)
class AIResponse:
    content: str
    citations: Sequence[str] = ()


class AIException(Exception):
    def __init__(self, message: str, status_code: int = 502, error_code: str = "ai_error") -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code


class AIAuthenticationError(AIException):
    def __init__(self, message: str = "Gemini API authentication failed. Verify GEMINI_API_KEY.") -> None:
        super().__init__(message, status_code=502, error_code="invalid_api_key")


class AIModelNotFoundError(AIException):
    def __init__(self, model: str) -> None:
        super().__init__(
            f"Configured Gemini model '{model}' is not available. Google recommends using gemini-3.6-flash.",
            status_code=502,
            error_code="model_not_found",
        )


class AIRateLimitError(AIException):
    def __init__(self, message: str = "Gemini API rate limit or quota exceeded. Please wait a moment and try again.") -> None:
        super().__init__(message, status_code=429, error_code="rate_limit_exceeded")


class AIServiceUnavailableError(AIException):
    def __init__(self, message: str = "Gemini API is temporarily experiencing high demand. Please retry in a few moments.") -> None:
        super().__init__(message, status_code=503, error_code="service_unavailable")


class AITimeoutError(AIException):
    def __init__(self, message: str = "Gemini API request timed out after 60 seconds. Please retry.") -> None:
        super().__init__(message, status_code=504, error_code="gateway_timeout")


class AIProvider(Protocol):
    async def complete(self, request: AIRequest) -> AIResponse: ...
    def test_connection(self) -> dict[str, Any]: ...


class GeminiProvider:
    """
    Google Gemini AI Provider implementing the official google-genai SDK.
    Enforces structured JSON responses, temperature control, and isolated untrusted text.
    """

    def __init__(self, api_key: str, model: str = "gemini-3.6-flash") -> None:
        from google import genai

        self.model = model
        self._api_key = api_key
        # Never store or log api_key in plain attribute logs
        self._client = genai.Client(api_key=api_key)

    async def complete(self, request: AIRequest) -> AIResponse:
        import asyncio
        from google.genai import errors, types

        prompt_parts: list[str] = []
        if request.document_context:
            prompt_parts.extend(request.document_context)
        if request.user_instructions:
            prompt_parts.append(request.user_instructions)

        full_prompt = "\n\n".join(prompt_parts)

        config = types.GenerateContentConfig(
            system_instruction=request.system_instructions,
            response_mime_type="application/json",
            temperature=0.0,  # Zero temperature for deterministic source-grounded legal accuracy
            seed=42,  # Deterministic seed for reproducible risk classification
            max_output_tokens=8192,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )

        models_to_try = [self.model]
        for fallback in ["gemini-3.5-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-flash-latest"]:
            if fallback not in models_to_try:
                models_to_try.append(fallback)

        last_exception: Exception | None = None
        for current_model in models_to_try:
            for attempt in range(2):
                try:
                    response = await asyncio.wait_for(
                        self._client.aio.models.generate_content(
                            model=current_model,
                            contents=full_prompt,
                            config=config,
                        ),
                        timeout=50.0,
                    )
                    raw_text = response.text or "{}"
                    return AIResponse(content=raw_text, citations=())
                except TimeoutError as exc:
                    logger.warning("Gemini completion timed out on model %s (attempt %s)", current_model, attempt + 1)
                    last_exception = AITimeoutError()
                    break
                except errors.APIError as api_exc:
                    code = getattr(api_exc, "code", None)
                    raw_msg = str(getattr(api_exc, "message", api_exc))
                    if self._api_key and self._api_key in raw_msg:
                        raw_msg = raw_msg.replace(self._api_key, "[REDACTED]")

                    logger.warning("Gemini API error on model %s (code %s): %s", current_model, code, raw_msg)
                    if code == 404:
                        last_exception = AIModelNotFoundError(current_model)
                        break
                    elif code in (401, 403):
                        raise AIAuthenticationError() from api_exc
                    elif code == 429:
                        last_exception = AIRateLimitError()
                        break
                    elif code == 503:
                        last_exception = AIServiceUnavailableError()
                        if attempt == 0:
                            await asyncio.sleep(2.0)
                            continue
                        break
                    else:
                        last_exception = AIException(f"Gemini API error ({code}): {raw_msg}", status_code=502)
                        break
                except Exception as exc:
                    if isinstance(exc, AIException):
                        raise
                    clean_err = str(exc)
                    if self._api_key and self._api_key in clean_err:
                        clean_err = clean_err.replace(self._api_key, "[REDACTED]")
                    logger.exception("Unexpected AI generation error on model %s: %s", current_model, clean_err)
                    last_exception = AIException(f"AI generation failed: {clean_err}", status_code=500)
                    break

        if last_exception:
            raise last_exception
        raise AIException("AI analysis could not be completed.", status_code=502)

    def test_connection(self) -> dict[str, Any]:
        """
        Verify Gemini API key validity with a lightweight call.
        Strictly never exposes the secret key in return values or exceptions.
        """
        from google.genai import types

        try:
            res = self._client.models.generate_content(
                model=self.model,
                contents="Respond with the exact word: OK",
                config=types.GenerateContentConfig(
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True)
                ),
            )
            text = (res.text or "").strip()
            return {
                "configured": True,
                "provider": "gemini",
                "model": self.model,
                "status": "healthy",
                "test_reply": text[:10],
            }
        except Exception as exc:
            clean_err = str(exc)
            if self._api_key and self._api_key in clean_err:
                clean_err = clean_err.replace(self._api_key, "[REDACTED]")
            logger.warning("Gemini connection test failed: %s", clean_err)
            return {
                "configured": True,
                "provider": "gemini",
                "model": self.model,
                "status": "error",
                "error": f"Failed to connect to Gemini API: {clean_err}",
            }


class UnconfiguredAIProvider:
    def __init__(self, message: str = "GEMINI_API_KEY is not configured.") -> None:
        self.message = message

    async def complete(self, request: AIRequest) -> AIResponse:
        raise AIAuthenticationError(self.message)

    def test_connection(self) -> dict[str, Any]:
        return {
            "configured": False,
            "provider": "unconfigured",
            "model": "none",
            "status": "unconfigured",
            "error": self.message,
        }


class MockAIProvider:
    """Mock provider for unit tests returning deterministic 24-section legal analysis."""

    def __init__(self, custom_response_json: str | None = None) -> None:
        self.custom_response = custom_response_json

    async def complete(self, request: AIRequest) -> AIResponse:
        if self.custom_response:
            return AIResponse(content=self.custom_response)

        if "comparison" in request.system_instructions.lower() or "redlining" in request.system_instructions.lower():
            mock_comparison_json = """{
                "executive_summary": "Comparison between Document 1 and Document 2 indicates key modifications in liability allocation, indemnification scope, and payment milestones.",
                "metrics": {
                    "total_changes": 4,
                    "added_count": 1,
                    "removed_count": 1,
                    "modified_count": 2,
                    "unchanged_count": 5,
                    "overall_risk_impact": "MEDIUM"
                },
                "important_changes": [
                    {
                        "title": "Expanded Indemnification Scope",
                        "category": "Risk/Liability",
                        "severity": "HIGH",
                        "description": "Document 2 includes broad third-party IP indemnity without reciprocal coverage.",
                        "legal_impact": "Increases commercial liability exposure for the contractor."
                    },
                    {
                        "title": "Shortened Payment Window",
                        "category": "Financial",
                        "severity": "MEDIUM",
                        "description": "Payment term changed from Net 30 to Net 15 days.",
                        "legal_impact": "Tightens invoice approval and disbursement timelines."
                    }
                ],
                "clause_comparisons": [
                    {
                        "topic": "Payment Terms",
                        "change_type": "modified",
                        "risk_level": "MEDIUM",
                        "doc_a_text": "Invoices shall be payable within thirty (30) days of receipt.",
                        "doc_b_text": "Invoices shall be payable within fifteen (15) days of receipt.",
                        "doc_a_page": 1,
                        "doc_b_page": 1,
                        "doc_a_section": "Section 3.1",
                        "doc_b_section": "Section 3.1",
                        "change_summary": "Payment schedule accelerated from Net 30 to Net 15."
                    },
                    {
                        "topic": "Limitation of Liability",
                        "change_type": "modified",
                        "risk_level": "HIGH",
                        "doc_a_text": "Liability capped at 12 months aggregate fees paid.",
                        "doc_b_text": "Liability capped at 2x aggregate contract value with carveouts for IP infringement.",
                        "doc_a_page": 2,
                        "doc_b_page": 2,
                        "doc_a_section": "Section 7",
                        "doc_b_section": "Section 7",
                        "change_summary": "Cap increased to 2x aggregate value and IP breaches uncapped."
                    },
                    {
                        "topic": "Non-Compete Covenant",
                        "change_type": "removed",
                        "risk_level": "LOW",
                        "doc_a_text": "Contractor shall not engage in competing legal services for 12 months.",
                        "doc_b_text": null,
                        "doc_a_page": 2,
                        "doc_b_page": null,
                        "doc_a_section": "Section 8",
                        "doc_b_section": null,
                        "change_summary": "12-month non-compete restriction was completely removed in Document 2."
                    },
                    {
                        "topic": "Data Protection & Audit",
                        "change_type": "added",
                        "risk_level": "MEDIUM",
                        "doc_a_text": null,
                        "doc_b_text": "Customer shall have the right to conduct an annual security audit upon 5 days notice.",
                        "doc_a_page": null,
                        "doc_b_page": 3,
                        "doc_a_section": null,
                        "doc_b_section": "Section 10",
                        "change_summary": "New security audit clause added granting annual audit rights."
                    }
                ]
            }"""
            return AIResponse(content=mock_comparison_json)

        # Default valid 24-section legal mock response
        mock_json = """{
            "executive_summary": "Standard Mutual Non-Disclosure Agreement governing proprietary disclosures.",
            "document_type": "Mutual Non-Disclosure Agreement",
            "parties": [
                {"name": "Disclosing Party Corp", "role": "Discloser", "notice_address": "100 Market St, SF, CA"},
                {"name": "Receiving Party LLC", "role": "Recipient", "notice_address": "200 Pine St, SF, CA"}
            ],
            "important_dates": [
                {"title": "Effective Date", "date": "January 1, 2026", "source_text": "Effective as of January 1, 2026", "page": 1}
            ],
            "financial_terms": [
                {"term": "Consideration", "amount_or_rate": "Mutual covenants", "details": "No direct fees", "source_text": "in consideration of mutual promises", "page": 1}
            ],
            "obligations": [
                {"party": "Receiving Party", "obligation": "Maintain confidentiality using reasonable care", "deadline": null, "source_text": "shall hold in strict confidence", "page": 1}
            ],
            "rights": [
                {"party": "Discloser", "right": "Demand immediate return of confidential materials", "conditions": "Upon written request", "source_text": "promptly return all materials upon demand", "page": 1}
            ],
            "termination": {
                "for_cause": "Immediate upon breach",
                "for_convenience": "30 days prior written notice",
                "notice_period": "30 days",
                "consequences": "Return or destroy confidential information",
                "source_text": "either party may terminate with thirty (30) days notice",
                "page": 1
            },
            "renewal": {
                "type": "Not found in the provided document.",
                "terms": "Not found in the provided document.",
                "notice_window": "Not found in the provided document.",
                "source_text": null,
                "page": null
            },
            "confidentiality": {
                "definition_scope": "All non-public proprietary technical and business data",
                "duration": "3 years from disclosure date",
                "standard_exclusions": "Public knowledge, already known, independently developed",
                "source_text": "confidentiality obligations shall survive for three (3) years",
                "page": 1
            },
            "liability": {
                "caps": "Direct damages only",
                "consequential_damages_exclusion": "Excludes indirect, punitive, or consequential damages",
                "carveouts": "Breach of confidentiality",
                "source_text": "in no event shall either party be liable for consequential damages",
                "page": 1
            },
            "indemnity": {
                "scope": "Not found in the provided document.",
                "covered_parties": "Not found in the provided document.",
                "procedure": "Not found in the provided document.",
                "source_text": null,
                "page": null
            },
            "intellectual_property": {
                "ownership": "All IP remains sole property of disclosing party",
                "work_for_hire": "Not found in the provided document.",
                "license_grant": "No license granted by implication or estoppel",
                "source_text": "no license is granted under any patent, copyright, or trademark",
                "page": 1
            },
            "governing_law": {
                "governing_state_or_nation": "State of New York",
                "source_text": "governed by the laws of the State of New York",
                "page": 1
            },
            "jurisdiction": {
                "court_venue": "Courts of New York County, New York",
                "exclusive": "Exclusive jurisdiction",
                "source_text": "exclusive jurisdiction of state and federal courts in NY County",
                "page": 1
            },
            "dispute_resolution": {
                "mechanism": "Litigation in specified venue",
                "escalation_steps": "Good faith negotiation",
                "rules": "Civil procedural rules of New York",
                "source_text": "parties agree to resolve disputes in the courts of New York",
                "page": 1
            },
            "warranties": {
                "express_warranties": "Right to disclose information without third-party infringement",
                "disclaimers": "Information provided AS IS without express warranty of accuracy",
                "source_text": "all information is provided AS IS",
                "page": 1
            },
            "representations": {
                "corporate_authority": "Each party represents full corporate power to execute agreement",
                "regulatory_compliance": "Not found in the provided document.",
                "source_text": "duly authorized by all necessary corporate action",
                "page": 1
            },
            "non_compete": {
                "applicable": "Not found in the provided document.",
                "scope": "Not found in the provided document.",
                "duration": "Not found in the provided document.",
                "territory": "Not found in the provided document.",
                "source_text": null,
                "page": null
            },
            "non_solicitation": {
                "applicable": "Not found in the provided document.",
                "scope": "Not found in the provided document.",
                "duration": "Not found in the provided document.",
                "territory": "Not found in the provided document.",
                "source_text": null,
                "page": null
            },
            "data_protection": {
                "applicable": "Standard technical and organizational safeguards",
                "security_standards": "Reasonable security practices",
                "breach_notification_window": "Prompt notice upon suspected security incident",
                "source_text": "shall notify discloser promptly of any unauthorized disclosure",
                "page": 1
            },
            "important_clauses": [
                {
                    "clause_type": "Confidentiality",
                    "title": "Duty of Confidentiality",
                    "original_text": "Receiving party shall hold in strict confidence all proprietary disclosures.",
                    "explanation": "Standard confidentiality duty with reasonable care standard.",
                    "page": 1,
                    "section": "Section 2",
                    "importance": "HIGH",
                    "risk_level": "LOW",
                    "confidence": 0.95
                }
            ],
            "risks": [
                {
                    "title": "Uncapped Liability for Confidentiality Breach",
                    "severity": "HIGH",
                    "explanation": "Carveout from consequential damages exclusion exposes receiving party to uncapped liability in event of disclosure.",
                    "source_text": "carveout applies to damages arising from breach of Section 2",
                    "page": 1,
                    "section": "Section 4",
                    "confidence": 0.92,
                    "suggested_review_action": "Negotiate a separate liability supercap for confidentiality breaches."
                }
            ],
            "missing_or_unclear_information": [
                {
                    "term": "Indemnity Clause",
                    "explanation": "Indemnity clause is missing from the agreement.",
                    "page": null,
                    "section": null,
                    "source_text": null,
                    "confidence": 0.95
                },
                {
                    "term": "Renewal Terms",
                    "explanation": "Renewal terms are not found in the provided document.",
                    "page": null,
                    "section": null,
                    "source_text": null,
                    "confidence": 0.9
                }
            ]
        }"""
        return AIResponse(content=mock_json)

    def test_connection(self) -> dict[str, Any]:
        return {
            "configured": True,
            "provider": "mock",
            "model": "mock-model",
            "status": "healthy",
            "test_reply": "OK",
        }


def get_ai_provider() -> AIProvider:
    """
    Factory returning configured GeminiProvider if GEMINI_API_KEY exists,
    otherwise UnconfiguredAIProvider.
    """
    settings = get_settings()
    api_key = settings.resolved_gemini_api_key

    if api_key and api_key.strip():
        return GeminiProvider(api_key=api_key.strip(), model=settings.resolved_gemini_model)

    return UnconfiguredAIProvider(message="GEMINI_API_KEY is not configured.")
