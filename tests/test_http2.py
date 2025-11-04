import inspect
import httpx
import pytest

from app.api.routes.subwoofers import crawl_crutchfield
from app.scraping.sites import crutchfield as site_crutchfield

class DummyClient(httpx.AsyncClient):
    def __init__(self, *args, **kwargs):
        self.captured_kwargs = kwargs.copy()
        super().__init__(*args, **kwargs)

@pytest.mark.asyncio
async def test_crawl_crutchfield_uses_http2(monkeypatch):
    created = {}

    async def dummy_async_client(*args, **kwargs):
        # we construct a real client to satisfy context manager but record kwargs
        client = DummyClient(*args, **kwargs)
        created['client'] = client
        return client

    # monkeypatch the httpx.AsyncClient class used in crawler
    monkeypatch.setattr(site_crutchfield.httpx, 'AsyncClient', dummy_async_client)
    # Run a minimal crawl (will attempt network; we abort fetch by monkeypatching fetch to avoid outbound)
    async def fake_fetch(client, url):
        class R: text = '<html></html>'
        return R
    from app.api.routes.subwoofers import fetch as real_fetch
    monkeypatch.setattr('app.api.routes.subwoofers.fetch', fake_fetch)

    items = await crawl_crutchfield(pages=1)
    assert isinstance(created['client'], DummyClient)
    assert created['client'].captured_kwargs.get('http2') is True

@pytest.mark.asyncio
async def test_site_scraper_uses_http2(monkeypatch):
    created = {}

    async def dummy_async_client(*args, **kwargs):
        client = DummyClient(*args, **kwargs)
        created['client'] = client
        return client

    monkeypatch.setattr(site_crutchfield.httpx, 'AsyncClient', dummy_async_client)

    async def fake_get(url):
        class R:
            status_code = 200
            text = '<div class="cf-productcard"><div class="cf-productcard-title" href="/foo">Brand Model</div><span class="cf-price">$199.99</span></div>'
        return R

    # monkeypatch client.get inside context manager; easiest is to monkeypatch httpx.AsyncClient.get after instance creation
    async def dummy_get(self, url):
        return await fake_get(url)

    monkeypatch.setattr(DummyClient, 'get', dummy_get)

    results = await site_crutchfield.scrape_crutchfield_subwoofers(pages=1)
    assert created['client'].captured_kwargs.get('http2') is True
    assert results  # parsed one item
