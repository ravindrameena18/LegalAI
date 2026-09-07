from fastapi import Depends, status
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.auth import router as auth_router
from app.database.models import User
from app.main import app
from app.security.dependencies import get_current_active_user, require_roles
from app.security.passwords import verify_password
from app.security.tokens import SESSION_COOKIE, create_access_token


# Helper dummy protected route for testing role authorization
@app.get("/test-admin-only", tags=["test"])
def handle_test_admin_only(user: User = Depends(require_roles("ADMIN"))):
    return {"status": "ok", "user": user.email}


def test_user_registration_success(client: TestClient, db_session: Session) -> None:
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Sarah Connor",
            "email": "sarah@example.com",
            "password": "StrongPassword123!",
            "confirmPassword": "StrongPassword123!",
        },
    )

    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["user"]["name"] == "Sarah Connor"
    assert data["user"]["email"] == "sarah@example.com"
    assert data["user"]["role"] == "LAWYER"
    assert data["user"]["is_active"] is True
    assert "id" in data["user"]
    assert "token" in data
    assert SESSION_COOKIE in response.cookies

    # Verify user in database
    db_user = db_session.scalar(select(User).where(User.email == "sarah@example.com"))
    assert db_user is not None
    assert db_user.password_hash != "StrongPassword123!"
    assert verify_password("StrongPassword123!", db_user.password_hash)


def test_user_registration_custom_role(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Client User",
            "email": "client@example.com",
            "password": "StrongPassword123!",
            "confirmPassword": "StrongPassword123!",
            "role": "CLIENT",
        },
    )
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["user"]["role"] == "CLIENT"


def test_user_registration_duplicate_email(client: TestClient) -> None:
    payload = {
        "name": "Sarah Connor",
        "email": "sarah@example.com",
        "password": "StrongPassword123!",
        "confirmPassword": "StrongPassword123!",
    }
    first_res = client.post("/api/auth/register", json=payload)
    assert first_res.status_code == status.HTTP_201_CREATED

    # Attempt second registration with same email (different casing)
    second_res = client.post(
        "/api/auth/register",
        json={**payload, "email": "SARAH@EXAMPLE.COM"},
    )
    assert second_res.status_code == status.HTTP_409_CONFLICT
    assert "already exists" in second_res.json()["detail"].lower()


def test_user_registration_password_strength(client: TestClient) -> None:
    # Too short (< 8 chars)
    res1 = client.post(
        "/api/auth/register",
        json={"name": "Test", "email": "test@example.com", "password": "Sh1!", "confirmPassword": "Sh1!"},
    )
    assert res1.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # Missing uppercase
    res2 = client.post(
        "/api/auth/register",
        json={"name": "Test", "email": "test@example.com", "password": "weakpassword123!", "confirmPassword": "weakpassword123!"},
    )
    assert res2.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # Missing number
    res3 = client.post(
        "/api/auth/register",
        json={"name": "Test", "email": "test@example.com", "password": "WeakPassword!", "confirmPassword": "WeakPassword!"},
    )
    assert res3.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    # Missing special char
    res4 = client.post(
        "/api/auth/register",
        json={"name": "Test", "email": "test@example.com", "password": "WeakPassword123", "confirmPassword": "WeakPassword123"},
    )
    assert res4.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_user_registration_password_mismatch(client: TestClient) -> None:
    res = client.post(
        "/api/auth/register",
        json={
            "name": "Sarah Connor",
            "email": "mismatch@example.com",
            "password": "StrongPassword123!",
            "confirmPassword": "DifferentPassword123!",
        },
    )
    assert res.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    assert "passwords do not match" in res.text.lower()


def test_password_hashing_security(client: TestClient, db_session: Session) -> None:
    raw_password = "SecurePassword2026!"
    client.post(
        "/api/auth/register",
        json={
            "name": "Hash Check",
            "email": "hash@example.com",
            "password": raw_password,
            "confirmPassword": raw_password,
        },
    )

    db_user = db_session.scalar(select(User).where(User.email == "hash@example.com"))
    assert db_user is not None
    # Ensure plaintext is never stored
    assert raw_password not in db_user.password_hash
    # Ensure hash starts with modern argon2 signature
    assert db_user.password_hash.startswith("$argon2")


