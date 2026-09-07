from functools import lru_cache

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_THIS_FILE = Path(__file__).resolve()
_WORKSPACE_ROOT = _THIS_FILE.parents[4] if len(_THIS_FILE.parents) > 4 else Path.cwd()
_ROOT_ENV = _WORKSPACE_ROOT / ".env"
_API_ENV = _THIS_FILE.parents[2] / ".env" if len(_THIS_FILE.parents) > 2 else Path.cwd() / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(_ROOT_ENV, _API_ENV),
        extra="ignore",
    )

    app_env: str = "development"
    api_origin: str = "http://localhost:8000"
    web_origin: str = "http://localhost:3000"
    cors_origins: str = "http://localhost:3000,https://legalai-jyad.onrender.com"
    database_url: str = "postgresql+psycopg://legalai:change-me@localhost:5432/legalai"
    redis_url: str = "redis://localhost:6379/0"
    storage_provider: str = "unconfigured"
    storage_endpoint: str | None = None
    storage_bucket: str = "legalai-private"
    jwt_secret: str = Field(default="development-only-secret-key-32-chars-long-min!", min_length=16)
    session_secret: str = "development-only-change-me"
    encryption_key: str = "development-only-change-me"
    ai_provider: str = "unconfigured"
    ai_api_key: str | None = None
    ai_model: str | None = None
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.5-flash"
    ocr_provider: str = "unconfigured"
    max_upload_bytes: int = 25 * 1024 * 1024

    @property
    def resolved_gemini_api_key(self) -> str | None:
        return self.gemini_api_key or self.ai_api_key

    @property
    def resolved_gemini_model(self) -> str:
        return self.gemini_model or self.ai_model or "gemini-3.5-flash"

    @property
    def allowed_origins(self) -> list[str]:
        origins = [origin.strip().rstrip("/") for origin in self.cors_origins.split(",") if origin.strip()]
        if self.web_origin:
            cleaned_web = self.web_origin.strip().rstrip("/")
            if cleaned_web and cleaned_web not in origins:
                origins.append(cleaned_web)
        return origins


@lru_cache
def get_settings() -> Settings:
    return Settings()
