"""Seed roles, demo admin user, stations, neighbors, and sample data.

Run with: python -m app.db.seed
"""
from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.core.config import settings
from app.core.logging import get_logger
from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.calibration import CalibrationProfile
from app.models.stations import DataSource, Station, StationSensor
from app.qc.defaults import DEFAULT_RULE_THRESHOLDS
from app.repositories.user_repository import UserRepository
from app.scoring.defaults import DEFAULT_DECISION_THRESHOLDS, DEFAULT_FUSION_WEIGHTS

logger = get_logger("meghdrishti.seed")

ROLE_NAMES = ["VIEWER", "OPERATOR", "MAINTENANCE", "SCIENTIST", "ADMIN"]

DEMO_STATIONS = [
    {"station_code": "IMD_PUNE_001", "name": "Pune AWS", "latitude": 18.5204, "longitude": 73.8567, "elevation_m": 560, "region": "MAHARASHTRA"},
    {"station_code": "IMD_MUMBAI_001", "name": "Mumbai Colaba AWS", "latitude": 18.9067, "longitude": 72.8147, "elevation_m": 11, "region": "MAHARASHTRA"},
    {"station_code": "IMD_NAGPUR_001", "name": "Nagpur AWS", "latitude": 21.1458, "longitude": 79.0882, "elevation_m": 310, "region": "MAHARASHTRA"},
    {"station_code": "IMD_DELHI_001", "name": "Delhi Safdarjung AWS", "latitude": 28.5822, "longitude": 77.2035, "elevation_m": 216, "region": "DELHI"},
    {"station_code": "IMD_BENGALURU_001", "name": "Bengaluru AWS", "latitude": 12.9716, "longitude": 77.5946, "elevation_m": 920, "region": "KARNATAKA"},
]

MEASUREMENTS = ["temperature_c", "humidity_pct", "pressure_hpa", "rainfall_mm", "wind_speed_ms", "wind_direction_deg"]
UNITS = {"temperature_c": "C", "humidity_pct": "%", "pressure_hpa": "hPa", "rainfall_mm": "mm", "wind_speed_ms": "m/s", "wind_direction_deg": "deg"}


async def seed() -> None:
    async with AsyncSessionLocal() as session:
        repo = UserRepository(session)

        for name in ROLE_NAMES:
            await repo.get_or_create_role(name)
        await session.commit()

        existing_admin = await repo.get_by_email(settings.demo_admin_email)
        if existing_admin is None:
            await repo.create_user(
                email=settings.demo_admin_email,
                hashed_password=hash_password(settings.demo_admin_password),
                full_name="Demo Administrator",
                role_names=["ADMIN"],
            )
            logger.info("seed_admin_created", email=settings.demo_admin_email)
        else:
            logger.info("seed_admin_exists", email=settings.demo_admin_email)

        existing_sources = {
            row[0] for row in (await session.execute(select(DataSource.name))).all()
        }
        for name, kind, enabled in [
            ("OPEN_METEO", "FORECAST_API", True),
            ("IMD", "STATION_NETWORK", settings.imd_enabled),
            ("NOAA_ISD", "STATION_NETWORK", False),
            ("ERA5", "REANALYSIS", False),
            ("NASA_GPM", "SATELLITE", False),
        ]:
            if name not in existing_sources:
                session.add(DataSource(name=name, kind=kind, is_enabled=enabled, config={}))

        existing_codes = {
            row[0] for row in (await session.execute(select(Station.station_code))).all()
        }
        stations: list[Station] = []
        for s in DEMO_STATIONS:
            if s["station_code"] in existing_codes:
                continue
            station = Station(source="IMD", is_active=True, **s)
            session.add(station)
            stations.append(station)
        await session.flush()

        for station in stations:
            for m in MEASUREMENTS:
                session.add(StationSensor(station_id=station.id, measurement=m, unit=UNITS[m], is_active=True))

        existing_profile = (
            await session.execute(select(CalibrationProfile).where(CalibrationProfile.name == "default"))
        ).scalar_one_or_none()
        if existing_profile is None:
            from app.health.station_health import DEFAULT_BOUNDARIES, DEFAULT_WEIGHTS

            session.add(
                CalibrationProfile(
                    name="default",
                    is_active=True,
                    rule_thresholds=DEFAULT_RULE_THRESHOLDS,
                    fusion_weights=DEFAULT_FUSION_WEIGHTS,
                    decision_thresholds=DEFAULT_DECISION_THRESHOLDS,
                    health_weights=DEFAULT_WEIGHTS,
                    health_boundaries={str(k): v for k, v in DEFAULT_BOUNDARIES},
                )
            )
            logger.info("seed_calibration_profile_created")
        else:
            logger.info("seed_calibration_profile_exists")

        await session.commit()
        logger.info("seed_stations_created", count=len(stations))


if __name__ == "__main__":
    asyncio.run(seed())
