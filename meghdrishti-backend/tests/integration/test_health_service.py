from datetime import datetime, timezone

import pytest

from app.models.observations import WeatherObservation
from app.models.stations import Station
from app.services.health_service import HealthService


@pytest.mark.asyncio
async def test_recompute_health_with_no_history_defaults_reasonably(db_session):
    station = Station(station_code="HEALTH001", name="Health Test", source="TEST", latitude=1.0, longitude=1.0)
    db_session.add(station)
    await db_session.commit()

    result = await HealthService(db_session).recompute(station.id)
    assert result["status"] == "HEALTHY"
    assert result["health_score"] > 0


@pytest.mark.asyncio
async def test_recompute_persists_and_is_retrievable(db_session):
    from app.repositories.health_repository import HealthRepository

    station = Station(station_code="HEALTH002", name="Health Test 2", source="TEST", latitude=1.0, longitude=1.0)
    db_session.add(station)
    await db_session.commit()

    await HealthService(db_session).recompute(station.id)
    stored = await HealthRepository(db_session).get_latest(station.id)
    assert stored is not None
    assert stored.status == "HEALTHY"
