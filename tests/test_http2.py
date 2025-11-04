import pytest

pytestmark = pytest.mark.skip(reason="Crutchfield integration removed; HTTP/2 scraper tests retired")

def test_removed_placeholder():
    assert True
