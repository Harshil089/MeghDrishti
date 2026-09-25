"""Role-based permission checks used as FastAPI dependencies."""
from __future__ import annotations

from enum import StrEnum

from fastapi import Depends

from app.core.exceptions import ForbiddenError


class Role(StrEnum):
    VIEWER = "VIEWER"
    OPERATOR = "OPERATOR"
    MAINTENANCE = "MAINTENANCE"
    SCIENTIST = "SCIENTIST"
    ADMIN = "ADMIN"


class Permission(StrEnum):
    READ_DASHBOARD = "read_dashboard"
    ACKNOWLEDGE_ALERT = "acknowledge_alert"
    SUBMIT_REVIEW = "submit_review"
    VIEW_MAINTENANCE = "view_maintenance"
    VIEW_MODEL_METRICS = "view_model_metrics"
    MANAGE_CALIBRATION = "manage_calibration"
    MANAGE_USERS = "manage_users"
    MANAGE_STATIONS = "manage_stations"
    MANAGE_SOURCES = "manage_sources"
    MANAGE_MODELS = "manage_models"
    MANAGE_REPLAY = "manage_replay"


ROLE_PERMISSIONS: dict[Role, set[Permission]] = {
    Role.VIEWER: {Permission.READ_DASHBOARD},
    Role.OPERATOR: {
        Permission.READ_DASHBOARD,
        Permission.ACKNOWLEDGE_ALERT,
        Permission.SUBMIT_REVIEW,
    },
    Role.MAINTENANCE: {Permission.READ_DASHBOARD, Permission.VIEW_MAINTENANCE},
    Role.SCIENTIST: {
        Permission.READ_DASHBOARD,
        Permission.VIEW_MODEL_METRICS,
        Permission.MANAGE_CALIBRATION,
    },
    Role.ADMIN: set(Permission),
}


def permissions_for_roles(roles: list[str]) -> set[Permission]:
    result: set[Permission] = set()
    for r in roles:
        try:
            result |= ROLE_PERMISSIONS[Role(r)]
        except ValueError:
            continue
    return result


def require_permission(permission: Permission):
    from app.api.deps import get_current_user  # avoid circular import

    async def _checker(user=Depends(get_current_user)):
        if permission not in permissions_for_roles(user.roles):
            raise ForbiddenError(f"Missing permission: {permission.value}")
        return user

    return _checker
