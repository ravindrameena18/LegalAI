import uuid
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database.models import ChatMessage, ChatSession, Document, DocumentVersion, User


def test_delete_chat_session_not_in_db(client: TestClient):
    # Deleting a session that only existed in client-side storage should succeed gracefully
    res = client.delete("/api/chats/session-client-12345")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["success"] is True
    assert data["session_id"] == "session-client-12345"
    assert data["deleted_from_database"] is False


def test_delete_chat_session_with_database_records(client: TestClient, db_session: Session):
    # Create test user via register API to ensure all roles and relations are properly configured
    unique_email = f"chat-test-{uuid.uuid4().hex[:8]}@example.com"
    reg_res = client.post(
        "/api/auth/register",
        json={
            "name": "Chat Tester",
            "email": unique_email,
            "password": "StrongPassword123!",
            "confirmPassword": "StrongPassword123!",
            "role": "LAWYER",
        },
    )
    assert reg_res.status_code == status.HTTP_201_CREATED
    user_id = uuid.UUID(reg_res.json()["user"]["id"])

    doc = Document(
        name="Test Contract",
        file_type="pdf",
        mime_type="application/pdf",
        owner_id=user_id,
    )
    db_session.add(doc)
    db_session.commit()

    version = DocumentVersion(
        document_id=doc.id,
        content_type="application/pdf",
        storage_key="test/doc.pdf",
        file_size=1024,
    )
    db_session.add(version)
    db_session.commit()

    chat_session = ChatSession(
        user_id=user_id,
        version_id=version.id,
    )
    db_session.add(chat_session)
    db_session.commit()

    msg1 = ChatMessage(
        session_id=chat_session.id,
        role="user",
        content="What is the term?",
    )
    msg2 = ChatMessage(
        session_id=chat_session.id,
        role="assistant",
        content="The term is 12 months.",
        citations=[{"page": 1, "text": "Term: 12 months"}],
    )
    db_session.add_all([msg1, msg2])
    db_session.commit()

    session_id_str = str(chat_session.id)

    # Verify session and messages exist
    assert db_session.get(ChatSession, chat_session.id) is not None
    assert db_session.query(ChatMessage).filter_by(session_id=chat_session.id).count() == 2

    # Call delete endpoint
    res = client.delete(f"/api/chats/{session_id_str}")
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["success"] is True
    assert data["deleted_from_database"] is True

    # Verify session and messages are deleted from database
    db_session.expire_all()
    assert db_session.get(ChatSession, chat_session.id) is None
    assert db_session.query(ChatMessage).filter_by(session_id=chat_session.id).count() == 0

    # Verify the document itself was NOT deleted
    assert db_session.get(Document, doc.id) is not None
