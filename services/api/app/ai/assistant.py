from uuid import UUID
from sqlalchemy.orm import Session

from app.database.models import User
from app.services.document_access import verify_document_ownership


async def ask_document_question(
    db: Session,
    user: User,
    document_id: UUID,
    question: str,
) -> dict[str, str]:
    """
    Service foundation for document-aware AI assistant.
    Enforces document ownership and pre-validates user query.
    Note: Full chat flow with session history and vector retrieval will be implemented in Phase 6.
    """
    # Enforce strict ownership boundary
    verify_document_ownership(db=db, user=user, document_id=document_id)

    if not question.strip():
        raise ValueError("Question cannot be empty.")

    # Placeholder for Phase 6 multi-turn conversation
    return {
        "status": "prepared",
        "message": "AI Assistant foundation active. Multi-turn chat interface will be connected in Phase 6.",
        "question": question.strip(),
    }

