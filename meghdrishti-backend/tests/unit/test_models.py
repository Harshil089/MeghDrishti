import pytest

from app.models.stations import Station
from app.models.users import Role, User, UserRole


@pytest.mark.asyncio
async def test_create_user_with_role(db_session):
    role = Role(name="ADMIN")
    db_session.add(role)
    await db_session.flush()

    user = User(email="a@b.com", hashed_password="x", full_name="A B")
    db_session.add(user)
    await db_session.flush()

    db_session.add(UserRole(user_id=user.id, role_id=role.id))
    await db_session.commit()

    await db_session.refresh(user, attribute_names=["user_roles"])
    assert user.role_names == ["ADMIN"]


@pytest.mark.asyncio
async def test_create_station(db_session):
    station = Station(
        station_code="PUNE001",
        name="Pune AWS",
        source="IMD",
        latitude=18.52,
        longitude=73.86,
        elevation_m=560,
        region="MAHARASHTRA",
    )
    db_session.add(station)
    await db_session.commit()
    assert station.id is not None
