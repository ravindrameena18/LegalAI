import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.schemas.legal_research import LegalQueryRequest
from app.services.legal_sources.query_parser import LegalQueryParser
from app.services.legal_sources.statute_registry import StatuteRegistry
from app.services.legal_sources.supreme_court_connector import SupremeCourtConnector
from app.services.legal_research_service import LegalResearchService

client = TestClient(app)


def test_query_parser_english_and_hinglish():
    # Test 1: Hinglish IPC 300
    p1 = LegalQueryParser.parse("IPC Section 300 mein kya hota hai?")
    assert p1.act_code == "IPC"
    assert p1.section_number == "300"
    assert p1.detected_language == "hi-Latn"

    # Test 2: Hinglish IPC 34
    p2 = LegalQueryParser.parse("IPC Section 34 ka kya meaning hai?")
    assert p2.act_code == "IPC"
    assert p2.section_number == "34"

    # Test 3: BNS murder
    p3 = LegalQueryParser.parse("BNS mein murder ki provision kya hai?")
    assert p3.act_code == "BNS"
    assert p3.legal_concept == "murder"

    # Test 4: Section 138 NI Act latest judgments
    p4 = LegalQueryParser.parse("Section 138 NI Act ke latest Supreme Court judgments")
    assert p4.act_code == "NI Act"
    assert p4.section_number == "138"
    assert p4.is_latest_requested is True
    assert p4.court == "Supreme Court of India"

    # Test 5: Anticipatory bail
    p5 = LegalQueryParser.parse("anticipatory bail ke recent judgments")
    assert p5.legal_concept == "anticipatory bail"
    assert p5.is_latest_requested is True

    # Test 6: Arbitration
    p6 = LegalQueryParser.parse("arbitration clause validity Supreme Court")
    assert p6.act_code == "Arbitration Act"
    assert p6.court == "Supreme Court of India"

    # Test 7: Contract breach
    p7 = LegalQueryParser.parse("contract breach Supreme Court")
    assert p7.act_code == "Contract Act"
    assert p7.legal_concept == "breach of contract and damages"


def test_statute_registry_mappings():
    # IPC 300 -> BNS 101/103
    m_300 = StatuteRegistry.get_statute_mapping("IPC", "300")
    assert m_300 is not None
    assert m_300.old_act == "Indian Penal Code, 1860"
    assert m_300.old_section == "Section 300"
    assert m_300.current_act == "Bharatiya Nyaya Sanhita, 2023 (BNS)"
    assert m_300.current_section == "Section 101"
    assert any("mob lynching" in diff.lower() for diff in m_300.key_differences)

    # IPC 34 -> BNS 3(5)
    m_34 = StatuteRegistry.get_statute_mapping("IPC", "34")
    assert m_34 is not None
    assert m_34.current_section == "Section 3(5)"

    # CrPC 438 -> BNSS 482
    m_438 = StatuteRegistry.get_statute_mapping("CrPC", "438")
    assert m_438 is not None
    assert m_438.current_section == "Section 482"

    # IEA 65B -> BSA 61/63
    m_65b = StatuteRegistry.get_statute_mapping("IEA", "65B")
    assert m_65b is not None
    assert "Section 61" in m_65b.current_section


def test_statute_registry_provisions():
    p_300 = StatuteRegistry.get_provision("IPC", "300")
    assert p_300 is not None
    assert len(p_300.ingredients) >= 4
    assert any("grave and sudden provocation" in ing.lower() for ing in p_300.ingredients)

    p_138 = StatuteRegistry.get_provision("NI Act", "138")
    assert p_138 is not None
    assert any("demand notice" in ing.lower() for ing in p_138.ingredients)


@pytest.mark.asyncio
async def test_supreme_court_connector_search():
    connector = SupremeCourtConnector()
    results = await connector.search_cases("arbitration")
    assert len(results) > 0
    assert any("stamp act" in r.title.lower() or "vidya drolia" in r.title.lower() for r in results)
    assert all(r.source_url.startswith("https://main.sci.gov.in") for r in results)


