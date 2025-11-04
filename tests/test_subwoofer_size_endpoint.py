import json
from pathlib import Path
from dataclasses import dataclass
from time import time

from app.api.routes import subwoofers as mod

@dataclass
class FakeSub:
    source: str = "crutchfield"
    url: str = "http://example.com/x"
    brand: str = "Brand"
    model: str = "Model"
    size_in: float = 10.0
    rms_w: int = 400
    peak_w: int = 800
    impedance_ohm: float = 4.0
    sensitivity_db: float = 87.5
    mounting_depth_in: float = 5.2
    cutout_diameter_in: float = 9.3
    displacement_cuft: float = 0.07
    recommended_box: str = "ported"
    price_usd: float = 179.99
    image: str | None = None
    scraped_at: float = time()


def test_size_endpoint_success(monkeypatch, client, tmp_path):
    monkeypatch.setattr(mod, "DB_PATH", tmp_path / "subwoofers.json")
    subs = [FakeSub(size_in=10.0, url="http://example.com/a"), FakeSub(size_in=10.2, url="http://example.com/b"), FakeSub(size_in=8.0, url="http://example.com/c")]
    mod.save_db(subs)
    r = client.get("/subwoofers/size/10")
    assert r.status_code == 200
    payload = r.json()
    assert payload["size"] == 10
    assert payload["count"] == 2  # 10.0 & 10.2 rounded bucket
    assert Path(payload["snapshot_file"]).exists()


def test_size_endpoint_missing(monkeypatch, client, tmp_path):
    monkeypatch.setattr(mod, "DB_PATH", tmp_path / "subwoofers.json")
    # Do not create bucket
    r = client.get("/subwoofers/size/15")
    assert r.status_code == 404
    msg = r.json().get("detail")
    assert "15" in msg
