from app.core import paths as paths_mod

# Tests that download (non-json) modes now persist to disk and expose X-Saved-File header

def test_basic_svg_persist(tmp_path, monkeypatch, client):
    monkeypatch.setattr(paths_mod, "OUTPUT_ROOT", tmp_path / "output")
    paths_mod.ensure_output_dirs()
    r = client.post("/export/basic-svg", json={"width": 11, "height": 4})
    assert r.status_code == 200
    saved = r.headers.get("x-saved-file")
    assert saved and saved.startswith("output/svg_box/")
    f = tmp_path / saved
    assert f.is_file()
    assert f.read_text(encoding='utf-8').startswith("<?xml")


def test_basic_dxf_persist(tmp_path, monkeypatch, client):
    monkeypatch.setattr(paths_mod, "OUTPUT_ROOT", tmp_path / "output")
    paths_mod.ensure_output_dirs()
    r = client.post("/export/basic-dxf", json={"width": 9, "height": 3})
    assert r.status_code == 200
    saved = r.headers.get("x-saved-file")
    assert saved and saved.startswith("output/dxf_box/") and saved.endswith('.dxf')
    f = tmp_path / saved
    assert f.is_file()
    content = f.read_text(encoding='utf-8')
    assert content.startswith('0\nSECTION')


def test_cutsheet_svg_persist(tmp_path, monkeypatch, client):
    monkeypatch.setattr(paths_mod, "OUTPUT_ROOT", tmp_path / "output")
    paths_mod.ensure_output_dirs()
    payload = {"width": 18.0, "height": 12.0, "depth": 10.0, "wall_thickness": 0.75}
    r = client.post("/export/svg", json=payload)
    assert r.status_code == 200
    saved = r.headers.get("x-saved-file")
    assert saved and saved.startswith('output/svg_cutsheets/') and saved.endswith('.svg')
    f = tmp_path / saved
    assert f.is_file()
    txt = f.read_text(encoding='utf-8')
    assert '<svg' in txt


def test_cutsheet_dxf_persist(tmp_path, monkeypatch, client):
    monkeypatch.setattr(paths_mod, "OUTPUT_ROOT", tmp_path / "output")
    paths_mod.ensure_output_dirs()
    payload = {"width": 18.0, "height": 12.0, "depth": 10.0, "wall_thickness": 0.75}
    r = client.post("/export/dxf", json=payload)
    assert r.status_code == 200
    saved = r.headers.get("x-saved-file")
    assert saved and saved.startswith('output/dxf_cutsheets/') and saved.endswith('.dxf')
    f = tmp_path / saved
    assert f.is_file()
    txt = f.read_text(encoding='utf-8')
    assert txt.startswith('0\nSECTION')


def test_cutsheet_pdf_persist(tmp_path, monkeypatch, client):
    monkeypatch.setattr(paths_mod, "OUTPUT_ROOT", tmp_path / "output")
    paths_mod.ensure_output_dirs()
    payload = {"width": 18.0, "height": 12.0, "depth": 10.0, "wall_thickness": 0.75}
    r = client.post("/export/pdf", json=payload)
    assert r.status_code == 200
    saved = r.headers.get("x-saved-file")
    # PDF persists under cut_sheets
    assert saved and saved.startswith('output/cut_sheets/') and saved.endswith('.pdf')
    f = tmp_path / saved
    assert f.is_file()
    # Simple PDF magic bytes check (%PDF-)
    with f.open('rb') as fh:
        head = fh.read(5)
    assert head == b'%PDF-'


def test_segregation_directories(tmp_path, monkeypatch, client):
    monkeypatch.setattr(paths_mod, "OUTPUT_ROOT", tmp_path / "output")
    paths_mod.ensure_output_dirs()
    # Produce one of each type
    client.post("/export/basic-svg", json={"width": 5, "height": 2})
    client.post("/export/basic-dxf", json={"width": 5, "height": 2})
    payload = {"width": 10.0, "height": 6.0, "depth": 8.0, "wall_thickness": 0.75}
    client.post("/export/svg", json=payload)
    client.post("/export/dxf", json=payload)
    client.post("/export/pdf", json=payload)
    # Assert directories populated appropriately
    assert any(p.suffix == '.svg' for p in (tmp_path/ 'output' / 'svg_box').glob('*.svg'))
    assert any(p.suffix == '.dxf' for p in (tmp_path/ 'output' / 'dxf_box').glob('*.dxf'))
    assert any(p.suffix == '.svg' for p in (tmp_path/ 'output' / 'svg_cutsheets').glob('*.svg'))
    assert any(p.suffix == '.dxf' for p in (tmp_path/ 'output' / 'dxf_cutsheets').glob('*.dxf'))
    assert any(p.suffix == '.pdf' for p in (tmp_path/ 'output' / 'cut_sheets').glob('*.pdf'))
