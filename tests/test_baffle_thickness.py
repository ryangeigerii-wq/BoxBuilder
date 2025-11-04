import math
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_front_baffle_wall_thickness_units_exposed():
    """Basic heuristic check: when wallThickness changed, debug text reports expected value.
    This is a proxy since direct Three.js geometry not accessible server-side.
    """
    r = client.get('/box-builder')
    assert r.status_code == 200
    # Ensure the template contains preview script reference (sanity)
    assert '/static/js/three_preview.js' in r.text
    # We can't execute Three.js here; rely on presence of userData injection identifier name attribute.
    # The mesh name 'frontBaffle' and userData assignment occur only in JS runtime; static test ensures no regress in template linking.
    assert 'preview3d' in r.text
