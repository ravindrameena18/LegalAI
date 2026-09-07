import json
from uuid import UUID, uuid4
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.ai.providers import MockAIProvider
from app.database.models import Document, DocumentPage, DocumentVersion, User
from app.services.risk_scoring import calculate_overall_risk


@pytest.fixture
def lawyer_client(client: TestClient) -> tuple[TestClient, dict[str, str]]:
    email = f"counsel_{uuid4().hex[:8]}@firm.com"
    res = client.post(
        "/api/auth/register",
        json={
            "name": "Audit Counsel",
            "email": email,
            "password": "StrongPassword123!",
            "confirmPassword": "StrongPassword123!",
            "role": "LAWYER",
        },
    )
    assert res.status_code == status.HTTP_201_CREATED
    token = res.json()["token"]
    client.headers["Authorization"] = f"Bearer {token}"
    return client, res.json()["user"]


def _create_ready_document(db: Session, owner_id, doc_name: str, pages_text: list[str]) -> Document:
    owner_uuid = UUID(owner_id) if isinstance(owner_id, str) else owner_id
    doc = Document(
        id=uuid4(),
        owner_id=owner_uuid,
        name=doc_name,
        file_type="pdf",
        mime_type="application/pdf",
        file_size=2048,
        status="ready",
        processing_status="ready",
        page_count=len(pages_text),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    version = DocumentVersion(
        id=uuid4(),
        document_id=doc.id,
        storage_key=f"documents/{doc.id}/v1/original.pdf",
        content_type="application/pdf",
        file_size=2048,
    )
    db.add(version)
    db.commit()

    for idx, text in enumerate(pages_text, start=1):
        db.add(
            DocumentPage(
                id=uuid4(),
                version_id=version.id,
                page_number=idx,
                text=text,
            )
        )
    db.commit()
    db.refresh(doc)
    return doc


def test_pure_risk_scoring_calculation() -> None:
    # 1. High risk findings
    high_risks = [
        {"severity": "HIGH", "title": "Uncapped IP Indemnity"},
        {"severity": "MEDIUM", "title": "Net 15 Payment Terms"},
    ]
    res_high = calculate_overall_risk(high_risks)
    assert res_high["level"] == "HIGH"
    assert res_high["score"] == (1 * 5) + (1 * 2)
    assert res_high["counts"]["high"] == 1
    assert res_high["counts"]["medium"] == 1

    # 2. Critical risk findings
    critical_risks = [
        {"severity": "CRITICAL", "title": "Total Unlimited Liability"},
        {"severity": "CRITICAL", "title": "Breach Liquidated Damages"},
    ]
    res_crit = calculate_overall_risk(critical_risks)
    assert res_crit["level"] == "CRITICAL"
    assert res_crit["score"] >= 20

    # 3. Low risk / Clean document
    low_risks = [
        {"severity": "LOW", "title": "Standard Governing Law Clause"}
    ]
    res_low = calculate_overall_risk(low_risks)
    assert res_low["level"] == "LOW"
    assert res_low["score"] == 1

    # 4. Zero findings
    res_zero = calculate_overall_risk([])
    assert res_zero["level"] == "LOW"
    assert res_zero["score"] == 0

    # 5. Determinism: same input always equals same output
    assert calculate_overall_risk(high_risks) == calculate_overall_risk(high_risks)


def test_a_analyze_same_pdf_twice_consistent_risk(
    lawyer_client: tuple[TestClient, dict[str, str]],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Test A: Analyze the exact same PDF/document twice.
    Expected: Same risk findings, same overall risk score, and same risk classification.
    """
    import app.services.analysis_service

    monkeypatch.setattr(app.services.analysis_service, "get_ai_provider", lambda: MockAIProvider())

    client, user = lawyer_client
    doc = _create_ready_document(
        db=db_session,
        owner_id=user["id"],
        doc_name="Master_Services_Agreement_10.pdf",
        pages_text=[
            "Section 1. Term and Services.\nSection 2. Confidentiality.\nSection 3. Liability capped at $50,000 with carveouts for IP infringement."
        ],
    )

    # First analysis
    res1 = client.post(f"/api/documents/{doc.id}/analyze")
    assert res1.status_code == status.HTTP_200_OK
    data1 = res1.json()

    # Second analysis (without force - reuses completed analysis)
    res2 = client.post(f"/api/documents/{doc.id}/analyze")
    assert res2.status_code == status.HTTP_200_OK
    data2 = res2.json()

    assert data1["id"] == data2["id"], "Non-forced analysis must reuse existing completed analysis"
    assert data1["risk_count"] == data2["risk_count"]

    risk_assess_1 = data1["structured_data"]["risk_assessment"]
    risk_assess_2 = data2["structured_data"]["risk_assessment"]
    assert risk_assess_1["level"] == risk_assess_2["level"]
    assert risk_assess_1["score"] == risk_assess_2["score"]
    assert risk_assess_1["counts"] == risk_assess_2["counts"]

    # Third analysis (forced re-run with force=True)
    res3 = client.post(f"/api/documents/{doc.id}/analyze?force=true")
    assert res3.status_code == status.HTTP_200_OK
    data3 = res3.json()

    risk_assess_3 = data3["structured_data"]["risk_assessment"]
    # Even after a forced re-run on the same document content, deterministic rules ensure identical classification
    assert risk_assess_3["level"] == risk_assess_1["level"]
    assert risk_assess_3["score"] == risk_assess_1["score"]


def test_b_multiple_reports_from_same_analysis(
    lawyer_client: tuple[TestClient, dict[str, str]],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Test B: Generate multiple reports from the same completed analysis.
    Expected: Same risk classification and clear analysis_id link.
    """
    import app.services.analysis_service

    monkeypatch.setattr(app.services.analysis_service, "get_ai_provider", lambda: MockAIProvider())

    client, user = lawyer_client
    doc = _create_ready_document(
        db=db_session,
        owner_id=user["id"],
        doc_name="Vendor_Agreement_Final.pdf",
        pages_text=["This agreement contains standard vendor obligations and liability terms."],
    )

    # 1. Run analysis
    res_an = client.post(f"/api/documents/{doc.id}/analyze")
    assert res_an.status_code == status.HTTP_200_OK
    analysis_id = res_an.json()["id"]

    # 2. Generate Report 1
    res_rep1 = client.post("/api/reports/generate", json={"document_id": str(doc.id)})
    assert res_rep1.status_code == status.HTTP_200_OK
    rep1 = res_rep1.json()

    # 3. Generate Report 2
    res_rep2 = client.post("/api/reports/generate", json={"document_id": str(doc.id)})
    assert res_rep2.status_code == status.HTTP_200_OK
    rep2 = res_rep2.json()

    # Assertions
    assert rep1["analysis_id"] == analysis_id
    assert rep2["analysis_id"] == analysis_id
    assert rep1["risk_level"] == rep2["risk_level"], "Multiple reports for the same analysis must have identical risk level"
    assert rep1["risk_score"] == rep2["risk_score"]
    assert rep1["status"] == "COMPLETED"
    assert rep2["status"] == "COMPLETED"

    # Also list reports
    res_list = client.get("/api/reports")
    assert res_list.status_code == status.HTTP_200_OK
    reports = res_list.json()
    matching_reports = [r for r in reports if r["document_id"] == str(doc.id)]
    assert len(matching_reports) >= 1
    for r in matching_reports:
        assert r["risk_level"] == rep1["risk_level"]


def test_c_two_different_pdfs_have_different_risk_classifications(
    lawyer_client: tuple[TestClient, dict[str, str]],
    db_session: Session,
    monkeypatch,
) -> None:
    """
    Test C: Two different PDFs with different findings.
    Expected: They can legitimately have different risk classifications based on actual document findings.
    """
    from app.ai.providers import AIRequest, AIResponse, MockAIProvider

    client, user = lawyer_client

    # Doc 1: High risk contract
    doc_high = _create_ready_document(
        db=db_session,
        owner_id=user["id"],
        doc_name="High_Risk_Contract.pdf",
        pages_text=["Agreement with unlimited indemnity and immediate termination."],
    )

    # Doc 2: Low risk clean agreement
    doc_low = _create_ready_document(
        db=db_session,
        owner_id=user["id"],
        doc_name="Standard_Low_Risk_NDA.pdf",
        pages_text=["Mutual NDA with standard terms and zero unilateral indemnity."],
    )

    # Mock high risk response for doc_high
    high_mock_json = json.dumps({
        "executive_summary": "High risk vendor contract.",
        "document_type": "Vendor Contract",
        "parties": [{"name": "A", "role": "Vendor"}],
        "risks": [
            {"title": "Uncapped Liability", "severity": "HIGH", "explanation": "Unlimited damages", "source_text": "unlimited", "suggested_review_action": "Cap damages"},
            {"title": "Immediate Termination", "severity": "HIGH", "explanation": "No cure period", "source_text": "immediate termination", "suggested_review_action": "Add 30-day cure"},
        ],
    })

    # Mock low risk response for doc_low
    low_mock_json = json.dumps({
        "executive_summary": "Low risk mutual agreement.",
        "document_type": "Mutual NDA",
        "parties": [{"name": "A", "role": "Party 1"}, {"name": "B", "role": "Party 2"}],
        "risks": [
            {"title": "Standard Notice Period", "severity": "LOW", "explanation": "30 days notice", "source_text": "30 days", "suggested_review_action": "Standard"}
        ],
    })

    class DynamicMockProvider:
        async def complete(self, request: AIRequest) -> AIResponse:
            full_text = " ".join(request.document_context)
            if "unlimited indemnity" in full_text.lower():
                return AIResponse(content=high_mock_json)
            return AIResponse(content=low_mock_json)

        def test_connection(self):
            return {"configured": True, "provider": "mock", "model": "mock", "status": "healthy"}

    import app.services.analysis_service
    monkeypatch.setattr(app.services.analysis_service, "get_ai_provider", lambda: DynamicMockProvider())

    # Analyze both
    res_h = client.post(f"/api/documents/{doc_high.id}/analyze")
    assert res_h.status_code == 200
    res_l = client.post(f"/api/documents/{doc_low.id}/analyze")
    assert res_l.status_code == 200

    # Generate reports
    rep_h = client.post("/api/reports/generate", json={"document_id": str(doc_high.id)}).json()
    rep_l = client.post("/api/reports/generate", json={"document_id": str(doc_low.id)}).json()

    assert rep_h["risk_level"] == "HIGH", "Document with multiple high risks must be classified as HIGH RISK"
    assert rep_l["risk_level"] == "LOW", "Document with only low risks must be classified as LOW RISK"
    assert rep_h["risk_level"] != rep_l["risk_level"]


def test_d_password_protected_pdf_consistent_risk_after_unlock(
    lawyer_client: tuple[TestClient, dict[str, str]],
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Test D: Password-protected PDF after successful unlock.
    Expected: Repeated analysis/report generation remains consistent.
    """
    import app.services.analysis_service

    monkeypatch.setattr(app.services.analysis_service, "get_ai_provider", lambda: MockAIProvider())

    client, user = lawyer_client

    # Create password-protected document in password_required state
    doc = Document(
        id=uuid4(),
        owner_id=UUID(user["id"]),
        name="10_Encrypted_Contract.pdf",
        file_type="pdf",
        mime_type="application/pdf",
        file_size=5000,
        status="password_required",
        processing_status="password_required",
        page_count=0,
    )
    db_session.add(doc)
    db_session.commit()

    # Attempting to analyze before unlock fails
    res_early = client.post(f"/api/documents/{doc.id}/analyze")
    assert res_early.status_code == status.HTTP_400_BAD_REQUEST

    # Simulate successful password unlock -> transition to READY with extracted pages
    doc.status = "ready"
    doc.processing_status = "ready"
    doc.page_count = 2
    db_session.commit()

    v1 = DocumentVersion(
        id=uuid4(),
        document_id=doc.id,
        storage_key=f"documents/{doc.id}/v1/unlocked.pdf",
        content_type="application/pdf",
        file_size=5000,
    )
    db_session.add(v1)
    db_session.commit()

    db_session.add(DocumentPage(id=uuid4(), version_id=v1.id, page_number=1, text="Confidential agreement page 1."))
    db_session.add(DocumentPage(id=uuid4(), version_id=v1.id, page_number=2, text="Confidential agreement page 2 with liability terms."))
    db_session.commit()

    # Run analysis after unlock
    res_unlock_an = client.post(f"/api/documents/{doc.id}/analyze")
    assert res_unlock_an.status_code == status.HTTP_200_OK
    an_id = res_unlock_an.json()["id"]

    # Generate Report 1
    rep1 = client.post("/api/reports/generate", json={"document_id": str(doc.id)}).json()
    assert rep1["analysis_id"] == an_id
    assert rep1["status"] == "COMPLETED"

    # Query reports list (Report 2)
    rep_list = client.get("/api/reports").json()
    doc_reports = [r for r in rep_list if r["document_id"] == str(doc.id)]
    assert len(doc_reports) >= 1
    rep2 = doc_reports[0]

    assert rep1["risk_level"] == rep2["risk_level"], "Unlocked password PDF must retain consistent risk level across report requests"
    assert rep1["risk_score"] == rep2["risk_score"]
    assert rep1["analysis_id"] == rep2["analysis_id"]
