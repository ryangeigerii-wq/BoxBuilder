import pytest, time
from app.api.routes import subwoofers as mod
from app.api.routes.subwoofers import Subwoofer

@pytest.mark.asyncio
async def test_multi_cycle_accumulation(monkeypatch):
    # Fake listing and product flow across cycles
    # Simulate 3 cycles each with 2 pages, each page listing 5 products sized 8.0
    pages_html = []
    for i in range(6):
        # create dummy listing html with anchors
        links = ''.join([f'<a href="/p_dummy_{i}_{j}.html">prod</a>' for j in range(5)])
        next_part = ''
        if i < 5:  # next link except last
            next_part = f'<a rel="next" href="http://example.com/page_{i+1}.html">Next</a>'
        pages_html.append(f'<html>{links}{next_part}</html>')

    async def fake_fetch(client, url):
        # Determine if listing or product
        if 'p_dummy' in url:
            # product page
            return type('Resp', (), {'text': '<html><h1>Brand Model 8" Subwoofer</h1></html>'})()
        # listing page: map page index from URL
        if 'page_' in url:
            idx = int(url.split('_')[-1].split('.')[0])
        else:
            idx = 0
        return type('Resp', (), {'text': pages_html[idx]})()

    monkeypatch.setattr(mod, 'fetch', fake_fetch)
    # Avoid real network client usage; patch httpx.AsyncClient to a simple shim
    import httpx
    class DummyAsyncClient:
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def get(self, *a, **k): return type('Resp', (), {'text': ''})()
    monkeypatch.setattr(mod.httpx, 'AsyncClient', lambda **kwargs: DummyAsyncClient())

    result = await mod.collect_by_size(8.0, batch_pages=2, target=50, max_cycles=5)
    # 6 listing pages * 5 products each = 30 matches (less than target)
    assert result['found'] == 30
    assert result['ranked_returned'] == 30
    assert result['cycles_used'] <= 5
