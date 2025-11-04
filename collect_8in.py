"""One-off utility to aggressively collect ~50 8" subwoofers from Crutchfield.

Usage (PowerShell):
    python collect_8in.py

This script widens tolerance progressively if insufficient results are found,
adding items to data/subwoofers.json.
"""
import asyncio, json
from pathlib import Path
from typing import List

from app.api.routes.subwoofers import crawl_crutchfield, parse_product, fetch, LISTING_START, load_db, save_db, Subwoofer
import httpx

TARGET = 50
SIZE = 8.0
BASE_TOLERANCE = 0.25
MAX_TOLERANCE = 0.75
BATCH_PAGES = 10
MAX_CYCLES = 8

async def aggressive_collect():
    collected = {}
    tolerance = BASE_TOLERANCE
    cycles = 0
    next_url = LISTING_START
    async with httpx.AsyncClient(follow_redirects=True, http2=True) as client:
        while cycles < MAX_CYCLES and len(collected) < TARGET and next_url:
            pages_in_cycle = 0
            while pages_in_cycle < BATCH_PAGES and len(collected) < TARGET and next_url:
                try:
                    resp = await fetch(client, next_url)
                except Exception:
                    next_url = None
                    break
                # parse listing urls
                from app.api.routes.subwoofers import parse_listing_urls
                urls, nxt = parse_listing_urls(resp.text)
                pages_in_cycle += 1
                next_url = nxt
                for u in urls:
                    if u in collected:
                        continue
                    try:
                        pr = await fetch(client, u)
                    except Exception:
                        continue
                    sub = parse_product(pr.text, u)
                    if sub.size_in is not None and abs(sub.size_in - SIZE) <= tolerance:
                        collected[u] = sub
                    if len(collected) >= TARGET:
                        break
            cycles += 1
            if len(collected) < TARGET and tolerance < MAX_TOLERANCE:
                tolerance = min(MAX_TOLERANCE, tolerance + 0.1)
    return list(collected.values())

async def main():
    items = await aggressive_collect()
    print(f"Collected {len(items)} candidate 8\" subs.")
    existing = load_db()
    by_url = {i.url: i for i in existing}
    for it in items:
        by_url[it.url] = it
    merged = list(by_url.values())
    save_db(merged)
    # summarize 8" only
    subs8 = [i for i in merged if i.size_in and abs(i.size_in - SIZE) <= MAX_TOLERANCE]
    print(f"Database now contains {len(subs8)} entries within ±{MAX_TOLERANCE} of {SIZE}\".")
    # write a summary file
    summary_path = Path("data/summary_8in.json")
    summary_path.write_text(json.dumps([i.__dict__ for i in subs8], indent=2), encoding="utf-8")
    print(f"Summary written to {summary_path}")

if __name__ == "__main__":
    asyncio.run(main())
