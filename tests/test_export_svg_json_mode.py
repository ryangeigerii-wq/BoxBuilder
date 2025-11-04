from app.core import paths as paths_mod


def test_svg_export_json_mode(tmp_path, monkeypatch, client):
    # Redirect output root before invoking endpoint so new app uses it
    monkeypatch.setattr(paths_mod, "OUTPUT_ROOT", tmp_path / "output")
    paths_mod.ensure_output_dirs()
    resp = client.post("/export/basic-svg", json={"width": 10, "height": 5, "mode": "json"})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data.get("saved") is True
    rel_file = data.get("file")
    assert rel_file.startswith("output/svg_box/"), rel_file
    fpath = tmp_path / rel_file
    assert fpath.is_file()
    content = fpath.read_text(encoding="utf-8")
    assert "<svg" in content and "</svg>" in content
    assert "rect" in content