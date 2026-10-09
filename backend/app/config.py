"""Configuration management using pydantic-settings."""

from functools import lru_cache
from typing import List, Optional, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings and environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    APP_NAME: str = "Numbers Guesser API"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8080

    # Firebase & Firestore Configuration
    FIREBASE_PROJECT_ID: str = "numbers-guesser"
    FIREBASE_CREDENTIALS_PATH: Optional[str] = "serviceAccountKey.json"
    FIRESTORE_EMULATOR_HOST: Optional[str] = None
    FIREBASE_AUTH_EMULATOR_HOST: Optional[str] = None
    USE_MOCK_DATABASE: bool = False

    # Auth and Local Development
    DEV_BYPASS_AUTH: bool = False
    DEV_DEFAULT_USER_ID: str = "dev-player-1"
    DEV_DEFAULT_USER_EMAIL: str = "dev@numbersguesser.local"

    # CORS Configuration
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if not v.strip():
                return ["*"]
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return ["*"]


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()
