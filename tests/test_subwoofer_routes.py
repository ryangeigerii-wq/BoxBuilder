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


def test_subwoofer_scrape_mock(monkeypatch, client, tmp_path):
    # Monkeypatch DB path to temp
    from app.api.routes import subwoofers as mod
    monkeypatch.setattr(mod, "DB_PATH", tmp_path / "subwoofers.json")
    # Provide fake crawl function returning two items
    from dataclasses import dataclass
    from time import time
    from typing import Optional

    @dataclass
    class FakeSub:
        source: str = "crutchfield"
        url: str = "http://example.com/1"
        brand: str = "Brand"
        model: str = "Model"
        size_in: float = 12.0
        rms_w: int = 500
        peak_w: int = 1000
        impedance_ohm: float = 4.0
        sensitivity_db: float = 88.0
        mounting_depth_in: float = 6.0
        cutout_diameter_in: float = 11.1
        displacement_cuft: float = 0.09
        recommended_box: str = "sealed"
        price_usd: float = 199.99
        image: Optional[str] = None
        scraped_at: float = time()

    async def fake_crawl(pages: int = 1):
        return [FakeSub(), FakeSub(url="http://example.com/2", model="Model2")]

    monkeypatch.setattr(mod, "crawl_crutchfield", fake_crawl)
    resp = client.get("/subwoofers/crutchfield/scrape?pages=1")
    assert resp.status_code == 200
    data = resp.json()
    assert data["found"] == 2
    assert data["total"] == 2
    # File should exist
    assert Path(data["file"]).exists()
    stored = json.loads(Path(data["file"]).read_text(encoding="utf-8"))
    assert len(stored) == 2

    # Now search should return items
    resp2 = client.get("/subwoofers?sort=price")
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["total"] == 2
    assert data2["items"][0]["price_usd"] == 199.99