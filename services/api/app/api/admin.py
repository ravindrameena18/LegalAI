from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.database.models import User
from app.schemas.audit import AuditLogResponse
from app.security.dependencies import require_permission
from app.security.permissions import Permission
from app.services.audit import get_audit_logs

router = APIRouter()


@router.get("/audit-logs", response_model=list[AuditLogResponse], status_code=status.HTTP_200_OK)
def list_audit_logs(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.AUDIT_VIEW)),
) -> list[AuditLogResponse]:
    """
    Retrieve audit logs.
    Restricted to users with AUDIT_VIEW permission (ADMIN).
    """
    logs = get_audit_logs(db=db, limit=limit, offset=offset)
    return [AuditLogResponse.model_validate(log) for log in logs]

