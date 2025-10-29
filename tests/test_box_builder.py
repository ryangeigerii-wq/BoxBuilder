from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_box_builder_page():
    r = client.get("/box-builder")
    assert r.status_code == 200
    html = r.text
    # Current JS-only builder template expectations
    assert "Box Builder" in html
    assert "Interactive dimensions, volume, cutout & SVG preview." in html
    assert "/static/js/box_builder.js" in html
    # Ensure preview wrapper placeholder present
    assert "preview-wrapper" in html
