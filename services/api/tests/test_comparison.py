from uuid import uuid4
import pytest
from fastapi import status
from fastapi.testclient import TestClient

from app.ai.providers import MockAIProvider, UnconfiguredAIProvider


@pytest.fixture
def test_users(client: TestClient) -> dict[str, str]:
    res_a = client.post(
        "/api/auth/register",
        json={
            "name": "Counsel A",
            "email": "counsel_compare_a@law.com",
            "password": "StrongPassword123!",
            "confirmPassword": "StrongPassword123!",
            "role": "LAWYER",
        },
    )
    token_a = res_a.json()["token"]

    res_b = client.post(
        "/api/auth/register",
        json={
            "name": "Counsel B",
            "email": "counsel_compare_b@law.com",
            "password": "StrongPassword123!",
            "confirmPassword": "StrongPassword123!",
            "role": "LAWYER",
        },
    )
    token_b = res_b.json()["token"]

    res_client = client.post(
        "/api/auth/register",
        json={
            "name": "Client User",
            "email": "client_compare@corp.com",
            "password": "StrongPassword123!",
            "confirmPassword": "StrongPassword123!",
            "role": "CLIENT",
        },
    )
    token_client = res_client.json()["token"]

    return {"token_a": token_a, "token_b": token_b, "token_client": token_client}


def test_comparison_requires_authentication(client: TestClient) -> None:
    client.cookies.clear()
    res = client.post(
        "/api/compare",
        json={"doc_a_id": str(uuid4()), "doc_b_id": str(uuid4())},
    )
    assert res.status_code == status.HTTP_401_UNAUTHORIZED


def test_comparison_same_document_succeeds_with_zero_changes(
    client: TestClient,
    test_users: dict[str, str],
) -> None:
    token_a = test_users["token_a"]

    # Upload document
    doc_res = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token_a}"},
        files={"file": ("contract_v1.txt", b"Master Agreement text.", "text/plain")},
    )
    assert doc_res.status_code == status.HTTP_201_CREATED
    doc_id = doc_res.json()["id"]

    # Comparing identical doc ID (PDF A vs PDF A) succeeds with zero changes
    res = client.post(
        "/api/compare",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "doc_a_id": doc_id,
            "doc_b_id": doc_id,
            "doc_a_label": "Original Contract",
            "doc_b_label": "Identical Copy",
        },
    )
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()["result_data"]
    assert data["metrics"]["total_changes"] == 0
    assert data["metrics"]["added_count"] == 0
    assert data["metrics"]["removed_count"] == 0
    assert data["metrics"]["modified_count"] == 0
    assert data["metrics"]["overall_risk_impact"] == "LOW"
    assert data["analysis_method"] == "document_text_comparison"
    assert data["comparison_source"] == "Fresh PDF extraction"
    assert data["doc_a_file_hash"] is not None


def test_comparison_ownership_isolation(
    client: TestClient,
    test_users: dict[str, str],
) -> None:
    token_a = test_users["token_a"]
    token_b = test_users["token_b"]

    doc_a = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token_a}"},
        files={"file": ("doc_a.txt", b"Content for user A.", "text/plain")},
    ).json()["id"]

    doc_b = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token_b}"},
        files={"file": ("doc_b.txt", b"Content for user B.", "text/plain")},
    ).json()["id"]

    # User A tries to compare User A's doc with User B's doc -> 404 (isolation)
    res = client.post(
        "/api/compare",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"doc_a_id": doc_a, "doc_b_id": doc_b},
    )
    assert res.status_code in [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN]


