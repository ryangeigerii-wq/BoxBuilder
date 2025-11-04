from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

ALT_8_URL = "https://www.crutchfield.com/g_446250/8-Inch-Subwoofers.html?tp=68848&avf=N"


def test_collect_size_mismatch_warning():
    r = client.get("/subwoofers/collect/size/10", params={"batch_pages":1,"target":10,"max_cycles":1,"start_url": ALT_8_URL})
    data = r.json()
    assert r.status_code == 200
    assert data["start_url"] == ALT_8_URL
    assert data.get("warning") and "8-Inch" in data["warning"] and "size=10" in data["warning"]


def test_aggressive_collect_mismatch_warning():
    r = client.get("/subwoofers/collect/aggressive/10", params={"batch_pages":1,"target":10,"max_cycles":1,"start_url": ALT_8_URL})
    data = r.json()
    assert r.status_code == 200
    assert data["start_url"] == ALT_8_URL
    assert data.get("warning") and "8-Inch" in data["warning"] and "size=10" in data["warning"]
