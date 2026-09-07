import io
import docx
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from pypdf import PdfWriter

from app.storage import get_storage_service


def make_valid_pdf_bytes(text: str = "Confidential Master Services Agreement 2026") -> bytes:
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
    return header + stream_obj + footer


def make_scanned_pdf_bytes() -> bytes:
    w = PdfWriter()
    w.add_blank_page(width=300, height=300)
    buf = io.BytesIO()
    w.write(buf)
    return buf.getvalue()


def make_valid_docx_bytes(text: str = "Independent Contractor Legal Agreement") -> bytes:
    d = docx.Document()
    d.add_paragraph(text)
    buf = io.BytesIO()
    d.save(buf)
    return buf.getvalue()


@pytest.fixture
def auth_tokens(client: TestClient) -> dict[str, str]:
    # User A (Lawyer)
    res_a = client.post(
        "/api/auth/register",
        json={
            "name": "Upload Attorney",
            "email": "uploader_a@firm.com",
            "password": "StrongPassword123!",
            "confirmPassword": "StrongPassword123!",
            "role": "LAWYER",
        },
    )
    token_a = res_a.json()["token"]

    # User B (Lawyer)
    res_b = client.post(
        "/api/auth/register",
        json={
            "name": "Separate Attorney",
            "email": "uploader_b@firm.com",
            "password": "StrongPassword123!",
            "confirmPassword": "StrongPassword123!",
            "role": "LAWYER",
        },
    )
    token_b = res_b.json()["token"]

    return {"token_a": token_a, "token_b": token_b}


def test_authenticated_pdf_upload_and_extraction(client: TestClient, auth_tokens: dict[str, str]) -> None:
    token = auth_tokens["token_a"]
    pdf_content = make_valid_pdf_bytes("Confidential Acquisition Term Sheet")

    response = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("acquisition_terms.pdf", pdf_content, "application/pdf")},
    )
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["name"] == "acquisition_terms.pdf"
    assert data["file_type"] == "pdf"
    assert data["status"] == "ready"
    assert data["processing_status"] == "ready"
    assert data["page_count"] >= 1
    doc_id = data["id"]

    # Retrieve details
    detail_res = client.get(
        f"/api/documents/{doc_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert detail_res.status_code == status.HTTP_200_OK
    detail_data = detail_res.json()
    assert len(detail_data["pages"]) >= 1
    assert "Acquisition Term Sheet" in detail_data["pages"][0]["text"]


def test_authenticated_docx_upload(client: TestClient, auth_tokens: dict[str, str]) -> None:
    token = auth_tokens["token_a"]
    docx_content = make_valid_docx_bytes("Vendor Employment Contract Section 4.")

    response = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("vendor_agreement.docx", docx_content, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")},
    )
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["name"] == "vendor_agreement.docx"
    assert data["file_type"] == "docx"
    assert data["status"] == "ready"

    # Detail check
    detail = client.get(f"/api/documents/{data['id']}", headers={"Authorization": f"Bearer {token}"}).json()
    assert "Vendor Employment Contract" in detail["pages"][0]["text"]


def test_authenticated_txt_upload(client: TestClient, auth_tokens: dict[str, str]) -> None:
    token = auth_tokens["token_a"]
    txt_content = b"Non-Disclosure Agreement terms: strictly private and confidential."

    response = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("nda_terms.txt", txt_content, "text/plain")},
    )
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["name"] == "nda_terms.txt"
    assert data["file_type"] == "txt"
    assert data["status"] == "ready"


def test_unauthenticated_upload_fails_401(client: TestClient) -> None:
    client.cookies.clear()
    txt_content = b"Unauthenticated attempt text."
    response = client.post(
        "/api/documents/upload",
        files={"file": ("test.txt", txt_content, "text/plain")},
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_unsupported_extension_rejected(client: TestClient, auth_tokens: dict[str, str]) -> None:
    token = auth_tokens["token_a"]
    res = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("malware.exe", b"MZDummyExecutableData", "application/octet-stream")},
    )
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "rejected for security" in res.json()["detail"].lower() or "executable" in res.json()["detail"].lower()


def test_executable_disguised_as_pdf_rejected(client: TestClient, auth_tokens: dict[str, str]) -> None:
    token = auth_tokens["token_a"]
    fake_pdf = b"MZ\x90\x00\x03\x00\x00\x00BinaryExeContentHere"
    res = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("disguised_file.pdf", fake_pdf, "application/pdf")},
    )
    assert res.status_code == status.HTTP_400_BAD_REQUEST


