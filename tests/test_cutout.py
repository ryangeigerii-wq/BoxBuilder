from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

sizes_expected = {
    8: 8 * 0.93,
    12: 12 * 0.93,
    15: 15 * 0.93,
}


def test_cutout_estimated_flag_and_value():
    for size, expected in sizes_expected.items():
        r = client.get(f"/subwoofers/cutout/{size}")
        assert r.status_code == 200
        data = r.json()
        assert data["estimated"] is True
        assert abs(data["cutout_diameter"] - expected) < 1e-6
        assert data["ratio_used"] == 0.93
        assert "0.93× standard" in data["disclaimer"]


def test_cutout_actual_override():
    # Provide an actual spec slightly different from heuristic
    size = 12
    override = 11.125
    r = client.get(f"/subwoofers/cutout/{size}", params={"actual_spec": override})
    assert r.status_code == 200
    data = r.json()
    assert data["estimated"] is False
    assert data["cutout_diameter"] == override
    assert data["ratio_used"] != 0.93
