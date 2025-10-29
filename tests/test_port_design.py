from fastapi.testclient import TestClient
from main import app
import math

client = TestClient(app)


def test_round_port_design_basic():
    payload = {
        "portType": "round",
        "boxVolumeLiters": 70.0,
        "targetHz": 32.0,
        "numPorts": 1,
        "diameterM": 0.10,  # 10 cm
        "flareRadiusM": 0.0,
        "cornerPlacement": False,
        "extraPhysicalLengthM": 0.0,
        "speedOfSound": 343.0
    }
    r = client.post("/ports/design", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    # Area check
    expected_area = math.pi * (payload["diameterM"]/2)**2
    assert abs(data["areaPerPortM2"] - expected_area) < 1e-8
    # Effective length must be > physical length and > 0
    assert data["effectiveLengthPerPortM"] > data["physicalLengthPerPortM"] > 0
    # Achieved tuning should be reasonably close to target (within ~2 Hz tolerance for heuristic ends)
    assert abs(data["tuningHzAchieved"] - payload["targetHz"]) < 2.5