def test_comparison_success_with_mock_ai(
    client: TestClient,
    test_users: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services import comparison_service

    monkeypatch.setattr(comparison_service, "get_ai_provider", lambda: MockAIProvider())

    token_a = test_users["token_a"]

    doc_1 = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token_a}"},
        files={"file": ("Agreement_Draft_1.txt", b"Section 1: Payment within 30 days. Section 2: Liability cap at $10,000.", "text/plain")},
    ).json()["id"]

    doc_2 = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token_a}"},
        files={"file": ("Agreement_Draft_2.txt", b"Section 1: Payment within 15 days. Section 2: Liability cap at $50,000.", "text/plain")},
    ).json()["id"]

    res = client.post(
        "/api/compare",
        headers={"Authorization": f"Bearer {token_a}"},
        json={
            "doc_a_id": doc_1,
            "doc_b_id": doc_2,
            "doc_a_label": "Original Draft (v1)",
            "doc_b_label": "Revised Draft (v2)",
        },
    )
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()
    assert data["doc_a_label"] == "Original Draft (v1)"
    assert data["doc_b_label"] == "Revised Draft (v2)"
    assert data["status"] == "completed"

    result_data = data["result_data"]
    assert "executive_summary" in result_data
    assert "metrics" in result_data
    assert result_data["metrics"]["total_changes"] >= 1
    assert len(result_data["clause_comparisons"]) >= 1

    comparison_id = data["id"]

    # Fetch comparison by ID
    get_res = client.get(
        f"/api/compare/{comparison_id}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert get_res.status_code == status.HTTP_200_OK
    assert get_res.json()["id"] == comparison_id

    # List comparisons
    list_res = client.get(
        "/api/compare",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert list_res.status_code == status.HTTP_200_OK
    assert any(c["id"] == comparison_id for c in list_res.json())


def test_comparison_works_for_client_role(
    client: TestClient,
    test_users: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services import comparison_service

    monkeypatch.setattr(comparison_service, "get_ai_provider", lambda: MockAIProvider())

    token_client = test_users["token_client"]

    doc_1 = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token_client}"},
        files={"file": ("Client_NDA_v1.txt", b"Confidentiality duration is 2 years.", "text/plain")},
    ).json()["id"]

    doc_2 = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token_client}"},
        files={"file": ("Client_NDA_v2.txt", b"Confidentiality duration is 5 years.", "text/plain")},
    ).json()["id"]

    res = client.post(
        "/api/compare",
        headers={"Authorization": f"Bearer {token_client}"},
        json={"doc_a_id": doc_1, "doc_b_id": doc_2},
    )
    assert res.status_code == status.HTTP_201_CREATED
    assert res.json()["status"] == "completed"


def test_comparison_deterministic_fallback_when_ai_offline(
    client: TestClient,
    test_users: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services import comparison_service

    # Force UnconfiguredAIProvider to trigger fallback
    monkeypatch.setattr(comparison_service, "get_ai_provider", lambda: UnconfiguredAIProvider())

    token_a = test_users["token_a"]

    doc_1 = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token_a}"},
        files={"file": ("Contract_Original.txt", b"Payment shall be net 30 days. Limitation of liability capped at fees paid.", "text/plain")},
    ).json()["id"]

    doc_2 = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token_a}"},
        files={"file": ("Contract_Modified.txt", b"Payment shall be net 15 days. Indemnification: Contractor agrees to defend and indemnify.", "text/plain")},
    ).json()["id"]

    res = client.post(
        "/api/compare",
        headers={"Authorization": f"Bearer {token_a}"},
        json={"doc_a_id": doc_1, "doc_b_id": doc_2},
    )
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()
    assert data["status"] == "completed"
    metrics = data["result_data"]["metrics"]
    assert metrics["total_changes"] >= 1
    # Check that clauses were identified
    assert len(data["result_data"]["clause_comparisons"]) >= 1


