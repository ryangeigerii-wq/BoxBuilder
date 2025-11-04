import pytest

pytestmark = pytest.mark.skip(reason="Retry/backoff fetch logic removed with Crutchfield purge")

def test_removed_placeholder():
    assert True
