from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.models import Document, User


def verify_document_ownership(db: Session, user: User, document_id: UUID) -> Document:
    """
    Verify that a document exists and belongs to the given user.
    To avoid leaking whether another user's private document exists,
    returns 404 Not Found if document is not found or owned by another user.
    """
    document = db.scalar(select(Document).where(Document.id == document_id))
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    user_role = user.role.name.upper() if user.role else ""
    if document.owner_id != user.id and user_role != "ADMIN":
        # Security requirement: Return 404 rather than 403
        # to prevent resource existence enumeration across tenants
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    return document


def get_user_documents(
    db: Session,
    user: User,
    file_type: str | None = None,
    processing_status: str | None = None,
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Document]:
    """Retrieve documents accessible to the given user with optional filtering."""
    user_role = user.role.name.upper() if user.role else ""
    query = select(Document)

    # Non-admins can only see their own documents
    if user_role != "ADMIN":
        query = query.where(Document.owner_id == user.id)

    if file_type and file_type.strip().lower() != "all":
        query = query.where(Document.file_type == file_type.strip().lower())

    if processing_status and processing_status.strip().lower() != "all":
        query = query.where(Document.processing_status == processing_status.strip().lower())

    if search and search.strip():
        search_term = f"%{search.strip()}%"
        query = query.where(Document.name.ilike(search_term))

    query = query.order_by(Document.created_at.desc()).limit(limit).offset(offset)
    return list(db.scalars(query).all())
