import io
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from pypdf import PdfReader, PdfWriter
from sqlalchemy.orm import Session


def make_encrypted_pdf_bytes(password: str = "SecretPass123", text: str = "Confidential Non-Disclosure Agreement 2026") -> bytes:
    # First generate a valid PDF with content
    content_stream = f"BT /F1 12 Tf 72 712 Td ({text}) Tj ET".encode("latin-1")
    length = len(content_stream)
    header = (
        b"%PDF-1.4\n"
        b"1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n"
        b"2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n"
        b"3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>> endobj\n"
    )
    stream_obj = f"4 0 obj <</Length {length}>> stream\n".encode("ascii") + content_stream + b"\nendstream endobj\n"
    footer = (
        b"5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n"
        b"xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \n0000000238 00000 n \n0000000332 00000 n \n"
        b"trailer <</Size 6 /Root 1 0 R>>\nstartxref\n403\n%%EOF\n"
    )
    raw_pdf = header + stream_obj + footer

    # Read and encrypt with pypdf
    reader = PdfReader(io.BytesIO(raw_pdf))
    writer = PdfWriter()
    writer.append(reader)
    writer.encrypt(password)

    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


@pytest.fixture
def test_user_tokens(client: TestClient) -> dict[str, str]:
    res_a = client.post(
        "/api/auth/register",
        json={
            "name": "Encrypted Test User A",
            "email": "enc_user_a@firm.com",
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "role": "LAWYER",
        },
    )
    token_a = res_a.json()["token"]

    res_b = client.post(
        "/api/auth/register",
        json={
            "name": "Encrypted Test User B",
            "email": "enc_user_b@firm.com",
            "password": "Password123!",
            "confirmPassword": "Password123!",
            "role": "LAWYER",
        },
    )
    token_b = res_b.json()["token"]

    return {"user_a": token_a, "user_b": token_b}


def test_upload_encrypted_pdf_without_password(client: TestClient, test_user_tokens: dict[str, str]):
    pdf_bytes = make_encrypted_pdf_bytes(password="Secret123")
    res = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
        files={"file": ("protected_contract.pdf", pdf_bytes, "application/pdf")},
    )

    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()
    assert data["status"] == "password_required"
    assert data["processing_status"] == "password_required"
    assert data["is_encrypted"] is True
    assert "password-protected" in (data.get("error_message") or "").lower()


def test_unlock_encrypted_pdf_wrong_password(client: TestClient, test_user_tokens: dict[str, str]):
    pdf_bytes = make_encrypted_pdf_bytes(password="Secret123")
    upload_res = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
        files={"file": ("protected_contract.pdf", pdf_bytes, "application/pdf")},
    )
    doc_id = upload_res.json()["id"]

    # Attempt unlock with wrong password
    unlock_res = client.post(
        f"/api/documents/{doc_id}/unlock",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
        json={"password": "WrongPassword!"},
    )
    assert unlock_res.status_code == status.HTTP_400_BAD_REQUEST
    assert "Incorrect password" in unlock_res.json()["detail"]


def test_unlock_encrypted_pdf_correct_password(client: TestClient, test_user_tokens: dict[str, str]):
    pdf_bytes = make_encrypted_pdf_bytes(password="Secret123", text="Strictly Private NDA terms 2026")
    upload_res = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
        files={"file": ("protected_contract.pdf", pdf_bytes, "application/pdf")},
    )
    doc_id = upload_res.json()["id"]

    # Unlock with correct password
    unlock_res = client.post(
        f"/api/documents/{doc_id}/unlock",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
        json={"password": "Secret123"},
    )
    assert unlock_res.status_code == status.HTTP_200_OK
    data = unlock_res.json()
    assert data["status"] == "ready"
    assert data["processing_status"] == "ready"
    assert data["is_encrypted"] is False
    assert data["page_count"] == 1
    assert len(data["pages"]) == 1
    assert "Strictly Private NDA terms 2026" in data["pages"][0]["text"]

    # Verify subsequent GET /api/documents/{id} returns ready and decrypted
    get_res = client.get(
        f"/api/documents/{doc_id}",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
    )
    assert get_res.status_code == status.HTTP_200_OK
    assert get_res.json()["status"] == "ready"
    assert get_res.json()["is_encrypted"] is False


def test_upload_encrypted_pdf_with_password(client: TestClient, test_user_tokens: dict[str, str]):
    pdf_bytes = make_encrypted_pdf_bytes(password="Secret123", text="Immediate Unlock Agreement")
    res = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
        files={"file": ("protected_instant.pdf", pdf_bytes, "application/pdf")},
        data={"password": "Secret123"},
    )

    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()
    assert data["status"] == "ready"
    assert data["processing_status"] == "ready"
    assert data["is_encrypted"] is False
    assert data["page_count"] == 1


