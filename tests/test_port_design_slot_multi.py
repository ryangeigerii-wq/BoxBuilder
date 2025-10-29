from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_slot_multi_port_layout():
    payload = {
        "portType": "slot",
        "boxVolumeLiters": 80.0,
        "targetHz": 35.0,
    "numPorts": 2,
        "slotHeightM": 0.05,
        "slotGapM": 0.01,
        "extraPhysicalLengthM": 0.0,
        "speedOfSound": 343.0
    }
    r = client.post("/ports/design", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    preview = data.get("preview")
    assert preview, "Missing preview geometry"
    shapes = preview.get("ports2D")
    assert len(shapes) == payload["numPorts"], "Incorrect number of slot port shapes (should be 2)"
    xs = [s["x"] for s in shapes]
    # Ensure side-by-side (sorted unique positions)
    assert len(set(xs)) == payload["numPorts"], "Slot ports not laid out side-by-side"
    # Centered layout: mean near 0
    mean_x = sum(xs)/len(xs)
    assert abs(mean_x) < 1e-6, f"Ports not centered (mean x = {mean_x})"
    # Width and height present
    for s in shapes:
        assert s["w"] > 0 and s["h"] > 0