def test_comparison_document_swap_symmetry_and_risk_recalculation(
    client: TestClient,
    test_users: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services import comparison_service

    monkeypatch.setattr(comparison_service, "get_ai_provider", lambda: UnconfiguredAIProvider())

    token = test_users["token_a"]

    # Doc A: Payment is ₹10 lakh, has Indemnification clause
    doc_a_content = (
        "Agreement A.\n"
        "Payment Terms: Contractor shall be paid total fee of ₹10 lakh for services rendered.\n"
        "Indemnification: The Vendor agrees to defend and indemnify the Client from all claims.\n"
    )
    # Doc B: Payment is ₹5 lakh, has Non-Compete clause (no Indemnification)
    doc_b_content = (
        "Agreement B.\n"
        "Payment Terms: Contractor shall be paid total fee of ₹5 lakh for services rendered.\n"
        "Non-Compete & Restrictive: Contractor covenants not to compete for a period of 2 years.\n"
    )

    id_a = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("Agreement_A.txt", doc_a_content.encode("utf-8"), "text/plain")},
    ).json()["id"]

    id_b = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("Agreement_B.txt", doc_b_content.encode("utf-8"), "text/plain")},
    ).json()["id"]

    # --- RUN 1: A vs B ---
    res_ab = client.post(
        "/api/compare",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "doc_a_id": id_a,
            "doc_b_id": id_b,
            "doc_a_label": "Agreement A",
            "doc_b_label": "Agreement B",
        },
    )
    assert res_ab.status_code == status.HTTP_201_CREATED
    data_ab = res_ab.json()["result_data"]
    clauses_ab = {c["topic"]: c for c in data_ab["clause_comparisons"]}

    # Payment in A vs B: modified, ₹10 lakh in A to ₹5 lakh in B
    assert "Payment Terms" in clauses_ab
    pay_ab = clauses_ab["Payment Terms"]
    assert pay_ab["change_type"] == "modified"
    assert pay_ab["risk_level"] == "HIGH"
    assert "₹10 lakh in Agreement A to ₹5 lakh in Agreement B" in pay_ab["risk_reason"]
    assert pay_ab["doc_a_text"] is not None and "₹10 lakh" in pay_ab["doc_a_text"]
    assert pay_ab["doc_b_text"] is not None and "₹5 lakh" in pay_ab["doc_b_text"]

    # Indemnification in A vs B: removed from B, HIGH risk
    assert "Indemnification" in clauses_ab
    indem_ab = clauses_ab["Indemnification"]
    assert indem_ab["change_type"] == "removed"
    assert indem_ab["risk_level"] == "HIGH"
    assert "Removal of Indemnification in Agreement B" in indem_ab["risk_reason"]

    # Non-compete in A vs B: added in B, HIGH risk
    assert "Non-Compete & Restrictive" in clauses_ab
    nc_ab = clauses_ab["Non-Compete & Restrictive"]
    assert nc_ab["change_type"] == "added"
    assert nc_ab["risk_level"] == "HIGH"

    assert data_ab["metrics"]["overall_risk_impact"] == "HIGH"
    assert "Agreement A" in data_ab["executive_summary"]
    assert "Agreement B" in data_ab["executive_summary"]

    # --- RUN 2: B vs A (SWAP!) ---
    res_ba = client.post(
        "/api/compare",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "doc_a_id": id_b,
            "doc_b_id": id_a,
            "doc_a_label": "Agreement B",
            "doc_b_label": "Agreement A",
        },
    )
    assert res_ba.status_code == status.HTTP_201_CREATED
    data_ba = res_ba.json()["result_data"]
    clauses_ba = {c["topic"]: c for c in data_ba["clause_comparisons"]}

    # Payment in B vs A: modified, ₹5 lakh in B to ₹10 lakh in A
    assert "Payment Terms" in clauses_ba
    pay_ba = clauses_ba["Payment Terms"]
    assert pay_ba["change_type"] == "modified"
    assert pay_ba["risk_level"] == "HIGH"
    assert "₹5 lakh in Agreement B to ₹10 lakh in Agreement A" in pay_ba["risk_reason"]
    # Snippets must swap sides!
    assert pay_ba["doc_a_text"] is not None and "₹5 lakh" in pay_ba["doc_a_text"]
    assert pay_ba["doc_b_text"] is not None and "₹10 lakh" in pay_ba["doc_b_text"]

    # Indemnification in B vs A: now ADDED in A!
    assert "Indemnification" in clauses_ba
    indem_ba = clauses_ba["Indemnification"]
    assert indem_ba["change_type"] == "added"
    assert indem_ba["risk_level"] == "HIGH"
    assert "New Indemnification clause introduced in Agreement A" in indem_ba["risk_reason"]

    # Non-compete in B vs A: now REMOVED in A! (Removing restrictive covenant is LOW risk)
    assert "Non-Compete & Restrictive" in clauses_ba
    nc_ba = clauses_ba["Non-Compete & Restrictive"]
    assert nc_ba["change_type"] == "removed"
    assert nc_ba["risk_level"] == "LOW"
    assert "Removal of restrictive covenants in Agreement A" in nc_ba["risk_reason"]


