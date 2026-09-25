from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.anomalies import Anomaly
from app.models.health import StationHealth
from app.models.ingestion import RawObservation
from app.models.observations import ObservationFeatures, WeatherObservation
from app.models.qc import QCRuleResult
from app.models.reviews import OperatorReview
from app.models.stations import Station

router = APIRouter()

MEASUREMENTS = ["temperature_c", "humidity_pct", "pressure_hpa", "rainfall_mm", "wind_speed_ms", "wind_direction_deg"]
MEASUREMENT_LABELS = {
    "temperature_c": "Temperature sensor",
    "humidity_pct": "Humidity sensor",
    "pressure_hpa": "Pressure sensor",
    "rainfall_mm": "Rain gauge",
    "wind_speed_ms": "Wind vane",
    "wind_direction_deg": "Wind direction sensor",
}
SENSOR_FAULT_RULES = ("STUCK_SENSOR", "GRADUAL_DRIFT", "SPIKE", "PHYSICAL_RANGE")


@router.get("/anomalies")
async def analytics_anomalies(
    station_id: uuid.UUID | None = None,
    hours: int = 24,
    db: AsyncSession = Depends(get_db),
):
    since = datetime.now(UTC) - timedelta(hours=hours)

    class_stmt = select(Anomaly.classification, func.count()).where(Anomaly.created_at >= since)
    if station_id:
        class_stmt = class_stmt.where(Anomaly.station_id == station_id)
    class_rows = (await db.execute(class_stmt.group_by(Anomaly.classification))).all()

    rule_stmt = (
        select(QCRuleResult.rule, func.count())
        .join(Anomaly, Anomaly.observation_id == QCRuleResult.observation_id)
        .where(QCRuleResult.triggered.is_(True), Anomaly.created_at >= since)
    )
    if station_id:
        rule_stmt = rule_stmt.where(Anomaly.station_id == station_id)
    rule_rows = (await db.execute(rule_stmt.group_by(QCRuleResult.rule))).all()

    bucket = func.date_trunc("hour", Anomaly.created_at)
    series_stmt = select(bucket.label("hour"), func.count()).where(Anomaly.created_at >= since)
    if station_id:
        series_stmt = series_stmt.where(Anomaly.station_id == station_id)
    series_rows = (await db.execute(series_stmt.group_by(bucket).order_by(bucket))).all()

    avg_fault = (
        await db.execute(
            select(func.avg(Anomaly.fault_score), func.avg(Anomaly.confidence)).where(Anomaly.created_at >= since)
        )
    ).one()

    return {
        "data": {
            "window_hours": hours,
            "classification_counts": {row[0]: row[1] for row in class_rows},
            "rule_trigger_counts": {row[0]: row[1] for row in rule_rows},
            "hourly_series": [{"hour": row[0].isoformat(), "count": row[1]} for row in series_rows],
            "average_fault_score": round(avg_fault[0], 4) if avg_fault[0] is not None else None,
            "average_confidence": round(avg_fault[1], 4) if avg_fault[1] is not None else None,
        }
    }


@router.get("/station-health")
async def analytics_station_health(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Station.id, Station.station_code, Station.name, StationHealth.health_score, StationHealth.status, StationHealth.issues)
        .join(StationHealth, StationHealth.station_id == Station.id, isouter=True)
    )
    rows = result.all()

    distribution: dict[str, int] = {}
    stations = []
    for station_id, code, name, score, status, issues in rows:
        status = status or "UNKNOWN"
        distribution[status] = distribution.get(status, 0) + 1
        stations.append(
            {
                "station_id": str(station_id),
                "station_code": code,
                "name": name,
                "health_score": score,
                "status": status,
                "issues": issues or [],
            }
        )

    return {"data": {"distribution": distribution, "stations": stations}}


