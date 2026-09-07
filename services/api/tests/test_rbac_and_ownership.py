import uuid
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.models import AuditLog, Document, User
from app.security.permissions import Permission, has_permission
from app.security.rate_limit import RateLimiter, clear_in_memory_rate_limits
from app.services.audit import sanitize_metadata


def test_permission_matrix_mapping() -> None:
    # Admin permissions
    assert has_permission("ADMIN", Permission.USERS_MANAGE) is True
    assert has_permission("ADMIN", Permission.AUDIT_VIEW) is True
    assert has_permission("ADMIN", Permission.DOCUMENT_VIEW) is True

    # Lawyer permissions
    assert has_permission("LAWYER", Permission.DOCUMENT_UPLOAD) is True
    assert has_permission("LAWYER", Permission.DOCUMENT_ANALYZE) is True
    assert has_permission("LAWYER", Permission.ASSISTANT_USE) is True
    assert has_permission("LAWYER", Permission.AUDIT_VIEW) is False
    assert has_permission("LAWYER", Permission.USERS_MANAGE) is False

    # Client permissions
    assert has_permission("CLIENT", Permission.DOCUMENT_UPLOAD) is True
    assert has_permission("CLIENT", Permission.DOCUMENT_VIEW) is True
    assert has_permission("CLIENT", Permission.DOCUMENT_ANALYZE) is False
    assert has_permission("CLIENT", Permission.ASSISTANT_USE) is False
    assert has_permission("CLIENT", Permission.AUDIT_VIEW) is False


