from datetime import datetime, timezone

import pytest

from app.models.calibration import CalibrationProfile
from app.models.observations import WeatherObservation
from app.models.stations import Station
from app.qc.defaults import DEFAULT_RULE_THRESHOLDS
from app.workers.pipeline import process_observation


@pytest.mark.asyncio
async def test_active_calibration_profile_overrides_default_thresholds(db_session):
    """A tighter PHYSICAL_RANGE threshold in an active profile should trigger
    where the hardcoded default would not — proves the pipeline actually
    loads and applies calibration_profiles, not just stores them unused."""
    station = Station(station_code="CAL001", name="Calibration Test", source="TEST", latitude=1.0, longitude=1.0)
    db_session.add(station)

    tight_thresholds = {**DEFAULT_RULE_THRESHOLDS, "PHYSICAL_RANGE": {"temperature_c": {"min": 0.0, "max": 30.0}}}
    db_session.add(
        CalibrationProfile(
            name="default",
            is_active=True,
            rule_thresholds=tight_thresholds,
            fusion_weights={},
            decision_thresholds={},
            health_weights={},
            health_boundaries={},
        )
    )
    await db_session.commit()

    now = datetime.now(timezone.utc)
    obs = WeatherObservation(station_id=station.id, timestamp=now, source="TEST", received_at=now, temperature_c=35.0)
    db_session.add(obs)
    await db_session.commit()

    anomaly_id = await process_observation(obs.id)
    assert anomaly_id is not None

    from app.repositories.anomaly_repository import AnomalyRepository

    anomaly = await AnomalyRepository(db_session).get(anomaly_id)
    assert "TEMP_PHYSICAL_LIMIT" in anomaly.reason_codes