def test_comparison_deterministic_stability(
    client: TestClient,
    test_users: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services import comparison_service

    monkeypatch.setattr(comparison_service, "get_ai_provider", lambda: UnconfiguredAIProvider())

    token = test_users["token_a"]

    doc_1 = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("Contract_1.txt", b"Payment shall be net 30 days. Governing law is Delhi.", "text/plain")},
    ).json()["id"]

    doc_2 = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("Contract_2.txt", b"Payment shall be net 15 days. Governing law is Mumbai.", "text/plain")},
    ).json()["id"]

    # Run twice
    res1 = client.post(
        "/api/compare",
        headers={"Authorization": f"Bearer {token}"},
        json={"doc_a_id": doc_1, "doc_b_id": doc_2},
    )
    res2 = client.post(
        "/api/compare",
        headers={"Authorization": f"Bearer {token}"},
        json={"doc_a_id": doc_1, "doc_b_id": doc_2},
    )

    data1 = res1.json()["result_data"]
    data2 = res2.json()["result_data"]

    assert data1["metrics"] == data2["metrics"]
    assert len(data1["clause_comparisons"]) == len(data2["clause_comparisons"])
    for c1, c2 in zip(data1["clause_comparisons"], data2["clause_comparisons"]):
        assert c1["topic"] == c2["topic"]
        assert c1["change_type"] == c2["change_type"]
        assert c1["risk_level"] == c2["risk_level"]
        assert c1["risk_score"] == c2["risk_score"]
        assert c1["risk_reason"] == c2["risk_reason"]


def test_comparison_identical_documents_produce_zero_changes(
    client: TestClient,
    test_users: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services import comparison_service

    monkeypatch.setattr(comparison_service, "get_ai_provider", lambda: UnconfiguredAIProvider())

    token = test_users["token_a"]
    content = b"Master Services Agreement.\nPayment shall be net 30 days.\nLimitation of liability is capped at fees paid."

    doc_1 = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("MSA_Draft.txt", content, "text/plain")},
    ).json()["id"]

    doc_2 = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("MSA_Copy.txt", content, "text/plain")},
    ).json()["id"]

    res = client.post(
        "/api/compare",
        headers={"Authorization": f"Bearer {token}"},
        json={"doc_a_id": doc_1, "doc_b_id": doc_2},
    )
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()["result_data"]
    metrics = data["metrics"]

    # Requirement 11 TEST 4: Total changes = 0, Added = 0, Removed = 0, Modified = 0, Overall Risk = LOW
    assert metrics["total_changes"] == 0
    assert metrics["added_count"] == 0
    assert metrics["removed_count"] == 0
    assert metrics["modified_count"] == 0
    assert metrics["overall_risk_impact"] == "LOW"
    assert len(data["important_changes"]) == 0
    # Every clause item must be unchanged with risk NONE
    for c in data["clause_comparisons"]:
        assert c["change_type"] == "unchanged"
        assert c["risk_level"] == "NONE"


def test_comparison_data_model_fields(
    client: TestClient,
    test_users: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.services import comparison_service

    monkeypatch.setattr(comparison_service, "get_ai_provider", lambda: UnconfiguredAIProvider())

    token = test_users["token_a"]
    doc_1 = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("Doc1.txt", b"Payment is $1000.", "text/plain")},
    ).json()["id"]

    doc_2 = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("Doc2.txt", b"Payment is $2000.", "text/plain")},
    ).json()["id"]

    res = client.post(
        "/api/compare",
        headers={"Authorization": f"Bearer {token}"},
        json={"doc_a_id": doc_1, "doc_b_id": doc_2},
    )
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()["result_data"]
    clause = data["clause_comparisons"][0]

    # Requirement 9: Verify data model fields
    assert "clause_title" in clause
    assert "change_type" in clause
    assert "risk_level" in clause
    assert "risk_score" in clause
    assert "risk_reason" in clause
    assert "legal_impact" in clause
    assert "document_1_text" in clause
    assert "document_2_text" in clause
    assert "document_1_page" in clause
    assert "document_2_page" in clause
    assert "doc_a_text" in clause
    assert "doc_b_text" in clause


