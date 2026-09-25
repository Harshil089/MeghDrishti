from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.alerts import Alert
from app.models.anomalies import Anomaly
from app.models.health import StationHealth
from app.models.stations import Station

router = APIRouter()


@router.get("/summary")
async def dashboard_summary(db: AsyncSession = Depends(get_db)):
    total_stations = (await db.execute(select(func.count()).select_from(Station))).scalar_one()
    active_stations = (
        await db.execute(select(func.count()).select_from(Station).where(Station.is_active.is_(True)))
    ).scalar_one()

    open_alerts = (
        await db.execute(select(func.count()).select_from(Alert).where(Alert.status == "OPEN"))
    ).scalar_one()
    critical_alerts = (
        await db.execute(
            select(func.count()).select_from(Alert).where(Alert.status == "OPEN", Alert.priority == "CRITICAL")
        )
    ).scalar_one()

    since = datetime.now(UTC) - timedelta(hours=24)
    anomalies_24h = (
        await db.execute(select(func.count()).select_from(Anomaly).where(Anomaly.created_at >= since))
    ).scalar_one()

    classification_counts_result = await db.execute(
        select(Anomaly.classification, func.count()).where(Anomaly.created_at >= since).group_by(Anomaly.classification)
    )
    classification_counts = {row[0]: row[1] for row in classification_counts_result.all()}

    avg_health = (await db.execute(select(func.avg(StationHealth.health_score)))).scalar_one()

    return {
        "data": {
            "stations": {"total": total_stations, "active": active_stations},
            "alerts": {"open": open_alerts, "critical": critical_alerts},
            "anomalies_24h": anomalies_24h,
            "classification_counts_24h": classification_counts,
            "average_station_health": round(avg_health, 2) if avg_health is not None else None,
        }
    }
