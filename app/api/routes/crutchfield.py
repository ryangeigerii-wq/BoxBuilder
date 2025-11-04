"""Crutchfield scraping router (Python 3.8-safe style).

Provides a direct scrape endpoint reusing minimal dependencies. Separate from the
main subwoofer aggregation logic to keep concerns isolated.
"""

import asyncio
import json
import math
import re
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/crutchfield", tags=["crutchfield"])

# ---------- Storage ----------
DATA_DIR = Path("data")
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "subwoofers.json"

# ---------- Model ----------
@dataclass
class SubwooferLite:
    source: str
    url: str
    brand: str
    model: str
    size_in: Optional[float]
    rms_w: Optional[int]
    price_usd: Optional[float]
    scraped_at: float

# ---------- Helpers ----------
UA_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0",
]
TIMEOUT = 30.0
REQUEST_DELAY = 0.75
REQUEST_JITTER_MIN = 0.10
REQUEST_JITTER_MAX = 0.35
MAX_RETRIES = 3
BACKOFF_BASE = 0.6

SIZE_PAT = re.compile(r'(\d+(?:\.\d+)?)\s*"?\s*(?:in|inch|")', re.I)
RMS_PAT  = re.compile(r'(\d{2,5})\s*w(?:att)?', re.I)
PRICE_PAT = re.compile(r'\$?\s*([0-9]+(?:\.[0-9]{2})?)')

# ---------- Diagnostics ----------
DIAG: Dict[str, Any] = {
    "attempts": 0,
    "successes": 0,
    "errors": 0,
    "protocol": {},
    "latencies": [],
    "total_latency": 0.0,
    "last_error": None,
    "started_at": time.time(),
    "snapshots": []  # appended small status dicts per scrape call
}

def _record_success(resp: httpx.Response, latency: float) -> None:
    DIAG["successes"] += 1
    DIAG["latencies"].append(latency)
    DIAG["total_latency"] += latency
    proto = getattr(resp, "http_version", None) or "unknown"
    DIAG["protocol"].setdefault(proto, 0)
    DIAG["protocol"][proto] += 1

def _record_error(exc: Exception) -> None:
    DIAG["errors"] += 1
    DIAG["last_error"] = f"{type(exc).__name__}: {exc}"[:300]

def _delay() -> float:
    return REQUEST_DELAY + (0 if 'SCRAPER_JITTER_OFF' in os.environ else time.random() if False else 0)  # placeholder to satisfy static analyzers

def _compute_delay() -> float:
    if 'SCRAPER_JITTER_OFF' in os.environ:
        return REQUEST_DELAY
    import random as _r
    return REQUEST_DELAY + _r.uniform(REQUEST_JITTER_MIN, REQUEST_JITTER_MAX)

def build_headers() -> Dict[str, str]:
    import random as _r
    ua = _r.choice(UA_POOL)
    return {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Referer": LISTING_START,
    }

def _float(pat: re.Pattern, text: str) -> Optional[float]:
    m = pat.search(text or "")
    return float(m.group(1)) if m else None

def _int(pat: re.Pattern, text: str) -> Optional[int]:
    m = pat.search(text or "")
    return int(m.group(1)) if m else None

def _clean(t: Optional[str]) -> str:
    return re.sub(r'\s+', ' ', (t or '').strip())

def _save(items: List[SubwooferLite]) -> None:
    # Merge with existing DB (lightweight fields only)
    existing = []
    if DB_PATH.exists():
        try:
            existing = json.loads(DB_PATH.read_text(encoding="utf-8"))
        except Exception:
            existing = []
    by_url = {d.get("url"): d for d in existing}
    for i in items:
        by_url[i.url] = asdict(i)
    DB_PATH.write_text(json.dumps(list(by_url.values()), indent=2), encoding="utf-8")

def _parse_listing_urls(html: str) -> Tuple[List[str], Optional[str]]:
    soup = BeautifulSoup(html, "html.parser")
    urls = []
    for a in soup.select('a[href*="/p_"]'):
        href = a.get("href") or ""
        if "/p_" in href and href.lower().endswith(".html"):
            if href.startswith("/"):
                href = "https://www.crutchfield.com" + href
            urls.append(href)
    next_url = None
    nxt = soup.select_one('a[rel="next"], a.pagination-next, a[aria-label="Next"]')
    if nxt and nxt.get("href"):
        href = nxt["href"]
        next_url = href if href.startswith("http") else "https://www.crutchfield.com" + href
    return sorted(set(urls)), next_url

def _get_text(node) -> Optional[str]:
    if not node:
        return None
    return _clean(node.get_text(" ", strip=True))

def _parse_product(html: str, url: str) -> SubwooferLite:
    soup = BeautifulSoup(html, "html.parser")
    title = _get_text(soup.select_one("h1, .product-title, #productTitle")) or ""
    brand, model = "", ""
    if " " in title:
        parts = title.split(" ", 1)
        brand = parts[0].strip()
        model = parts[1].strip()
    else:
        model = title
    specs_blob = " ".join([t.get_text(" ", strip=True) for t in soup.select("table, .specs, .product-specs, .key-specs")])
    size_in = _float(SIZE_PAT, specs_blob) or _float(SIZE_PAT, title)
    rms_w = _int(RMS_PAT, specs_blob)
    price = None
    pt = _get_text(soup.select_one('[class*=price], .price, .sale-price'))
    if pt:
        m = PRICE_PAT.search(pt.replace(",", ""))
        if m:
            price = float(m.group(1))
    return SubwooferLite(
        source="crutchfield",
        url=url,
        brand=brand,
        model=model,
        size_in=size_in,
        rms_w=rms_w,
        price_usd=price,
        scraped_at=time.time(),
    )

LISTING_START = "https://www.crutchfield.com/g_512/Subwoofers.html"