def test_comparison_fresh_storage_file_content_change(
    client: TestClient,
    test_users: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Requirement 13 & 14: Verifies that changing the underlying file content in storage
    immediately produces an updated comparison without reusing old answers or caches.
    """
    from app.services import comparison_service
    from app.storage import get_storage_service

    monkeypatch.setattr(comparison_service, "get_ai_provider", lambda: UnconfiguredAIProvider())

    token = test_users["token_a"]

    # 1. Upload Doc A (Payment = ₹10,00,000)
    doc_1 = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("Contract_A.txt", b"Payment Terms: Contractor shall receive payment of Rs 10,00,000.", "text/plain")},
    ).json()["id"]

    # 2. Upload Doc B (Payment = ₹20,00,000)
    res_b = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("Contract_B.txt", b"Payment Terms: Contractor shall receive payment of Rs 20,00,000.", "text/plain")},
    )
    doc_2 = res_b.json()["id"]

    # 3. First comparison: ₹10,00,000 vs ₹20,00,000
    res1 = client.post(
        "/api/compare",
        headers={"Authorization": f"Bearer {token}"},
        json={"doc_a_id": doc_1, "doc_b_id": doc_2},
    )
    assert res1.status_code == status.HTTP_201_CREATED
    data1 = res1.json()["result_data"]
    pay1 = next(c for c in data1["clause_comparisons"] if c["topic"] == "Payment Terms")
    assert pay1["change_type"] == "modified"
    assert "10,00,000" in pay1["risk_reason"]
    assert "20,00,000" in pay1["risk_reason"]
    hash1_b = data1["doc_b_file_hash"]

    # 4. Now modify Doc B's actual file directly in storage to ₹50,00,000!
    storage = get_storage_service()
    doc2_details = client.get(f"/api/documents/{doc_2}", headers={"Authorization": f"Bearer {token}"}).json()
    storage_key = doc2_details["storage_key"]
    # Overwrite file in storage with new content
    new_content = b"Payment Terms: Contractor shall receive payment of Rs 50,00,000."
    target_path = storage._resolve_key(storage_key)
    target_path.write_bytes(new_content)

    # 5. Run comparison again: MUST detect the new ₹50,00,000 amount from storage!
    res2 = client.post(
        "/api/compare",
        headers={"Authorization": f"Bearer {token}"},
        json={"doc_a_id": doc_1, "doc_b_id": doc_2},
    )
    assert res2.status_code == status.HTTP_201_CREATED
    data2 = res2.json()["result_data"]
    pay2 = next(c for c in data2["clause_comparisons"] if c["topic"] == "Payment Terms")
    assert pay2["change_type"] == "modified"
    assert "10,00,000" in pay2["risk_reason"]
    assert "50,00,000" in pay2["risk_reason"]
    assert "20,00,000" not in pay2["risk_reason"]
    # File hash must have changed
    assert data2["doc_b_file_hash"] != hash1_b
    assert data2["comparison_source"] == "Fresh PDF extraction"


def test_comparison_gemini_rate_limit_truthful_labeling(
    client: TestClient,
    test_users: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    Requirement 7 & 17: When Gemini rate limit or quota is reached, the system must
    NOT claim 'AI Analysis' or use fake results. It must truthfully label the result
    and provide the user-facing quota notice banner text.
    """
    from app.ai.providers import AIRateLimitError
    from app.services import comparison_service

    class RateLimitedProvider:
        async def complete(self, request):
            raise AIRateLimitError("Quota limit reached on Gemini")

    monkeypatch.setattr(comparison_service, "get_ai_provider", lambda: RateLimitedProvider())

    token = test_users["token_a"]

    doc_1 = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("Doc1.txt", b"Payment is net 30. Liability capped at fees.", "text/plain")},
    ).json()["id"]

    doc_2 = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("Doc2.txt", b"Payment is net 15. Indemnity uncapped.", "text/plain")},
    ).json()["id"]

    res = client.post(
        "/api/compare",
        headers={"Authorization": f"Bearer {token}"},
        json={"doc_a_id": doc_1, "doc_b_id": doc_2},
    )
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()["result_data"]

    # Must be marked as ai_unavailable with truthful label
    assert data["analysis_method"] == "ai_unavailable"
    assert data["analysis_method_label"] == "Text comparison only — AI legal analysis unavailable"
    assert "AI comparison analysis is temporarily unavailable" in data["ai_status_message"]
    assert "quota/rate limit has been reached" in data["ai_status_message"]
    assert data["comparison_source"] == "Fresh PDF extraction"


