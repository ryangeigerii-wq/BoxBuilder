from fastapi.testclient import TestClient
from main import app
import importlib.util
import pytest

client = TestClient(app)

def test_export_pdf_basic():
    payload = {
        "width": 18.0,
        "height": 12.0,
        "depth": 10.0,
        "wall_thickness": 0.75,
        "include_ports": True,
        "include_bracing": True,
        "join_style": "front_back_overlap",
        "slot_port_height": 2.0,
        "slot_port_width": 14.0,
        "num_slot_ports": 2,
        "brace_strip_width": 2.0,
        "brace_count": 3
    }
    # Skip test gracefully if reportlab not installed in environment
    if importlib.util.find_spec("reportlab") is None:
        pytest.skip("reportlab not installed; skipping PDF export test")
    resp = client.post("/export/pdf", json=payload)
    if resp.status_code != 200:
        print("PDF export error status:", resp.status_code)
        print("Response text:", resp.text[:500])
    assert resp.status_code == 200
    assert resp.headers.get("content-type") == "application/pdf"
    content = resp.content
    # Basic sanity: PDF starts with %PDF
    assert content[:4] == b"%PDF", "Not a valid PDF header"
