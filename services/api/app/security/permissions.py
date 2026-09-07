from enum import StrEnum


class Permission(StrEnum):
    # User & Administration
    USERS_MANAGE = "users:manage"
    SYSTEM_MANAGE = "system:manage"
    AUDIT_VIEW = "audit:view"

    # Documents & Analysis
    DOCUMENT_UPLOAD = "document:upload"
    DOCUMENT_VIEW = "document:view"
    DOCUMENT_DELETE = "document:delete"
    DOCUMENT_ANALYZE = "document:analyze"
    ASSISTANT_USE = "assistant:use"
    REPORT_GENERATE = "report:generate"
    REPORT_VIEW = "report:view"


# Canonical role-to-permission mappings
ROLE_PERMISSIONS: dict[str, set[Permission]] = {
    "ADMIN": {
        Permission.USERS_MANAGE,
        Permission.SYSTEM_MANAGE,
        Permission.AUDIT_VIEW,
        Permission.DOCUMENT_VIEW,
        Permission.REPORT_VIEW,
    },
    "LAWYER": {
        Permission.DOCUMENT_UPLOAD,
        Permission.DOCUMENT_VIEW,
        Permission.DOCUMENT_DELETE,
        Permission.DOCUMENT_ANALYZE,
        Permission.ASSISTANT_USE,
        Permission.REPORT_GENERATE,
        Permission.REPORT_VIEW,
    },
    "CLIENT": {
        Permission.DOCUMENT_UPLOAD,
        Permission.DOCUMENT_VIEW,
        Permission.DOCUMENT_DELETE,
        Permission.REPORT_VIEW,
    },
}


def has_permission(role_name: str | None, permission: Permission) -> bool:
    if not role_name:
        return False
    normalized = role_name.strip().upper()
    return permission in ROLE_PERMISSIONS.get(normalized, set())


def get_role_permissions(role_name: str | None) -> list[str]:
    if not role_name:
        return []
    normalized = role_name.strip().upper()
    return sorted([p.value for p in ROLE_PERMISSIONS.get(normalized, set())])

