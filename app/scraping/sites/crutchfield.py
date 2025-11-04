"""Crutchfield subwoofer scraper integrated with existing schemas."""
from typing import List
from bs4 import BeautifulSoup
import httpx
from app.scraping.http_utils import ensure_async_client, aclose_safely
from app.schemas.subwoofer import SubwooferSchema

BASE_URL = "https://www.crutchfield.com"
HEADERS = {"User-Agent": "Mozilla/5.0"}


async def scrape_crutchfield_subwoofers(pages: int = 5) -> List[SubwooferSchema]:
    """Scrape simplified listing cards from Crutchfield.

    Uses HTTP/2 when available for improved connection reuse and header compression.
    Falls back transparently if the remote server does not negotiate h2.
    """
    results: List[SubwooferSchema] = []
    client = await ensure_async_client(headers=HEADERS, timeout=15.0, http2=True)
    try:
        for page in range(1, pages + 1):
            url = f"{BASE_URL}/shopsearch/subwoofers.html?pg={page}"
            try:
                resp = await client.get(url)
            except Exception:
                continue
            if getattr(resp, 'status_code', 200) != 200:
                continue
            soup = BeautifulSoup(getattr(resp, 'text', ''), "html.parser")
            for item in soup.select(".cf-productcard"):
                name_tag = item.select_one(".cf-productcard-title")
                price_tag = item.select_one(".cf-price")
                link_tag = name_tag.get("href") if name_tag else None
                if name_tag and link_tag:
                    name = name_tag.get_text(strip=True)
                    price_text = price_tag.get_text(strip=True) if price_tag else None
                    price = _parse_price(price_text) if price_text else None
                    full_url = BASE_URL + link_tag
                    results.append(
                        SubwooferSchema(
                            name=name,
                            price=price,
                            product_url=full_url,
                            source="crutchfield",
                        )
                    )
    finally:
        await aclose_safely(client)
    return results


def _parse_price(text: str) -> float | None:
    """Extract a price from a string.

    Handles formats like:
    $199.99, 199, $1,299.50, 1,299, 1299.5
    Returns None if no plausible number found.
    """
    import re
    if not text:
        return None
    # Remove currency symbols and whitespace
    cleaned = text.strip().replace("$", "")
    # Regex for number with optional thousands separators and optional decimals
    match = re.search(r"\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b|\b\d+(?:\.\d+)?\b", cleaned)
    if not match:
        return None
    number = match.group(0).replace(",", "")
    try:
        return float(number)
    except ValueError:
        return None
