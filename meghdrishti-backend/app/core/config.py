"""Typed application settings loaded from environment variables."""
from __future__ import annotations

from functools import lru_cache
from urllib.parse import urlsplit

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # App
    app_name: str = "meghdrishti-backend"
    environment: str = "development"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"
    cors_origins: list[str] = ["http://localhost:3000"]

    # Database
    database_url: str = "postgresql+asyncpg://meghdrishti:meghdrishti@localhost:5432/meghdrishti"
    database_url_sync: str = "postgresql+psycopg://meghdrishti:meghdrishti@localhost:5432/meghdrishti"
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pooling: bool = True

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    jwt_secret: str = "insecure-dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_minutes: int = 10080
    write_rate_limit_per_minute: int = 120

    demo_admin_email: str = "admin@meghdrishti.local"
    demo_admin_password: str = "change-me"

    google_client_id: str = ""

    # Ingestion sources
    open_meteo_base_url: str = "https://api.open-meteo.com/v1"

    imd_api_base_url: str = ""
    imd_api_key: str = ""
    imd_enabled: bool = False

    ghcn_base_url: str = "https://www.ncei.noaa.gov/access/services/data/v1"
    ghcn_api_token: str = ""

    era5_cds_url: str = "https://cds.climate.copernicus.eu/api"
    era5_cds_key: str = ""

    nasa_gpm_base_url: str = "https://gpm1.gesdisc.eosdis.nasa.gov"
    nasa_gpm_token: str = ""

    # Celery
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # Observability
    prometheus_enabled: bool = True
    log_level: str = "INFO"
    log_json: bool = True

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v):
        if isinstance(v, str):
            import json

            try:
                return json.loads(v)
            except Exception:
                return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @field_validator("cors_origins")
    @classmethod
    def _exact_origins(cls, origins: list[str]) -> list[str]:
        for origin in origins:
            parts = urlsplit(origin)
            if (parts.scheme not in {"http", "https"} or not parts.hostname
                or "*" in origin or parts.path or parts.query or parts.fragment
                or parts.username or parts.password):
                raise ValueError("CORS_ORIGINS must contain exact http(s) origins without paths or wildcards")
            _port = parts.port  # accessing the property rejects malformed port numbers
        return list(dict.fromkeys(origins))

    @model_validator(mode="after")
    def _guard_production(self) -> Settings:
        # Anything other than local development must not run with dev defaults.
        if self.environment != "development":
            if self.debug:
                raise ValueError("DEBUG must be false outside ENVIRONMENT=development")
            if self.jwt_secret == "insecure-dev-secret-change-me":
                raise ValueError("JWT_SECRET must be set to a real secret outside ENVIRONMENT=development")
            if self.demo_admin_password == "change-me":
                raise ValueError("DEMO_ADMIN_PASSWORD must be changed outside ENVIRONMENT=development")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
