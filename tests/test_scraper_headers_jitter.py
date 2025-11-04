import os
import re
from fastapi.testclient import TestClient
from main import app

def test_fetch_headers_and_jitter(monkeypatch):
    # Monkeypatch httpx.AsyncClient.get to capture headers
    captured = {}
    async def fake_get(self, url, headers=None, timeout=None):  # noqa: D401
        class FakeResp:
            status_code = 200
            text = "<html></html>"
            def raise_for_status(self):
                return None
        captured['headers'] = headers or {}
        captured['url'] = url
        return FakeResp()

    import httpx
    monkeypatch.setattr(httpx.AsyncClient, 'get', fake_get, raising=True)

    # Monkeypatch sleep to validate jitter range
    delays = []
    async def fake_sleep(d):
        delays.append(d)
        return None
    import asyncio
    monkeypatch.setattr(asyncio, 'sleep', fake_sleep, raising=True)

    from app.api.routes import subwoofers as sw
    # Call fetch directly to ensure header capture
    import asyncio
    async def run_once():
        async with httpx.AsyncClient() as client:
            await sw.fetch(client, 'https://example.com/test')
    asyncio.run(run_once())

    assert 'headers' in captured, 'Expected headers captured from fetch()'
    h = captured['headers']
    # Allow any UA from pool (Chrome / Firefox / Safari / Edge) rather than hard-coding Chrome
    assert 'User-Agent' in h and any(browser in h['User-Agent'] for browser in ['Chrome', 'Firefox', 'Safari', 'Edg']), h.get('User-Agent')
    assert 'Accept-Language' in h and 'en-US' in h['Accept-Language']
    assert 'Accept' in h and 'text/html' in h['Accept']

    assert delays, 'Expected at least one recorded delay with jitter'
    # Jitter should produce a delay > base REQUEST_DELAY occasionally unless disabled
    base = sw.REQUEST_DELAY
    assert any(d > base for d in delays), f"No jitter detected; delays={delays} base={base}"

def test_fetch_without_jitter(monkeypatch):
    os.environ['SCRAPER_JITTER_OFF'] = '1'
    delays = []
    async def fake_sleep(d):
        delays.append(d)
        return None
    import asyncio as aio2
    monkeypatch.setattr(aio2, 'sleep', fake_sleep, raising=True)
    import httpx
    async def fake_get(self, url, headers=None, timeout=None):
        class FakeResp:
            status_code = 200
            text = "<html></html>"
            def raise_for_status(self):
                return None
        return FakeResp()
    monkeypatch.setattr(httpx.AsyncClient, 'get', fake_get, raising=True)
    from app.api.routes import subwoofers as sw
    import asyncio as aio3
    async def run_once():
        async with httpx.AsyncClient() as client:
            await sw.fetch(client, 'https://example.com')
    aio3.run(run_once())
    base = sw.REQUEST_DELAY
    assert delays and all(abs(d - base) < 1e-6 for d in delays)
    del os.environ['SCRAPER_JITTER_OFF']