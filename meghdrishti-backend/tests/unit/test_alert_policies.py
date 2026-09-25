from datetime import datetime, timedelta, timezone

from app.alerts.policies import AnomalySummary, evaluate_policies

BASE = datetime(2026, 9, 24, 12, 0, tzinfo=timezone.utc)


def test_single_suspicious_reading_does_not_alert():
    current = AnomalySummary("SUSPICIOUS", "MEDIUM", BASE)
    decision = evaluate_policies(current, [current])
    assert decision.should_alert is False


def test_three_consecutive_suspicious_readings_alert():
    readings = [AnomalySummary("SUSPICIOUS", "MEDIUM", BASE - timedelta(minutes=i * 5)) for i in range(3)]
    decision = evaluate_policies(readings[0], readings)
    assert decision.should_alert is True
    assert decision.policy == "CONSECUTIVE_SUSPICIOUS"


def test_five_anomalies_in_30_minutes_creates_alert():
    readings = [AnomalySummary("WATCH", "LOW", BASE - timedelta(minutes=i * 5)) for i in range(5)]
    decision = evaluate_policies(readings[0], readings)
    assert decision.should_alert is True
    assert decision.policy == "ANOMALY_BURST"


def test_critical_physical_impossibility_immediate_alert():
    current = AnomalySummary("PROBABLE_SENSOR_FAULT", "CRITICAL", BASE)
    decision = evaluate_policies(current, [current])
    assert decision.should_alert is True
    assert decision.priority == "CRITICAL"


def test_genuine_extreme_is_informational_not_fault_alert():
    current = AnomalySummary("LIKELY_GENUINE_EXTREME", "CRITICAL", BASE)
    decision = evaluate_policies(current, [current])
    assert decision.should_alert is True
    assert decision.policy == "GENUINE_EXTREME_EVENT"
