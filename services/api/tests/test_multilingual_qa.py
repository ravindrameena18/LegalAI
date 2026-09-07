import pytest
from fastapi import status
from fastapi.testclient import TestClient

from tests.test_upload_and_documents import make_valid_pdf_bytes


@pytest.fixture
def auth_header_and_doc(client: TestClient):
    # Register test counsel
    res_reg = client.post(
        "/api/auth/register",
        json={
            "name": "Advocate Sharma",
            "email": "sharma_qa@firm.com",
            "password": "StrongPassword123!",
            "confirmPassword": "StrongPassword123!",
            "role": "LAWYER",
        },
    )
    token = res_reg.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Upload document with payment terms
    pdf_content = make_valid_pdf_bytes(
        "Services Agreement. Section 2: Invoices shall be payable net 30 days. Rate is $150 per hour. Section 5: Termination on 30 days notice."
    )
    upload_res = client.post(
        "/api/documents/upload",
        headers=headers,
        files={"file": ("services_agreement_2026.pdf", pdf_content, "application/pdf")},
    )
    assert upload_res.status_code == status.HTTP_201_CREATED
    doc_id = upload_res.json()["id"]

    return headers, doc_id


def test_qa_english_question(client: TestClient, auth_header_and_doc):
    headers, doc_id = auth_header_and_doc
    res = client.post(
        f"/api/documents/{doc_id}/ask",
        json={"question": "By when do I have to deposit the payment?"},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["found_in_document"] is True
    assert "net 30" in data["answer"].lower() or "payable" in data["answer"].lower() or "$150" in data["answer"].lower()
    assert data["language_detected"] == "en"
    assert len(data["citations"]) > 0


def test_qa_hindi_devanagari_question(client: TestClient, auth_header_and_doc):
    headers, doc_id = auth_header_and_doc
    res = client.post(
        f"/api/documents/{doc_id}/ask",
        json={"question": "इसमें पैसे कब तक जमा करवाने हैं?"},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["found_in_document"] is True
    assert "दस्तावेज़" in data["answer"] or "भुगतान" in data["answer"]
    assert data["language_detected"] == "hi"


def test_qa_hinglish_question(client: TestClient, auth_header_and_doc):
    headers, doc_id = auth_header_and_doc
    res = client.post(
        f"/api/documents/{doc_id}/ask",
        json={"question": "isme paise kab tak jama karwane hain?"},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["found_in_document"] is True
    assert data["language_detected"] == "hi"
    assert "दस्तावेज़" in data["answer"] or "भुगतान" in data["answer"]


def test_qa_liquidated_damages_not_in_doc_uninvented(client: TestClient, auth_header_and_doc):
    headers, doc_id = auth_header_and_doc
    res = client.post(
        f"/api/documents/{doc_id}/ask",
        json={"question": "Are there liquidated damages for breach in this contract?"},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["found_in_document"] is False
    assert "could not find" in data["answer"].lower()
    assert "provided document" in data["answer"].lower()