@pytest.mark.asyncio
async def test_legal_research_service_the_7_mandatory_queries():
    service = LegalResearchService()

    # Query 1: IPC Section 300
    res1 = await service.search(LegalQueryRequest(query="IPC Section 300"))
    assert res1.provision is not None
    assert res1.statute_mapping is not None
    assert res1.statute_mapping.current_section == "Section 101"
    assert len(res1.cases) > 0
    assert res1.summary is not None
    assert "[Source 2]" in res1.summary.direct_answer

    # Query 2: IPC Section 34
    res2 = await service.search(LegalQueryRequest(query="IPC Section 34"))
    assert res2.provision is not None
    assert res2.statute_mapping is not None
    assert res2.statute_mapping.current_section == "Section 3(5)"
    assert len(res2.cases) > 0

    # Query 3: BNS murder
    res3 = await service.search(LegalQueryRequest(query="BNS murder"))
    assert res3.provision is not None
    assert res3.provision.act_code == "BNS"
    assert "101" in res3.provision.section_number or "103" in res3.provision.section_number

    # Query 4: Section 138 NI Act latest judgments
    res4 = await service.search(LegalQueryRequest(query="Section 138 NI Act latest judgments"))
    assert res4.provision is not None
    assert res4.provision.section_number == "Section 138"
    assert len(res4.latest_cases) > 0
    # Confirm descending order of recency
    years = [c.year for c in res4.latest_cases]
    assert years == sorted(years, reverse=True)

    # Query 5: arbitration latest Supreme Court judgments
    res5 = await service.search(LegalQueryRequest(query="arbitration latest Supreme Court judgments"))
    assert len(res5.cases) > 0
    assert any("2023" in str(c.year) for c in res5.cases)

    # Query 6: anticipatory bail latest cases
    res6 = await service.search(LegalQueryRequest(query="anticipatory bail latest cases"))
    assert res6.provision is not None
    assert len(res6.cases) > 0
    assert any("sushila aggarwal" in c.title.lower() for c in res6.cases)

    # Query 7: contract breach Supreme Court
    res7 = await service.search(LegalQueryRequest(query="contract breach Supreme Court"))
    assert len(res7.cases) > 0
    assert any("kailash nath" in c.title.lower() for c in res7.cases)


@pytest.mark.asyncio
async def test_conduct_and_multi_provision_queries():
    service = LegalResearchService()

    # Conduct Query 1: Jaan se maar diya
    res_kill = await service.search(LegalQueryRequest(query="Agar kisi ko jaan se maar diya jaye to kaun si dhara lag sakti hai?"))
    assert len(res_kill.provisions) >= 3
    assert any("101" in p.section for p in res_kill.provisions)
    assert any("100" in p.section or "105" in p.section for p in res_kill.provisions)
    assert res_kill.summary is not None
    assert "### POTENTIALLY RELEVANT PROVISIONS" in res_kill.summary.formatted_markdown
    assert "Legal Ethics Notice" in res_kill.summary.formatted_markdown

    # Conduct Query 2: Cheque bounce
    res_chq = await service.search(LegalQueryRequest(query="Cheque bounce hone par kaunsi dhara lagti hai?"))
    assert len(res_chq.provisions) >= 2
    assert any("138" in p.section for p in res_chq.provisions)
    assert any("141" in p.section for p in res_chq.provisions)
    assert res_chq.summary is not None
    assert "### KEY REQUIREMENTS / INGREDIENTS" in res_chq.summary.formatted_markdown

    # Conduct Query 3: Fraud ke case mein
    res_fraud = await service.search(LegalQueryRequest(query="Fraud ke case mein kaun kaun se sections relevant ho sakte hain?"))
    assert len(res_fraud.provisions) >= 3
    assert any("318" in p.section for p in res_fraud.provisions)
    assert any("316" in p.section for p in res_fraud.provisions)
    assert any("66D" in p.section for p in res_fraud.provisions)
    assert res_fraud.summary is not None
    assert "### POTENTIALLY RELEVANT PROVISIONS" in res_fraud.summary.formatted_markdown
    assert "Legal Ethics Notice" in res_fraud.summary.formatted_markdown

    # Conduct Query 4: Dhamki / Intimidation
    res_threat = await service.search(LegalQueryRequest(query="Dhamki dene par kaun si dhara lagti hai?"))
    assert len(res_threat.provisions) >= 2
    assert any("351" in p.section for p in res_threat.provisions)

    # Conduct Query 5: Property par kabja
    res_prop = await service.search(LegalQueryRequest(query="Property par jabardasti kabja karne par kya provision hai?"))
    assert len(res_prop.provisions) >= 2
    assert any("329" in p.section for p in res_prop.provisions)
    assert any("Specific Relief" in p.act for p in res_prop.provisions)


