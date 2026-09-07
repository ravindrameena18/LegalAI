from app.core.config import Settings


def test_cors_origins_are_parsed_without_secrets() -> None:
    settings = Settings(cors_origins="http://localhost:3000, http://localhost:3001")

    assert settings.allowed_origins == ["http://localhost:3000", "http://localhost:3001"]
    assert settings.jwt_secret != ""
