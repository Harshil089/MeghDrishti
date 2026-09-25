from app.context.engine import ContextEngine, ContextInputs
from app.context.neighbors import compute_neighbors, haversine_km
from app.models.stations import Station
import uuid


def test_context_unavailable_distinct_from_disagreement():
    engine = ContextEngine()

    unavailable = engine.evaluate(ContextInputs(measurement="temperature_c", observed_value=49.2))
    assert unavailable.external_context_available is False
    assert unavailable.extreme_weather_score is None

    disagreeing = engine.evaluate(
        ContextInputs(measurement="temperature_c", observed_value=49.2, neighbor_median=31.7, forecast_value=32.1)
    )
    assert disagreeing.external_context_available is True
    assert disagreeing.extreme_weather_score < 0.3


def test_context_confirms_genuine_extreme():
    engine = ContextEngine()
    result = engine.evaluate(
        ContextInputs(
            measurement="rainfall_mm",
            observed_value=182.0,
            neighbor_median=178.0,
            forecast_value=175.0,
            gpm_value=180.0,
        )
    )
    assert result.external_context_available is True
    assert result.extreme_weather_score > 0.5


def test_haversine_known_distance():
    # Pune to Mumbai ~ 120km
    d = haversine_km(18.5204, 73.8567, 18.9067, 72.8147)
    assert 100 < d < 160


def test_compute_neighbors_orders_by_distance():
    pune = Station(id=uuid.uuid4(), station_code="PUNE", name="Pune", source="IMD", latitude=18.52, longitude=73.86)
    mumbai = Station(id=uuid.uuid4(), station_code="MUMBAI", name="Mumbai", source="IMD", latitude=18.90, longitude=72.81)
    nagpur = Station(id=uuid.uuid4(), station_code="NAGPUR", name="Nagpur", source="IMD", latitude=21.14, longitude=79.09)

    neighbors = compute_neighbors(pune, [pune, mumbai, nagpur], k=5, max_km=1000)
    assert neighbors[0]["neighbor_station_id"] == mumbai.id
    assert neighbors[0]["distance_km"] < neighbors[1]["distance_km"]