def test_empty_file_rejected(client: TestClient, auth_tokens: dict[str, str]) -> None:
    token = auth_tokens["token_a"]
    res = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("empty.pdf", b"", "application/pdf")},
    )
    assert res.status_code == status.HTTP_400_BAD_REQUEST
    assert "empty" in res.json()["detail"].lower()


def test_oversized_file_rejected(client: TestClient, auth_tokens: dict[str, str], monkeypatch: pytest.MonkeyPatch) -> None:
    token = auth_tokens["token_a"]
    from app.api import documents as doc_module
    monkeypatch.setattr(doc_module.settings, "max_upload_bytes", 100)

    res = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("large.txt", b"A" * 500, "text/plain")},
    )
    assert res.status_code == status.HTTP_413_REQUEST_ENTITY_TOO_LARGE


def test_scanned_pdf_marked_ocr_required(client: TestClient, auth_tokens: dict[str, str]) -> None:
    token = auth_tokens["token_a"]
    scanned_pdf = make_scanned_pdf_bytes()

    res = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("scanned_lease.pdf", scanned_pdf, "application/pdf")},
    )
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()
    assert data["status"] == "ocr_required"
    assert data["processing_status"] == "ocr_required"
    assert data["page_count"] == 1


def test_corrupted_pdf_graceful_handling(client: TestClient, auth_tokens: dict[str, str]) -> None:
    token = auth_tokens["token_a"]
    corrupted_pdf = b"%PDF-1.4\nCorruptedGarbageTrailerNotPdfContent%%EOF"

    res = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("corrupt.pdf", corrupted_pdf, "application/pdf")},
    )
    assert res.status_code == status.HTTP_201_CREATED
    data = res.json()
    assert data["status"] == "failed"
    assert data["processing_status"] == "failed"
    assert data["error_message"] is not None


def test_cross_tenant_document_isolation_and_download(client: TestClient, auth_tokens: dict[str, str]) -> None:
    token_a = auth_tokens["token_a"]
    token_b = auth_tokens["token_b"]

    # User A uploads a document
    doc_res = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token_a}"},
        files={"file": ("private_will.txt", b"Last will and testament of Client A.", "text/plain")},
    )
    doc_id = doc_res.json()["id"]

    # 1. User A downloads own document -> 200 OK
    down_a = client.get(f"/api/documents/{doc_id}/download", headers={"Authorization": f"Bearer {token_a}"})
    assert down_a.status_code == status.HTTP_200_OK
    assert down_a.content == b"Last will and testament of Client A."

    # 2. User B attempts to access User A's document details -> 404 NOT FOUND (no leak)
    detail_b = client.get(f"/api/documents/{doc_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert detail_b.status_code == status.HTTP_404_NOT_FOUND

    # 3. User B attempts to download User A's document -> 404 NOT FOUND
    down_b = client.get(f"/api/documents/{doc_id}/download", headers={"Authorization": f"Bearer {token_b}"})
    assert down_b.status_code == status.HTTP_404_NOT_FOUND

    # 4. User B listing does NOT show User A's document
    list_b = client.get("/api/documents", headers={"Authorization": f"Bearer {token_b}"})
    ids_b = [d["id"] for d in list_b.json()]
    assert doc_id not in ids_b


def test_delete_document_and_purges_storage(client: TestClient, auth_tokens: dict[str, str]) -> None:
    token = auth_tokens["token_a"]

    # Upload document
    doc_res = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("to_delete.txt", b"Temporary legal memo.", "text/plain")},
    )
    doc_id = doc_res.json()["id"]

    # Verify details gives storage key
    detail = client.get(f"/api/documents/{doc_id}", headers={"Authorization": f"Bearer {token}"}).json()
    storage_key = detail["storage_key"]
    storage = get_storage_service()
    assert storage.get_file(storage_key) == b"Temporary legal memo."

    # Delete document
    del_res = client.delete(f"/api/documents/{doc_id}", headers={"Authorization": f"Bearer {token}"})
    assert del_res.status_code == status.HTTP_200_OK

    # Verify removed from database
    get_after = client.get(f"/api/documents/{doc_id}", headers={"Authorization": f"Bearer {token}"})
    assert get_after.status_code == status.HTTP_404_NOT_FOUND

    # Verify purged from storage
    with pytest.raises(FileNotFoundError):
        storage.get_file(storage_key)


