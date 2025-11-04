import re, json
from types import SimpleNamespace
from pathlib import Path
from time import perf_counter

from fastapi.testclient import TestClient
from main import app

LISTING_HTML = '<html><a href="/item-1001-BrandX-Alpha.html">Alpha</a><a href="/item-1002-BrandX-Beta.html">Beta</a></html>'
PRODUCT_HTML_TM = '<html><h1>BrandX™ Beta Eight-Inch Subwoofer</h1><div class="price">$149.99</div><table><tr><td>RMS Power</td><td>325 Watts</td></tr></table></html>'
PRODUCT_HTML = '<html><h1>BrandX Alpha Eight-Inch Subwoofer</h1><div class="price">$129.99</div><table><tr><td>RMS Power</td><td>300 Watts</td></tr></table></html>'

class FakeScraper:
    def __init__(self):
        self.calls = []
    def get(self, url):
        self.calls.append(url)
        if 'ci59-8-car-subwoofers.html' in url:
            return SimpleNamespace(status_code=200, text=LISTING_HTML)
        if '/item-1001-' in url:
            return SimpleNamespace(status_code=200, text=PRODUCT_HTML)
        if '/item-1002-' in url:
            return SimpleNamespace(status_code=200, text=PRODUCT_HTML_TM)
        return SimpleNamespace(status_code=404, text='')


def test_sonic_jitter_and_cleanup(monkeypatch, tmp_path):
    from app.api.routes import sonic as mod
    monkeypatch.setattr(mod, 'DB_PATH', tmp_path / 'subwoofers.json')
    import cloudscraper
    monkeypatch.setattr(cloudscraper, 'create_scraper', lambda: FakeScraper())
    # Force deterministic jitter OFF
    monkeypatch.setenv('SONIC_JITTER_OFF', '1')
    client = TestClient(app)
    start = perf_counter()
    resp = client.get('/sonic/subwoofers?pages=1')
    elapsed = perf_counter() - start
    assert resp.status_code == 200
    data = resp.json()
    assert data['total'] == 2
    brands = {item['brand'] for item in data['items']}
    assert 'BrandX' in brands
    # Ensure trademark symbol removed from Beta model
    beta = [i for i in data['items'] if 'Beta' in i['model']][0]
    assert '™' not in beta['model']
    # Delay should be at least BASE_DELAY * number of calls (listing + 2 products)
    base = float(mod.BASE_DELAY)
    # We triggered listing + 2 product delays ~3 * base
    assert elapsed >= base * 2.5  # allow slight timing variance

