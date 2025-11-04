import json
from pathlib import Path
from fastapi.testclient import TestClient
from main import app


def test_export_box_creates_file(tmp_path, monkeypatch):
    # Redirect OUTPUT_ROOT to temp to avoid polluting real output
    from app.core import paths as paths_mod

    monkeypatch.setattr(paths_mod, "OUTPUT_ROOT", tmp_path / "output")
    paths_mod.ensure_output_dirs()

    client = TestClient(app)
    resp = client.post(
        "/export/box",
        data={
            "width": 18,
            "height": 12,
            "depth": 10,
            "wall_thickness": 0.75,
            "sub_size": 12,
            "sub_count": 1,
            "finish": "espresso",
        },
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get("saved") is True
    rel_file = data["file"]
    # Ensure relative path includes output/temp/ prefix
    assert rel_file.startswith("output/temp/")
    saved_path = tmp_path / rel_file
    assert saved_path.is_file()
    with saved_path.open() as f:
        payload = json.load(f)
    assert payload["width"] == 18
    assert payload["finish"] == "espresso"

def test_export_box_validation_error(client=None):
    test_client = TestClient(app)
    # Zero dimension should trigger error
    bad = test_client.post(
        "/export/box",
        data={"width": 0, "height": 10, "depth": 5, "wall_thickness": 0.75},
    )
    assert bad.status_code == 400
    assert "error" in bad.json()
