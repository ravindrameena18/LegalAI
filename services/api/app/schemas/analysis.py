from datetime import datetime
from typing import Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, model_validator


def _clean_str(val: Any, default: str = "Not found in the provided document.") -> str:
    if val is None:
        return default
    if isinstance(val, str):
        s = val.strip()
        return s if s else default
    if isinstance(val, (dict, list)):
        import json
        return json.dumps(val)
    return str(val)


class PartyItem(BaseModel):
    name: str = "Unnamed Party"
    role: str = "Party"
    notice_address: str | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_party(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {"name": data.strip() or "Unnamed Party", "role": "Party", "notice_address": None}
        if isinstance(data, dict):
            name = data.get("name") or data.get("party_name") or data.get("party") or "Unnamed Party"
            data["name"] = _clean_str(name, "Unnamed Party")
            role = data.get("role") or "Party"
            data["role"] = _clean_str(role, "Party")
            addr = data.get("notice_address") or data.get("address")
            if addr is not None:
                data["notice_address"] = _clean_str(addr, "")
        return data


class DateItem(BaseModel):
    title: str = "Important Date"
    date: str = "Not specified"
    source_text: str | None = None
    page: int | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_date(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {
                "title": data.strip() or "Important Date",
                "date": data.strip() or "Not specified",
                "source_text": None,
                "page": None,
            }
        if isinstance(data, dict):
            title = data.get("title") or data.get("event") or data.get("description") or "Important Date"
            data["title"] = _clean_str(title, "Important Date")
            date_val = data.get("date") or data.get("date_value") or data.get("value") or "Not specified"
            data["date"] = _clean_str(date_val, "Not specified")
            if "page" in data and data["page"] is not None:
                try:
                    data["page"] = int(data["page"])
                except (ValueError, TypeError):
                    data["page"] = None
            if "source_text" in data and data["source_text"] is not None:
                data["source_text"] = str(data["source_text"])
        return data


class FinancialItem(BaseModel):
    term: str = "Payment Term"
    amount_or_rate: str = "Not specified"
    details: str = "Not found in the provided document."
    source_text: str | None = None
    page: int | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_financial(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {
                "term": data.strip() or "Payment Term",
                "amount_or_rate": "Not specified",
                "details": data.strip() or "Not found in the provided document.",
                "source_text": None,
                "page": None,
            }
        if isinstance(data, dict):
            term = data.get("term") or data.get("payment_term") or data.get("title") or "Payment Term"
            data["term"] = _clean_str(term, "Payment Term")
            amount = data.get("amount_or_rate") or data.get("amount") or data.get("rate") or "Not specified"
            data["amount_or_rate"] = _clean_str(amount, "Not specified")
            details = data.get("details") or data.get("description") or "Not found in the provided document."
            data["details"] = _clean_str(details, "Not found in the provided document.")
            if "page" in data and data["page"] is not None:
                try:
                    data["page"] = int(data["page"])
                except (ValueError, TypeError):
                    data["page"] = None
            if "source_text" in data and data["source_text"] is not None:
                data["source_text"] = str(data["source_text"])
        return data


class ObligationItem(BaseModel):
    party: str = "Party"
    obligation: str = "Not specified"
    deadline: str | None = None
    source_text: str | None = None
    page: int | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_obligation(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {
                "party": "Party",
                "obligation": data.strip() or "Not specified",
                "deadline": None,
                "source_text": None,
                "page": None,
            }
        if isinstance(data, dict):
            party = data.get("party") or "Party"
            data["party"] = _clean_str(party, "Party")
            ob = data.get("obligation") or data.get("description") or data.get("details") or "Not specified"
            data["obligation"] = _clean_str(ob, "Not specified")
            if "deadline" in data and data["deadline"] is not None:
                data["deadline"] = _clean_str(data["deadline"], "")
            if "page" in data and data["page"] is not None:
                try:
                    data["page"] = int(data["page"])
                except (ValueError, TypeError):
                    data["page"] = None
            if "source_text" in data and data["source_text"] is not None:
                data["source_text"] = str(data["source_text"])
        return data


class RightItem(BaseModel):
    party: str = "Party"
    right: str = "Not specified"
    conditions: str | None = None
    source_text: str | None = None
    page: int | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_right(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {
                "party": "Party",
                "right": data.strip() or "Not specified",
                "conditions": None,
                "source_text": None,
                "page": None,
            }
        if isinstance(data, dict):
            party = data.get("party") or "Party"
            data["party"] = _clean_str(party, "Party")
            r = data.get("right") or data.get("description") or data.get("details") or "Not specified"
            data["right"] = _clean_str(r, "Not specified")
            if "conditions" in data and data["conditions"] is not None:
                data["conditions"] = _clean_str(data["conditions"], "")
            if "page" in data and data["page"] is not None:
                try:
                    data["page"] = int(data["page"])
                except (ValueError, TypeError):
                    data["page"] = None
            if "source_text" in data and data["source_text"] is not None:
                data["source_text"] = str(data["source_text"])
        return data


class TerminationSection(BaseModel):
    for_cause: str = "Not found in the provided document."
    for_convenience: str = "Not found in the provided document."
    notice_period: str = "Not found in the provided document."
    consequences: str = "Not found in the provided document."
    source_text: str | None = None
    page: int | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_section(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {
                "for_cause": _clean_str(data),
                "for_convenience": "Not found in the provided document.",
                "notice_period": "Not found in the provided document.",
                "consequences": "Not found in the provided document.",
                "source_text": None,
                "page": None,
            }
        if not isinstance(data, dict):
            return {}
        for k in ["for_cause", "for_convenience", "notice_period", "consequences"]:
            data[k] = _clean_str(data.get(k))
        return data


class RenewalSection(BaseModel):
    type: str = "Not found in the provided document."
    terms: str = "Not found in the provided document."
    notice_window: str = "Not found in the provided document."
    source_text: str | None = None
    page: int | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_section(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {
                "type": _clean_str(data),
                "terms": "Not found in the provided document.",
                "notice_window": "Not found in the provided document.",
                "source_text": None,
                "page": None,
            }
        if not isinstance(data, dict):
            return {}
        for k in ["type", "terms", "notice_window"]:
            data[k] = _clean_str(data.get(k))
        return data


class ConfidentialitySection(BaseModel):
    definition_scope: str = "Not found in the provided document."
    duration: str = "Not found in the provided document."
    standard_exclusions: str = "Not found in the provided document."
    source_text: str | None = None
    page: int | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_section(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {
                "definition_scope": _clean_str(data),
                "duration": "Not found in the provided document.",
                "standard_exclusions": "Not found in the provided document.",
                "source_text": None,
                "page": None,
            }
        if not isinstance(data, dict):
            return {}
        for k in ["definition_scope", "duration", "standard_exclusions"]:
            data[k] = _clean_str(data.get(k))
        return data


class LiabilitySection(BaseModel):
    caps: str = "Not found in the provided document."
    consequential_damages_exclusion: str = "Not found in the provided document."
    carveouts: str = "Not found in the provided document."
    source_text: str | None = None
    page: int | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_section(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {
                "caps": _clean_str(data),
                "consequential_damages_exclusion": "Not found in the provided document.",
                "carveouts": "Not found in the provided document.",
                "source_text": None,
                "page": None,
            }
        if not isinstance(data, dict):
            return {}
        for k in ["caps", "consequential_damages_exclusion", "carveouts"]:
            data[k] = _clean_str(data.get(k))
        return data


class IndemnitySection(BaseModel):
    scope: str = "Not found in the provided document."
    covered_parties: str = "Not found in the provided document."
    procedure: str = "Not found in the provided document."
    source_text: str | None = None
    page: int | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_section(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {
                "scope": _clean_str(data),
                "covered_parties": "Not found in the provided document.",
                "procedure": "Not found in the provided document.",
                "source_text": None,
                "page": None,
            }
        if not isinstance(data, dict):
            return {}
        for k in ["scope", "covered_parties", "procedure"]:
            data[k] = _clean_str(data.get(k))
        return data


class IPSection(BaseModel):
    ownership: str = "Not found in the provided document."
    work_for_hire: str = "Not found in the provided document."
    license_grant: str = "Not found in the provided document."
    source_text: str | None = None
    page: int | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_section(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {
                "ownership": _clean_str(data),
                "work_for_hire": "Not found in the provided document.",
                "license_grant": "Not found in the provided document.",
                "source_text": None,
                "page": None,
            }
        if not isinstance(data, dict):
            return {}
        for k in ["ownership", "work_for_hire", "license_grant"]:
            data[k] = _clean_str(data.get(k))
        return data


class GoverningLawSection(BaseModel):
    governing_state_or_nation: str = "Not found in the provided document."
    source_text: str | None = None
    page: int | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_section(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {
                "governing_state_or_nation": _clean_str(data),
                "source_text": None,
                "page": None,
            }
        if not isinstance(data, dict):
            return {}
        if not data.get("governing_state_or_nation"):
            data["governing_state_or_nation"] = "Not found in the provided document."
        else:
            data["governing_state_or_nation"] = _clean_str(data["governing_state_or_nation"])
        return data


class JurisdictionSection(BaseModel):
    court_venue: str = "Not found in the provided document."
    exclusive: str = "Not found in the provided document."
    source_text: str | None = None
    page: int | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_section(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {
                "court_venue": _clean_str(data),
                "exclusive": "Not found in the provided document.",
                "source_text": None,
                "page": None,
            }
        if not isinstance(data, dict):
            return {}
        for k in ["court_venue", "exclusive"]:
            data[k] = _clean_str(data.get(k))
        return data


class DisputeSection(BaseModel):
    mechanism: str = "Not found in the provided document."
    escalation_steps: str = "Not found in the provided document."
    rules: str = "Not found in the provided document."
    source_text: str | None = None
    page: int | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_section(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {
                "mechanism": _clean_str(data),
                "escalation_steps": "Not found in the provided document.",
                "rules": "Not found in the provided document.",
                "source_text": None,
                "page": None,
            }
        if not isinstance(data, dict):
            return {}
        for k in ["mechanism", "escalation_steps", "rules"]:
            data[k] = _clean_str(data.get(k))
        return data


class WarrantySection(BaseModel):
    express_warranties: str = "Not found in the provided document."
    disclaimers: str = "Not found in the provided document."
    source_text: str | None = None
    page: int | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_section(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {
                "express_warranties": _clean_str(data),
                "disclaimers": "Not found in the provided document.",
                "source_text": None,
                "page": None,
            }
        if not isinstance(data, dict):
            return {}
        for k in ["express_warranties", "disclaimers"]:
            data[k] = _clean_str(data.get(k))
        return data


class RepresentationSection(BaseModel):
    corporate_authority: str = "Not found in the provided document."
    regulatory_compliance: str = "Not found in the provided document."
    source_text: str | None = None
    page: int | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_section(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {
                "corporate_authority": _clean_str(data),
                "regulatory_compliance": "Not found in the provided document.",
                "source_text": None,
                "page": None,
            }
        if not isinstance(data, dict):
            return {}
        for k in ["corporate_authority", "regulatory_compliance"]:
            data[k] = _clean_str(data.get(k))
        return data


class RestrictiveCovenantSection(BaseModel):
    applicable: str = "Not found in the provided document."
    scope: str = "Not found in the provided document."
    duration: str = "Not found in the provided document."
    territory: str = "Not found in the provided document."
    source_text: str | None = None
    page: int | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_section(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {
                "applicable": _clean_str(data),
                "scope": "Not found in the provided document.",
                "duration": "Not found in the provided document.",
                "territory": "Not found in the provided document.",
                "source_text": None,
                "page": None,
            }
        if not isinstance(data, dict):
            return {}
        for k in ["applicable", "scope", "duration", "territory"]:
            data[k] = _clean_str(data.get(k))
        return data


class DataProtectionSection(BaseModel):
    applicable: str = "Not found in the provided document."
    security_standards: str = "Not found in the provided document."
    breach_notification_window: str = "Not found in the provided document."
    source_text: str | None = None
    page: int | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_section(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {
                "applicable": _clean_str(data),
                "security_standards": "Not found in the provided document.",
                "breach_notification_window": "Not found in the provided document.",
                "source_text": None,
                "page": None,
            }
        if not isinstance(data, dict):
            return {}
        for k in ["applicable", "security_standards", "breach_notification_window"]:
            data[k] = _clean_str(data.get(k))
        return data


class ClauseItem(BaseModel):
    clause_type: str = "General Provision"
    title: str = "Clause"
    original_text: str = ""
    explanation: str = "Not found in the provided document."
    page: int | None = None
    section: str | None = None
    importance: str = "MEDIUM"  # "HIGH", "MEDIUM", "LOW"
    risk_level: str = "LOW"     # "HIGH", "MEDIUM", "LOW", "NONE"
    confidence: float = 0.9

    @model_validator(mode="before")
    @classmethod
    def normalize_clause(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {
                "clause_type": "General Provision",
                "title": "Clause",
                "original_text": data.strip(),
                "explanation": "Not found in the provided document.",
                "page": None,
                "section": None,
                "importance": "MEDIUM",
                "risk_level": "LOW",
                "confidence": 0.9,
            }
        if isinstance(data, dict):
            c_type = data.get("clause_type") or data.get("type") or "General Provision"
            data["clause_type"] = _clean_str(c_type, "General Provision")
            title = data.get("title") or data.get("name") or "Clause"
            data["title"] = _clean_str(title, "Clause")
            orig = data.get("original_text") or data.get("source_text") or data.get("text") or ""
            data["original_text"] = str(orig)
            expl = data.get("explanation") or data.get("summary") or data.get("description") or "Not found in the provided document."
            data["explanation"] = _clean_str(expl, "Not found in the provided document.")
            if "page" in data and data["page"] is not None:
                try:
                    data["page"] = int(data["page"])
                except (ValueError, TypeError):
                    data["page"] = None
            if "confidence" in data and data["confidence"] is not None:
                try:
                    data["confidence"] = float(data["confidence"])
                except (ValueError, TypeError):
                    data["confidence"] = 0.9
            if "section" in data and data["section"] is not None:
                data["section"] = str(data["section"])
        return data


class RiskItem(BaseModel):
    title: str = "Potential Risk"
    severity: str = "MEDIUM"       # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    explanation: str = "Not specified."
    source_text: str = ""
    page: int | None = None
    section: str | None = None
    confidence: float = 0.9
    suggested_review_action: str = "Review with legal counsel."

    @model_validator(mode="before")
    @classmethod
    def normalize_risk(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {
                "title": "Potential Risk",
                "severity": "MEDIUM",
                "explanation": data.strip() or "Not specified.",
                "source_text": "",
                "page": None,
                "section": None,
                "confidence": 0.9,
                "suggested_review_action": "Review with legal counsel.",
            }
        if isinstance(data, dict):
            title = data.get("title") or data.get("risk") or data.get("name") or "Potential Risk"
            data["title"] = _clean_str(title, "Potential Risk")
            sev = str(data.get("severity", "MEDIUM")).upper().strip()
            if sev not in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}:
                sev = "MEDIUM"
            data["severity"] = sev
            expl = data.get("explanation") or data.get("description") or data.get("details") or "Not specified."
            data["explanation"] = _clean_str(expl, "Not specified.")
            src = data.get("source_text") or data.get("evidence") or data.get("quote") or ""
            data["source_text"] = str(src)
            action = data.get("suggested_review_action") or data.get("recommendation") or data.get("action") or "Review with legal counsel."
            data["suggested_review_action"] = _clean_str(action, "Review with legal counsel.")
            if "page" in data and data["page"] is not None:
                try:
                    data["page"] = int(data["page"])
                except (ValueError, TypeError):
                    data["page"] = None
            if "confidence" in data and data["confidence"] is not None:
                try:
                    data["confidence"] = float(data["confidence"])
                except (ValueError, TypeError):
                    data["confidence"] = 0.9
            if "section" in data and data["section"] is not None:
                data["section"] = str(data["section"])
        return data


class MissingOrUnclearItem(BaseModel):
    term: str = "Unspecified Term"
    explanation: str = "Not found in the provided document."
    page: int | None = None
    section: str | None = None
    source_text: str | None = None
    confidence: float | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_missing_item(cls, data: Any) -> Any:
        if isinstance(data, str):
            clean = data.strip()
            return {
                "term": clean if clean else "Unspecified Term",
                "explanation": "Not found in the provided document.",
                "page": None,
                "section": None,
                "source_text": None,
                "confidence": None,
            }
        if isinstance(data, dict):
            term_val = (
                data.get("term")
                or data.get("title")
                or data.get("name")
                or data.get("provision")
                or "Unspecified Term"
            )
            data["term"] = _clean_str(term_val, "Unspecified Term")

            expl_val = (
                data.get("explanation")
                or data.get("details")
                or data.get("description")
                or data.get("reason")
                or "Not found in the provided document."
            )
            data["explanation"] = _clean_str(expl_val, "Not found in the provided document.")

            if "page" in data and data["page"] is not None:
                try:
                    data["page"] = int(data["page"])
                except (ValueError, TypeError):
                    data["page"] = None

            if "confidence" in data and data["confidence"] is not None:
                try:
                    data["confidence"] = float(data["confidence"])
                except (ValueError, TypeError):
                    data["confidence"] = None

            if "section" in data and data["section"] is not None:
                data["section"] = str(data["section"])

            if "source_text" in data and data["source_text"] is not None:
                data["source_text"] = str(data["source_text"])

        return data


class LegalAnalysisResult(BaseModel):
    """
    24-Section canonical structured legal analysis model.
    Must strictly be grounded in the provided document without hallucination.
    Guarantees that all collection fields default to safe empty lists when omitted or null.
    """
    # 1. Executive Summary
    executive_summary: str = "Executive summary not provided in document."
    # 2. Document Type
    document_type: str = "Legal Document"
    # 3. Parties
    parties: list[PartyItem] = Field(default_factory=list)
    # 4. Important Dates
    important_dates: list[DateItem] = Field(default_factory=list)
    # 5. Financial Terms
    financial_terms: list[FinancialItem] = Field(default_factory=list)
    # 6. Obligations
    obligations: list[ObligationItem] = Field(default_factory=list)
    # 7. Rights
    rights: list[RightItem] = Field(default_factory=list)
    # 8. Termination
    termination: TerminationSection = Field(default_factory=TerminationSection)
    # 9. Renewal
    renewal: RenewalSection = Field(default_factory=RenewalSection)
    # 10. Confidentiality
    confidentiality: ConfidentialitySection = Field(default_factory=ConfidentialitySection)
    # 11. Liability
    liability: LiabilitySection = Field(default_factory=LiabilitySection)
    # 12. Indemnity
    indemnity: IndemnitySection = Field(default_factory=IndemnitySection)
    # 13. Intellectual Property
    intellectual_property: IPSection = Field(default_factory=IPSection)
    # 14. Governing Law
    governing_law: GoverningLawSection = Field(default_factory=GoverningLawSection)
    # 15. Jurisdiction
    jurisdiction: JurisdictionSection = Field(default_factory=JurisdictionSection)
    # 16. Dispute Resolution
    dispute_resolution: DisputeSection = Field(default_factory=DisputeSection)
    # 17. Warranties
    warranties: WarrantySection = Field(default_factory=WarrantySection)
    # 18. Representations
    representations: RepresentationSection = Field(default_factory=RepresentationSection)
    # 19. Non-Compete
    non_compete: RestrictiveCovenantSection = Field(default_factory=RestrictiveCovenantSection)
    # 20. Non-Solicitation
    non_solicitation: RestrictiveCovenantSection = Field(default_factory=RestrictiveCovenantSection)
    # 21. Data Protection
    data_protection: DataProtectionSection = Field(default_factory=DataProtectionSection)
    # 22. Important Clauses
    important_clauses: list[ClauseItem] = Field(default_factory=list)
    # 23. Risks
    risks: list[RiskItem] = Field(default_factory=list)
    # 24. Missing/Unclear Information
    missing_or_unclear_information: list[MissingOrUnclearItem] = Field(default_factory=list)
    risk_assessment: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def normalize_collections_and_sections(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return {}

        list_fields = [
            "parties",
            "important_dates",
            "financial_terms",
            "obligations",
            "rights",
            "important_clauses",
            "risks",
            "missing_or_unclear_information",
        ]
        for f in list_fields:
            val = data.get(f)
            if val is None or not isinstance(val, list):
                data[f] = []

        section_fields = [
            "termination",
            "renewal",
            "confidentiality",
            "liability",
            "indemnity",
            "intellectual_property",
            "governing_law",
            "jurisdiction",
            "dispute_resolution",
            "warranties",
            "representations",
            "non_compete",
            "non_solicitation",
            "data_protection",
        ]
        for s in section_fields:
            val = data.get(s)
            if val is None or (not isinstance(val, (dict, str))):
                data[s] = {}

        if isinstance(data.get("executive_summary"), dict):
            es = data["executive_summary"]
            data["executive_summary"] = (
                es.get("summary")
                or es.get("overview")
                or es.get("text")
                or _clean_str(es)
            )
        elif not data.get("executive_summary"):
            data["executive_summary"] = "Executive summary not provided in document."
        else:
            data["executive_summary"] = _clean_str(data["executive_summary"])

        if isinstance(data.get("document_type"), dict):
            dt = data["document_type"]
            data["document_type"] = (
                dt.get("type")
                or dt.get("classification")
                or dt.get("name")
                or _clean_str(dt)
            )
        elif not data.get("document_type"):
            data["document_type"] = "Legal Document"
        else:
            data["document_type"] = _clean_str(data["document_type"])

        return data


# API Models
class AnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    document_id: UUID | None
    version_id: UUID
    status: str
    summary: str | None
    created_at: datetime
    updated_at: datetime
    error_message: str | None = None


class AnalysisDetailResponse(AnalysisResponse):
    structured_data: LegalAnalysisResult
    risk_count: int = 0
    clause_count: int = 0
    overall_risk: str = "LOW"
    risk_score: int = 0
    risk_assessment: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def ensure_structured_result(cls, data: Any) -> Any:
        if isinstance(data, dict):
            raw = data.get("structured_data")
            if not isinstance(raw, LegalAnalysisResult):
                data["structured_data"] = LegalAnalysisResult.model_validate(raw or {})
        return data


class WorkspaceStatsResponse(BaseModel):
    document_count: int
    analysis_count: int
    risk_count: int
    report_count: int


class ProviderStatusResponse(BaseModel):
    provider: str
    model: str
    configured: bool
