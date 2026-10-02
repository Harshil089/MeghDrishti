"""Focused regression checks for flaws found while tracing the backend graph."""
import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from sqlalchemy.dialects import postgresql

from app.features.builder import MEASUREMENTS
from app.ml.inference import MLInferenceResult
from app.schemas.qc import RuleResult
from app.services.ingestion_service import IngestionService
from app.workers import pipeline


@pytest.mark.asyncio
@pytest.mark.parametrize("completeness", [0.0, 100.0, None])
@pytest.mark.parametrize("weak_rule", [False, True])
async def test_final_decision_keeps_secondary_ml_signal_and_completeness(monkeypatch, completeness, weak_rule):
    observation = SimpleNamespace(
        id=uuid.uuid4(), station_id=uuid.uuid4(), source="IMD",
        **{measurement: 1.0 for measurement in MEASUREMENTS},
    )
    session = AsyncMock()
    session.execute.side_effect = [
        Mock(scalar_one=Mock(return_value=observation)),
        Mock(scalar_one_or_none=Mock(return_value=SimpleNamespace(completeness_pct=completeness))),
    ]
    repository = SimpleNamespace(create=AsyncMock(return_value=SimpleNamespace(id=uuid.uuid4(), classification="SUSPICIOUS")))
    monkeypatch.setattr(pipeline, "AnomalyRepository", lambda _: repository)
    monkeypatch.setattr(pipeline, "HealthService", lambda _: SimpleNamespace(recompute=AsyncMock()))
    for name in ("create_alert_if_required", "publish_dashboard_event", "publish_station_event"):
        monkeypatch.setattr(pipeline, name, AsyncMock())
    ml = MLInferenceResult("v1", 1.0, 0.99, 0.5, True, {"value": 1.0})
    rules = [RuleResult(rule="SPIKE", triggered=True, score=0.2, severity="LOW", reason_code="TEMP_SPIKE", evidence={"measurement": "temperature_c"})] if weak_rule else []

    await pipeline.calculate_final_decision(session, observation.id, rules, {"pressure_hpa": ml}, {})

    values = repository.create.call_args.kwargs
    assert values["measurement"] == "pressure_hpa"
    assert values["fault_score"] > 0
    assert values["evidence"]["ML"]["normalized_anomaly_score"] == 0.99
    assert values["confidence"] < 0.2 if completeness == 0 else values["confidence"] > 0.2


