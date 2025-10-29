"""Parsing logic for subwoofer HTML pages."""
from typing import List
from bs4 import BeautifulSoup
from app.schemas.subwoofer import SubwooferSchema


# These are heuristic CSS selectors; you'll adapt them to real target sites.
NAME_SELECTORS = [".product-title", "h1", ".listing-title"]
PRICE_SELECTORS = [".price", ".product-price", "span.price"]
SIZE_SELECTORS = [".spec-size", "li.size", "td:contains('Size')"]
RMS_SELECTORS = [".spec-rms", "li.rms", "td:contains('RMS')"]
MAX_SELECTORS = [".spec-max", "li.max", "td:contains('Peak')"]


def _first_text(soup: BeautifulSoup, selectors: List[str]) -> str:
    for sel in selectors:
        el = soup.select_one(sel)
        if el and el.get_text(strip=True):
            return el.get_text(strip=True)
    return ""


def parse_subwoofers(html: str, source: str = "unknown") -> List[SubwooferSchema]:
    """Extract a list of subwoofers from a page's HTML.

    For now this treats the entire page as a single product if no list detected.
    Later you can add list/container detection.
    """
    soup = BeautifulSoup(html, "html.parser")

    # Simple heuristic: look for repeated product card containers
    product_cards = soup.select(".product-card, .item, .product")

    results: List[SubwooferSchema] = []
    if product_cards:
        for card in product_cards:
            name = _first_text(card, NAME_SELECTORS)
            price_raw = _first_text(card, PRICE_SELECTORS)
            price = _extract_price(price_raw)
            results.append(SubwooferSchema(name=name or "Unknown", price=price, source=source))
    else:
        # Fallback: single page product
        name = _first_text(soup, NAME_SELECTORS) or "Unknown"
        price_raw = _first_text(soup, PRICE_SELECTORS)
        price = _extract_price(price_raw)
        results.append(SubwooferSchema(name=name, price=price, source=source))

    return results


def _extract_price(text: str) -> float | None:
    import re

    if not text:
        return None
    match = re.search(r"([$]?)(\d+[\.,]?\d*)", text)
    if not match:
        return None
    number = match.group(2).replace(",", "")
    try:
        return float(number)
    except ValueError:
        return None
