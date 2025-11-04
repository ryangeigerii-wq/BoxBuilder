"""Debug script to inspect Sundown HTML structure."""
import asyncio
from app.scraping.sundown import _fetch_html, SUNDOWN_PAGE
from bs4 import BeautifulSoup

async def debug_sundown():
    print("Fetching Sundown page...")
    html = await _fetch_html(SUNDOWN_PAGE)
    
    if not html:
        print("❌ Failed to fetch HTML")
        return
    
    print(f"✓ Fetched {len(html):,} chars")
    
    soup = BeautifulSoup(html, "html.parser")
    
    # Look for 8" mentions
    print("\n=== Searching for 8\" mentions ===")
    text_content = soup.get_text()
    eight_mentions = []
    for line in text_content.split('\n'):
        if '8"' in line or '8-inch' in line or '8 inch' in line:
            cleaned = line.strip()
            if cleaned and len(cleaned) < 200:
                eight_mentions.append(cleaned)
    
    print(f"Found {len(eight_mentions)} lines mentioning 8\":")
    for mention in eight_mentions[:10]:
        print(f"  {mention}")
    
    # Check common selectors
    print("\n=== Checking common product selectors ===")
    selectors = [
        ("a[href*='subwoofer']", "Links with 'subwoofer'"),
        (".product", "Class 'product'"),
        (".ProductItem", "Class 'ProductItem'"),
        ("div[class*='product']", "Divs with 'product' in class"),
        ("a[href*='/products/']", "Product page links"),
        ("[data-product]", "Elements with data-product attr"),
    ]
    
    for selector, desc in selectors:
        found = soup.select(selector)
        print(f"  {desc}: {len(found)} elements")
        if found and len(found) <= 20:
            for elem in found[:3]:
                text = elem.get_text(" ", strip=True)[:80]
                href = elem.get('href', '')[:60] if elem.name == 'a' else ''
                print(f"    → {text} {href}")
    
    # Check for specific product names
    print("\n=== Known Sundown 8\" models ===")
    known_models = ["SA-8", "X-8", "U-8", "E-8", "Zv5-8", "SD-8"]
    for model in known_models:
        count = text_content.count(model)
        print(f"  {model}: {count} mentions")
    
    # Save sample HTML for inspection
    with open("debug_sundown_sample.html", "w", encoding="utf-8") as f:
        # Save first 50k chars
        f.write(html[:50000])
    print("\n✓ Saved first 50k chars to debug_sundown_sample.html")

if __name__ == "__main__":
    asyncio.run(debug_sundown())
