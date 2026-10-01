import json

import httpx
import pytest

from app.workers import schedule_tasks


@pytest.mark.parametrize("failed_source", [False, True])
def test_scheduled_ingestion_paginates_and_reports_failed_jobs(monkeypatch, failed_source):
    requests = []
    original_client = httpx.Client

    def handler(request):
        requests.append(request)
        path = request.url.path
        if path.endswith("/auth/login"):
            return httpx.Response(200, json={"access_token": "test-token"})
        assert request.headers["Authorization"] == "Bearer test-token"
        if path.endswith("/stations"):
            offset = int(request.url.params["offset"])
            stations = range(500) if offset == 0 else [500]
            return httpx.Response(200, json={"data": [{"id": str(i)} for i in stations]})
        if "/admin/ingest/" in path:
            station_id = path.rsplit("/", 1)[1]
            failed = failed_source and station_id == "500"
            return httpx.Response(200, json={"data": {
                "job_id": station_id, "raw_stored": 0 if failed else 1,
                "errors": ["provider unavailable"] if failed else [],
            }})
        assert path.endswith("/admin/enqueue-processing")
        jobs = json.loads(request.content)["job_ids"]
        assert len(jobs) == (500 if failed_source else 501)
        return httpx.Response(200, json={"data": {"enqueued": len(jobs)}})

    monkeypatch.setattr(schedule_tasks.httpx, "Client",
                        lambda **kwargs: original_client(transport=httpx.MockTransport(handler), **kwargs))
    if failed_source:
        with pytest.raises(RuntimeError, match="1 station/source requests failed"):
            schedule_tasks.run_scheduled_job("ingest", sources=["OPEN_METEO"])
    else:
        assert len(schedule_tasks.run_scheduled_job("ingest", sources=["OPEN_METEO"])["job_ids"]) == 501
    pages = [r for r in requests if r.url.path.endswith("/stations")]
    assert [r.url.params["offset"] for r in pages] == ["0", "500"]


@pytest.mark.parametrize("operation,endpoint", [
    ("train", "/models/train"), ("calibrate", "/admin/calibration/propose"),
    ("roster", "/admin/ghcn-stations/refresh"),
])
def test_scheduled_operations_use_existing_protected_endpoints(monkeypatch, operation, endpoint):
    original_client = httpx.Client

    def handler(request):
        if request.url.path.endswith("/auth/login"):
            return httpx.Response(200, json={"access_token": "test-token"})
        assert request.method == "POST"
        assert request.url.path.endswith(endpoint)
        assert request.headers["Authorization"] == "Bearer test-token"
        return httpx.Response(200, json={"data": {"verified": operation}})

    monkeypatch.setattr(schedule_tasks.httpx, "Client",
                        lambda **kwargs: original_client(transport=httpx.MockTransport(handler), **kwargs))
    assert schedule_tasks.run_scheduled_job(operation) == {"data": {"verified": operation}}
