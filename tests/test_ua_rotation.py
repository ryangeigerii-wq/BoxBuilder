import asyncio
import httpx
from app.api.routes import subwoofers as sw

async def _fake_get(self, url, headers=None, timeout=None):
    class FakeResp:
        status_code = 200
        text = "<html></html>"
        def raise_for_status(self):
            return None
    # capture UA for inspection
    FakeResp.headers_used = headers
    return FakeResp()

def test_user_agent_rotation(monkeypatch):
    seen = set()
    monkeypatch.setattr(httpx.AsyncClient, 'get', _fake_get, raising=True)
    async def run_many():
        async with httpx.AsyncClient() as client:
            for _ in range(25):
                resp = await sw.fetch(client, 'https://example.com/x')
                ua = resp.headers_used.get('User-Agent')
                assert ua, 'User-Agent missing'
                seen.add(ua)
    asyncio.run(run_many())
    # Expect more than one distinct UA string used
    assert len(seen) >= 2, f"Expected rotation; only saw {len(seen)} values"