from contextlib import asynccontextmanager
import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.admin import router as admin_router
from app.api.analysis import router as analysis_router
from app.api.auth import router as auth_router
from app.api.chats import router as chats_router
from app.api.comparison import router as comparison_router
from app.api.documents import router as documents_router
from app.api.legal_research import router as legal_research_router
from app.api.reports import router as reports_router
from app.api.router import router
from app.core.config import get_settings
from app.core.logging import configure_logging

configure_logging()
logger = logging.getLogger("legalai.api")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        from app.database.base import Base
        from app.database.session import engine
        from app.database import models  # noqa: F401
        Base.metadata.create_all(bind=engine)
    except Exception as exc:
        logger.warning("Could not auto-create database tables on startup: %s", exc)
    yield


app = FastAPI(title="LegalAI API", version="0.1.0", docs_url="/docs", redoc_url=None, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    try:
        response = await call_next(request)
    except Exception as exc:
        logger.exception(
            "Unhandled server error method=%s path=%s error_type=%s request_id=%s: %s",
            request.method,
            request.url.path,
            type(exc).__name__,
            request_id,
            exc,
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "An internal error occurred.", "request_id": request_id},
        )
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "same-origin"
    return response


app.include_router(router)
app.include_router(router, prefix="/api")
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(auth_router, prefix="/auth", tags=["auth"], include_in_schema=False)
app.include_router(documents_router, prefix="/api/documents", tags=["documents"])
app.include_router(chats_router, prefix="/api", tags=["chats"])
app.include_router(comparison_router, prefix="/api/compare", tags=["compare"])
app.include_router(analysis_router, prefix="/api", tags=["analysis"])
app.include_router(reports_router, prefix="/api/reports", tags=["reports"])
app.include_router(legal_research_router, prefix="/api/research", tags=["research"])
app.include_router(admin_router, prefix="/api/admin", tags=["admin"])
