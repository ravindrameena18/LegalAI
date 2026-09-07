from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database.dependencies import get_db
from app.database.models import User
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    UserResponse,
)
from app.security.dependencies import get_current_active_user
from app.security.rate_limit import RateLimiter
from app.security.tokens import SESSION_COOKIE, create_access_token
from app.services.audit import AuditEvent, record_audit_event
from app.services.auth import authenticate_user, register_user

router = APIRouter()
settings = get_settings()

auth_rate_limiter = RateLimiter(times=30, seconds=60, prefix="auth")


def _set_auth_cookie(response: Response, token: str) -> None:
    is_production = settings.app_env.lower() == "production"
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        secure=is_production,
        max_age=8 * 3600,
        path="/",
    )


def _clear_auth_cookie(response: Response) -> None:
    is_production = settings.app_env.lower() == "production"
    response.delete_cookie(
        key=SESSION_COOKIE,
        path="/",
        samesite="lax",
        secure=is_production,
    )


def _to_user_response(user: User) -> UserResponse:
    role_name = user.role.name if user.role else "LAWYER"
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=role_name,
        is_active=user.is_active,
        created_at=user.created_at,
    )


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(auth_rate_limiter)],
)
def register(request: RegisterRequest, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    user = register_user(db, request)
    role_name = user.role.name if user.role else "LAWYER"
    token = create_access_token(user_id=user.id, role=role_name)
    _set_auth_cookie(response, token)

    record_audit_event(
        db=db,
        action=AuditEvent.AUTH_REGISTER,
        resource_type="user",
        actor_id=user.id,
        resource_id=str(user.id),
        metadata={"email": user.email, "role": role_name},
    )

    return AuthResponse(
        user=_to_user_response(user),
        token=token,
        token_type="bearer",
    )


@router.post(
    "/login",
    response_model=AuthResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(auth_rate_limiter)],
)
def login(request: LoginRequest, response: Response, db: Session = Depends(get_db)) -> AuthResponse:
    try:
        user = authenticate_user(db, request)
    except HTTPException as err:
        if err.status_code == status.HTTP_401_UNAUTHORIZED:
            record_audit_event(
                db=db,
                action=AuditEvent.AUTH_LOGIN_FAILED,
                resource_type="user",
                metadata={"attempted_email": request.email},
            )
        raise err

    role_name = user.role.name if user.role else "LAWYER"
    token = create_access_token(user_id=user.id, role=role_name)
    _set_auth_cookie(response, token)

    record_audit_event(
        db=db,
        action=AuditEvent.AUTH_LOGIN,
        resource_type="user",
        actor_id=user.id,
        resource_id=str(user.id),
        metadata={"email": user.email, "role": role_name},
    )

    return AuthResponse(
        user=_to_user_response(user),
        token=token,
        token_type="bearer",
    )


@router.post("/logout", response_model=MessageResponse, status_code=status.HTTP_200_OK)
def logout(response: Response, db: Session = Depends(get_db)) -> MessageResponse:
    _clear_auth_cookie(response)
    record_audit_event(
        db=db,
        action=AuditEvent.AUTH_LOGOUT,
        resource_type="user",
    )
    return MessageResponse(message="Successfully logged out.")


@router.get("/me", response_model=UserResponse, status_code=status.HTTP_200_OK)
def get_me(current_user: User = Depends(get_current_active_user)) -> UserResponse:
    return _to_user_response(current_user)
