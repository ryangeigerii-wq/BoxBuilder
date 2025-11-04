import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_cutsheet_holes_basic():
    payload = {
        "panel_width": 30.0,
        "panel_height": 20.0,
        "holes": [
            {"dx": 0.0, "dy": 0.0, "nominal": 12.0, "cut": None},
            {"dx": -5.0, "dy": 3.0, "nominal": 8.0, "cut": 7.5},
            {"dx": 6.0, "dy": -4.0, "nominal": 10.0, "cut": None},
        ],
    }
    r = client.post("/export/cutsheet-holes", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["hole_count"] == 3
    first = data["holes"][0]
    assert abs(first["dia"] - 11.16) < 0.01
    second = data["holes"][1]
    assert abs(second["dia"] - 7.5) < 0.01
    third = data["holes"][2]
    assert abs(third["dia"] - 9.3) < 0.01
    assert data.get("note") is None
