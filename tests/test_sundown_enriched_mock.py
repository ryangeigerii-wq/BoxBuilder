import json, time, pathlib, re
import pytest

# We avoid real network by monkeypatching internal helpers.

def asyncio_run(coro):
    """Run a coroutine using asyncio.run for Python 3.11+ compatibility.
    This replaces legacy get_event_loop()/run_until_complete usage which
    can raise RuntimeError when no loop is set on Windows.
    """
    import asyncio
    return asyncio.run(coro)


@pytest.mark.parametrize("scenario", ["enriched", "fallback"])
def test_sundown_enriched_and_fallback(monkeypatch, scenario):
    """Parametrized test:
    - enriched: catalog + detail pages succeed; enrichment fields present.
    - fallback: catalog fetch returns None; synthetic items emitted without enrichment fields.
    Ensures fallback does NOT accidentally carry enrichment keys.
    """
    from app.scraping import sundown as sundown_mod
    from app.scraping.sundown import scrape_sundown_eight_full, SUNDOWN_PAGE

    # Common enrichment monkeypatch (only used in enriched scenario)
    async def fake_enrich(url: str):
        return {
            'detail_fetch': True,
            'has_rms': True,
            'has_mount': True,
            'has_price': True,
            'page_chars': 64,
            'enriched_at': 1234567890.0,
        }

    # Fake catalog HTML with two product links referencing 8" subwoofers
    fake_html = '''<html><body>
        <a href="/products/z8-8-subwoofer">Z8 8" Subwoofer</a>
        <a href="/products/sa-8-v3-8-subwoofer">SA-8 V.3 8" Subwoofer</a>
    </body></html>'''

    if scenario == "enriched":
        # Catalog fetch returns HTML; detail fetches return product pages.
        async def fake_fetch(url: str, retries: int = 3, timeout: float = 25.0):
            if url.endswith('sundown-subwoofer-page'):
                return fake_html
            return '<div>RMS: 500W Mounting Depth: 6.0" Price: $249.99</div>'
        monkeypatch.setattr(sundown_mod, '_fetch_html', fake_fetch)
        monkeypatch.setattr(sundown_mod, '_enrich_product', fake_enrich)
        enriched = asyncio_run(scrape_sundown_eight_full(max_models=5, base_delay=0.01, jitter=0.0))
        assert len(enriched) == 2, 'Should parse exactly the two fake products.'
        for rec in enriched:
            # Enrichment fields present
            assert rec.get('detail_fetch') is True
            assert rec.get('has_rms') is True
            assert rec.get('has_mount') is True
            assert rec.get('has_price') is True
            assert rec.get('page_chars') == 64
            # Core fields still correct
            assert rec.get('cutout_diameter_in') == round(8.0 * 0.93, 3)
            assert rec.get('brand') == 'Sundown Audio'
            assert rec.get('size_in') == 8.0
    else:  # fallback scenario
        async def fake_fetch_none(url: str, retries: int = 3, timeout: float = 25.0):
            return None  # Force catalog failure triggering synthetic fallback
        monkeypatch.setattr(sundown_mod, '_fetch_html', fake_fetch_none)
        # Do NOT monkeypatch _enrich_product: it should never be called.
        enriched = asyncio_run(scrape_sundown_eight_full(max_models=5, base_delay=0.01, jitter=0.0))
        # Synthetic fallback list length >= 1
        assert len(enriched) >= 1
        for rec in enriched:
            # Should not contain enrichment fields
            assert 'detail_fetch' not in rec
            assert 'has_rms' not in rec
            assert 'has_mount' not in rec
            assert 'has_price' not in rec
            assert 'page_chars' not in rec
            # Core fields still correct
            assert rec.get('cutout_diameter_in') == round(8.0 * 0.93, 3)
            assert rec.get('brand') == 'Sundown Audio'
            assert rec.get('size_in') == 8.0

    # Persist sample output for manual inspection (overwrites per scenario)
    out_path = pathlib.Path(f'sundown_enriched_mock_{scenario}.json')
    out_path.write_text(json.dumps(enriched, indent=2), encoding='utf-8')