def test_rbac_admin_access_to_audit_logs(client: TestClient) -> None:
    # Register an admin user
    reg = client.post(
        "/api/auth/register",
        json={
            "name": "Super Admin",
            "email": "admin@legalai.corp",
            "password": "AdminPassword123!",
            "confirmPassword": "AdminPassword123!",
            "role": "ADMIN",
        },
    )
    assert reg.status_code == status.HTTP_201_CREATED
    admin_token = reg.json()["token"]

    # Admin accesses audit logs endpoint
    res = client.get("/api/admin/audit-logs", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == status.HTTP_200_OK
    assert isinstance(res.json(), list)


def test_rbac_lawyer_forbidden_from_admin_audit_logs(client: TestClient) -> None:
    # Register a lawyer user
    reg = client.post(
        "/api/auth/register",
        json={
            "name": "Associate Lawyer",
            "email": "lawyer@firm.com",
            "password": "LawyerPassword123!",
            "confirmPassword": "LawyerPassword123!",
            "role": "LAWYER",
        },
    )
    lawyer_token = reg.json()["token"]

    # Lawyer attempts to access audit logs
    res = client.get("/api/admin/audit-logs", headers={"Authorization": f"Bearer {lawyer_token}"})
    assert res.status_code == status.HTTP_403_FORBIDDEN
    assert "audit:view" in res.json()["detail"].lower()


def test_rbac_client_forbidden_from_admin_audit_logs(client: TestClient) -> None:
    # Register a client user
    reg = client.post(
        "/api/auth/register",
        json={
            "name": "Client User",
            "email": "client@business.com",
            "password": "ClientPassword123!",
            "confirmPassword": "ClientPassword123!",
            "role": "CLIENT",
        },
    )
    client_token = reg.json()["token"]

    # Client attempts to access audit logs
    res = client.get("/api/admin/audit-logs", headers={"Authorization": f"Bearer {client_token}"})
    assert res.status_code == status.HTTP_403_FORBIDDEN


def test_unauthenticated_requests_return_401(client: TestClient) -> None:
    client.cookies.clear()
    res1 = client.get("/api/admin/audit-logs")
    assert res1.status_code == status.HTTP_401_UNAUTHORIZED

    res2 = client.get("/api/documents")
    assert res2.status_code == status.HTTP_401_UNAUTHORIZED


def test_document_ownership_isolation(client: TestClient, db_session: Session) -> None:
    # Register User A (Lawyer A)
    res_a = client.post(
        "/api/auth/register",
        json={
            "name": "Attorney Alice",
            "email": "alice@firm.com",
            "password": "StrongPassword123!",
            "confirmPassword": "StrongPassword123!",
            "role": "LAWYER",
        },
    )
    user_a_id = uuid.UUID(res_a.json()["user"]["id"])
    token_a = res_a.json()["token"]

    # Register User B (Lawyer B)
    res_b = client.post(
        "/api/auth/register",
        json={
            "name": "Attorney Bob",
            "email": "bob@firm.com",
            "password": "StrongPassword123!",
            "confirmPassword": "StrongPassword123!",
            "role": "LAWYER",
        },
    )
    token_b = res_b.json()["token"]

    # Insert a confidential document belonging to User A directly in the DB
    doc_a = Document(
        owner_id=user_a_id,
        name="Confidential_M&A_Agreement.pdf",
        status="uploaded",
    )
    db_session.add(doc_a)
    db_session.commit()
    db_session.refresh(doc_a)
    doc_a_id = str(doc_a.id)

    # 1. User A accesses their own document -> 200 OK
    res_own = client.get(
        f"/api/documents/{doc_a_id}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res_own.status_code == status.HTTP_200_OK
    assert res_own.json()["name"] == "Confidential_M&A_Agreement.pdf"

    # 2. User B attempts to access User A's document -> 404 NOT FOUND (no leak)
    res_other = client.get(
        f"/api/documents/{doc_a_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_other.status_code == status.HTTP_404_NOT_FOUND
    assert "not found" in res_other.json()["detail"].lower()

    # 3. User A lists documents -> contains document
    list_a = client.get("/api/documents", headers={"Authorization": f"Bearer {token_a}"})
    assert list_a.status_code == status.HTTP_200_OK
    assert len(list_a.json()) == 1
    assert list_a.json()[0]["id"] == doc_a_id

    # 4. User B lists documents -> empty (User A's doc is NOT listed)
    list_b = client.get("/api/documents", headers={"Authorization": f"Bearer {token_b}"})
    assert list_b.status_code == status.HTTP_200_OK
    assert len(list_b.json()) == 0


def test_audit_logging_and_credential_sanitization(client: TestClient, db_session: Session) -> None:
    # Verify metadata sanitizer scrubs sensitive words
    dirty_meta = {
        "user_email": "user@example.com",
        "password": "SecretPassword123!",
        "token": "bearer.jwt.token",
        "nested": {"api_key": "12345", "status": "active"},
    }
    clean_meta = sanitize_metadata(dirty_meta)
    assert clean_meta["user_email"] == "user@example.com"
    assert clean_meta["password"] == "[REDACTED]"
    assert clean_meta["token"] == "[REDACTED]"
    assert clean_meta["nested"]["api_key"] == "[REDACTED]"
    assert clean_meta["nested"]["status"] == "active"

    # Perform register, login, logout and check audit log rows
    reg = client.post(
        "/api/auth/register",
        json={
            "name": "Audit Target",
            "email": "audit_target@test.com",
            "password": "StrongPassword123!",
            "confirmPassword": "StrongPassword123!",
        },
    )
    assert reg.status_code == status.HTTP_201_CREATED

    client.post(
        "/api/auth/login",
        json={"email": "audit_target@test.com", "password": "StrongPassword123!"},
    )

    client.post("/api/auth/logout")

    # Check database audit logs
    audit_records = list(db_session.scalars(select(AuditLog)).all())
    actions = [r.action for r in audit_records]
    assert "auth.register" in actions
    assert "auth.login" in actions
    assert "auth.logout" in actions

    # Verify no password or token was ever written
    for record in audit_records:
        meta_str = str(record.metadata_json)
        assert "StrongPassword123!" not in meta_str


def test_rate_limiter_exceeds_threshold() -> None:
    clear_in_memory_rate_limits()
    limiter = RateLimiter(times=3, seconds=60, prefix="test_limit")

    class MockRequest:
        class Client:
            host = "192.168.1.100"
        client = Client()

    req = MockRequest()  # type: ignore

    # First 3 calls should pass
    limiter(req)  # type: ignore
    limiter(req)  # type: ignore
    limiter(req)  # type: ignore

    # 4th call must raise 429
    try:
        limiter(req)  # type: ignore
        assert False, "Should have raised 429 Too Many Requests"
    except Exception as exc:
        from fastapi import HTTPException
        assert isinstance(exc, HTTPException)
        assert exc.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    finally:
        clear_in_memory_rate_limits()

