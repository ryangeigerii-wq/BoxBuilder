from app.core import paths as paths_mod

def test_basic_svg_json_hash(tmp_path, monkeypatch, client):
    monkeypatch.setattr(paths_mod, "OUTPUT_ROOT", tmp_path / "output")
    paths_mod.ensure_output_dirs()
    resp = client.post("/export/basic-svg", json={"width": 7, "height": 3, "mode": "json"})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    h = data.get("hash")
    assert h and len(h) == 64
    # Repeat identical request should yield identical hash
    resp2 = client.post("/export/basic-svg", json={"width": 7, "height": 3, "mode": "json"})
    assert resp2.status_code == 200
    assert resp2.json().get("hash") == h


def test_basic_svg_download_etag(tmp_path, monkeypatch, client):
    monkeypatch.setattr(paths_mod, "OUTPUT_ROOT", tmp_path / "output")
    paths_mod.ensure_output_dirs()
    resp = client.post("/export/basic-svg", json={"width": 5, "height": 2})
    assert resp.status_code == 200
    etag = resp.headers.get("etag")
    assert etag and len(etag) == 64
    # Second identical request gets same ETag because content is deterministic
    resp2 = client.post("/export/basic-svg", json={"width": 5, "height": 2})
    assert resp2.headers.get("etag") == etag


def test_basic_dxf_download_etag(client):
    resp = client.post("/export/basic-dxf", json={"width": 9, "height": 4})
    assert resp.status_code == 200
    etag = resp.headers.get("etag")
    assert etag and len(etag) == 64
