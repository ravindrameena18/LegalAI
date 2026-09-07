from typing import Any, Literal
from pydantic import BaseModel, Field


class LegalQueryRequest(BaseModel):
    query: str = Field(..., description="Natural language search query or citation")
    court_filter: str = Field(default="all", description="Filter by court: all, supreme_court, high_courts, district_courts")
    year_filter: str = Field(default="all", description="Filter by year: all, 1_year, 3_years, 5_years, custom")
    source_filter: str = Field(default="all", description="Filter by source: all, official_courts, government, verified_databases")
    sort_by: Literal["relevance", "date_desc", "date_asc", "court"] = Field(default="relevance", description="Sorting criterion")
    doc_type: str = Field(default="all", description="Document type: all, judgment, order, act, section, notification")


class StatutoryIngredient(BaseModel):
    title: str
    description: str


class LegalProvisionResponse(BaseModel):
    act_title: str
    act_code: str
    enactment_year: int
    jurisdiction: str = "Central"
    section_number: str
    section_title: str
    what_it_means: str
    legal_interpretation: str
    ingredients: list[str] = Field(default_factory=list)
    punishment_or_remedy: str | None = None
    related_provisions: list[str] = Field(default_factory=list)
    status: str = "In Force"
    effective_date: str | None = None


class StatuteMappingResponse(BaseModel):
    old_act: str
    old_section: str
    old_title: str
    current_act: str
    current_section: str
    current_title: str
    how_law_changed: str
    key_differences: list[str] = Field(default_factory=list)
    is_repealed_or_replaced: bool = True
    effective_date: str = "July 1, 2024"
    statutory_authority: str = "Ministry of Law and Justice, Government of India"


class CaseLawResponse(BaseModel):
    id: str
    title: str
    year: int
    court: str
    citation: str
    case_number: str | None = None
    judgment_date: str
    bench: str
    petitioner: str | None = None
    respondent: str | None = None
    summary: str
    ratio_decidendi: str
    why_relevant: str
    relevant_section: str | None = None
    source: str
    source_url: str
    source_type: str = "Official Court Registry"
    retrieved_at: str
    relevance_score: int = 90
    precedent_type: Literal["SUPPORTING", "CONTRARY", "DISTINGUISHING", "NEUTRAL"] = "SUPPORTING"
    facts: str | None = None
    issues: list[str] = Field(default_factory=list)
    arguments_appellant: list[str] = Field(default_factory=list)
    arguments_respondent: list[str] = Field(default_factory=list)
    applicable_law: list[str] = Field(default_factory=list)
    reasoning: str | None = None
    decision: str | None = None
    key_paragraphs: list[dict[str, Any]] = Field(default_factory=list)
    sections_referred: list[str] = Field(default_factory=list)
    cases_referred: list[str] = Field(default_factory=list)
    alternate_citations: list[str] = Field(default_factory=list)


class PrecedentPairResponse(BaseModel):
    supporting_precedents: list[CaseLawResponse] = Field(default_factory=list)
    contrary_precedents: list[CaseLawResponse] = Field(default_factory=list)
    distinguishing_precedents: list[CaseLawResponse] = Field(default_factory=list)


class PotentialProvisionItem(BaseModel):
    act: str = Field(..., description="Verified Act name, e.g. Bharatiya Nyaya Sanhita, 2023 or Indian Penal Code, 1860")
    section: str = Field(..., description="Section number, e.g. Section 318(4) / Section 420")
    title: str = Field(..., description="Official title of the provision")
    why_relevant: str = Field(..., description="Explanation of why this provision may apply based on stated facts")
    statutory_effect: str | None = Field(default=None, description="Prescribed penalty or statutory legal consequence")
    source_url: str = Field(default="https://www.indiacode.nic.in/", description="Verified legislative portal URL")
    is_current_law: bool = Field(default=True, description="Whether this is the currently in-force law")
    historical_counterpart: str | None = Field(default=None, description="Old or new law counterpart reference if applicable")


class SummaryStructuredSection(BaseModel):
    title: str = Field(..., description="Section title, e.g. DIRECT ANSWER, APPLICABLE LAW, etc.")
    points: list[str] = Field(default_factory=list, description="Point-wise bullet items")
    sub_points: dict[str, list[str]] | None = Field(default=None, description="Optional nested sub-bullets")


class ResearchSummaryCitation(BaseModel):
    source_id: int
    source_title: str
    source_url: str
    source_type: str


class ResearchSummaryResponse(BaseModel):
    direct_answer: str
    formatted_markdown: str = Field(default="", description="Full point-wise structured markdown following Legal Answer Template")
    applicable_law: list[str] = Field(default_factory=list)
    relevant_section: str | None = None
    key_principles: list[str] = Field(default_factory=list)
    key_requirements: list[str] = Field(default_factory=list, description="Essential statutory ingredients")
    possible_consequences: list[str] = Field(default_factory=list, description="Supported civil/criminal consequences")
    relevant_judgments: list[str] = Field(default_factory=list)
    latest_developments: str | None = None
    practical_interpretation: str | None = None
    current_position: str | None = Field(default=None, description="Current governing legal position")
    sections: list[SummaryStructuredSection] = Field(default_factory=list, description="Structured sections breakdown")
    citations: list[ResearchSummaryCitation] = Field(default_factory=list)


class OfficialSourceItem(BaseModel):
    id: str
    name: str
    source_type: str
    description: str
    official_url: str
    status: Literal["CONNECTED", "OFFICIAL_PORTAL", "DISCONNECTED"] = "CONNECTED"
    retrieved_at: str


class CitationVerificationResponse(BaseModel):
    citation: str
    status: Literal["VERIFIED", "NOT_FOUND", "NEEDS_REVIEW", "SOURCE_UNAVAILABLE"]
    case_name: str | None = None
    court: str | None = None
    year: int | None = None
    bench: str | None = None
    status_message: str
    source_attribution: str
    source_url: str | None = None
    alternate_citations: list[str] = Field(default_factory=list)
    treatment_history: dict[str, Any] | None = None


class LegalSearchResponse(BaseModel):
    query: str
    parsed_intent: dict[str, Any]
    summary: ResearchSummaryResponse | None = None
    provision: LegalProvisionResponse | None = None
    provisions: list[PotentialProvisionItem] = Field(default_factory=list, description="Multiple potentially applicable provisions")
    statute_mapping: StatuteMappingResponse | None = None
    statute_mappings: list[StatuteMappingResponse] = Field(default_factory=list, description="Multiple statutory transitions if applicable")
    cases: list[CaseLawResponse] = Field(default_factory=list)
    latest_cases: list[CaseLawResponse] = Field(default_factory=list)
    precedents: PrecedentPairResponse | None = None
    related_sections: list[str] = Field(default_factory=list)
    sources: list[OfficialSourceItem] = Field(default_factory=list)
    is_unconfigured_query: bool = False
    warning_message: str | None = None

