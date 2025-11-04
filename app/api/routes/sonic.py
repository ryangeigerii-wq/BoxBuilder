"""Sonic Electronix scraping router.

Uses cloudscraper to bypass Cloudflare challenge and returns lightweight
subwoofer records similar to crutchfield lite format.
"""
from __future__ import annotations
import time, json, re, os, random
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Optional, Dict, Any

import cloudscraper
from bs4 import BeautifulSoup
from fastapi import APIRouter, Query, HTTPException

router = APIRouter(prefix="/sonic", tags=["sonic"])

DATA_DIR = Path("data")
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "subwoofers.json"

LISTING_BASE = "https://www.sonicelectronix.com"
CATEGORY_8 = "/ci59-8-car-subwoofers.html"
BASE_DELAY = float(os.getenv("SONIC_BASE_DELAY", "0.7"))  # polite base delay seconds
JITTER_MIN = float(os.getenv("SONIC_JITTER_MIN", "0.10"))
JITTER_MAX = float(os.getenv("SONIC_JITTER_MAX", "0.35"))
DISABLE_JITTER = os.getenv("SONIC_JITTER_OFF") is not None
SIZE_PAT = re.compile(r"(\d+(?:\.\d+)?)\s*\"?\s*(?:in|inch|\")", re.I)
RMS_PAT = re.compile(r"(\d{2,5})\s*w(?:att)?", re.I)
PRICE_PAT = re.compile(r"\$\s*([0-9]+(?:\.[0-9]{2})?)")

@dataclass
class SonicSubLite:
    source: str
    url: str
    brand: str
    model: str
    size_in: Optional[float]
    rms_w: Optional[int]
    price_usd: Optional[float]
    scraped_at: float


def _merge_save(items: List[SonicSubLite]) -> None:
    existing: List[Dict[str, Any]] = []
    if DB_PATH.exists():
        try:
            existing = json.loads(DB_PATH.read_text(encoding="utf-8"))
        except Exception:
            existing = []
    by_url = {d.get("url"): d for d in existing}
    for it in items:
        by_url[it.url] = asdict(it)
    DB_PATH.write_text(json.dumps(list(by_url.values()), indent=2), encoding="utf-8")


def _extract_product_links(html: str) -> List[str]:
    soup = BeautifulSoup(html, "html.parser")
    links: List[str] = []
    for a in soup.select('a[href*="/item-"]'):
        href = a.get("href") or ""
        # Basic de-dup; skip bundle anchors
        if href and href.startswith("/item-"):
            href = LISTING_BASE + href.split('#')[0]
            links.append(href)
    return sorted(set(links))


def _clean_brand_model(text: str) -> tuple[str, str]:
    """Split raw title into brand + model; strip TM/branding artifacts and excessive whitespace.

    Removes common trademark symbols and collapses double spaces. If no space found,
    brand left empty and entire string treated as model.
    """
    raw = re.sub(r"[®™©]\s*", " ", text).strip()
    raw = re.sub(r"\s+", " ", raw)
    if " " not in raw:
        return "", raw
    parts = raw.split(" ", 1)
    return parts[0].strip(), parts[1].strip()

def _parse_product(html: str, url: str) -> SonicSubLite:
    soup = BeautifulSoup(html, "html.parser")
    title = soup.select_one("h1")
    title_text = (title.get_text(" ", strip=True) if title else "").strip()
    brand, model = _clean_brand_model(title_text)
    specs_blob = " ".join(t.get_text(" ", strip=True) for t in soup.select(".specs, table, .features"))
    size_in = None
    for pat in (SIZE_PAT,):
        m = pat.search(specs_blob) or pat.search(title_text)
        if m:
            try:
                size_in = float(m.group(1))
                break
            except Exception:
                pass
    rms_w = None
    m = RMS_PAT.search(specs_blob)
    if m:
        try:
            rms_w = int(m.group(1))
        except Exception:
            pass
    price_usd = None
    price_node = soup.select_one('[class*="price"], .price, .sale-price')
    if price_node:
        txt = price_node.get_text(" ", strip=True).replace(",", "")
        pm = PRICE_PAT.search(txt)
        if pm:
            try:
                price_usd = float(pm.group(1))
            except Exception:
                pass
    return SonicSubLite(
        source="sonic",
        url=url,
        brand=brand,
        model=model,
        size_in=size_in,
        rms_w=rms_w,
        price_usd=price_usd,
        scraped_at=time.time(),
    )


def _delay():
    if DISABLE_JITTER:
        return BASE_DELAY
    return BASE_DELAY + random.uniform(JITTER_MIN, JITTER_MAX)

@router.get("/subwoofers")
async def sonic_subwoofers(pages: int = Query(1, ge=1, le=5), category: str = Query(CATEGORY_8)):
    """Scrape Sonic Electronix category listing and product pages.

    Parameters:
      pages: Number of category pages to attempt (pagination may be limited; simple heuristic).
      category: Relative category path (default 8-inch subs).
    """
    scraper = cloudscraper.create_scraper()
    items: List[SonicSubLite] = []
    current_url = LISTING_BASE + category
    for _ in range(pages):
        try:
            resp = scraper.get(current_url)
            if resp.status_code != 200:
                break
        except Exception as e:
            raise HTTPException(500, f"listing fetch failed: {e}")
        links = _extract_product_links(resp.text)
        # polite delay after listing fetch
        time.sleep(_delay())
        for link in links[:60]:  # soft cap per page to avoid huge fan-out
            try:
                pr = scraper.get(link)
                if pr.status_code != 200:
                    continue
                items.append(_parse_product(pr.text, link))
                time.sleep(_delay())  # per product delay
            except Exception:
                continue
        # naive pagination: look for rel=next
        soup = BeautifulSoup(resp.text, "html.parser")
        nxt = soup.select_one('a[rel="next"], a.pagination-next')
        if nxt and nxt.get('href') and nxt['href'].startswith('/'):
            current_url = LISTING_BASE + nxt['href']
        else:
            break
    _merge_save(items)
    return {"total": len(items), "items": [asdict(i) for i in items]}

__all__ = ["router"]
