import json
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

@pytest.mark.asyncio
async def test_jlaudio_fetch_and_parse():
    resp = client.get("/subwoofers/jlaudio")
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data and "items" in data
    assert data["total"] == len(data["items"])
    items = data["items"]
    assert len(items) > 0, "No JL Audio items (even synthetic should return >0)"
    first = items[0]
    for field in ["brand", "model", "size_in", "cutout_diameter_in", "cutout_estimated", "url", "source", "scraped_at"]:
        assert field in first, f"Missing field {field} in first item"
    assert first["brand"] == "JL Audio"
    assert abs(first["size_in"] - 8.0) < 1e-6
    assert first["cutout_diameter_in"] == round(8.0 * 0.93, 3)

@pytest.mark.asyncio
async def test_jlaudio_persistence_bucket():
    _ = client.get("/subwoofers/jlaudio")
    import pathlib
    bucket = pathlib.Path("subwoofers/8/latest.json")
    assert bucket.exists(), "Bucket latest.json missing"
    items = json.loads(bucket.read_text(encoding="utf-8"))
    assert any(i.get("brand") == "JL Audio" for i in items), "No JL Audio entries persisted to bucket"

@pytest.mark.asyncio
async def test_jlaudio_idempotent_merge():
    import pathlib
    db_path = pathlib.Path("subwoofers_db.json")
    before = json.loads(db_path.read_text()) if db_path.exists() else []
    client.get("/subwoofers/jlaudio")
    client.get("/subwoofers/jlaudio")
    after = json.loads(db_path.read_text()) if db_path.exists() else []
    urls_after = [r.get("url") for r in after]
    assert len(urls_after) == len(set(urls_after)), "Duplicate JL Audio URLs after repeated scrape"
    assert len(after) >= len(before)
