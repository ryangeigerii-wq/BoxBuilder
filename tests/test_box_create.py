from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_box_create_volume():
    payload = {"width": 2.0, "height": 3.0, "depth": 4.0}
    r = client.post("/boxes/create", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["volume"] == 24.0
