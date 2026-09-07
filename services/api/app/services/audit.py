import logging
from enum import StrEnum
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.models import AuditLog

logger = logging.getLogger("legalai.audit")

SENSITIVE_KEY_SUBSTRINGS = {
    "password",
    "hash",
    "token",
    "secret",
    "authorization",
    "cookie",
    "key",
    "credential",
}


class AuditEvent(StrEnum):
    AUTH_REGISTER = "auth.register"
    AUTH_LOGIN = "auth.login"
    AUTH_LOGIN_FAILED = "auth.login_failed"
    AUTH_LOGOUT = "auth.logout"
    DOCUMENT_VIEW = "document.view"
    DOCUMENT_ACCESS_DENIED = "document.access_denied"
    PERMISSION_DENIED = "permission.denied"


def sanitize_metadata(data: Any) -> Any:
    """Recursively scrub sensitive keys and credentials from audit metadata."""
    if isinstance(data, dict):
        cleaned = {}
        for k, v in data.items():
            k_lower = str(k).lower()
            if any(sub in k_lower for sub in SENSITIVE_KEY_SUBSTRINGS):
                cleaned[k] = "[REDACTED]"
            else:
                cleaned[k] = sanitize_metadata(v)
        return cleaned
    elif isinstance(data, list):
        return [sanitize_metadata(item) for item in data]
    return data


def record_audit_event(
    db: Session,
    action: str,
    resource_type: str,
    actor_id: UUID | None = None,
    resource_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> AuditLog | None:
    """
    Persist an audit log entry.
    Never persists passwords, tokens, or sensitive credentials.
    """
    try:
        sanitized = sanitize_metadata(metadata) if metadata else {}
        log_entry = AuditLog(
            actor_id=actor_id,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id else None,
            metadata_json=sanitized,
        )
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)
        return log_entry
    except Exception as exc:
        logger.exception("Failed to write audit log entry action=%s: %s", action, exc)
        db.rollback()
        return None


def get_audit_logs(
    db: Session,
    limit: int = 50,
    offset: int = 0,
) -> list[AuditLog]:
    """Query audit logs ordered by creation time descending."""
    query = (
        select(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(query).all())

