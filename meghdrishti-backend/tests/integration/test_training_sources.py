import random
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select

from app.ml.workflow import train_candidates
from app.models.ml import ModelVersion
from app.models.observations import WeatherObservation
from app.models.stations import Station


@pytest.mark.asyncio
async def test_sensor_and_forecast_readings_train_separate_models(db_session):
    rng = random.Random(7)
    station = Station(station_code="TRAIN001", name="Train", source="IMD_AWS", latitude=1.0, longitude=1.0)
    db_session.add(station)
    await db_session.commit()
    start = datetime.now(UTC).replace(second=0, microsecond=0) - timedelta(hours=20)
    for i in range(60):
        ts = start + timedelta(minutes=15 * i)
        for source in ("IMD", "OPEN_METEO"):
            db_session.add(WeatherObservation(station_id=station.id, timestamp=ts, received_at=ts, source=source,
                                              temperature_c=25 + rng.gauss(0, 1)))
    await db_session.commit()

    result = await train_candidates(db_session)

    models = (await db_session.execute(select(ModelVersion).where(ModelVersion.id.in_(result["candidates"])))).scalars().all()
    temp = {m.metrics["source_group"]: m for m in models if m.measurement == "temperature_c"}
    assert temp["sensor"].metrics["training_sources"] == {"IMD": temp["sensor"].metrics["training_samples"]}
    assert temp["sensor"].metrics["sensor_data_only"] is True
    assert set(temp["forecast"].metrics["training_sources"]) == {"OPEN_METEO"}
    assert temp["sensor"].model_id != temp["forecast"].model_id