def test_comparison_ready_protected_pdf_with_normal_pdf(
    client: TestClient,
    test_users: dict[str, str],
) -> None:
    """
    Requirements 2, 4, 8: A password-protected PDF that has already been unlocked
    during upload/processing and is READY must be comparable without re-entering password.
    Both normal+protected and protected+normal directions must work.
    """
    from tests.test_password_pdf import make_encrypted_pdf_bytes

    token = test_users["token_a"]

    # 1. Upload password-protected PDF
    enc_bytes = make_encrypted_pdf_bytes(
        password="PassSecret123",
        text="Payment Terms: Invoices paid within 30 calendar days. Liability is strictly limited to 1x contract fees.",
    )
    upload_res = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("Contract_Protected.pdf", enc_bytes, "application/pdf")},
    )
    assert upload_res.status_code == status.HTTP_201_CREATED
    enc_doc_id = upload_res.json()["id"]
    assert upload_res.json()["status"] == "password_required"

    # 2. Unlock it using correct password -> status becomes 'ready'
    unlock_res = client.post(
        f"/api/documents/{enc_doc_id}/unlock",
        headers={"Authorization": f"Bearer {token}"},
        json={"password": "PassSecret123"},
    )
    assert unlock_res.status_code == status.HTTP_200_OK
    assert unlock_res.json()["status"] == "ready"

    # 3. Upload a normal document
    normal_res = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("Contract_Revised.txt", b"Payment Terms: Invoices paid within 15 calendar days. Liability is uncapped for IP claims.", "text/plain")},
    )
    assert normal_res.status_code == status.HTTP_201_CREATED
    normal_doc_id = normal_res.json()["id"]

    # 4. Compare: Protected (Ready) vs Normal -> MUST succeed without asking for password
    res_a = client.post(
        "/api/compare",
        headers={"Authorization": f"Bearer {token}"},
        json={"doc_a_id": enc_doc_id, "doc_b_id": normal_doc_id},
    )
    assert res_a.status_code == status.HTTP_201_CREATED
    data_a = res_a.json()["result_data"]
    assert data_a["metrics"]["total_changes"] > 0
    assert "Processed document content" in data_a["comparison_source"]

    # 5. Reverse: Normal vs Protected (Ready) -> MUST succeed
    res_b = client.post(
        "/api/compare",
        headers={"Authorization": f"Bearer {token}"},
        json={"doc_a_id": normal_doc_id, "doc_b_id": enc_doc_id},
    )
    assert res_b.status_code == status.HTTP_201_CREATED
    data_b = res_b.json()["result_data"]
    assert data_b["metrics"]["total_changes"] > 0
    assert "Processed document content" in data_b["comparison_source"]


