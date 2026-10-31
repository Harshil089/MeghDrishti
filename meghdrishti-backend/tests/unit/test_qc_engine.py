from datetime import datetime, timedelta, timezone

from app.qc.engine import QCContext, QCEngine

BASE = datetime(2026, 9, 24, 12, 0, tzinfo=timezone.utc)


def _history(n: int, measurement: str, value: float, step_minutes: int = 15) -> list[dict]:
    return [
        {"timestamp": BASE - timedelta(minutes=step_minutes * (i + 1)), measurement: value}
        for i in range(n)
    ]


def test_physical_invalid_measurement_triggers_critical():
    ctx = QCContext(
        timestamp=BASE,
        received_at=BASE,
        measurements={"temperature_c": 85.0},
        history=[],
    )
    results = QCEngine().run(ctx)
    physical = next(r for r in results if r.rule == "PHYSICAL_RANGE" and r.evidence.get("measurement") == "temperature_c")
    assert physical.triggered
    assert physical.severity == "CRITICAL"
    assert physical.reason_code == "TEMP_PHYSICAL_LIMIT"


def test_stuck_sensor_detected_after_12_identical_readings():
    history = _history(12, "temperature_c", 24.0)
    ctx = QCContext(timestamp=BASE, received_at=BASE, measurements={"temperature_c": 24.0}, history=history)
    results = QCEngine().run(ctx)
    stuck = next(r for r in results if r.rule == "STUCK_SENSOR" and r.evidence.get("measurement") == "temperature_c")
    assert stuck.triggered
    assert stuck.reason_code == "TEMP_STUCK"


def test_single_spike_detected():
    history = [{"timestamp": BASE - timedelta(minutes=15 * (i + 1)), "temperature_c": 24.0 + (i % 3) * 0.2} for i in range(10)]
    ctx = QCContext(timestamp=BASE, received_at=BASE, measurements={"temperature_c": 49.2}, history=history)
    results = QCEngine().run(ctx)
    spike = next(r for r in results if r.rule == "SPIKE" and r.evidence.get("measurement") == "temperature_c")
    assert spike.triggered


def test_gradual_drift_detected():
    history = [
        {"timestamp": BASE - timedelta(hours=(24 - i)), "temperature_c": 20.0 + i * 2.0}
        for i in range(24)
    ]
    ctx = QCContext(timestamp=BASE, received_at=BASE, measurements={"temperature_c": 68.0}, history=history)
    results = QCEngine().run(ctx)
    drift = next(r for r in results if r.rule == "GRADUAL_DRIFT" and r.evidence.get("measurement") == "temperature_c")
    assert drift.triggered


def test_dropout_detected_when_reporting_sensor_goes_missing():
    history = [{"timestamp": BASE - timedelta(minutes=15), "temperature_c": 24.0}]
    ctx = QCContext(timestamp=BASE, received_at=BASE, measurements={"temperature_c": None}, history=history)
    results = QCEngine().run(ctx)
    dropout = next(r for r in results if r.rule == "DROPOUT" and r.evidence.get("measurement") == "temperature_c")
    assert dropout.triggered


def test_never_reported_measurement_is_not_a_dropout():
    ctx = QCContext(timestamp=BASE, received_at=BASE, measurements={"temperature_c": 24.0, "rainfall_mm": None}, history=[])
    results = QCEngine().run(ctx)
    assert not any(r.rule == "DROPOUT" and r.evidence.get("measurement") == "rainfall_mm" for r in results)


def test_telemetry_gap_detected():
    ctx = QCContext(
        timestamp=BASE,
        received_at=BASE,
        measurements={"temperature_c": 24.0},
        history=[],
        last_observation_timestamp=BASE - timedelta(hours=3),
    )
    results = QCEngine().run(ctx)
    gap = next(r for r in results if r.rule == "TELEMETRY_GAP")
    assert gap.triggered


def test_genuine_heatwave_not_flagged_as_physical_fault():
    """A very hot but physically plausible reading should not trip PHYSICAL_RANGE."""
    ctx = QCContext(timestamp=BASE, received_at=BASE, measurements={"temperature_c": 47.5}, history=[])
    results = QCEngine().run(ctx)
    physical = next(r for r in results if r.rule == "PHYSICAL_RANGE" and r.evidence.get("measurement") == "temperature_c")
    assert not physical.triggered


def test_rainfall_extreme_flagged():
    ctx = QCContext(timestamp=BASE, received_at=BASE, measurements={"rainfall_mm": 182.0, "humidity_pct": 95.0}, history=[])
    results = QCEngine().run(ctx)
    rain = next(r for r in results if r.rule == "RAIN_ACCUMULATION")
    assert rain.triggered
    assert rain.reason_code == "RAINFALL_EXTREME"


def test_calm_wind_without_direction_is_not_a_dropout():
    history = [{"timestamp": BASE - timedelta(minutes=15), "wind_speed_ms": 2.0, "wind_direction_deg": 90.0}]
    ctx = QCContext(timestamp=BASE, received_at=BASE, measurements={"wind_speed_ms": 0.0, "wind_direction_deg": None}, history=history)
    assert not any(r.rule == "DROPOUT" and r.triggered for r in QCEngine().run(ctx))


def test_saturated_humidity_needs_a_much_longer_flat_run():
    from app.qc import persistence
    from app.qc.defaults import DEFAULT_RULE_THRESHOLDS as T

    night = [100.0] * 13  # ~3 h of fog at 15-minute readings
    assert not persistence.evaluate_stuck_sensor("humidity_pct", 100.0, night, T).triggered
    assert not persistence.evaluate_persistence("humidity_pct", 100.0, night, T).triggered
    assert persistence.evaluate_stuck_sensor("humidity_pct", 100.0, [100.0] * 60, T).triggered  # 15 h
    assert persistence.evaluate_stuck_sensor("humidity_pct", 60.0, [60.0] * 13, T).triggered


def test_spike_ignores_baseline_from_before_a_long_gap():
    # Flat 97 % humidity last night, 6 h gap, normal 80 % this morning.
    night = [{"timestamp": BASE - timedelta(hours=6, minutes=15 * i), "humidity_pct": 97.0} for i in range(10)]
    ctx = QCContext(timestamp=BASE, received_at=BASE, measurements={"humidity_pct": 80.0}, history=night)
    assert not any(r.rule == "SPIKE" and r.triggered for r in QCEngine().run(ctx))
    recent = [{"timestamp": BASE - timedelta(minutes=15 * (i + 1)), "humidity_pct": 97.0 + (i % 2) * 0.1} for i in range(10)]
    ctx = QCContext(timestamp=BASE, received_at=BASE, measurements={"humidity_pct": 80.0}, history=recent)
    assert any(r.rule == "SPIKE" and r.triggered for r in QCEngine().run(ctx))


def test_blank_derived_rainfall_is_not_a_dropout():
    history = [{"timestamp": BASE - timedelta(minutes=15), "temperature_c": 25.0, "rainfall_mm": 0.5}]
    ctx = QCContext(timestamp=BASE, received_at=BASE, measurements={"temperature_c": 25.0, "rainfall_mm": None}, history=history)
    assert not any(r.rule == "DROPOUT" and r.triggered for r in QCEngine().run(ctx))
