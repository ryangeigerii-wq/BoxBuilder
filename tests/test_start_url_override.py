from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

DEF_URL = "https://www.crutchfield.com/g_512/Subwoofers.html"
ALT_URL = "https://www.crutchfield.com/g_446250/8-Inch-Subwoofers.html?tp=68848&avf=N"

def test_collect_size_start_url_echo():
    r = client.get(
        f"/subwoofers/collect/size/8",
        params={"batch_pages":1,"target":10,"max_cycles":1,"start_url": ALT_URL}
    )
    assert r.status_code == 200
    data = r.json()
    assert data["start_url"] == ALT_URL

def test_aggressive_collect_start_url_echo():
    r = client.get(
        f"/subwoofers/collect/aggressive/8",
        params={"batch_pages":1,"target":10,"max_cycles":1,"start_url": ALT_URL}
    )
    assert r.status_code == 200
    data = r.json()
    assert data["start_url"] == ALT_URL
