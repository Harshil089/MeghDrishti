from datetime import datetime, timedelta, timezone

import pytest

from app.models.observations import WeatherObservation
from app.models.stations import Station
from app.workers.pipeline import process_observation


async def _seed_history(db_session, station, base_value, base_ts, n=15, jitter=0.3):
    import random

    rng = random.Random(7)
    for i in range(n, 0, -1):
        ts = base_ts - timedelta(minutes=15 * i)
        db_session.add(
            WeatherObservation(
                station_id=station.id,
                timestamp=ts,
                source="TEST",
                received_at=ts,
                temperature_c=base_value + rng.uniform(-jitter, jitter),
                humidity_pct=70.0 + rng.uniform(-2, 2),
                pressure_hpa=1008.0 + rng.uniform(-1, 1),
                rainfall_mm=0.0,
                wind_speed_ms=3.0 + rng.uniform(-0.5, 0.5),
                wind_direction_deg=180.0,
            )
        )
    await db_session.commit()


@pytest.mark.asyncio
async def test_full_pipeline_produces_anomaly_for_spike(db_session):
    """Definition of done (section 50): raw -> ... -> anomaly -> alert -> health -> ws event."""
    station = Station(station_code="E2E001", name="E2E Test", source="TEST", latitude=18.5, longitude=73.8, region="TEST")
    db_session.add(station)
    await db_session.commit()

    now = datetime.now(timezone.utc)
    await _seed_history(db_session, station, base_value=24.0, base_ts=now)

    spike_obs = WeatherObservation(
        station_id=station.id, timestamp=now, source="TEST", received_at=now,
        temperature_c=49.2, humidity_pct=70.0, pressure_hpa=1008.0, rainfall_mm=0.0,
        wind_speed_ms=3.0, wind_direction_deg=180.0,
    )
    db_session.add(spike_obs)
    await db_session.commit()

    anomaly_id = await process_observation(spike_obs.id)
    assert anomaly_id is not None

    from app.repositories.anomaly_repository import AnomalyRepository
    from app.repositories.health_repository import HealthRepository

    anomaly = await AnomalyRepository(db_session).get(anomaly_id)
    assert anomaly is not None
    assert anomaly.classification in ("SUSPICIOUS", "PROBABLE_SENSOR_FAULT", "INSUFFICIENT_CONTEXT")
    assert anomaly.measurement == "temperature_c"
    assert len(anomaly.reason_codes) > 0

    health = await HealthRepository(db_session).get_latest(station.id)
    assert health is not None
