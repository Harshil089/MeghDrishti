"""Aggregates all v1 API routers."""
from fastapi import APIRouter, Depends

from app.api.deps import get_current_user

from app.api import (
    admin,
    alerts,
    analytics,
    anomalies,
    auth,
    dashboard,
    models,
    observations,
    reviews,
    stations,
)

# Every route except /auth requires a valid access token. Per-route permission
# checks (require_permission) still apply on top.
api_router = APIRouter()
authed = [Depends(get_current_user)]
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"], dependencies=authed)
api_router.include_router(stations.router, prefix="/stations", tags=["stations"], dependencies=authed)
api_router.include_router(observations.router, prefix="/observations", tags=["observations"], dependencies=authed)
api_router.include_router(anomalies.router, prefix="/anomalies", tags=["anomalies"], dependencies=authed)
api_router.include_router(reviews.router, tags=["reviews"], dependencies=authed)
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"], dependencies=authed)
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"], dependencies=authed)
api_router.include_router(admin.router, prefix="/admin", tags=["admin"], dependencies=authed)
api_router.include_router(models.router, prefix="/models", tags=["models"], dependencies=authed)