def test_unlock_encrypted_pdf_unauthorized_user(client: TestClient, test_user_tokens: dict[str, str]):
    pdf_bytes = make_encrypted_pdf_bytes(password="Secret123")
    upload_res = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
        files={"file": ("protected_contract.pdf", pdf_bytes, "application/pdf")},
    )
    doc_id = upload_res.json()["id"]

    # User B tries to unlock User A's document -> 404 (safe boundary)
    unlock_res = client.post(
        f"/api/documents/{doc_id}/unlock",
        headers={"Authorization": f"Bearer {test_user_tokens['user_b']}"},
        json={"password": "Secret123"},
    )
    assert unlock_res.status_code == status.HTTP_404_NOT_FOUND


def test_unlocked_pdf_chunks_and_rag_retrieval(client: TestClient, test_user_tokens: dict[str, str]):
    pdf_bytes = make_encrypted_pdf_bytes(password="DocPass2026", text="Obligation: Contractor shall deliver reports. Liquidated damages: None.")
    upload_res = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
        files={"file": ("services_agreement.pdf", pdf_bytes, "application/pdf")},
    )
    doc_id = upload_res.json()["id"]

    # While locked, chunks endpoint returns empty list
    chunks_res = client.get(
        f"/api/documents/{doc_id}/chunks",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
    )
    assert chunks_res.status_code == status.HTTP_200_OK
    assert len(chunks_res.json()) == 0

    # Unlock with password
    unlock_res = client.post(
        f"/api/documents/{doc_id}/unlock",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
        json={"password": "DocPass2026"},
    )
    assert unlock_res.status_code == status.HTTP_200_OK
    unlocked_data = unlock_res.json()
    assert unlocked_data["status"] == "ready"
    assert len(unlocked_data["pages"]) == 1
    assert len(unlocked_data["chunks"]) == 1
    assert "Contractor shall deliver reports" in unlocked_data["chunks"][0]["text"]

    # Chunks retrieval endpoint returns all chunks
    all_chunks = client.get(
        f"/api/documents/{doc_id}/chunks",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
    ).json()
    assert len(all_chunks) == 1
    assert all_chunks[0]["metadata_json"]["document_id"] == doc_id

    # Filtered retrieval with matching keyword
    matching_chunks = client.get(
        f"/api/documents/{doc_id}/chunks?query=Contractor",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
    ).json()
    assert len(matching_chunks) == 1
    assert "Contractor" in matching_chunks[0]["text"]

    # Filtered retrieval with non-matching keyword
    non_matching = client.get(
        f"/api/documents/{doc_id}/chunks?query=NonExistentPaymentClause",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
    ).json()
    assert len(non_matching) == 0


def test_document_isolation_across_two_protected_pdfs(client: TestClient, test_user_tokens: dict[str, str]):
    pdf1 = make_encrypted_pdf_bytes(password="PassOne111", text="Agreement Alpha: Confidential intellectual property license.")
    pdf2 = make_encrypted_pdf_bytes(password="PassTwo222", text="Agreement Beta: Commercial real estate lease terms.")

    upload1 = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
        files={"file": ("alpha.pdf", pdf1, "application/pdf")},
    ).json()
    doc1_id = upload1["id"]

    upload2 = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
        files={"file": ("beta.pdf", pdf2, "application/pdf")},
    ).json()
    doc2_id = upload2["id"]

    # Unlock both documents
    client.post(
        f"/api/documents/{doc1_id}/unlock",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
        json={"password": "PassOne111"},
    )
    client.post(
        f"/api/documents/{doc2_id}/unlock",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
        json={"password": "PassTwo222"},
    )

    # Verify Document 1 chunks only contain Alpha terms
    c1 = client.get(
        f"/api/documents/{doc1_id}/chunks",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
    ).json()
    assert len(c1) == 1
    assert "Agreement Alpha" in c1[0]["text"]
    assert "Agreement Beta" not in c1[0]["text"]

    # Verify Document 2 chunks only contain Beta terms
    c2 = client.get(
        f"/api/documents/{doc2_id}/chunks",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
    ).json()
    assert len(c2) == 1
    assert "Agreement Beta" in c2[0]["text"]
    assert "Agreement Alpha" not in c2[0]["text"]

    # Querying "Beta" in Document 1 returns 0 chunks (isolation)
    query_doc1_for_beta = client.get(
        f"/api/documents/{doc1_id}/chunks?query=Beta",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
    ).json()
    assert len(query_doc1_for_beta) == 0

    # Querying "Beta" in Document 2 returns 1 chunk
    query_doc2_for_beta = client.get(
        f"/api/documents/{doc2_id}/chunks?query=Beta",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
    ).json()
    assert len(query_doc2_for_beta) == 1


