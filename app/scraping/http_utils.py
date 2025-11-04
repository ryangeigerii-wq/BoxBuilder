"""HTTP client helpers for scraper & collection endpoints.

Provides a single coroutine-aware factory to obtain an httpx.AsyncClient that
is resilient to test monkeypatches which may cause httpx.AsyncClient(...) to
return a coroutine instead of an instance (e.g., when replacing the class
with an async factory). Centralizing this logic eliminates duplicated
try/await blocks scattered across scraping modules.
"""
from __future__ import annotations

from typing import Any, Dict, Optional
import httpx


DEFAULT_TIMEOUT = 15.0


async def ensure_async_client(
    *,
    headers: Optional[Dict[str, str]] = None,
    follow_redirects: bool = True,
    http2: bool = True,
    timeout: float = DEFAULT_TIMEOUT,
    **extra: Any,
) -> httpx.AsyncClient:
    """Return a real httpx.AsyncClient instance.

    Some tests monkeypatch ``httpx.AsyncClient`` with a coroutine-returning
    stub. In that scenario calling ``httpx.AsyncClient(...)`` yields a
    coroutine which must be awaited to get the actual client object. This
    helper hides that detail so callers can simply ``client = await
    ensure_async_client(...)`` and proceed normally.

    Any additional keyword arguments are passed through to ``httpx.AsyncClient``.
    """
    created = httpx.AsyncClient(
        headers=headers, follow_redirects=follow_redirects, http2=http2, timeout=timeout, **extra
    )
    if hasattr(created, "__await__"):
        created = await created  # type: ignore[assignment]
    return created  # type: ignore[return-value]


async def aclose_safely(client: httpx.AsyncClient) -> None:
    """Attempt to close the client; swallow all exceptions.

    Used in finally blocks to avoid masking earlier scraping errors with close
    issues (e.g., when a monkeypatched stub lacks aclose implementation).
    """
    try:  # pragma: no cover - defensive
        await client.aclose()  # type: ignore[attr-defined]
    except Exception:
        pass
