import sys
import types
from datetime import datetime

import numpy as np
import xarray as xr

from app.ingestion import gpm as gpm_adapter


def test_rainfall_sums_half_hour_rates_at_nearest_cell(monkeypatch):
    # Two half-hour steps at 4 and 2 mm/h at the station cell -> 2 + 1 = 3 mm.
    rates = np.zeros((2, 2, 2))
    rates[:, 1, 0] = [4.0, 2.0]
    ds = xr.Dataset(
        {"precipitation": (("time", "lat", "lon"), rates)},
        coords={"time": [0, 1], "lat": [18.0, 18.5], "lon": [73.85, 74.0]},
    )
    fake = types.SimpleNamespace(define_configs=lambda **_: None, download=lambda **_: None, open_dataset=lambda **_: ds)
    monkeypatch.setitem(sys.modules, "gpm", fake)
    monkeypatch.setattr(gpm_adapter, "_configured", True)

    assert gpm_adapter._rainfall_mm(18.52, 73.86, datetime(2026, 10, 4, 10), datetime(2026, 10, 4, 11)) == 3.0


def test_unconfigured_adapter_returns_nothing(monkeypatch):
    monkeypatch.setattr(gpm_adapter.settings, "nasa_gpm_username", "")
    import asyncio

    assert asyncio.run(gpm_adapter.GPMAdapter().fetch(object(), datetime(2026, 1, 1), datetime(2026, 1, 1))) == []
