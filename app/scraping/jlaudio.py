"""JL Audio manufacturer scrape helpers (8" subwoofers).

Follows the same pattern as sundown.py: lightweight HTML fetch with retry,
parsing of product links containing 8" indicators, fallback synthetic list
if live scraping blocked.
"""
from __future__ import annotations
import asyncio, time, re, random
from typing import List, Dict, Any, Optional

import httpx
from bs4 import BeautifulSoup

JLAUDIO_PAGE = "https://www.jlaudio.com/collections/car-subwoofers"  # collection page
UA_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
]


async def _fetch_html(url: str, retries: int = 3, timeout: float = 25.0) -> Optional[str]:
    attempt = 0
    last_exc: Optional[Exception] = None
    while attempt < retries:
        headers = {
            "User-Agent": random.choice(UA_POOL),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Referer": url,
        }
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=timeout) as client:
                resp = await client.get(url, headers=headers)
                resp.raise_for_status()
                return resp.text
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            attempt += 1
            await asyncio.sleep(0.5 * (2 ** (attempt - 1)))
    return None


def _parse_models(html: str) -> List[Dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    items: List[Dict[str, Any]] = []
    seen = set()

    # JL Audio collection uses product cards with anchor tags linking to /products/<slug>
    product_links = soup.select("a[href*='/products/']")

    for link in product_links:
        text = link.get_text(" ", strip=True)
        href = link.get("href", "")
        if not text or not href:
            continue
        # Look for 8" markers (8W, 8W3, '8-inch', '8"') but avoid unrelated sizes (18, etc.)
        if not re.search(r"\b8(?:\"|\s|w)" , text.lower()):
            if "8-inch" not in text.lower():
                continue
        # Only keep subwoofer category terms; filter out enclosures/accessories
        tl = text.lower()
        if any(bad in tl for bad in ["enclosure", "box", "amplifier", "amp", "marine"]):
            continue
        # Model extraction: remove trailing size descriptors like 8" Subwoofer
        model = re.sub(r"\s*8(?:\"| inch).*", "", text, flags=re.I).strip()
        if not model:
            # fallback: derive from slug
            slug_match = re.search(r"/products/([a-z0-9-]+)", href)
            if slug_match:
                model = slug_match.group(1).replace("-", " ").title()
            else:
                continue
        full_url = href if href.startswith("http") else f"https://www.jlaudio.com{href}"
        if full_url in seen:
            continue
        seen.add(full_url)
        size_in = 8.0
        cutout = round(size_in * 0.93, 3)
        items.append({
            "brand": "JL Audio",
            "model": model,
            "size_in": size_in,
            "cutout_diameter_in": cutout,
            "cutout_estimated": True,
            "source": "jlaudio",
            "url": full_url,
            "scraped_at": time.time(),
        })
    return items


def _synthetic_fallback() -> List[Dict[str, Any]]:
    # Representative JL Audio 8" sub families (simplified)
    base = ["8W1v3", "8W3v3", "8W7AE", "CP108LG-W3v3"]
    out: List[Dict[str, Any]] = []
    for m in base:
        size_in = 8.0
        cutout = round(size_in * 0.93, 3)
        out.append({
            "brand": "JL Audio",
            "model": m,
            "size_in": size_in,
            "cutout_diameter_in": cutout,
            "cutout_estimated": True,
            "source": "jlaudio-synthetic",
            "url": JLAUDIO_PAGE + f"#synthetic-{m.lower().replace(' ', '-')}",
            "scraped_at": time.time(),
        })
    return out


async def scrape_jlaudio_eight() -> List[Dict[str, Any]]:
    html = await _fetch_html(JLAUDIO_PAGE)
    if not html:
        return _synthetic_fallback()
    parsed = _parse_models(html)
    return parsed or _synthetic_fallback()

__all__ = ["scrape_jlaudio_eight", "JLAUDIO_PAGE"]
