from fastapi import APIRouter

from app.core.config import get_settings
from app.schemas.health import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["system"])
def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        status="ok",
        service="legalai-api",
        version="0.1.0",
        dependencies={
            "database": "configured" if settings.database_url else "unconfigured",
            "redis": "configured" if settings.redis_url else "unconfigured",
            "ai": settings.ai_provider,
            "storage": settings.storage_provider,
            "ocr": settings.ocr_provider,
        },
    )
