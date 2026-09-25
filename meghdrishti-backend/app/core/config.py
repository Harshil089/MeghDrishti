"""Typed application settings loaded from environment variables."""
from __future__ import annotations

from functools import lru_cache

from pydantic import field_validator
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

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    jwt_secret: str = "insecure-dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_minutes: int = 10080

    demo_admin_email: str = "admin@meghdrishti.local"
    demo_admin_password: str = "change-me"

    google_client_id: str = ""

    # Ingestion sources
    open_meteo_base_url: str = "https://api.open-meteo.com/v1"

    imd_api_base_url: str = ""
    imd_api_key: str = ""
    imd_enabled: bool = False

    noaa_isd_base_url: str = "https://www.ncei.noaa.gov/access/services/data/v1"
    noaa_api_token: str = ""

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


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