@router.get("/data-quality")
async def analytics_data_quality(hours: int = 24, db: AsyncSession = Depends(get_db)):
    since = datetime.now(UTC) - timedelta(hours=hours)

    total = (
        await db.execute(select(func.count()).select_from(RawObservation).where(RawObservation.created_at >= since))
    ).scalar_one()
    invalid = (
        await db.execute(
            select(func.count())
            .select_from(RawObservation)
            .where(RawObservation.created_at >= since, RawObservation.schema_valid.is_(False))
        )
    ).scalar_one()
    avg_completeness = (
        await db.execute(select(func.avg(ObservationFeatures.completeness_pct)))
    ).scalar_one()

    status_rows = (
        await db.execute(
            select(RawObservation.processing_status, func.count())
            .where(RawObservation.created_at >= since)
            .group_by(RawObservation.processing_status)
        )
    ).all()

    return {
        "data": {
            "window_hours": hours,
            "total_raw_observations": total,
            "schema_invalid_count": invalid,
            "schema_invalid_rate": round(invalid / total, 4) if total else None,
            "average_completeness_pct": round(avg_completeness, 2) if avg_completeness is not None else None,
            "processing_status_counts": {row[0]: row[1] for row in status_rows},
        }
    }


@router.get("/sensor-health")
async def analytics_sensor_health(hours: int = 168, db: AsyncSession = Depends(get_db)):
    """Fleet-wide reliability per measurement type, derived from real QC rule
    trigger rates (stuck/drift/spike/physical-range) over the window — not a
    canned per-sensor-type number."""
    since = datetime.now(UTC) - timedelta(hours=hours)

    measurement_expr = QCRuleResult.evidence["measurement"].astext
    triggered_rows = (
        await db.execute(
            select(measurement_expr, func.count())
            .join(WeatherObservation, WeatherObservation.id == QCRuleResult.observation_id)
            .where(
                QCRuleResult.triggered.is_(True),
                QCRuleResult.rule.in_(SENSOR_FAULT_RULES),
                WeatherObservation.timestamp >= since,
            )
            .group_by(measurement_expr)
        )
    ).all()
    triggered_by_measurement = {row[0]: row[1] for row in triggered_rows if row[0]}

    results = []
    for measurement in MEASUREMENTS:
        total = (
            await db.execute(
                select(func.count())
                .select_from(WeatherObservation)
                .where(WeatherObservation.timestamp >= since, getattr(WeatherObservation, measurement).is_not(None))
            )
        ).scalar_one()
        triggered = triggered_by_measurement.get(measurement, 0)
        reliability = round(max(0.0, 100.0 - (100.0 * triggered / total)), 1) if total else None
        results.append(
            {
                "measurement": measurement,
                "label": MEASUREMENT_LABELS[measurement],
                "reliability_pct": reliability,
                "readings": total,
                "rule_triggers": triggered,
            }
        )

    return {"data": {"window_hours": hours, "sensors": results}}


@router.get("/maintenance")
async def analytics_maintenance(db: AsyncSession = Depends(get_db)):
    """Predicted-maintenance list and recommended actions, derived from real
    station_health rows + which measurement is triggering the most QC rules
    per station — not scripted copy."""
    since = datetime.now(UTC) - timedelta(days=7)

    health_rows = (
        await db.execute(
            select(Station.id, Station.station_code, Station.name, StationHealth.health_score, StationHealth.status, StationHealth.issues)
            .join(StationHealth, StationHealth.station_id == Station.id)
            .order_by(StationHealth.health_score.asc())
        )
    ).all()

    measurement_expr = QCRuleResult.evidence["measurement"].astext
    offender_rows = (
        await db.execute(
            select(WeatherObservation.station_id, measurement_expr, func.count())
            .join(QCRuleResult, QCRuleResult.observation_id == WeatherObservation.id)
            .where(
                QCRuleResult.triggered.is_(True),
                QCRuleResult.rule.in_(SENSOR_FAULT_RULES),
                WeatherObservation.timestamp >= since,
            )
            .group_by(WeatherObservation.station_id, measurement_expr)
        )
    ).all()
    top_offender_by_station: dict[uuid.UUID, tuple[str, int]] = {}
    for station_id, measurement, count in offender_rows:
        if not measurement:
            continue
        current = top_offender_by_station.get(station_id)
        if current is None or count > current[1]:
            top_offender_by_station[station_id] = (measurement, count)

    predictions = []
    recommended_actions = []
    for station_id, code, name, score, status, issues in health_rows:
        pct = round(100.0 - score, 1)
        offender = top_offender_by_station.get(station_id)
        if offender:
            note = f"{offender[0].replace('_', ' ')} — {offender[1]} rule triggers in 7d"
        elif issues:
            note = issues[0]
        else:
            note = "Healthy"
        predictions.append({"station_id": str(station_id), "station_code": code, "name": name, "pct": pct, "note": note})

        if status in ("POOR", "CRITICAL"):
            recommended_actions.append(f"Dispatch field check to {code} — health {status.lower()} ({score:.0f}%).")
        elif offender and offender[1] >= 5:
            recommended_actions.append(f"Schedule remote recalibration for {code}'s {offender[0].replace('_', ' ')}.")

    return {"data": {"predictions": predictions, "recommended_actions": recommended_actions[:8]}}


