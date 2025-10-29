from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_box_builder_includes_main_script_only():
    resp = client.get('/box-builder')
    assert resp.status_code == 200
    html = resp.text
    # Should include primary builder script
    assert '/static/js/box_builder.js' in html
    # Should not include lemonade vendor anymore
    assert 'lemonade.min.js' not in html
