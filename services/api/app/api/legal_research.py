from fastapi import APIRouter, Query
from app.schemas.legal_research import (
    CaseLawResponse,
    CitationVerificationResponse,
    LegalProvisionResponse,
    LegalQueryRequest,
    LegalSearchResponse,
    OfficialSourceItem,
    PrecedentPairResponse,
    StatuteMappingResponse,
)
from app.services.legal_research_service import LegalResearchService

router = APIRouter()
_service = LegalResearchService()


@router.post("/search", response_model=LegalSearchResponse)
async def search_legal_research(request: LegalQueryRequest) -> LegalSearchResponse:
    """
    Search judgments, acts, sections, and legal principles with source-grounded accuracy.
    Supports English and Hinglish natural language queries.
    """
    return await _service.search(request)


@router.get("/statute", response_model=dict)
async def get_statute(
    act: str = Query(..., description="Act code or name, e.g. IPC, BNS, CrPC, BNSS, NI Act"),
    section: str = Query(..., description="Section number, e.g. 300, 34, 138, 438"),
) -> dict:
    """
    Retrieve section-wise legal information and Old Law -> Current Law transition mapping.
    """
    prov, mapping = await _service.get_provision(act, section)
    return {
        "provision": prov,
        "statute_mapping": mapping,
    }


@router.get("/cases", response_model=list[CaseLawResponse])
async def search_cases(
    query: str = Query(default="", description="Search query"),
    court_filter: str = Query(default="all"),
    year_filter: str = Query(default="all"),
    sort_by: str = Query(default="relevance"),
) -> list[CaseLawResponse]:
    """
    Search case laws across Supreme Court and verified judicial sources.
    """
    req = LegalQueryRequest(
        query=query,
        court_filter=court_filter,
        year_filter=year_filter,
        sort_by=sort_by,  # type: ignore
    )
    res = await _service.search(req)
    return res.cases


@router.post("/precedents", response_model=PrecedentPairResponse)
async def find_precedents(
    payload: dict,
) -> PrecedentPairResponse:
    """
    Find supporting, contrary, and distinguishing precedents for a legal issue.
    """
    issue = payload.get("legal_issue", "")
    facts = payload.get("facts", "")
    section = payload.get("section", None)
    return await _service.find_precedents(issue, facts, section)


@router.post("/verify-citation", response_model=CitationVerificationResponse)
async def verify_citation(payload: dict) -> CitationVerificationResponse:
    """
    Verify a citation string against officially reported Supreme Court and High Court citations.
    """
    citation_str = payload.get("citation", "")
    return await _service.verify_citation(citation_str)


@router.get("/sources", response_model=list[OfficialSourceItem])
async def list_sources() -> list[OfficialSourceItem]:
    """
    List connected official legal sources and their live connectivity status.
    """
    return [
        _service.sc_connector.get_source_metadata(),
        _service.india_code_connector.get_source_metadata(),
        _service.ecourts_connector.get_source_metadata(),
    ]