@pytest.mark.asyncio
async def test_pointwise_structured_markdown_format():
    service = LegalResearchService()
    res = await service.search(LegalQueryRequest(query="IPC Section 300 mein kya hota hai?"))
    assert res.summary is not None
    fm = res.summary.formatted_markdown
    assert "### DIRECT ANSWER" in fm
    assert "### APPLICABLE LAW" in fm
    assert "### WHY IT MAY APPLY" in fm
    assert "### KEY REQUIREMENTS / INGREDIENTS" in fm
    assert "### POSSIBLE CONSEQUENCES" in fm
    assert "### RELEVANT CASE LAW" in fm
    assert "### CURRENT LEGAL POSITION" in fm
    assert "### SOURCES" in fm
    assert "https://main.sci.gov.in/judgments" in fm
    assert "https://www.indiacode.nic.in/" in fm


@pytest.mark.asyncio
async def test_zero_fabrication_unconfigured_behavior():
    service = LegalResearchService()
    res = await service.search(LegalQueryRequest(query="random nonsense query xyz123456789"))
    assert res.is_unconfigured_query is True
    assert res.provision is None
    assert len(res.cases) == 0
    assert res.warning_message is not None
    assert "never fabricates" in res.warning_message.lower()


def test_api_endpoints():
    # Test POST /api/research/search
    resp = client.post("/api/research/search", json={"query": "IPC Section 300"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["provision"]["act_code"] == "IPC"
    assert data["statute_mapping"]["current_section"] == "Section 101"
    assert len(data["cases"]) > 0
    assert len(data["sources"]) == 3

    # Test GET /api/research/statute
    resp_statute = client.get("/api/research/statute?act=IPC&section=300")
    assert resp_statute.status_code == 200
    st_data = resp_statute.json()
    assert st_data["provision"]["section_title"] == "Murder"
    assert st_data["statute_mapping"]["current_act"].startswith("Bharatiya Nyaya Sanhita")

    # Test GET /api/research/cases
    resp_cases = client.get("/api/research/cases?query=arbitration")
    assert resp_cases.status_code == 200
    assert isinstance(resp_cases.json(), list)
    assert len(resp_cases.json()) > 0

    # Test GET /api/research/sources
    resp_sources = client.get("/api/research/sources")
    assert resp_sources.status_code == 200
    sources = resp_sources.json()
    assert len(sources) >= 3
    assert any(s["id"] == "supreme_court_india" for s in sources)

    # Test POST /api/research/verify-citation
    resp_cit = client.post("/api/research/verify-citation", json={"citation": "(2021) 2 SCC 1"})
    assert resp_cit.status_code == 200
    cit_data = resp_cit.json()
    assert cit_data["status"] == "VERIFIED"
    assert "Vidya Drolia" in cit_data["case_name"]