@router.get("/fleet-series")
async def analytics_fleet_series(hours: int = 24, db: AsyncSession = Depends(get_db)):
    """Hourly fleet-average per measurement across all active stations — real
    aggregate of weather_observations, used for the dashboard overview charts."""
    since = datetime.now(UTC) - timedelta(hours=hours)
    bucket = func.date_trunc("hour", WeatherObservation.timestamp)

    series: dict[str, list[dict]] = {}
    for measurement in ("temperature_c", "humidity_pct", "pressure_hpa"):
        col = getattr(WeatherObservation, measurement)
        rows = (
            await db.execute(
                select(bucket.label("hour"), func.avg(col))
                .where(WeatherObservation.timestamp >= since, col.is_not(None))
                .group_by(bucket)
                .order_by(bucket)
            )
        ).all()
        series[measurement] = [{"t": row[0].isoformat(), "value": round(row[1], 2)} for row in rows]

    return {"data": series}


@router.get("/insights")
async def analytics_insights(db: AsyncSession = Depends(get_db)):
    """Short natural-language insights generated from real aggregates — every
    number is a live query result, not scripted copy."""
    since_24h = datetime.now(UTC) - timedelta(hours=24)
    since_7d = datetime.now(UTC) - timedelta(days=7)
    insights: list[str] = []

    fault_count = (
        await db.execute(
            select(func.count())
            .select_from(Anomaly)
            .where(Anomaly.created_at >= since_24h, Anomaly.classification == "PROBABLE_SENSOR_FAULT")
        )
    ).scalar_one()
    fault_stations = (
        await db.execute(
            select(func.count(func.distinct(Anomaly.station_id)))
            .where(Anomaly.created_at >= since_24h, Anomaly.classification == "PROBABLE_SENSOR_FAULT")
        )
    ).scalar_one()
    if fault_count:
        insights.append(f"{fault_count} probable sensor faults detected across {fault_stations} station(s) in the last 24h.")

    top_rule = (
        await db.execute(
            select(QCRuleResult.rule, func.count())
            .join(WeatherObservation, WeatherObservation.id == QCRuleResult.observation_id)
            .where(QCRuleResult.triggered.is_(True), WeatherObservation.timestamp >= since_24h)
            .group_by(QCRuleResult.rule)
            .order_by(func.count().desc())
            .limit(1)
        )
    ).first()
    if top_rule:
        insights.append(f"{top_rule[0]} is the most frequently triggered check ({top_rule[1]}x) in the last 24h.")

    confirmed = (
        await db.execute(
            select(func.count())
            .select_from(OperatorReview)
            .where(
                OperatorReview.created_at >= since_7d,
                OperatorReview.operator_classification == "CONFIRMED_SENSOR_FAULT",
            )
        )
    ).scalar_one()
    if confirmed:
        insights.append(f"{confirmed} sensor fault(s) confirmed by operator review in the last 7 days.")

    extreme_count = (
        await db.execute(
            select(func.count())
            .select_from(Anomaly)
            .where(Anomaly.created_at >= since_24h, Anomaly.classification == "LIKELY_GENUINE_EXTREME")
        )
    ).scalar_one()
    if extreme_count:
        insights.append(f"{extreme_count} reading(s) confirmed as genuine extreme weather (not sensor fault) in the last 24h.")

    if not insights:
        insights.append("No significant anomalies in the last 24 hours — all stations nominal.")

    return {"data": {"insights": insights}}
