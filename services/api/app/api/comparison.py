import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.database.models import Comparison, User
from app.schemas.comparison import (
    ComparisonCreateRequest,
    ComparisonResponse,
    ComparisonResultData,
)
from app.security.dependencies import require_permission
from app.security.permissions import Permission
from app.services.comparison_service import (
    get_comparison_by_id,
    list_user_comparisons,
    run_document_comparison,
)

logger = logging.getLogger("legalai.comparison.api")
router = APIRouter()


def _to_comparison_response(comp: Comparison) -> ComparisonResponse:
    result_data = (
        comp.result_data
        if isinstance(comp.result_data, dict)
        else {}
    )
    validated_result = ComparisonResultData.model_validate(result_data)

    return ComparisonResponse(
        id=comp.id,
        doc_a_id=comp.doc_a_id,
        doc_b_id=comp.doc_b_id,
        doc_a_label=comp.doc_a_label,
        doc_b_label=comp.doc_b_label,
        status=comp.status,
        result_data=validated_result,
        created_at=comp.created_at,
    )


@router.post(
    "",
    response_model=ComparisonResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Compare two legal documents",
)
async def create_comparison(
    payload: ComparisonCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.DOCUMENT_VIEW)),
) -> ComparisonResponse:
    """
    Compare Document 1 against Document 2.
    Detects additions, removals, modifications, and associated legal risks.
    Both documents must be in READY status and owned/accessible by the user.
    """
    try:
        comp = await run_document_comparison(
            db=db,
            user=current_user,
            request=payload,
        )
        return _to_comparison_response(comp)
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        logger.exception(
            "Unhandled comparison failure user_id=%s doc_a_id=%s doc_b_id=%s: %s",
            getattr(current_user, "id", "unknown"),
            payload.doc_a_id,
            payload.doc_b_id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Comparison failed: {exc}",
        ) from exc



@router.get(
    "/{comparison_id}",
    response_model=ComparisonResponse,
    summary="Get comparison details by ID",
)
def get_comparison(
    comparison_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.DOCUMENT_VIEW)),
) -> ComparisonResponse:
    """
    Retrieve stored document comparison results by UUID.
    """
    comp = get_comparison_by_id(
        db=db,
        user=current_user,
        comparison_id=comparison_id,
    )
    return _to_comparison_response(comp)


@router.get(
    "",
    response_model=list[ComparisonResponse],
    summary="List comparisons for the current user",
)
def list_comparisons(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.DOCUMENT_VIEW)),
) -> list[ComparisonResponse]:
    """
    List previous document comparisons initiated by the user.
    """
    comps = list_user_comparisons(db=db, user=current_user)
    return [_to_comparison_response(c) for c in comps]

