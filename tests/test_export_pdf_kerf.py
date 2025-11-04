from fastapi.testclient import TestClient
from main import app
import importlib.util
import pytest

client = TestClient(app)

def test_export_pdf_with_kerf():
    if importlib.util.find_spec("reportlab") is None:
        pytest.skip("reportlab not installed; skipping PDF kerf test")
    payload = {
        "width": 30.0,
        "height": 18.0,
        "depth": 16.0,
        "wall_thickness": 0.75,
        "include_ports": True,
        "include_bracing": True,
        "join_style": "side_overlap",
        "slot_port_height": 2.5,
        "slot_port_width": 18.0,
        "num_slot_ports": 1,
        "brace_strip_width": 2.0,
        "brace_count": 4,
        "kerf_thickness": 0.125
    }
    resp = client.post("/export/pdf", json=payload)
    assert resp.status_code == 200
    assert resp.headers.get("content-type") == "application/pdf"
    assert resp.content.startswith(b"%PDF")
