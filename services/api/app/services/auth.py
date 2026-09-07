from enum import StrEnum

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database.models import Role, User
from app.schemas.auth import LoginRequest, RegisterRequest
from app.security.passwords import hash_password, verify_password


class RoleName(StrEnum):
    ADMIN = "ADMIN"
    LAWYER = "LAWYER"
    CLIENT = "CLIENT"


def ensure_role(db: Session, role_name: str) -> Role:
    normalized = role_name.strip().upper()
    role = db.scalar(select(Role).where(func.upper(Role.name) == normalized))
    if not role:
        role = Role(name=normalized)
        db.add(role)
        db.commit()
        db.refresh(role)
    return role


def ensure_default_roles(db: Session) -> dict[str, Role]:
    roles = {}
    for role_name in RoleName:
        roles[role_name.value] = ensure_role(db, role_name.value)
    return roles


def register_user(db: Session, request: RegisterRequest) -> User:
    normalized_email = request.email.strip().lower()

    existing_user = db.scalar(select(User).where(func.lower(User.email) == normalized_email))
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    role = ensure_role(db, request.role)
    hashed = hash_password(request.password)

    user = User(
        name=request.name,
        email=normalized_email,
        password_hash=hashed,
        role_id=role.id,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, request: LoginRequest) -> User:
    normalized_email = request.email.strip().lower()

    user = db.scalar(select(User).where(func.lower(User.email) == normalized_email))
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive. Please contact an administrator.",
        )

    return user

