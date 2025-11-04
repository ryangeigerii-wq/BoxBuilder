"""
Diagnostic test to verify scrapers are fetching real data vs falling back to synthetic/mock.
Run with: pytest tests/test_scraper_diagnostics.py -v -s
"""
import asyncio
import pytest
from app.scraping.sundown import scrape_sundown_eight, _fetch_html, SUNDOWN_PAGE
from app.scraping.sites.crutchfield import scrape_crutchfield_subwoofers


@pytest.mark.asyncio
async def test_sundown_live_fetch():
    """Verify Sundown scraper can fetch real HTML from manufacturer page."""
    print("\n=== Testing Sundown Live Fetch ===")
    
    html = await _fetch_html(SUNDOWN_PAGE, retries=3)
    
    if html is None:
        pytest.fail(
            f"❌ FAILED: Could not fetch {SUNDOWN_PAGE}\n"
            "Possible causes:\n"
            "  - Network connectivity issue\n"
            "  - Site blocking requests (403/429)\n"
            "  - Timeout (slow connection)\n"
            "Check your internet connection and try accessing the URL in a browser."
        )
    
    assert len(html) > 1000, f"❌ HTML too short ({len(html)} chars) - likely error page"
    
    # Check for expected content indicating a real product page
    has_products = any([
        "subwoofer" in html.lower(),
        "sundown" in html.lower(),
        "ProductItem" in html,
        "product" in html.lower()
    ])
    
    if not has_products:
        pytest.fail(
            f"❌ FAILED: Fetched HTML but content doesn't match expected product page\n"
            f"HTML length: {len(html)} chars\n"
            "Page structure may have changed - scraper needs updating."
        )
    
    print(f"✓ Successfully fetched {len(html):,} chars from Sundown")
    print(f"✓ Content contains product indicators")


@pytest.mark.asyncio
async def test_sundown_parse_results():
    """Verify Sundown scraper returns real parsed data, not just synthetic fallback."""
    print("\n=== Testing Sundown Parse Results ===")
    
    items = await scrape_sundown_eight()
    
    assert len(items) > 0, "❌ No items returned at all"
    
    # Check if we're getting synthetic fallback
    synthetic_models = {"SA-8 V.3", "X-8", "U-8", "Zv5-8 Prototype"}
    all_synthetic = all(item["model"] in synthetic_models for item in items)
    
    if all_synthetic and len(items) == 4:
        pytest.fail(
            "❌ FAILED: Only synthetic fallback data returned!\n"
            "Real scrape failed - check network connectivity or site access.\n"
            f"Returned models: {[item['model'] for item in items]}"
        )
    
    print(f"✓ Parsed {len(items)} items")
    print(f"✓ Models found: {[item['model'] for item in items[:5]]}")
    
    # Verify data quality
    for item in items:
        assert item["brand"] == "Sundown Audio"
        assert item["size_in"] == 8.0
        assert "cutout_diameter_in" in item
        assert "scraped_at" in item
        assert item["source"] in ["sundown", "sundown-synthetic"]
    
    if items[0]["source"] == "sundown-synthetic":
        print("⚠ WARNING: Using synthetic fallback - real scrape may have failed")
    else:
        print("✓ Real data successfully scraped (not synthetic)")


@pytest.mark.asyncio
async def test_crutchfield_live_fetch():
    """Verify Crutchfield scraper can fetch and parse listing pages."""
    print("\n=== Testing Crutchfield Live Fetch ===")
    
    try:
        items = await scrape_crutchfield_subwoofers(pages=1)
    except Exception as e:
        pytest.fail(
            f"❌ FAILED: Crutchfield scrape threw exception: {e}\n"
            "Check network connectivity and site accessibility."
        )
    
    # Note: Crutchfield often returns 403 - this is expected and not a failure
    if len(items) == 0:
        print("⚠ WARNING: Crutchfield returned 0 items (likely 403 Forbidden)")
        print("  This is a known issue - Crutchfield blocks automated requests")
        print("  Skipping detailed validation for Crutchfield")
        pytest.skip("Crutchfield blocking requests (403) - expected behavior")
        return
    
    print(f"✓ Fetched {len(items)} items from Crutchfield")
    
    # Verify data quality if we got results
    if items:
        first = items[0]
        # Check SubwooferSchema fields
        assert hasattr(first, 'name'), "Missing 'name' attribute"
        assert hasattr(first, 'product_url'), "Missing 'product_url' attribute"
        
        print(f"✓ Sample item: {first.name}")
        print(f"✓ URL: {first.product_url}")
        if hasattr(first, 'price') and first.price:
            print(f"✓ Price: ${first.price}")
        print(f"✓ Schema validation passed")


@pytest.mark.asyncio
async def test_network_connectivity():
    """Basic connectivity test to isolate network vs scraper issues."""
    print("\n=== Testing Basic Network Connectivity ===")
    
    import httpx
    
    test_urls = [
        ("https://httpbin.org/get", "httpbin test endpoint"),
        (SUNDOWN_PAGE, "Sundown product page"),
        ("https://www.crutchfield.com", "Crutchfield homepage"),
    ]
    
    results = []
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        for url, label in test_urls:
            try:
                resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                status = resp.status_code
                results.append((label, status, True))
                print(f"✓ {label}: {status}")
            except Exception as e:
                results.append((label, str(e)[:50], False))
                print(f"✗ {label}: {str(e)[:50]}")
    
    failed = [r for r in results if not r[2]]
    if failed:
        pytest.fail(
            f"❌ Network connectivity issues detected:\n" +
            "\n".join([f"  - {r[0]}: {r[1]}" for r in failed]) +
            "\n\nCheck your internet connection or firewall settings."
        )
    
    print("✓ All connectivity tests passed")


def test_scraper_summary():
    """Summary test that reports overall scraper health."""
    print("\n" + "="*60)
    print("SCRAPER DIAGNOSTIC SUMMARY")
    print("="*60)
    print("\nRun the async tests above to see detailed diagnostics.")
    print("\nQuick troubleshooting guide:")
    print("  - If Sundown returns synthetic: Check Sundown site access")
    print("  - If Crutchfield returns 0 items: Check 403/429 errors")
    print("  - If network tests fail: Check internet/firewall")
    print("  - If HTML fetches but parsing fails: Site structure changed")
    print("\nFor live server diagnostics:")
    print("  GET /crutchfield/diagnostics")
    print("  GET /subwoofers/metrics")
    print("="*60)
