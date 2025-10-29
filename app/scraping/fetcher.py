"""HTML fetching utilities for subwoofer data scraping."""
from typing import Optional
import httpx

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


async def fetch_html(url: str, timeout: float = 10.0) -> Optional[str]:
    """Fetch raw HTML from a URL.

    Returns None on network errors or non-200 status.
    """
    try:
        async with httpx.AsyncClient(timeout=timeout, headers=DEFAULT_HEADERS) as client:
            resp = await client.get(url)
            if resp.status_code != 200:
                return None
            return resp.text
    except httpx.HTTPError:
        return None
