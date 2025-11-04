import asyncio
from app.scraping.sundown import _fetch_html, _parse_models, SUNDOWN_PAGE

async def main():
    html = await _fetch_html(SUNDOWN_PAGE)
    items = _parse_models(html)
    print(f'Found {len(items)} items:')
    for i in items:
        print(f"  - {i['model']} ({i['url']})")

asyncio.run(main())
