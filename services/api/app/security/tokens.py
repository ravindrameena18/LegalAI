from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt

from app.core.config import get_settings

ALGORITHM = "HS256"
SESSION_COOKIE = "legalai_session"


def create_access_token(user_id: UUID, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "role": role, "iat": now, "exp": now + timedelta(hours=8)}
    return jwt.encode(payload, get_settings().jwt_secret, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, get_settings().jwt_secret, algorithms=[ALGORITHM])