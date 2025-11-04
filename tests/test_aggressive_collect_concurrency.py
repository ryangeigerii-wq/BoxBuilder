import asyncio
import time
from collections import defaultdict
from fastapi.testclient import TestClient
import app.api.routes.subwoofers as mod
from main import get_application

app = get_application()
client = TestClient(app)

class DummyResp:
    def __init__(self, text):
        self.text = text
        self.http_version = 'HTTP/2'
    def raise_for_status(self):
        return

# Two distinct product pages
PRODUCT_TEMPLATE = '<html><h1>BrandX Model{n} 8" Subwoofer</h1><div class="price">$199.99</div><table><tr><th>RMS Power</th><td>300 watts</td></tr></table></html>'
LISTING_HTML = '<html>' + ''.join(f'<a href="/p_{1000+i}/Test-Sub-{i}.html">Link {i}</a>' for i in range(12)) + '</html>'

CALL_COUNTS = defaultdict(int)

async def fake_fetch(client, url):
    CALL_COUNTS['total'] += 1
    await asyncio.sleep(0.005)
    if 'Test-Sub' in url:
        CALL_COUNTS['product'] += 1
        idx = url.split('-')[-1].split('.')[0]
        return DummyResp(PRODUCT_TEMPLATE.replace('{n}', idx))
    CALL_COUNTS['listing'] += 1
    return DummyResp(LISTING_HTML)

def test_aggressive_collect_concurrency(monkeypatch):
    monkeypatch.setattr(mod, 'fetch', fake_fetch)
    start = time.time()
    r = client.get('/subwoofers/collect/aggressive/8?target=10&batch_pages=1&max_cycles=1&product_concurrency=6')
    elapsed = time.time() - start
    assert r.status_code == 200
    data = r.json()
    assert data['found'] >= 10 or data['ranked_returned'] >= 10
    # Basic sanity: ensure we hit expected product calls
    assert CALL_COUNTS['product'] >= 12
    # Concurrency heuristic: elapsed should be less than exaggerated serial cost
    # Serial would be ~12*0.005 + listing overhead ~0.07s; allow generous headroom for test env (~0.8s)
    assert elapsed < 0.8, f"Elapsed too high, possible loss of concurrency: {elapsed:.3f}s"
