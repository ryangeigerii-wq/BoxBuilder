from app.scraping.sites.crutchfield import _parse_price


def test_parse_price_basic():
    assert _parse_price("$199.99") == 199.99
    assert _parse_price("199") == 199.0
    assert _parse_price("$1,299.50") == 1299.50
    assert _parse_price("No price") is None