async def _fetch(client: httpx.AsyncClient, url: str) -> httpx.Response:
    attempt = 0
    last_exc: Optional[Exception] = None
    import random as _r
    while attempt < MAX_RETRIES:
        DIAG["attempts"] += 1
        start = time.perf_counter()
        try:
            resp = await client.get(url, headers=build_headers(), timeout=TIMEOUT)
            latency = time.perf_counter() - start
            resp.raise_for_status()
            _record_success(resp, latency)
            await asyncio.sleep(_compute_delay())
            return resp
        except Exception as exc:
            _record_error(exc)
            last_exc = exc
            attempt += 1
            if attempt >= MAX_RETRIES:
                break
            backoff = BACKOFF_BASE * (2 ** (attempt - 1))
            await asyncio.sleep(backoff)
    raise last_exc if last_exc else RuntimeError("fetch failed")

def _quality(item: SubwooferLite) -> bool:
    """Gate on minimal content quality before persisting.

    Rules (tunable):
    - brand & model non-empty
    - size_in in plausible range (6"–24") or None (will still allow to pass but flagged)
    - skip pages with obviously generic titles (e.g., 'Subwoofer')
    """
    if not item.brand or not item.model:
        return False
    if item.brand.lower() in {"subwoofer", "speaker"}:
        return False
    if item.model.lower() in {"subwoofer", "speaker"}:
        return False
    if item.size_in is not None and not (5.5 <= item.size_in <= 24.5):
        return False
    return True

def _augment_cutout(item: SubwooferLite) -> Dict[str, Any]:
    # Add heuristic cutout diameter metadata for UI consumption.
    cut_dia = None
    estimated = True
    if item.size_in is not None:
        cut_dia = round(item.size_in * 0.93, 3)
    # Return extended dict (non-breaking for existing consumers)
    data = asdict(item)
    data["cutout_diameter_in"] = cut_dia
    data["cutout_estimated"] = estimated if cut_dia is not None else None
    return data

async def _crawl(pages: int) -> List[Dict[str, Any]]:
    items: List[SubwooferLite] = []
    async with httpx.AsyncClient(follow_redirects=True) as client:
        page_url = LISTING_START
        listing_htmls: List[str] = []
        for _ in range(max(1, pages)):
            resp = await _fetch(client, page_url)
            listing_htmls.append(resp.text)
            _, next_url = _parse_listing_urls(resp.text)
            if not next_url:
                break
            page_url = next_url
        product_urls = set()
        for html in listing_htmls:
            urls, _ = _parse_listing_urls(html)
            product_urls.update(urls)
        product_urls = sorted(product_urls)
        for u in product_urls:
            try:
                pr = await _fetch(client, u)
            except Exception:
                continue
            lite = _parse_product(pr.text, u)
            if not _quality(lite):
                continue
            items.append(_augment_cutout(lite))
    return items

@router.get("/subwoofers")
async def list_crutchfield_subwoofers(pages: int = Query(1, ge=1, le=10)):
    """Scrape Crutchfield subwoofer listing + product pages and return lightweight items.

    Fields returned: brand, model, size_in, rms_w, price_usd, source, url, scraped_at.
    Results merged into `data/subwoofers.json` (lite merge: existing richer records preserved by other routers).
    """
    try:
        items = await _crawl(pages=pages)
        # Persist only quality-filtered items; merge maintaining lite schema
        lite_objs = [SubwooferLite(
            source=i.get('source','crutchfield'),
            url=i['url'],
            brand=i.get('brand',''),
            model=i.get('model',''),
            size_in=i.get('size_in'),
            rms_w=i.get('rms_w'),
            price_usd=i.get('price_usd'),
            scraped_at=i.get('scraped_at', time.time())
        ) for i in items]
        _save(lite_objs)
        # Per-size persistence using existing ensure_subwoofer_dirs() layout
        by_size: Dict[int, List[Dict[str, Any]]] = {}
        for rec in items:
            sz = rec.get('size_in')
            if sz is None:
                continue
            norm = int(round(sz))
            by_size.setdefault(norm, []).append(rec)
        root = Path('subwoofers')
        root.mkdir(exist_ok=True)
        for sz, group in by_size.items():
            bucket = root / str(sz)
            bucket.mkdir(parents=True, exist_ok=True)
            # Write/overwrite quality-gated latest file
            (bucket / 'latest.json').write_text(json.dumps(group, indent=2), encoding='utf-8')
        # Diagnostics snapshot appended
        snapshot = {
            "ts": time.time(),
            "pages": pages,
            "returned": len(items),
            "quality_filtered": len(items),
            "diag_attempts": DIAG['attempts'],
            "diag_errors": DIAG['errors'],
        }
        DIAG['snapshots'].append(snapshot)
        return {"total": len(items), "items": items, "diagnostic": snapshot}
    except Exception as e:
        raise HTTPException(500, f"crutchfield scrape failed: {e}")

@router.get('/diagnostics')
async def crutchfield_diagnostics():
    attempts = DIAG['attempts']
    successes = DIAG['successes']
    errors = DIAG['errors']
    latencies = DIAG['latencies']
    avg_latency = (DIAG['total_latency']/successes) if successes else None
    p95 = None
    if latencies:
        sl = sorted(latencies)
        p95 = sl[int(min(len(sl)-1, round(0.95*(len(sl)-1))))]
    return {
        "attempts": attempts,
        "successes": successes,
        "errors": errors,
        "avg_latency": avg_latency,
        "p95_latency": p95,
        "protocol": DIAG['protocol'],
        "last_error": DIAG['last_error'],
        "uptime_sec": time.time() - DIAG['started_at'],
        "snapshots": DIAG['snapshots'][-10:],
    }

__all__ = ["router"]