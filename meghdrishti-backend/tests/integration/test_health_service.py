from datetime import datetime, timezone

import pytest

from app.models.observations import WeatherObservation
from app.models.stations import Station
from app.services.health_service import HealthService


@pytest.mark.asyncio
async def test_station_without_enough_history_is_new_not_scored(db_session):
    station = Station(station_code="HEALTH001", name="Health Test", source="TEST", latitude=1.0, longitude=1.0)
    db_session.add(station)
    await db_session.commit()

    result = await HealthService(db_session).recompute(station.id)
    assert result["status"] == "NEW"
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
    assert stored.status == "NEW"


async def _readings(db_session, station, n, **values):
    from datetime import timedelta

    now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    for i in range(n):
        db_session.add(WeatherObservation(station_id=station.id, timestamp=now - timedelta(minutes=15 * i), source="IMD",
                                          received_at=now, **values))
    await db_session.commit()


@pytest.mark.asyncio
async def test_sensors_a_station_never_reports_do_not_lower_health(db_session):
    # An IMD AWS with temperature and humidity only: no rainfall in the feed, no barometer.
    station = Station(station_code="HEALTH003", name="Health Test 3", source="IMD_AWS", latitude=1.0, longitude=1.0)
    db_session.add(station)
    await db_session.commit()
    await _readings(db_session, station, 10, temperature_c=25.0, humidity_pct=70.0)

    result = await HealthService(db_session).recompute(station.id)
    assert result["status"] == "HEALTHY"
    assert result["components"]["completeness_pct"] == 100.0
