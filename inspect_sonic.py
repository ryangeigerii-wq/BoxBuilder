import cloudscraper
from bs4 import BeautifulSoup

s = cloudscraper.create_scraper()
r = s.get('https://www.sonicelectronix.com/ci59-8-car-subwoofers.html')
soup = BeautifulSoup(r.text, 'html.parser')

print(f"Status: {r.status_code}")
print(f"Page length: {len(r.text)}")
print()

# Find product links
links = soup.select('a[href*="/item"]')
print(f"Found {len(links)} /item links")
for l in links[:5]:
    print(f"  {l.get('href')}")
print()

# Look for product containers
containers = soup.select('[class*="product-"]')
print(f"Found {len(containers)} elements with 'product-' class")

# Check for specific patterns
item_cards = soup.select('.item-card, .product-card, [data-product]')
print(f"Found {len(item_cards)} card elements")
print()

# Show first link details
if links:
    first = links[0]
    print("First link details:")
    print(f"  href: {first.get('href')}")
    print(f"  text: {first.get_text().strip()[:100]}")
    print(f"  parent: {first.parent.name}")