def test_normal_unprotected_pdf_upload_succeeds(client: TestClient, test_user_tokens: dict[str, str]):
    # Normal unprotected PDF
    content_stream = b"BT /F1 12 Tf 72 712 Td (Standard Commercial Contract 2026) Tj ET"
    length = len(content_stream)
    raw_pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n"
        b"2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n"
        b"3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>> endobj\n"
        + f"4 0 obj <</Length {length}>> stream\n".encode("ascii") + content_stream + b"\nendstream endobj\n"
        b"5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj\n"
        b"xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \n0000000238 00000 n \n0000000332 00000 n \n"
        b"trailer <</Size 6 /Root 1 0 R>>\nstartxref\n403\n%%EOF\n"
    )

    upload_res = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
        files={"file": ("normal_contract.pdf", raw_pdf, "application/pdf")},
    )
    assert upload_res.status_code == status.HTTP_201_CREATED
    data = upload_res.json()
    assert data["status"] == "ready"
    assert data["processing_status"] == "ready"
    assert data["is_encrypted"] is False
    assert data["page_count"] == 1


def test_protected_pdf_retry_after_wrong_password_no_duplicates(client: TestClient, test_user_tokens: dict[str, str]):
    pdf_bytes = make_encrypted_pdf_bytes(password="MyCorrectPassword999", text="Confidential Milestone Agreement")
    
    # 1. Upload
    upload_res = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
        files={"file": ("retry_agreement.pdf", pdf_bytes, "application/pdf")},
    )
    assert upload_res.status_code == status.HTTP_201_CREATED
    doc_id = upload_res.json()["id"]

    # Initial doc list count for user
    docs_before = client.get("/api/documents", headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"}).json()
    count_before = len(docs_before)

    # 2. Attempt with wrong password -> 400
    wrong_res = client.post(
        f"/api/documents/{doc_id}/unlock",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
        json={"password": "IncorrectPassword!"},
    )
    assert wrong_res.status_code == status.HTTP_400_BAD_REQUEST
    assert "Incorrect password" in wrong_res.json()["detail"]

    # Doc list count must NOT change (no duplicate record)
    docs_after_wrong = client.get("/api/documents", headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"}).json()
    assert len(docs_after_wrong) == count_before

    # 3. Retry with correct password -> succeeds 200
    correct_res = client.post(
        f"/api/documents/{doc_id}/unlock",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
        json={"password": "MyCorrectPassword999"},
    )
    assert correct_res.status_code == status.HTTP_200_OK
    unlocked_data = correct_res.json()
    assert unlocked_data["id"] == doc_id
    assert unlocked_data["status"] == "ready"
    assert unlocked_data["processing_status"] == "ready"

    # Doc list count must STILL be exactly the same (no duplicates created during retry)
    docs_after_unlock = client.get("/api/documents", headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"}).json()
    assert len(docs_after_unlock) == count_before


def test_unlock_preserves_original_encrypted_file_and_never_persists_password(client: TestClient, test_user_tokens: dict[str, str], db_session: Session):
    secret_pass = "UltraSecretPassword123"
    pdf_bytes = make_encrypted_pdf_bytes(password=secret_pass, text="Preserved Encrypted Original PDF Text")

    upload_res = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
        files={"file": ("preserved_test.pdf", pdf_bytes, "application/pdf")},
    )
    doc_id = upload_res.json()["id"]

    # Unlock
    unlock_res = client.post(
        f"/api/documents/{doc_id}/unlock",
        headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"},
        json={"password": secret_pass},
    )
    assert unlock_res.status_code == status.HTTP_200_OK

    # Verify original file in storage is still intact and encrypted
    from app.storage import get_storage_service
    storage = get_storage_service()
    doc_detail = client.get(f"/api/documents/{doc_id}", headers={"Authorization": f"Bearer {test_user_tokens['user_a']}"}).json()
    storage_key = doc_detail.get("storage_key")
    if storage_key:
        stored_bytes = storage.get_file(storage_key)
        stored_reader = PdfReader(io.BytesIO(stored_bytes))
        assert stored_reader.is_encrypted is True

    # Verify password is NEVER stored in database
    from app.database.models import Document, AuditLog
    from uuid import UUID
    db_doc = db_session.get(Document, UUID(doc_id))
    assert db_doc is not None
    assert secret_pass not in (db_doc.error_message or "")
    assert secret_pass not in str(db_doc.__dict__)

    # Check audit logs
    logs = db_session.query(AuditLog).filter_by(resource_id=doc_id).all()
    for log in logs:
        assert secret_pass not in str(log.metadata_json)


