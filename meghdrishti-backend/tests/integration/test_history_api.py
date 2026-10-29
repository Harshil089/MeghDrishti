from datetime import UTC, datetime

import pytest

from app.models.anomalies import Anomaly
from app.models.observations import WeatherObservation
from app.models.reviews import OperatorReview
from app.models.stations import Station


@pytest.mark.asyncio
async def test_history_lists_flags_date_range_and_reviews(client, db_session, auth_headers):
    station = Station(station_code="HIST001", name="History Test", source="TEST", latitude=1.0, longitude=1.0)
    db_session.add(station)
    await db_session.commit()

    old = datetime(2026, 9, 1, 12, tzinfo=UTC)
    new = datetime(2026, 10, 1, 12, tzinfo=UTC)
    o_old = WeatherObservation(station_id=station.id, timestamp=old, source="TEST", received_at=old, temperature_c=20)
    o_new = WeatherObservation(station_id=station.id, timestamp=new, source="TEST", received_at=new, temperature_c=90)
    db_session.add_all([o_old, o_new])
    await db_session.commit()
    anomaly = Anomaly(
        observation_id=o_new.id, station_id=station.id, classification="PROBABLE_SENSOR_FAULT",
        severity="HIGH", fault_score=0.9, confidence=0.8, reason_codes=[], measurement="temperature_c",
    )
    db_session.add(anomaly)
    await db_session.commit()
    db_session.add(OperatorReview(
        anomaly_id=anomaly.id, previous_classification="PROBABLE_SENSOR_FAULT",
        operator_classification="CONFIRMED_SENSOR_FAULT", comment="stuck at 90",
    ))
    await db_session.commit()

    resp = await client.get(
        "/api/v1/observations",
        params={"station_id": str(station.id), "start_time": "2026-09-20T00:00:00Z"},
        headers=auth_headers,
    )
    rows = resp.json()["data"]
    assert resp.json()["meta"]["total"] == 1  # total counts the filtered set, not the page
    assert [r["measurements"]["temperature_c"] for r in rows] == [90]  # old reading excluded by range
    assert rows[0]["flags"][0]["classification"] == "PROBABLE_SENSOR_FAULT"

    reviews = (await client.get("/api/v1/reviews", headers=auth_headers)).json()["data"]
    assert (await client.get("/api/v1/reviews", headers=auth_headers)).json()["meta"]["total"] == 1
    assert reviews[0]["station"] == "History Test"
    assert reviews[0]["operator_classification"] == "CONFIRMED_SENSOR_FAULT"
