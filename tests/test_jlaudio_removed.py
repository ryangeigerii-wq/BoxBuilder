import pytest

pytestmark = pytest.mark.skip(reason="JL Audio manufacturer scrape removed; endpoint /subwoofers/jlaudio retired")

def test_jlaudio_removed_placeholder():
    assert True
