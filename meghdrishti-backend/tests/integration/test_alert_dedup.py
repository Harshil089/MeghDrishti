from datetime import datetime, timezone
import uuid

import pytest

from app.alerts.engine import AlertEngine
from app.alerts.policies import AnomalySummary
from app.models.anomalies import Anomaly
from app.models.observations import WeatherObservation
from app.models.stations import Station


@pytest.mark.asyncio
async def test_duplicate_anomaly_does_not_create_duplicate_alert(db_session):
    station = Station(station_code="DEDUP001", name="Dedup Test", source="TEST", latitude=1.0, longitude=1.0)
    db_session.add(station)
    await db_session.commit()

    ts = datetime(2026, 9, 24, 12, 5, tzinfo=timezone.utc)
    obs = WeatherObservation(station_id=station.id, timestamp=ts, source="TEST", received_at=ts)
    db_session.add(obs)
    await db_session.commit()

    anomaly1 = Anomaly(
        observation_id=obs.id, station_id=station.id, classification="PROBABLE_SENSOR_FAULT",
        severity="CRITICAL", fault_score=0.9, confidence=0.8, reason_codes=[],
    )
    anomaly2 = Anomaly(
        observation_id=obs.id, station_id=station.id, classification="PROBABLE_SENSOR_FAULT",
        severity="CRITICAL", fault_score=0.9, confidence=0.8, reason_codes=[],
    )
    db_session.add_all([anomaly1, anomaly2])
    await db_session.commit()

    current = AnomalySummary("PROBABLE_SENSOR_FAULT", "CRITICAL", ts)
    engine = AlertEngine(db_session)

    alert1 = await engine.process_anomaly(station.id, anomaly1.id, current, [current], {})
    alert2 = await engine.process_anomaly(station.id, anomaly2.id, current, [current], {})

    assert alert1 is not None
    assert alert2 is not None
    assert alert1.id == alert2.id
