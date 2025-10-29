"""Orchestrates fetching and parsing subwoofer data."""
from typing import List
from app.scraping.fetcher import fetch_html
from app.scraping.parser import parse_subwoofers
from app.schemas.subwoofer import SubwooferSchema


async def collect_subwoofers(urls: List[str]) -> List[SubwooferSchema]:
    results: List[SubwooferSchema] = []
    for url in urls:
        html = await fetch_html(url)
        if not html:
            continue
        results.extend(parse_subwoofers(html, source=url))
    return results
