import json
from pathlib import Path
from dataclasses import dataclass
from time import time

from app.api.routes import subwoofers as mod

@dataclass
class FakeSub:
    source: str = "crutchfield"
    url: str = "http://example.com/1"
    brand: str = "Brand"
    model: str = "Model"
    size_in: float = 8.0
    rms_w: int = 300
    peak_w: int = 600
    impedance_ohm: float = 4.0
    sensitivity_db: float = 88.0
    mounting_depth_in: float = 5.0
    cutout_diameter_in: float = 7.4
    displacement_cuft: float = 0.05
    recommended_box: str = "sealed"
    price_usd: float = 129.99
    image: str | None = None
    scraped_at: float = time()


def test_size_grouping_latest(monkeypatch, tmp_path):
    # Point DB_PATH to temp to avoid polluting real dataset
    monkeypatch.setattr(mod, "DB_PATH", tmp_path / "subwoofers.json")
    # Prepare multiple sizes
    subs = [FakeSub(size_in=8.0, url="http://example.com/a"), FakeSub(size_in=10.0, url="http://example.com/b"), FakeSub(size_in=10.2, url="http://example.com/c"), FakeSub(size_in=12.0, url="http://example.com/d")]
    mod.save_db(subs)
    # Verify primary DB written
    assert mod.DB_PATH.exists(), "Expected main DB file to exist"
    data = json.loads(mod.DB_PATH.read_text(encoding="utf-8"))
    assert len(data) == 4
    # Verify per-size directories and latest.json snapshots
    root = Path("subwoofers")
    for size in [8,10,12]:
        d = root / str(size)
        assert d.exists(), f"Directory for size {size} missing"
        latest = d / "latest.json"
        assert latest.exists(), f"latest.json missing for size {size}"
        payload = json.loads(latest.read_text(encoding="utf-8"))
        # For size 10 we expect two entries (10.0 and 10.2 rounded)
        if size == 10:
            assert len(payload) == 2
        else:
            assert len(payload) == 1
    # Verify index.json summarizing sizes
    index = root / "index.json"
    assert index.exists(), "index.json not generated"
    meta = json.loads(index.read_text(encoding="utf-8"))
    sizes_map = meta.get("sizes", {})
    assert "8" in sizes_map and "10" in sizes_map and "12" in sizes_map
