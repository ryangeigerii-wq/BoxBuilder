from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_box_builder_page():
    r = client.get("/box-builder")
    assert r.status_code == 200
    html = r.text
    # Updated template expectations for dual view system
    assert "Box Builder" in html
    # Preview heading removed for compact layout; ensure preview container exists instead
    assert 'preview3d' in html
    # Plan / 3D view buttons replaced by Exploded / Assembled view controls
    assert "Exploded" in html
    assert "Assembled" in html
    assert "/static/js/box_builder.js" in html
    assert "downloadSvg" in html  # download button name attribute
