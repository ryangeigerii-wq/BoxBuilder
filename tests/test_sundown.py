import json
import time
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_sundown_basic_shape():
    resp = client.get("/subwoofers/sundown")
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data and isinstance(data["total"], int)
    assert "items" in data and isinstance(data["items"], list)
    assert "source_page" in data
    # At least one item (synthetic fallback guarantees >0)
    assert data["total"] >= 1
    assert len(data["items"]) == data["total"]
    first = data["items"][0]
    required_fields = [
        "brand", "model", "size_in", "cutout_diameter_in",
        "cutout_estimated", "source", "url", "scraped_at"
    ]
    for f in required_fields:
        assert f in first, f"Missing field {f} in first item"
    assert first["brand"] == "Sundown Audio"
    assert abs(first["size_in"] - 8.0) < 1e-6
    assert first["cutout_estimated"] is True
    assert first["cutout_diameter_in"] == round(8.0 * 0.93, 3)


def test_sundown_persistence_bucket():
    # Trigger a scrape to ensure persistence write attempted
    _ = client.get("/subwoofers/sundown")
    # Read the bucket file if present
    import os, pathlib
    bucket = pathlib.Path("subwoofers/8/latest.json")
    assert bucket.exists(), "Size 8 bucket file missing after Sundown scrape"
    text = bucket.read_text(encoding="utf-8")
    arr = json.loads(text)
    # Ensure at least one 8" entry persisted
    assert any((rec.get("size_in") == 8.0 for rec in arr)), "No 8\" records in bucket snapshot"


def test_sundown_repeat_merge_idempotent():
    # Capture DB size before and after repeat calls (should not balloon duplicates)
    import pathlib, json
    db_path = pathlib.Path("subwoofers_db.json")
    before = json.loads(db_path.read_text()) if db_path.exists() else []
    client.get("/subwoofers/sundown")
    client.get("/subwoofers/sundown")
    after = json.loads(db_path.read_text()) if db_path.exists() else []
    # Allow after >= before but not doubling identical url entries
    urls_before = {item["url"] for item in before}
    urls_after = [item["url"] for item in after]
    # Each URL should appear only once
    assert len(urls_after) == len(set(urls_after)), "Duplicate URLs found after repeated Sundown scrapes"
    assert len(after) >= len(before)
