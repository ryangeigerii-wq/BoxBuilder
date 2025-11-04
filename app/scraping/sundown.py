"""Sundown Audio manufacturer scrape helpers.

Provides an async function to extract ~8" subwoofer models from the public
catalog page. Network errors yield a synthetic fallback list so the UI can
still display options during local development or blocked environments.
"""
from __future__ import annotations
import asyncio, time, re, random
from typing import List, Dict, Any, Optional

import httpx
from bs4 import BeautifulSoup

SUNDOWN_PAGE = "https://sundownaudio.com/pages/sundown-subwoofer-page"
UA_POOL = [
    # Reuse generic pool; kept minimal to avoid duplication. Calling code may extend.
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
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
    
    # Find product links (e.g., /products/z-series-z8-...)
    product_links = soup.select("a[href*='/products/']")
    
    for link in product_links:
        text = link.get_text(" ", strip=True)
        href = link.get('href', '')
        
        # Look for 8" indicators in link text (8" or 8 inch patterns)
        if not re.search(r'8\s*(?:"|inch)', text, re.I):
            continue
        
        # Skip if not a subwoofer (filter out amps, accessories, etc.)
        text_lower = text.lower()
        if 'amplifier' in text_lower or 'fuse' in text_lower or 'wire' in text_lower or 'cable' in text_lower:
            continue
        if 'subwoofer' not in text_lower:
            continue
        
        # Build full URL for deduplication
        if href.startswith('/'):
            full_url = f"https://sundownaudio.com{href}"
        else:
            full_url = href if href.startswith('http') else f"https://sundownaudio.com{href}"
        
        # Dedupe by URL first
        if full_url in seen:
            continue
        seen.add(full_url)
        
        # Extract model name - remove size and "Subwoofer" suffix
        # Example: "Z8 8\" Subwoofer" -> "Z8"
        model = re.sub(r'\s+8\s*(?:"|inch).*$', '', text, flags=re.I).strip()
        model = re.sub(r'\s+subwoofer\s*$', '', model, flags=re.I).strip()
        
        if not model or len(model) < 1:
            # Fallback: extract from URL if model name empty
            url_match = re.search(r'/products/[^/]*-([a-z0-9-]+)', href, re.I)
            if url_match:
                model = url_match.group(1).replace('-', ' ').title()
            else:
                continue
        
        size_in = 8.0
        cutout = round(size_in * 0.93, 3)
        items.append({
            "brand": "Sundown Audio",
            "model": model,
            "size_in": size_in,
            "cutout_diameter_in": cutout,
            "cutout_estimated": True,
            "source": "sundown",
            "url": full_url,
            "scraped_at": time.time(),
        })
    
    return items

def _synthetic_fallback() -> List[Dict[str, Any]]:
    base = ["SA-8 V.3", "X-8", "U-8", "Zv5-8 Prototype"]
    items: List[Dict[str, Any]] = []
    for m in base:
        size_in = 8.0
        cutout = round(size_in * 0.93, 3)
        items.append({
            "brand": "Sundown Audio",
            "model": m,
            "size_in": size_in,
            "cutout_diameter_in": cutout,
            "cutout_estimated": True,
            "source": "sundown-synthetic",
            "url": SUNDOWN_PAGE + f"#synthetic-{m.lower().replace(' ', '-')}",
            "scraped_at": time.time(),
        })
    return items

async def scrape_sundown_eight() -> List[Dict[str, Any]]:
    html = await _fetch_html(SUNDOWN_PAGE)
    if not html:
        return _synthetic_fallback()
    parsed = _parse_models(html)
    return parsed or _synthetic_fallback()

async def _enrich_product(url: str) -> Dict[str, Any]:  # pragma: no cover (network variability)
    """Fetch individual product page to attempt richer data (placeholder).

    Currently extracts only raw text length and presence of spec keywords.
    Future enhancement: parse RMS, mounting depth, recommended enclosure, price.
    """
    html = await _fetch_html(url, retries=2, timeout=15.0)
    if not html:
        return {"detail_fetch": False}
    lower = html.lower()
    return {
        "detail_fetch": True,
        "has_rms": "rms" in lower,
        "has_mount": "mount" in lower or "depth" in lower,
        "has_price": "$" in html,
        "page_chars": len(html),
    }

async def scrape_sundown_eight_full(max_models: int = 12, base_delay: float = 1.2, jitter: float = 0.4) -> List[Dict[str, Any]]:
    """Polite, slower scrape attempting enrichment per product page.

    Args:
        max_models: cap number of models to avoid excessive requests.
        base_delay: base seconds between product page fetches.
        jitter: random +/- added to delay for variability.

    Returns list of model dicts (same shape as fast scrape plus optional enrichment fields).
    Falls back to synthetic list if catalog page unreachable.
    """
    catalog_html = await _fetch_html(SUNDOWN_PAGE)
    if not catalog_html:
        return _synthetic_fallback()
    models = _parse_models(catalog_html)
    if not models:
        return _synthetic_fallback()
    limited = models[:max_models]
    enriched: List[Dict[str, Any]] = []
    for m in limited:
        # Polite delay before each product detail fetch
        delay = base_delay + random.uniform(-jitter, jitter)
        await asyncio.sleep(max(delay, 0.2))  # clamp to minimum 0.2
        detail = await _enrich_product(m["url"])
        merged = {**m, **detail}
        enriched.append(merged)
    return enriched

__all__ = ["scrape_sundown_eight", "SUNDOWN_PAGE", "scrape_sundown_eight_full"]

__all__ = ["scrape_sundown_eight", "SUNDOWN_PAGE"]