import time
import json
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_sundown_collect_basic_shape(monkeypatch):
    # Monkeypatch _enrich_product to avoid real network detail fetch & speed up test
    from app.scraping import sundown as sundown_mod

    async def fake_enrich(url: str):
        return {"detail_fetch": True, "has_rms": False, "has_mount": False, "has_price": False, "page_chars": 1234}

    monkeypatch.setattr(sundown_mod, "_enrich_product", fake_enrich)

    t0 = time.time()
    resp = client.get("/subwoofers/sundown/collect?max_models=3&base_delay=0.2&jitter=0.0")
    dt = time.time() - t0
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data and data["total"] <= 3
    assert "models" in data and isinstance(data["models"], list)
    assert data["pacing"]["base_delay"] == 0.2
    # Ensure pacing introduced some delay (3 models * 0.2s ~ 0.6s) allow tolerance
    assert dt >= 0.35, f"Pacing delay too short: {dt:.3f}s"
    if data["models"]:
        m = data["models"][0]
        for field in ["brand", "model", "size_in", "cutout_diameter_in", "detail_fetch"]:
            assert field in m, f"Missing field {field} in model record"


def test_sundown_collect_idempotent_merge(monkeypatch):
    from app.scraping import sundown as sundown_mod

    async def fake_enrich(url: str):
        return {"detail_fetch": True}

    monkeypatch.setattr(sundown_mod, "_enrich_product", fake_enrich)

    # First run
    client.get("/subwoofers/sundown/collect?max_models=2&base_delay=0.2&jitter=0.0")
    # Second run (should not duplicate URLs)
    client.get("/subwoofers/sundown/collect?max_models=2&base_delay=0.2&jitter=0.0")

    import pathlib
    db_path = pathlib.Path("subwoofers_db.json")
    if db_path.exists():
        records = json.loads(db_path.read_text())
        urls = [r.get("url") for r in records]
        assert len(urls) == len(set(urls)), "Duplicate URLs detected after collect runs"


def test_sundown_collect_bucket(monkeypatch):
    from app.scraping import sundown as sundown_mod

    async def fake_enrich(url: str):
        return {"detail_fetch": True}

    monkeypatch.setattr(sundown_mod, "_enrich_product", fake_enrich)

    client.get("/subwoofers/sundown/collect?max_models=1&base_delay=0.2&jitter=0.0")
    import pathlib
    bucket = pathlib.Path("subwoofers/8/latest.json")
    assert bucket.exists(), "Bucket latest.json missing after collect"
    arr = json.loads(bucket.read_text())
    assert any(rec.get("brand") == "Sundown Audio" for rec in arr), "No Sundown entries in bucket"
