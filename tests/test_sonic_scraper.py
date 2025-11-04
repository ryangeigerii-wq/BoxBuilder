import json
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient
from main import app

LISTING_HTML = '<html>' + ''.join([
    '<a href="/item-100{}-BrandX-Model{}-Eight.html">Sub {}</a>'.format(i, i, i) for i in range(3)
]) + '</html>'

PRODUCT_TEMPLATE = '<html><h1>BrandX Model{idx} Eight-Inch Subwoofer</h1><div class="price">$199.99</div><table><tr><td>RMS Power</td><td>{rms} Watts</td></tr></table></html>'

class FakeScraper:
    def __init__(self):
        self.calls = []
    def get(self, url):
        self.calls.append(url)
        if 'ci59-8-car-subwoofers.html' in url:
            return SimpleNamespace(status_code=200, text=LISTING_HTML)
        if '/item-' in url:
            # Extract index
            import re
            m = re.search(r'/item-100(\d+)-', url)
            idx = int(m.group(1)) if m else 0
            html = PRODUCT_TEMPLATE.format(idx=idx, rms=300 + idx * 10)
            return SimpleNamespace(status_code=200, text=html)
        return SimpleNamespace(status_code=404, text='')

def test_sonic_scraper_basic(monkeypatch, tmp_path):
    # Monkeypatch DB path to temp
    from app.api.routes import sonic as mod
    monkeypatch.setattr(mod, 'DB_PATH', tmp_path / 'subwoofers.json')

    # Monkeypatch cloudscraper.create_scraper to return fake scraper
    import cloudscraper
    monkeypatch.setattr(cloudscraper, 'create_scraper', lambda: FakeScraper())

    client = TestClient(app)
    resp = client.get('/sonic/subwoofers?pages=1')
    assert resp.status_code == 200
    data = resp.json()
    assert data['total'] == 3
    # Ensure fields present
    first = data['items'][0]
    assert first['source'] == 'sonic'
    assert first['brand'] == 'BrandX'
    assert first['rms_w'] is not None and first['rms_w'] >= 300
    # DB file persisted
    assert Path(mod.DB_PATH).exists()
    stored = json.loads(Path(mod.DB_PATH).read_text(encoding='utf-8'))
    assert len(stored) == 3