def test_login_success(client: TestClient) -> None:
    client.post(
        "/api/auth/register",
        json={
            "name": "Login User",
            "email": "login@example.com",
            "password": "CorrectPassword123!",
            "confirmPassword": "CorrectPassword123!",
        },
    )

    response = client.post(
        "/api/auth/login",
        json={"email": "login@example.com", "password": "CorrectPassword123!"},
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["user"]["email"] == "login@example.com"
    assert "token" in data
    assert SESSION_COOKIE in response.cookies


def test_login_failure_wrong_password(client: TestClient) -> None:
    client.post(
        "/api/auth/register",
        json={
            "name": "Login User",
            "email": "login_fail@example.com",
            "password": "CorrectPassword123!",
            "confirmPassword": "CorrectPassword123!",
        },
    )

    response = client.post(
        "/api/auth/login",
        json={"email": "login_fail@example.com", "password": "WrongPassword123!"},
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "invalid email or password" in response.json()["detail"].lower()


def test_login_failure_unknown_user(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login",
        json={"email": "ghost@example.com", "password": "SomePassword123!"},
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "invalid email or password" in response.json()["detail"].lower()


def test_protected_me_endpoint_with_bearer_token(client: TestClient) -> None:
    reg = client.post(
        "/api/auth/register",
        json={
            "name": "Bearer User",
            "email": "bearer@example.com",
            "password": "StrongPassword123!",
            "confirmPassword": "StrongPassword123!",
        },
    )
    token = reg.json()["token"]

    # Clear cookie from client to ensure Bearer header is what authorizes
    client.cookies.clear()

    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["email"] == "bearer@example.com"


def test_protected_me_endpoint_with_cookie(client: TestClient) -> None:
    client.post(
        "/api/auth/register",
        json={
            "name": "Cookie User",
            "email": "cookie@example.com",
            "password": "StrongPassword123!",
            "confirmPassword": "StrongPassword123!",
        },
    )
    # Cookie is automatically stored in test client
    response = client.get("/api/auth/me")
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["email"] == "cookie@example.com"


def test_unauthorized_request(client: TestClient) -> None:
    client.cookies.clear()
    response = client.get("/api/auth/me")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert "not authenticated" in response.json()["detail"].lower()


def test_unauthorized_with_malformed_token(client: TestClient) -> None:
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-valid-jwt"})
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_role_authorization_forbidden(client: TestClient) -> None:
    # Register default LAWYER
    reg = client.post(
        "/api/auth/register",
        json={
            "name": "Lawyer User",
            "email": "lawyer@example.com",
            "password": "StrongPassword123!",
            "confirmPassword": "StrongPassword123!",
            "role": "LAWYER",
        },
    )
    token = reg.json()["token"]

    # LAWYER attempting to access ADMIN-only endpoint
    res = client.get("/test-admin-only", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == status.HTTP_403_FORBIDDEN
    assert "insufficient permissions" in res.json()["detail"].lower()


def test_logout_clears_cookie(client: TestClient) -> None:
    client.post(
        "/api/auth/register",
        json={
            "name": "Logout User",
            "email": "logout@example.com",
            "password": "StrongPassword123!",
            "confirmPassword": "StrongPassword123!",
        },
    )
    assert SESSION_COOKIE in client.cookies

    logout_res = client.post("/api/auth/logout")
    assert logout_res.status_code == status.HTTP_200_OK
    assert logout_res.json()["message"] == "Successfully logged out."

    # Cookie is expired / deleted
    cookie = client.cookies.get(SESSION_COOKIE)
    assert cookie is None or cookie == '""'


def test_auth_alias_routes(client: TestClient) -> None:
    res = client.post(
        "/auth/register",
        json={
            "name": "Alias User",
            "email": "alias@example.com",
            "password": "StrongPassword123!",
            "confirmPassword": "StrongPassword123!",
        },
    )
    assert res.status_code == status.HTTP_201_CREATED
    assert res.json()["user"]["email"] == "alias@example.com"

