import json
from fastapi.testclient import TestClient
import app.api.routes.subwoofers as mod
from main import get_application

app = get_application()
client = TestClient(app)

def test_aggressive_collect_smoke(monkeypatch):
    # Monkeypatch fetch to return static HTML with a single product of desired size repeatedly.
    sample_listing = '<html><a href="/p_1234/Test-Sub.html">Test Sub</a></html>'
    sample_product = '<html><h1>BrandX ModelY 8" Subwoofer</h1><div class="price">$199.99</div><table><tr><th>RMS Power</th><td>300 watts</td></tr></table></html>'

    class DummyResp:
        def __init__(self, text):
            self.text = text
            self.http_version = 'HTTP/2'
        def raise_for_status(self):
            return

    async def fake_fetch(client, url):
        if 'Test-Sub.html' in url:
            return DummyResp(sample_product)
        return DummyResp(sample_listing)

    monkeypatch.setattr(mod, 'fetch', fake_fetch)

    r = client.get('/subwoofers/collect/aggressive/8?target=12&batch_pages=2&max_cycles=2')
    assert r.status_code == 200, r.text
    data = r.json()
    assert data['found'] >= 1
    assert data['ranked_returned'] >= 1
    # Snapshot file path (may be None in constrained env)
    # If present, ensure file got written.
    snap = data.get('snapshot')
    if snap:
        with open(snap, 'r', encoding='utf-8') as fh:
            js = json.load(fh)
            assert isinstance(js, list)
            assert js, 'snapshot should contain at least one item'
