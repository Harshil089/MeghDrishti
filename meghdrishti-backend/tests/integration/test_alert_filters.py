from datetime import datetime, timedelta, timezone

import pytest

from app.models.alerts import Alert
from app.models.anomalies import Anomaly
from app.models.observations import WeatherObservation
from app.models.stations import Station
from app.repositories.alert_repository import AlertRepository


@pytest.mark.asyncio
async def test_list_filters_by_reading_time_and_region(db_session):
    pune = Station(station_code="FLT_PUNE", name="Pune", source="TEST", latitude=18.5, longitude=73.8, region="MAHARASHTRA")
    delhi = Station(station_code="FLT_DEL", name="Delhi", source="TEST", latitude=28.6, longitude=77.2, region="DELHI")
    db_session.add_all([pune, delhi])
    await db_session.commit()

    day = datetime(2026, 10, 20, 6, 0, tzinfo=timezone.utc)
    for i, (station, ts) in enumerate([(pune, day), (pune, day + timedelta(days=3)), (delhi, day)]):
        obs = WeatherObservation(station_id=station.id, timestamp=ts, source="TEST", received_at=ts)
        db_session.add(obs)
        await db_session.flush()
        anomaly = Anomaly(observation_id=obs.id, station_id=station.id, classification="SUSPICIOUS",
                          severity="WARNING", fault_score=0.5, confidence=0.5, reason_codes=[])
        db_session.add(anomaly)
        await db_session.flush()
        db_session.add(Alert(station_id=station.id, anomaly_id=anomaly.id, priority="MEDIUM", policy="TEST",
                             dedup_key=f"flt-{i}", title="t", details={}))
    await db_session.commit()

    repo = AlertRepository(db_session)
    same_day = await repo.list(50, 0, since=day - timedelta(hours=6), until=day + timedelta(hours=18))
    assert {a.station_id for a in same_day} == {pune.id, delhi.id}
    pune_only = await repo.list(50, 0, region="MAHARASHTRA")
    assert len(pune_only) == 2 and all(a.station_id == pune.id for a in pune_only)
    assert len(await repo.list(50, 0, since=day + timedelta(days=1), region="MAHARASHTRA")) == 1
