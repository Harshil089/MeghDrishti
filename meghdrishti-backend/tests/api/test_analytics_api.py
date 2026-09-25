import pytest


@pytest.mark.asyncio
async def test_analytics_anomalies_shape(client, db_session):
    resp = await client.get("/api/v1/analytics/anomalies")
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert "classification_counts" in body
    assert "rule_trigger_counts" in body
    assert "hourly_series" in body


@pytest.mark.asyncio
async def test_analytics_station_health_shape(client, db_session):
    resp = await client.get("/api/v1/analytics/station-health")
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert "distribution" in body
    assert "stations" in body


@pytest.mark.asyncio
async def test_analytics_data_quality_shape(client, db_session):
    resp = await client.get("/api/v1/analytics/data-quality")
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert "total_raw_observations" in body
    assert "processing_status_counts" in body


@pytest.mark.asyncio
async def test_analytics_sensor_health_shape(client, db_session):
    resp = await client.get("/api/v1/analytics/sensor-health")
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert len(body["sensors"]) == 6
    assert all("reliability_pct" in s for s in body["sensors"])


@pytest.mark.asyncio
async def test_analytics_maintenance_shape(client, db_session):
    resp = await client.get("/api/v1/analytics/maintenance")
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert "predictions" in body
    assert "recommended_actions" in body


@pytest.mark.asyncio
async def test_analytics_fleet_series_shape(client, db_session):
    resp = await client.get("/api/v1/analytics/fleet-series")
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert set(body.keys()) == {"temperature_c", "humidity_pct", "pressure_hpa"}


@pytest.mark.asyncio
async def test_analytics_insights_shape(client, db_session):
    resp = await client.get("/api/v1/analytics/insights")
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert len(body["insights"]) >= 1
