from datetime import UTC, datetime, timedelta

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

    now = datetime.now(UTC)
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

    # Idempotency: a retry (Celery retry, or a duplicate enqueue-processing
    # call) must not create a second Anomaly/QC/ML/Context row for the same
    # observation — it should just return the existing anomaly.
    from sqlalchemy import func, select

    from app.models.anomalies import Anomaly

    rerun_id = await process_observation(spike_obs.id)
    assert rerun_id == anomaly_id
    count = (
        await db_session.execute(select(func.count()).select_from(Anomaly).where(Anomaly.observation_id == spike_obs.id))
    ).scalar_one()
    assert count == 1


@pytest.mark.asyncio
async def test_ingested_fault_reaches_alert_health_and_event(db_session, monkeypatch):
    from unittest.mock import AsyncMock

    from sqlalchemy import select

    from app.db.session import get_redis
    from app.ingestion.imd import IMDAdapter
    from app.models.alerts import Alert
    from app.models.ingestion import RawObservation
    from app.repositories.health_repository import HealthRepository
    from app.services import ingestion_service
    from app.services.event_publisher import CHANNEL_ALERTS
    from app.workers import pipeline

    class FaultAdapter(IMDAdapter):
        source_name = "VERIFICATION_SYNTHETIC"

        async def fetch(self, station, start_time, end_time):
            return [{"station_id": station.station_code,
                     "timestamp": (start_time + timedelta(minutes=15 * i)).isoformat(),
                     "location": {"latitude": station.latitude, "longitude": station.longitude},
                     "measurements": {"temperature_c": 49.2 if i == 15 else 24.0}}
                    for i in range(16)]

    station = Station(station_code="VERIFY_RAW", name="Synthetic verification",
                      source="TEST", latitude=18.5, longitude=73.8)
    db_session.add(station)
    await db_session.commit()
    monkeypatch.setattr(ingestion_service, "get_adapter_registry",
                        lambda: {"VERIFICATION_SYNTHETIC": FaultAdapter()})

    async def forecast(_station, measurement, _timestamp):
        return 24.0 if measurement == "temperature_c" else None

    monkeypatch.setattr(pipeline, "fetch_forecast_value", forecast)
    monkeypatch.setattr(pipeline, "fetch_era5_value", AsyncMock(return_value=None))
    monkeypatch.setattr(pipeline, "fetch_gpm_rainfall", AsyncMock(return_value=None))
    now = datetime.now(UTC)
    result = await ingestion_service.IngestionService(db_session).run_for_station(
        station, "VERIFICATION_SYNTHETIC", now - timedelta(minutes=15 * 15), now,
    )
    assert result["normalized"] == result["raw_stored"] == 16
    observation = (await db_session.execute(
        select(WeatherObservation).where(WeatherObservation.station_id == station.id)
        .order_by(WeatherObservation.timestamp.desc()).limit(1)
    )).scalar_one()
    raw = await db_session.get(RawObservation, observation.raw_observation_id)
    assert raw.raw_payload["measurements"]["temperature_c"] == 49.2

    async with get_redis() as redis:
        async with redis.pubsub() as pubsub:
            await pubsub.subscribe(CHANNEL_ALERTS)
            await pubsub.get_message(timeout=2)  # Consume subscription acknowledgement.
            anomaly_id = await process_observation(observation.id)
            alert = (await db_session.execute(
                select(Alert).where(Alert.anomaly_id == anomaly_id)
            )).scalar_one()
            assert alert.status == "OPEN"
            assert alert.policy == "SINGLE_PROBABLE_FAULT"
            assert await HealthRepository(db_session).get_latest(station.id) is not None
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=2)
            import json

            event = json.loads(message["data"])
            assert event["event_type"] == "ALERT_CREATED"
            assert event["payload"]["alert_id"] == str(alert.id)
            assert await process_observation(observation.id) == anomaly_id
            assert len((await db_session.execute(select(Alert))).scalars().all()) == 1