@pytest.mark.asyncio
async def test_historical_baseline_excludes_future_observations(monkeypatch):
    now = datetime.now(UTC)
    observation = SimpleNamespace(
        id=uuid.uuid4(), station_id=uuid.uuid4(), timestamp=now, source="IMD",
        **{measurement: 1.0 for measurement in MEASUREMENTS},
    )
    session = AsyncMock()
    session.execute.side_effect = [Mock(scalar_one=Mock(return_value=observation)), Mock(scalars=Mock(return_value=Mock(all=Mock(return_value=[]))))]
    monkeypatch.setattr(pipeline, "ObservationRepository", lambda _: SimpleNamespace(recent_for_station=AsyncMock(return_value=[])))
    monkeypatch.setattr(pipeline, "StationRepository", lambda _: SimpleNamespace(neighbors_of=AsyncMock(return_value=[])))
    monkeypatch.setattr(pipeline, "FeatureRepository", lambda _: SimpleNamespace(upsert=AsyncMock()))

    await pipeline.calculate_features(session, observation.id)

    statement = session.execute.call_args_list[1].args[0]
    sql = str(statement.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
    assert "weather_observations.timestamp <" in sql
    assert "ORDER BY weather_observations.timestamp DESC" in sql


@pytest.mark.asyncio
async def test_health_completeness_uses_same_window(monkeypatch):
    from app.services import health_service

    session = AsyncMock()
    session.execute.side_effect = [Mock(scalar_one=Mock(return_value=value)) for value in [1, 0, 0, 0, 100.0, 0]]
    monkeypatch.setattr(health_service, "CalibrationRepository", lambda _: SimpleNamespace(get_active=AsyncMock(return_value=None)))
    monkeypatch.setattr(health_service, "publish_station_event", AsyncMock())
    service = health_service.HealthService(session)
    service.repo = SimpleNamespace(upsert=AsyncMock())

    await service.recompute(uuid.uuid4())

    statement = session.execute.call_args_list[4].args[0]
    sql = str(statement.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
    assert "observation_features.observation_id IN" in sql
    assert "weather_observations.timestamp >=" in sql


@pytest.mark.asyncio
@pytest.mark.parametrize("recorded", [True, False])
async def test_replay_recovers_window_and_finishes_tracking(recorded):
    start = datetime(2026, 9, 1, tzinfo=UTC)
    end = start + timedelta(hours=3)
    job = SimpleNamespace(source="TEST", created_at=end, stats={"window_start": start.isoformat(), "window_end": end.isoformat()} if recorded else {})
    replay = SimpleNamespace(status="PENDING", result={})
    service = IngestionService(AsyncMock())
    service.jobs = SimpleNamespace(get=AsyncMock(return_value=job), create_replay=AsyncMock(return_value=replay))
    service.run_for_station = AsyncMock(return_value={"normalized": 1, "raw_stored": 1, "errors": []})
    station = SimpleNamespace(id=uuid.uuid4())

    result = await service.replay(uuid.uuid4(), station, None)

    args = service.run_for_station.call_args.args
    assert args[2:] == (start if recorded else end - timedelta(hours=1), end)
    assert replay.status == "SUCCEEDED"
    assert replay.result == result


@pytest.mark.asyncio
async def test_ingestion_records_window_and_rolls_back_failed_transaction(monkeypatch):
    from app.services import ingestion_service

    start = datetime(2026, 9, 1, tzinfo=UTC)
    end = start + timedelta(hours=2)
    station = SimpleNamespace(id=uuid.uuid4(), station_code="TEST")
    job = SimpleNamespace(id=uuid.uuid4())
    service = IngestionService(AsyncMock())
    service.jobs = SimpleNamespace(create=AsyncMock(return_value=job), mark_failed=AsyncMock())
    monkeypatch.setattr(ingestion_service, "get_adapter_registry", lambda: {"TEST": object()})
    monkeypatch.setattr(ingestion_service, "ingest_station", AsyncMock(side_effect=RuntimeError("database failure")))

    with pytest.raises(RuntimeError, match="database failure"):
        await service.run_for_station(station, "TEST", start, end)

    service.session.rollback.assert_awaited_once()
    service.session.refresh.assert_awaited_once_with(job)
    window = {"window_start": start.isoformat(), "window_end": end.isoformat()}
    assert service.jobs.create.call_args.kwargs["stats"] == window
    service.jobs.mark_failed.assert_awaited_once_with(job, "database failure", window)


@pytest.mark.asyncio
async def test_failed_replay_finishes_tracking():
    job = SimpleNamespace(source="TEST", created_at=datetime.now(UTC), stats={})
    replay = SimpleNamespace(status="PENDING", result={})
    service = IngestionService(AsyncMock())
    service.jobs = SimpleNamespace(get=AsyncMock(return_value=job), create_replay=AsyncMock(return_value=replay))
    service.run_for_station = AsyncMock(side_effect=RuntimeError("provider failed"))

    with pytest.raises(RuntimeError, match="provider failed"):
        await service.replay(uuid.uuid4(), SimpleNamespace(), None)

    assert replay.status == "FAILED"
    assert replay.result == {"error": "provider failed"}


@pytest.mark.asyncio
@pytest.mark.parametrize("fail", [False, True])
async def test_publishing_closes_redis_even_on_failure(monkeypatch, fail):
    from app.services import event_publisher

    client = AsyncMock()
    client.__aenter__.return_value = client
    if fail:
        client.publish.side_effect = RuntimeError("redis unavailable")
    monkeypatch.setattr(event_publisher, "get_redis", lambda: client)

    if fail:
        with pytest.raises(RuntimeError, match="redis unavailable"):
            await event_publisher.publish_event("test", "TEST", {})
    else:
        await event_publisher.publish_event("test", "TEST", {})

    client.__aexit__.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize("labels", [{}, {"FALSE_POSITIVE": 20}, {"CONFIRMED_SENSOR_FAULT": 20}])
async def test_calibration_api_keeps_proposals_inactive(labels):
    from app.api.admin import propose_calibration
    from app.scoring.defaults import DEFAULT_DECISION_THRESHOLDS

    session = AsyncMock()
    session.add = Mock()
    session.execute.return_value = Mock(all=Mock(return_value=list(labels.items())))

    result = await propose_calibration(session, _user=SimpleNamespace())

    profile = session.add.call_args.args[0]
    assert profile.is_active is False
    assert result["data"]["label_counts"] == labels
    watch = DEFAULT_DECISION_THRESHOLDS["WATCH"]
    expected = watch + 0.05 if "FALSE_POSITIVE" in labels else watch - 0.05 if labels else watch
    assert profile.decision_thresholds["WATCH"] == pytest.approx(expected)


@pytest.mark.asyncio
async def test_new_admin_operations_require_authentication():
    from httpx import ASGITransport, AsyncClient

    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for path in ("/admin/calibration/propose", "/admin/ghcn-stations/refresh"):
            response = await client.post(f"/api/v1{path}")
            assert response.status_code == 401
