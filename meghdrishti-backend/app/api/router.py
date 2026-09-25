"""Aggregates all v1 API routers."""
from fastapi import APIRouter

from app.api import (
    admin,
    alerts,
    analytics,
    anomalies,
    auth,
    dashboard,
    observations,
    reviews,
    stations,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(stations.router, prefix="/stations", tags=["stations"])
api_router.include_router(observations.router, prefix="/observations", tags=["observations"])
api_router.include_router(anomalies.router, prefix="/anomalies", tags=["anomalies"])
api_router.include_router(reviews.router, tags=["reviews"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
