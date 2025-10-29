from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_index_no_framework_script():
    resp = client.get('/')
    assert resp.status_code == 200
    html = resp.text
    # Confirm absence of lemonade framework
    assert 'lemonade.min.js' not in html
    # Basic sanity: page title content
    assert 'Box Builder Home' in html
