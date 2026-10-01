"""HTTP access to the backend without importing its dependency environment."""
import os
from contextlib import contextmanager

import requests
from airflow.models import Variable

API_BASE = Variable.get("meghdrishti_api_base", default_var="http://localhost:8000/api/v1")


@contextmanager
def backend_session():
    with requests.Session() as session:
        response = session.post(
            f"{API_BASE}/auth/login",
            data={"username": os.environ["DEMO_ADMIN_EMAIL"], "password": os.environ["DEMO_ADMIN_PASSWORD"]},
            timeout=10,
        )
        response.raise_for_status()
        session.headers["Authorization"] = f"Bearer {response.json()['access_token']}"
        yield session
