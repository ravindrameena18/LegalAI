import logging
from typing import Any
from app.schemas.legal_research import (
    CaseLawResponse,
    CitationVerificationResponse,
    LegalProvisionResponse,
    LegalQueryRequest,
    LegalSearchResponse,
    OfficialSourceItem,
    PotentialProvisionItem,
    PrecedentPairResponse,
    ResearchSummaryCitation,
    ResearchSummaryResponse,
    StatuteMappingResponse,
    SummaryStructuredSection,
)
from app.services.legal_sources.ecourts_connector import ECourtsConnector
from app.services.legal_sources.india_code_connector import IndiaCodeConnector
from app.services.legal_sources.query_parser import LegalQueryParser, ParsedQuery
from app.services.legal_sources.statute_registry import StatuteRegistry
from app.services.legal_sources.supreme_court_connector import SupremeCourtConnector

logger = logging.getLogger("legalai.research")


class LegalResearchService:
    """
    Main orchestration engine for source-grounded legal research.
    Coordinates query parsing, statutory mapping, case retrieval,
    precedent classification, and AI-grounded summary generation.
    """

    def __init__(self) -> None:
        self.sc_connector = SupremeCourtConnector()
        self.india_code_connector = IndiaCodeConnector()
        self.ecourts_connector = ECourtsConnector()

    async def search(self, request: LegalQueryRequest) -> LegalSearchResponse:
        parsed: ParsedQuery = LegalQueryParser.parse(request.query)

        # 1. Statutory Provision & Old Law -> Current Law Mapping
        provision: LegalProvisionResponse | None = None
        statute_mapping: StatuteMappingResponse | None = None

        if parsed.act_code and parsed.section_number:
            provision = StatuteRegistry.get_provision(parsed.act_code, parsed.section_number)
            statute_mapping = StatuteRegistry.get_statute_mapping(parsed.act_code, parsed.section_number)
        elif parsed.act_code:
            # Check default prominent section for act
            default_sec = "138" if parsed.act_code == "NI Act" else ("11" if parsed.act_code == "Arbitration Act" else "300")
            provision = StatuteRegistry.get_provision(parsed.act_code, default_sec)
            statute_mapping = StatuteRegistry.get_statute_mapping(parsed.act_code, default_sec)

        # 2. Potential Provisions for conduct / dispute / multi-offence queries
        potential_provisions: list[PotentialProvisionItem] = StatuteRegistry.get_potential_provisions(request.query)
        if not potential_provisions and parsed.legal_concept:
            potential_provisions = StatuteRegistry.get_potential_provisions(parsed.legal_concept)

        # Auto-resolve provision and mapping from potential_provisions if not explicitly set
        if provision is None and potential_provisions:
            p0 = potential_provisions[0]
            # Try to resolve provision from registry
            act_lookup = "BNS" if "Bharatiya Nyaya" in p0.act or "BNS" in p0.act else ("NI Act" if "Negotiable" in p0.act else "IPC")
            sec_num = p0.section.replace("Section", "").split("(")[0].strip()
            provision = StatuteRegistry.get_provision(act_lookup, sec_num)
            if statute_mapping is None:
                statute_mapping = StatuteRegistry.get_statute_mapping(act_lookup, sec_num)
                if not statute_mapping and act_lookup == "BNS":
                    statute_mapping = StatuteRegistry.get_statute_mapping("IPC", sec_num)

        # Collect statute mappings
        statute_mappings: list[StatuteMappingResponse] = []
        if statute_mapping:
            statute_mappings.append(statute_mapping)

        # 3. Case Law Retrieval from Supreme Court connector
        filter_opts = {
            "court_filter": request.court_filter,
            "year_filter": request.year_filter,
            "sort_by": request.sort_by,
        }

        # Query term to pass to case connector
        case_search_term = parsed.cleaned_query or request.query
        if parsed.section_number:
            case_search_term = f"{parsed.section_number} {case_search_term}"

        case_results = await self.sc_connector.search_cases(case_search_term, filter_opts)

        # If strict search returned 0 but we have an act or concept, try fallback concept search
        if not case_results and parsed.legal_concept:
            case_results = await self.sc_connector.search_cases(parsed.legal_concept, filter_opts)
        if not case_results and parsed.act_code:
            case_results = await self.sc_connector.search_cases(parsed.act_code, filter_opts)
        if not case_results and potential_provisions:
            for p in potential_provisions[:2]:
                case_results = await self.sc_connector.search_cases(p.title, filter_opts)
                if case_results:
                    break

        # 4. Latest Cases (sorted strictly by year/date descending)
        latest_cases = sorted(case_results, key=lambda c: c.year, reverse=True)

        # 5. Precedent Classification
        supporting = [c for c in case_results if c.precedent_type == "SUPPORTING"]
        contrary = [c for c in case_results if c.precedent_type == "CONTRARY"]
        distinguishing = [c for c in case_results if c.precedent_type == "DISTINGUISHING"]
        precedents = PrecedentPairResponse(
            supporting_precedents=supporting,
            contrary_precedents=contrary,
            distinguishing_precedents=distinguishing,
        )

        # 6. Connected Sources
        sources = [
            self.sc_connector.get_source_metadata(),
            self.india_code_connector.get_source_metadata(),
            self.ecourts_connector.get_source_metadata(),
        ]

        # 7. Check if query is unconfigured / no source data found
        is_unconfigured = (provision is None) and (len(case_results) == 0) and (len(potential_provisions) == 0)

        # 8. AI Legal Research Summary (Source-Grounded)
        summary = self._generate_grounded_summary(
            request.query, parsed, provision, statute_mapping, potential_provisions, case_results, sources
        )

        # Related provisions
        related_sections: list[str] = []
        if provision:
            related_sections.extend(provision.related_provisions)
        if statute_mapping:
            related_sections.append(f"{statute_mapping.current_act} {statute_mapping.current_section}")
        for p in potential_provisions:
            related_sections.append(f"{p.act} {p.section}")

        warning_message = None
        if is_unconfigured:
            warning_message = "Verified legal source not found for this specific query in the current benchmark index. In compliance with strict legal ethics, LegalAI never fabricates legal citations or court holdings."

        return LegalSearchResponse(
            query=request.query,
            parsed_intent=parsed.to_dict(),
            summary=summary,
            provision=provision,
            provisions=potential_provisions,
            statute_mapping=statute_mapping,
            statute_mappings=statute_mappings,
            cases=case_results,
            latest_cases=latest_cases,
            precedents=precedents,
            related_sections=list(dict.fromkeys(related_sections)),
            sources=sources,
            is_unconfigured_query=is_unconfigured,
            warning_message=warning_message,
        )

    def _generate_grounded_summary(
        self,
        raw_query: str,
        parsed: ParsedQuery,
        provision: LegalProvisionResponse | None,
        statute_mapping: StatuteMappingResponse | None,
        potential_provisions: list[PotentialProvisionItem],
        cases: list[CaseLawResponse],
        sources: list[OfficialSourceItem],
    ) -> ResearchSummaryResponse | None:
        if not provision and not cases and not potential_provisions:
            return None

        citations = [
            ResearchSummaryCitation(
                source_id=1,
                source_title="Supreme Court of India Official Records",
                source_url="https://main.sci.gov.in/judgments",
                source_type="Official Apex Court Registry",
            ),
            ResearchSummaryCitation(
                source_id=2,
                source_title="India Code / Legislative Department",
                source_url="https://www.indiacode.nic.in/",
                source_type="Official Legislative Database",
            ),
        ]

        applicable_law: list[str] = []
        if provision:
            applicable_law.append(f"{provision.act_title} - {provision.section_number}")
        if statute_mapping:
            applicable_law.append(f"{statute_mapping.current_act} - {statute_mapping.current_section} (Current Law)")
        for p in potential_provisions:
            entry = f"{p.act} - {p.section}"
            if entry not in applicable_law:
                applicable_law.append(entry)

        key_principles: list[str] = []
        if provision:
            key_principles.append(provision.what_it_means)
            if provision.ingredients:
                key_principles.extend(provision.ingredients[:3])

        key_requirements: list[str] = []
        if provision and provision.ingredients:
            key_requirements = list(provision.ingredients)
        elif potential_provisions:
            for p in potential_provisions[:3]:
                key_requirements.append(f"{p.section} ({p.act}): {p.why_relevant}")

        possible_consequences: list[str] = []
        if provision and provision.punishment_or_remedy:
            possible_consequences.append(f"Statutory Consequence: {provision.punishment_or_remedy}")
        for p in potential_provisions:
            if p.statutory_effect and f"Under {p.section}: {p.statutory_effect}" not in possible_consequences:
                possible_consequences.append(f"Under {p.section}: {p.statutory_effect}")

        relevant_judgments: list[str] = []
        for c in cases[:3]:
            relevant_judgments.append(f"{c.title} [{c.citation}]: {c.ratio_decidendi[:140]}...")

        # Construct direct answer with inline [Source X] references
        if provision and statute_mapping:
            direct_answer = (
                f"{provision.section_title} is governed under {provision.act_title} ({provision.section_number}) [Source 2]. "
                f"Under current law, it is replaced and codified by {statute_mapping.current_act} ({statute_mapping.current_section}) [Source 2]. "
                f"{provision.what_it_means} "
            )
            if cases:
                direct_answer += f"The Supreme Court of India in {cases[0].title} [{cases[0].citation}] held that {cases[0].ratio_decidendi} [Source 1]."
        elif provision:
            direct_answer = (
                f"Under {provision.act_title} ({provision.section_number}), {provision.what_it_means} [Source 2]. "
            )
            if cases:
                direct_answer += f"As affirmed by the Supreme Court in {cases[0].title} [{cases[0].citation}], {cases[0].ratio_decidendi} [Source 1]."
        elif potential_provisions:
            p0 = potential_provisions[0]
            direct_answer = (
                f"Based on the stated facts, the primary applicable provision is {p0.section} of {p0.act} (*{p0.title}*) [Source 2]. "
                f"{p0.why_relevant} "
            )
            if len(potential_provisions) > 1:
                direct_answer += f"Additionally, {len(potential_provisions)-1} related provisions may be attracted depending on evidence and specific overt acts. "
            if cases:
                direct_answer += f"In {cases[0].title} [{cases[0].citation}], the Supreme Court established that {cases[0].ratio_decidendi} [Source 1]."
        elif cases:
            direct_answer = (
                f"Based on verified Supreme Court jurisprudence, {cases[0].title} [{cases[0].citation}] establishes that {cases[0].ratio_decidendi} [Source 1]. "
                f"Counsel should note the applicable standard and procedural requirements laid down by the court."
            )
        else:
            direct_answer = "Verified legal source not found."

        latest_dev = None
        if statute_mapping:
            latest_dev = f"Statutory transition w.e.f. {statute_mapping.effective_date}: {statute_mapping.how_law_changed}"
        elif cases and cases[0].year >= 2021:
            latest_dev = f"Latest ruling in {cases[0].title} ({cases[0].year}) reinforces strict compliance with statutory procedural timelines."

        practical = None
        if parsed.legal_concept == "cheque dishonour" or parsed.section_number == "138":
            practical = "Ensure 30-day statutory demand notice is dispatched with postal receipt, and complaint is filed within 1 month after the 15-day cure period expires."
        elif parsed.legal_concept == "anticipatory bail" or parsed.section_number in {"438", "482"}:
            practical = "Anticipatory bail applications under Section 482 BNSS must establish apprehension of arrest on genuine grounds with willingness to join investigation."
        elif parsed.legal_concept == "arbitration agreement & referral":
            practical = "Under Section 11(6A) and the 7-judge Constitution Bench ruling in Re: Stamp Act, referral courts will not delve into stamping defects or deep arbitrability."

        current_position = None
        if statute_mapping:
            current_position = f"{statute_mapping.old_section} ({statute_mapping.old_act}) is replaced by {statute_mapping.current_section} ({statute_mapping.current_act}) w.e.f. {statute_mapping.effective_date}."
        elif provision:
            current_position = f"{provision.act_title} {provision.section_number} is currently {provision.status}."

        # Build Full Structured Markdown representation
        formatted_markdown = self._build_formatted_markdown(
            raw_query=raw_query,
            parsed=parsed,
            provision=provision,
            statute_mapping=statute_mapping,
            potential_provisions=potential_provisions,
            cases=cases,
            key_requirements=key_requirements,
            possible_consequences=possible_consequences,
            current_position=current_position,
            direct_answer=direct_answer,
        )

        # Structured sections list
        structured_sections: list[SummaryStructuredSection] = [
            SummaryStructuredSection(title="DIRECT ANSWER", points=[direct_answer]),
            SummaryStructuredSection(title="APPLICABLE LAW", points=applicable_law),
        ]
        if key_requirements:
            structured_sections.append(SummaryStructuredSection(title="KEY REQUIREMENTS / INGREDIENTS", points=key_requirements))
        if possible_consequences:
            structured_sections.append(SummaryStructuredSection(title="POSSIBLE CONSEQUENCES", points=possible_consequences))
        if relevant_judgments:
            structured_sections.append(SummaryStructuredSection(title="RELEVANT CASE LAW", points=relevant_judgments))

        return ResearchSummaryResponse(
            direct_answer=direct_answer,
            formatted_markdown=formatted_markdown,
            applicable_law=applicable_law,
            relevant_section=provision.section_number if provision else (potential_provisions[0].section if potential_provisions else None),
            key_principles=key_principles,
            key_requirements=key_requirements,
            possible_consequences=possible_consequences,
            relevant_judgments=relevant_judgments,
            latest_developments=latest_dev,
            practical_interpretation=practical,
            current_position=current_position,
            sections=structured_sections,
            citations=citations,
        )

    def _build_formatted_markdown(
        self,
        raw_query: str,
        parsed: ParsedQuery,
        provision: LegalProvisionResponse | None,
        statute_mapping: StatuteMappingResponse | None,
        potential_provisions: list[PotentialProvisionItem],
        cases: list[CaseLawResponse],
        key_requirements: list[str],
        possible_consequences: list[str],
        current_position: str | None,
        direct_answer: str,
    ) -> str:
        parts: list[str] = []

        # 1. DIRECT ANSWER
        parts.append("### DIRECT ANSWER\n\n")
        parts.append(f"{direct_answer}\n\n")

        # 2. APPLICABLE LAW
        parts.append("### APPLICABLE LAW\n\n")
        if provision:
            parts.append(f"- **Primary Statutory Provision**: {provision.act_title}, {provision.section_number} (*{provision.section_title}*) [Source 2]\n")
            parts.append(f"- **Status**: {provision.status}\n")
        elif potential_provisions:
            p0 = potential_provisions[0]
            parts.append(f"- **Primary Provision**: {p0.act}, {p0.section} (*{p0.title}*) [Source 2]\n")
        if statute_mapping:
            parts.append(f"- **Current Law (w.e.f. {statute_mapping.effective_date})**: {statute_mapping.current_act}, {statute_mapping.current_section} (*{statute_mapping.current_title}*)\n")
            parts.append(f"- **Legislative Authority**: {statute_mapping.statutory_authority}\n")
        parts.append("\n")

        # 3. WHY IT MAY APPLY
        parts.append("### WHY IT MAY APPLY\n\n")
        is_conduct_query = any(w in raw_query.lower() for w in ["maar", "jaan", "hatya", "fraud", "dhokhadhadi", "chhal", "dhamki", "threat", "kabja", "trespass", "bounce"]) or (potential_provisions and len(potential_provisions) > 0)
        if is_conduct_query:
            parts.append("> **Legal Ethics Notice**: Based on the facts provided, this provision may be relevant. Additional facts are required to determine applicability, and final applicability depends on judicial interpretation.\n\n")

        if provision:
            parts.append(f"1. **Factual Trigger**: The stated query implicates {provision.section_title.lower()} governed by {provision.act_title}.\n")
            parts.append(f"2. **Substantive Rule**: {provision.what_it_means}\n")
        elif potential_provisions:
            p0 = potential_provisions[0]
            parts.append(f"1. **Factual Trigger**: {p0.why_relevant}\n")
            parts.append(f"2. **Statutory Threshold**: Invoked under {p0.act} where facts indicate corresponding conduct.\n")
        parts.append("\n")

        # 4. KEY REQUIREMENTS / INGREDIENTS
        if key_requirements:
            parts.append("### KEY REQUIREMENTS / INGREDIENTS\n\n")
            for i, req in enumerate(key_requirements, 1):
                parts.append(f"{i}. {req}\n")
            parts.append("\n")

        # 5. POTENTIALLY RELEVANT PROVISIONS
        if len(potential_provisions) > 1:
            parts.append("### POTENTIALLY RELEVANT PROVISIONS\n\n")
            parts.append("Depending on specific transaction details or overt acts, the following provisions may also apply:\n\n")
            for p in potential_provisions:
                counterpart_txt = f" *(formerly {p.historical_counterpart})*" if p.historical_counterpart else ""
                penalty_txt = f" — **Statutory Effect**: {p.statutory_effect}" if p.statutory_effect else ""
                parts.append(f"- **{p.act} — {p.section}**: *{p.title}*{counterpart_txt}\n")
                parts.append(f"  - **Why Relevant**: {p.why_relevant}{penalty_txt}\n")
            parts.append("\n")

        # 6. POSSIBLE CONSEQUENCES
        if possible_consequences:
            parts.append("### POSSIBLE CONSEQUENCES\n\n")
            for c in possible_consequences:
                parts.append(f"- {c}\n")
            parts.append("\n")

        # 7. RELEVANT CASE LAW
        if cases:
            parts.append("### RELEVANT CASE LAW\n\n")
            for c in cases[:3]:
                parts.append(f"- **{c.title}** (`{c.citation}`, {c.year}) — *{c.court}* [Source 1]\n")
                parts.append(f"  - **Ratio Decidendi**: {c.ratio_decidendi}\n")
            parts.append("\n")

        # 8. CURRENT LEGAL POSITION
        if current_position or statute_mapping:
            parts.append("### CURRENT LEGAL POSITION\n\n")
            if statute_mapping:
                parts.append(f"- **Old Law ↔ Current Law Transition**: {statute_mapping.old_section} ({statute_mapping.old_act}) is replaced by {statute_mapping.current_section} ({statute_mapping.current_act}) w.e.f. {statute_mapping.effective_date}.\n")
                parts.append(f"- **Statutory Effect**: {statute_mapping.how_law_changed}\n")
                if statute_mapping.key_differences:
                    for diff in statute_mapping.key_differences:
                        parts.append(f"  - {diff}\n")
            elif current_position:
                parts.append(f"- {current_position}\n")
            parts.append("\n")

        # 9. SOURCES
        parts.append("### SOURCES\n\n")
        parts.append("- [Source 1: Supreme Court of India Official Records](https://main.sci.gov.in/judgments)\n")
        parts.append("- [Source 2: India Code / Legislative Department](https://www.indiacode.nic.in/)\n")

        return "".join(parts).strip()

    async def get_provision(self, act_code: str, section: str) -> tuple[LegalProvisionResponse | None, StatuteMappingResponse | None]:
        prov = StatuteRegistry.get_provision(act_code, section)
        mapping = StatuteRegistry.get_statute_mapping(act_code, section)
        return prov, mapping

    async def find_precedents(self, issue: str, facts: str, section: str | None = None) -> PrecedentPairResponse:
        combined = f"{issue} {facts} {section or ''}"
        parsed = LegalQueryParser.parse(combined)
        case_results = await self.sc_connector.search_cases(parsed.cleaned_query or issue)

        supporting = [c for c in case_results if c.precedent_type == "SUPPORTING"]
        contrary = [c for c in case_results if c.precedent_type == "CONTRARY"]
        distinguishing = [c for c in case_results if c.precedent_type == "DISTINGUISHING"]

        return PrecedentPairResponse(
            supporting_precedents=supporting,
            contrary_precedents=contrary,
            distinguishing_precedents=distinguishing,
        )

    async def verify_citation(self, citation_str: str) -> CitationVerificationResponse:
        raw = (citation_str or "").strip()
        if not raw:
            return CitationVerificationResponse(
                citation="",
                status="NOT_FOUND",
                status_message="Please provide a valid citation string.",
                source_attribution="Indian Legal Citation Index",
            )

        # Search against verified cases
        for case in SupremeCourtConnector.VERIFIED_BENCHMARK_CASES:
            if (
                raw.lower() in case["citation"].lower()
                or any(raw.lower() in alt.lower() for alt in case.get("alternate_citations", []))
                or raw.lower() in case["title"].lower()
            ):
                return CitationVerificationResponse(
                    citation=case["citation"],
                    status="VERIFIED",
                    case_name=case["title"],
                    court=case["court"],
                    year=case["year"],
                    bench=case["bench"],
                    status_message="Verified Authority: Found in Supreme Court of India officially reported citations.",
                    source_attribution="Supreme Court of India Official Registry",
                    source_url="https://main.sci.gov.in/judgments",
                    alternate_citations=case.get("alternate_citations", []),
                    treatment_history={"overruled": False, "upheld_by": "Supreme Court of India", "cases_referred": case.get("cases_referred", [])},
                )

        # Check syntax pattern
        import re
        if re.search(r"\b(\d{4}|\(\d{4}\))\s*(INSC|SCC|AIR|SCR|SCALE|ILR|CrLJ)\b", raw, re.IGNORECASE):
            return CitationVerificationResponse(
                citation=raw,
                status="NEEDS_REVIEW",
                status_message="Citation matches standard Indian legal citation syntax, but external court registry API is not currently connected to verify the live docket.",
                source_attribution="External Court Registry (Disconnected)",
                source_url=None,
            )

        return CitationVerificationResponse(
            citation=raw,
            status="NOT_FOUND",
            status_message="Citation not found in verified dataset. Please verify the volume, journal code, and page number.",
            source_attribution="Indian Legal Citation Index",
            source_url=None,
        )

