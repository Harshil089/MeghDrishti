import sys
import types
from datetime import datetime

import numpy as np
import xarray as xr

from app.ingestion import gpm as gpm_adapter


def test_rainfall_sums_half_hour_rates_at_nearest_cell(monkeypatch, tmp_path):
    # Isolate from the real data dir: a live .cooldown file there would make this test wait.
    monkeypatch.setattr(gpm_adapter.settings, "nasa_gpm_data_dir", str(tmp_path))
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
    monkeypatch.setattr(gpm_adapter.settings, "nasa_gpm_token", "")
    import asyncio

    assert asyncio.run(gpm_adapter.GPMAdapter().fetch(object(), datetime(2026, 1, 1), datetime(2026, 1, 1))) == []


def test_error_page_granule_is_deleted_and_triggers_cooldown(tmp_path, monkeypatch):
    import pytest

    monkeypatch.setattr(gpm_adapter.settings, "nasa_gpm_data_dir", str(tmp_path))
    folder = tmp_path / "NRT/IMERG/IMERG-ER/2026/10/17"
    folder.mkdir(parents=True)
    bad = folder / "3B-HHR-E.MS.MRG.3IMERG.20261017-S030000-E032959.0180.V07C.HDF5"
    bad.write_text("You have exceeded the maximum number of allowed login attempts. User profile has been locked")

    with pytest.raises(gpm_adapter.GPMCoolingDown):
        gpm_adapter._purge_bad_granules(datetime(2026, 10, 17, 3), datetime(2026, 10, 17, 4))

    assert not bad.exists()  # not left behind to be mistaken for a real granule
    with pytest.raises(gpm_adapter.GPMCoolingDown):  # and the next call backs off without hitting NASA
        gpm_adapter._check_cooldown()


def test_granule_names_follow_imerg_convention():
    names = gpm_adapter._granule_names(datetime(2026, 10, 6, 10, 30))
    assert names[0] == "3B-HHR-E.MS.MRG.3IMERG.20261006-S103000-E105959.0630.V07C.HDF5"
    assert names[1].endswith(".V07B.HDF5")