def test_delete_document_preserves_chat_history_and_purges_all_dependencies(
    client: TestClient, auth_tokens: dict[str, str], db_session: Session
) -> None:
    from uuid import UUID, uuid4
    from app.database.models import (
        Analysis,
        ChatMessage,
        ChatSession,
        Clause,
        DocumentChunk,
        DocumentPage,
        DocumentVersion,
        Finding,
        Report,
        Risk,
        User,
    )

    token = auth_tokens["token_a"]

    # 1. Upload a document
    doc_res = client.post(
        "/api/documents/upload",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("contract_for_delete.txt", b"Terms of service contract with liability limit.", "text/plain")},
    )
    assert doc_res.status_code == status.HTTP_201_CREATED
    doc_id = UUID(doc_res.json()["id"])

    # 2. Attach complex dependencies in database: ChatSession, Messages, Analysis, Clause, Risk, Report
    storage = get_storage_service()
    user = db_session.query(User).filter(User.email == "uploader_a@firm.com").first()
    assert user is not None
    version = db_session.query(DocumentVersion).filter(DocumentVersion.document_id == doc_id).first()
    assert version is not None

    # Add DocumentChunk
    chunk = DocumentChunk(id=uuid4(), version_id=version.id, text="Liability chunk")
    db_session.add(chunk)

    # Add ChatSession & ChatMessages
    chat_sess = ChatSession(id=uuid4(), user_id=user.id, version_id=version.id)
    db_session.add(chat_sess)
    msg1 = ChatMessage(id=uuid4(), session_id=chat_sess.id, role="user", content="What is the liability limit?")
    msg2 = ChatMessage(id=uuid4(), session_id=chat_sess.id, role="assistant", content="The limit is capped at $50,000.")
    db_session.add(msg1)
    db_session.add(msg2)

    # Add Analysis, Clause, Risk, Finding, Report
    analysis = Analysis(id=uuid4(), document_id=doc_id, version_id=version.id, status="completed")
    db_session.add(analysis)
    clause = Clause(id=uuid4(), analysis_id=analysis.id, name="Limitation of Liability", source_text="Liability limit")
    risk = Risk(id=uuid4(), analysis_id=analysis.id, title="Uncapped IP Risk", severity="HIGH", explanation="No cap on IP")
    finding = Finding(id=uuid4(), analysis_id=analysis.id, kind="obligation", value={"party": "Client"})
    db_session.add(clause)
    db_session.add(risk)
    db_session.add(finding)

    # Save a dummy report file to storage
    report_storage_key = storage.save_file(
        user_id=user.id,
        document_id=doc_id,
        filename="analysis_report.pdf",
        content=b"%PDF-Dummy-Report-Bytes",
    )
    report = Report(id=uuid4(), analysis_id=analysis.id, format="pdf", storage_key=report_storage_key)
    db_session.add(report)

    db_session.commit()
    chat_sess_id = chat_sess.id
    analysis_id = analysis.id

    # 3. Call DELETE /api/documents/{doc_id}
    del_res = client.delete(f"/api/documents/{doc_id}", headers={"Authorization": f"Bearer {token}"})
    assert del_res.status_code == status.HTTP_200_OK

    # 4. Verify document is gone from API
    get_res = client.get(f"/api/documents/{doc_id}", headers={"Authorization": f"Bearer {token}"})
    assert get_res.status_code == status.HTTP_404_NOT_FOUND

    # 5. Verify database state
    # Document, DocumentVersion, DocumentPage, DocumentChunk are gone
    assert db_session.query(DocumentVersion).filter(DocumentVersion.document_id == doc_id).count() == 0
    assert db_session.query(DocumentPage).filter(DocumentPage.version_id == version.id).count() == 0
    assert db_session.query(DocumentChunk).filter(DocumentChunk.version_id == version.id).count() == 0

    # Analysis, Clause, Risk, Finding, Report are gone
    assert db_session.query(Analysis).filter(Analysis.id == analysis_id).count() == 0
    assert db_session.query(Clause).filter(Clause.analysis_id == analysis_id).count() == 0
    assert db_session.query(Risk).filter(Risk.analysis_id == analysis_id).count() == 0
    assert db_session.query(Finding).filter(Finding.analysis_id == analysis_id).count() == 0
    assert db_session.query(Report).filter(Report.analysis_id == analysis_id).count() == 0

    # CRITICAL: ChatSession and ChatMessages REMAIN INTACT with version_id = None
    surviving_chat = db_session.query(ChatSession).filter(ChatSession.id == chat_sess_id).first()
    assert surviving_chat is not None
    assert surviving_chat.version_id is None
    messages = db_session.query(ChatMessage).filter(ChatMessage.session_id == chat_sess_id).all()
    assert len(messages) == 2
    assert messages[0].content == "What is the liability limit?"
    assert messages[1].content == "The limit is capped at $50,000."

    # 6. Verify physical report file was purged from storage
    if report_storage_key:
        with pytest.raises(FileNotFoundError):
            storage.get_file(report_storage_key)

