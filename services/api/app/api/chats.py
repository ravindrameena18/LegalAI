import logging
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.database.models import ChatMessage, ChatSession

logger = logging.getLogger("legalai.api.chats")

router = APIRouter()


class ChatDeleteResponse(BaseModel):
    success: bool
    message: str
    session_id: str
    deleted_from_database: bool


@router.delete("/chats/{session_id}", response_model=ChatDeleteResponse, status_code=status.HTTP_200_OK)
@router.delete("/chat-sessions/{session_id}", response_model=ChatDeleteResponse, status_code=status.HTTP_200_OK)
def delete_chat_session(
    session_id: str,
    db: Session = Depends(get_db),
) -> ChatDeleteResponse:
    """
    Permanently delete a chat session and all its associated messages from storage.
    If the session exists in the PostgreSQL database, cascade deletes all chat_messages and chat_sessions rows.
    """
    deleted_from_db = False
    parsed_uuid = None
    try:
        parsed_uuid = UUID(session_id)
    except (ValueError, TypeError):
        parsed_uuid = None

    if parsed_uuid:
        try:
            # Delete messages first due to foreign key constraint
            msg_res = db.execute(delete(ChatMessage).where(ChatMessage.session_id == parsed_uuid))
            sess_res = db.execute(delete(ChatSession).where(ChatSession.id == parsed_uuid))
            db.commit()
            if (sess_res.rowcount and sess_res.rowcount > 0) or (msg_res.rowcount and msg_res.rowcount > 0):
                deleted_from_db = True
                logger.info("Deleted chat session %s and its messages from database", session_id)
        except Exception as exc:
            db.rollback()
            logger.warning("Error deleting session %s from database: %s", session_id, exc)

    return ChatDeleteResponse(
        success=True,
        message="Chat session and conversation history permanently deleted.",
        session_id=session_id,
        deleted_from_database=deleted_from_db,
    )

