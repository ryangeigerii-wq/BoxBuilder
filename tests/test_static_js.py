from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

JS_PATHS = [
    "/static/js/box_builder.js",
    "/static/js/vendor/lemonade.min.js",
]

def test_static_js_files_accessible():
    for path in JS_PATHS:
        resp = client.get(path)
        assert resp.status_code == 200, f"{path} not accessible (status {resp.status_code})"
        # Basic sanity: file should not be empty
        assert resp.text.strip(), f"{path} returned empty content"
