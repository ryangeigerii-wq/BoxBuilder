import pytest
from app.api.routes.subwoofers import fetch, metrics_snapshot, METRICS
import httpx

class DummyClient(httpx.AsyncClient):
    def __init__(self):
        super().__init__()
        self.calls = 0
    async def get(self, url, headers=None, timeout=None):
        self.calls += 1
        if self.calls < 3:
            raise httpx.ConnectTimeout("timeout")
        base = httpx.Response(200, request=httpx.Request("GET", url))
        class Shim(httpx.Response):
            @property
            def http_version(self):  # type: ignore
                return 'HTTP/2'
        # Return shim instance copying underlying data
        shim = Shim(status_code=base.status_code, request=base.request)
        return shim

@pytest.mark.asyncio
async def test_fetch_retries_and_metrics(monkeypatch):
    # Reset metrics state for isolated test
    METRICS['attempts'] = 0
    METRICS['successes'] = 0
    METRICS['errors'] = 0
    METRICS['protocol'] = {}
    METRICS['latencies'] = []
    METRICS['total_latency'] = 0.0
    METRICS['last_error'] = None

    client = DummyClient()
    resp = await fetch(client, 'http://example.com')
    assert resp.status_code == 200
    snap = metrics_snapshot()
    assert snap['attempts'] == 3  # 2 failures + 1 success
    assert snap['successes'] == 1
    assert snap['errors'] == 2
    assert snap['protocol'].get('HTTP/2') == 1
    assert snap['avg_latency'] is not None

@pytest.mark.asyncio
async def test_fetch_exhausts_retries(monkeypatch):
    METRICS['attempts'] = 0
    METRICS['successes'] = 0
    METRICS['errors'] = 0
    METRICS['protocol'] = {}
    METRICS['latencies'] = []
    METRICS['total_latency'] = 0.0
    METRICS['last_error'] = None

    class AlwaysFailClient(httpx.AsyncClient):
        def __init__(self):
            super().__init__()
        async def get(self, url, headers=None, timeout=None):
            raise httpx.ConnectError('fail')

    client = AlwaysFailClient()
    with pytest.raises(Exception):
        await fetch(client, 'http://does-not-resolve.test')
    snap = metrics_snapshot()
    # attempts == MAX_RETRIES (3)
    assert snap['attempts'] == 3
    assert snap['successes'] == 0
    assert snap['errors'] == 3
    assert snap['last_error'] is not None
