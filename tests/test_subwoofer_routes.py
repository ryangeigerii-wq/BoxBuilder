import json
from pathlib import Path

def test_subwoofer_search_empty(monkeypatch, tmp_path, client):
    # Isolate DB path to ensure empty state regardless of prior test runs
    from app.api.routes import subwoofers as mod
    monkeypatch.setattr(mod, "DB_PATH", tmp_path / "subwoofers.json")
    resp = client.get("/subwoofers")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["items"] == []


def test_subwoofer_search_sort(monkeypatch, client, tmp_path):
    """Basic sort verification without external scrape logic (Crutchfield removed)."""
    from app.api.routes import subwoofers as mod
    monkeypatch.setattr(mod, "DB_PATH", tmp_path / "subwoofers.json")
    # Seed DB manually
    from dataclasses import asdict
    from app.api.routes.subwoofers import Subwoofer, save_db
    from time import time
    items = [
        Subwoofer(
            source="synthetic", url="http://example.com/a", brand="Brand", model="A", size_in=12.0,
            rms_w=500, peak_w=None, impedance_ohm=None, sensitivity_db=None, mounting_depth_in=None,
            cutout_diameter_in=None, displacement_cuft=None, recommended_box=None, price_usd=150.0,
            image=None, scraped_at=time()
        ),
        Subwoofer(
            source="synthetic", url="http://example.com/b", brand="Brand", model="B", size_in=12.0,
            rms_w=600, peak_w=None, impedance_ohm=None, sensitivity_db=None, mounting_depth_in=None,
            cutout_diameter_in=None, displacement_cuft=None, recommended_box=None, price_usd=175.0,
            image=None, scraped_at=time()
        ),
    ]
    save_db(items)
    resp = client.get("/subwoofers?sort=rms")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert data["items"][0]["rms_w"] == 600