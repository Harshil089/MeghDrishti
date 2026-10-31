from types import SimpleNamespace

from app.ingestion import imd

ROW = {"ID": "49534192", "DATE": "2026-10-29", "TIME": "14:15:00", "CURR_TEMP": "26.2", "RH": "78",
       "MSLP": "1009.4", "WIND_SPEED": 3.7, "WIND_DIRECTION": "257", "RAINFALL": "12.5"}
STATION = SimpleNamespace(station_code="IMD_AWS_49534192", latitude=18.52, longitude=73.85)


def test_payload_converts_units_and_uses_utc():
    p = imd.to_payload(STATION, ROW)
    assert p["timestamp"] == "2026-10-29T14:15:00+00:00"
    m = p["measurements"]
    assert m["temperature_c"] == 26.2 and m["humidity_pct"] == 78 and m["pressure_hpa"] == 1009.4
    assert m["wind_speed_ms"] == 1.03  # 3.7 km/h
    assert m["rainfall_mm"] is None  # running total and no earlier slot: amount unknown
    assert p["rainfall_total_mm"] == 12.5


def test_calm_wind_has_no_direction_and_nulls_are_none():
    m = imd.to_payload(STATION, {**ROW, "WIND_SPEED": 0, "WIND_DIRECTION": "0", "RH": "NULL", "MSLP": None})["measurements"]
    assert m["wind_direction_deg"] is None and m["humidity_pct"] is None and m["pressure_hpa"] is None


def test_only_imported_aws_stations_take_the_feed():
    curated = SimpleNamespace(station_code="IMD_PUNE_001", latitude=18.52, longitude=73.85)
    assert imd._row_for(curated, [ROW]) is None
    assert imd._row_for(STATION, [ROW]) is ROW


def test_coord_strips_stray_characters():
    assert imd.coord("?23.8349908") == 23.8349908 and imd.coord("") is None


def test_rain_increment_from_running_total():
    from datetime import UTC, datetime

    t = lambda h, m, d=29: datetime(2026, 10, d, h, m, tzinfo=UTC)  # noqa: E731
    assert imd.rain_increment("R1", t(14, 0), 4.0) is None  # no earlier slot
    assert imd.rain_increment("R1", t(14, 15), 6.5) == 2.5
    assert imd.rain_increment("R1", t(14, 15), 6.5) == 2.5  # same slot fetched twice
    assert imd.rain_increment("R1", t(14, 45), 7.0) is None  # skipped a slot
    assert imd.rain_increment("R1", t(15, 0), 6.0) is None  # total went down without a reset
    # 03:00 UTC closes the rain day; the 03:15 reading is a fresh total.
    assert imd.rain_increment("R2", t(2, 45, 30), 15.0) is None
    assert imd.rain_increment("R2", t(3, 0, 30), 15.5) == 0.5
    assert imd.rain_increment("R2", t(3, 15, 30), 1.0) == 1.0
