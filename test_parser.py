"""Test the updated Sundown parser."""
import asyncio
from app.scraping.sundown import _fetch_html, SUNDOWN_PAGE
from bs4 import BeautifulSoup
import re

async def test_parser():
    html = await _fetch_html(SUNDOWN_PAGE)
    soup = BeautifulSoup(html, "html.parser")
    
    # Find product links
    product_links = soup.select("a[href*='/products/']")
    print(f"Found {len(product_links)} product links total")
    
    # Filter for 8" subwoofers
    matches = []
    for link in product_links:
        text = link.get_text(" ", strip=True)
        href = link.get('href', '')
        
        # Look for 8" indicators
        has_eight = re.search(r'\b8["\s]|8-inch|8\s+inch', text, re.I)
        
        if has_eight:
            print(f"\n✓ Found 8\" match:")
            print(f"  Text: {text}")
            print(f"  Href: {href}")
            
            # Check filters
            text_lower = text.lower()
            is_amp = 'amplifier' in text_lower or 'fuse' in text_lower or 'wire' in text_lower
            is_sub = 'subwoofer' in text_lower or '8"' in text
            
            print(f"  Is amp/accessory: {is_amp}")
            print(f"  Is subwoofer: {is_sub}")
            
            if not is_amp and is_sub:
                matches.append((text, href))
    
    print(f"\n=== Final matches: {len(matches)} ===")
    for text, href in matches:
        print(f"  {text} → {href}")

asyncio.run(test_parser())