def test_comparison_two_ready_protected_pdfs(
    client: TestClient,
    test_users: dict[str, str],
) -> None:
    """
    Requirement 8.4: Two different protected PDFs that were both unlocked and READY
    can be compared against each other.
    """
    from tests.test_password_pdf import make_encrypted_pdf_bytes

    token = test_users["token_a"]

    # Doc 1
    bytes_1 = make_encrypted_pdf_bytes(password="Pass1", text="Governing Law: Jurisdiction shall be New York.")
    doc1_id = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("Protected_NY.pdf", bytes_1, "application/pdf")},
    ).json()["id"]
    client.post(f"/api/documents/{doc1_id}/unlock", headers={"Authorization": f"Bearer {token}"}, json={"password": "Pass1"})

    # Doc 2
    bytes_2 = make_encrypted_pdf_bytes(password="Pass2", text="Governing Law: Jurisdiction shall be Delaware.")
    doc2_id = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("Protected_DE.pdf", bytes_2, "application/pdf")},
    ).json()["id"]
    client.post(f"/api/documents/{doc2_id}/unlock", headers={"Authorization": f"Bearer {token}"}, json={"password": "Pass2"})

    res = client.post(
        "/api/compare",
        headers={"Authorization": f"Bearer {token}"},
        json={"doc_a_id": doc1_id, "doc_b_id": doc2_id},
    )
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()["result_data"]
    assert data["metrics"]["total_changes"] > 0
    assert data["comparison_source"] == "Processed document content"


def test_comparison_unlocked_same_protected_pdf_zero_changes(
    client: TestClient,
    test_users: dict[str, str],
) -> None:
    """
    Comparing an unlocked protected PDF against itself yields 0 material changes.
    """
    from tests.test_password_pdf import make_encrypted_pdf_bytes

    token = test_users["token_a"]
    bytes_1 = make_encrypted_pdf_bytes(password="PassIdentical", text="Confidentiality shall last 5 years.")
    doc_id = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("Protected_NDA.pdf", bytes_1, "application/pdf")},
    ).json()["id"]
    client.post(f"/api/documents/{doc_id}/unlock", headers={"Authorization": f"Bearer {token}"}, json={"password": "PassIdentical"})

    res = client.post(
        "/api/compare",
        headers={"Authorization": f"Bearer {token}"},
        json={"doc_a_id": doc_id, "doc_b_id": doc_id},
    )
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()["result_data"]
    assert data["metrics"]["total_changes"] == 0
    assert data["metrics"]["overall_risk_impact"] == "LOW"


def test_comparison_locked_protected_pdf_rejected(
    client: TestClient,
    test_users: dict[str, str],
) -> None:
    """
    Requirements 5, 8.5, 12: A protected PDF still in PASSWORD_REQUIRED state must be
    rejected with the exact message: "Document '...' is password-protected. Unlock it before comparing."
    """
    from tests.test_password_pdf import make_encrypted_pdf_bytes

    token = test_users["token_a"]

    # Upload locked PDF and DO NOT unlock it
    bytes_locked = make_encrypted_pdf_bytes(password="NeverUnlocked", text="Top Secret Provisions.")
    locked_id = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("Locked_Secret.pdf", bytes_locked, "application/pdf")},
    ).json()["id"]

    # Upload normal PDF
    normal_id = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("Normal.txt", b"Normal contract content.", "text/plain")},
    ).json()["id"]

    # Try comparing Locked (Doc A) vs Normal (Doc B)
    res1 = client.post(
        "/api/compare",
        headers={"Authorization": f"Bearer {token}"},
        json={"doc_a_id": locked_id, "doc_b_id": normal_id},
    )
    assert res1.status_code == status.HTTP_400_BAD_REQUEST
    assert "Document 'Locked_Secret.pdf' is password-protected. Unlock it before comparing." in res1.json()["detail"]

    # Try comparing Normal (Doc A) vs Locked (Doc B)
    res2 = client.post(
        "/api/compare",
        headers={"Authorization": f"Bearer {token}"},
        json={"doc_a_id": normal_id, "doc_b_id": locked_id},
    )
    assert res2.status_code == status.HTTP_400_BAD_REQUEST
    assert "Document 'Locked_Secret.pdf' is password-protected. Unlock it before comparing." in res2.json()["detail"]




