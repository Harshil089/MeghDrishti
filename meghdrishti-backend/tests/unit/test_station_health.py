from app.health.station_health import HealthInputs, compute_health, status_for_score


def test_healthy_station_scores_high():
    result = compute_health(
        HealthInputs(
            sensor_reliability_pct=100,
            telemetry_reliability_pct=100,
            anomaly_rate_pct=0,
            completeness_pct=100,
            confirmed_fault_count_30d=0,
        )
    )
    assert result["status"] == "HEALTHY"
    assert result["health_score"] >= 90


def test_degraded_station_from_dropouts():
    result = compute_health(
        HealthInputs(
            sensor_reliability_pct=90,
            telemetry_reliability_pct=40,
            anomaly_rate_pct=10,
            completeness_pct=90,
            confirmed_fault_count_30d=0,
            issues=["4 telemetry dropouts in 24 hours"],
        )
    )
    assert result["status"] in ("DEGRADED", "POOR")
    assert "4 telemetry dropouts in 24 hours" in result["issues"]


def test_critical_station_from_confirmed_faults():
    result = compute_health(
        HealthInputs(
            sensor_reliability_pct=20,
            telemetry_reliability_pct=20,
            anomaly_rate_pct=80,
            completeness_pct=40,
            confirmed_fault_count_30d=5,
        )
    )
    assert result["status"] == "CRITICAL"


def test_status_boundaries():
    assert status_for_score(95) == "HEALTHY"
    assert status_for_score(75) == "DEGRADED"
    assert status_for_score(50) == "POOR"
    assert status_for_score(10) == "CRITICAL"
