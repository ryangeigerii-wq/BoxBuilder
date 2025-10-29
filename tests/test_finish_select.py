from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_finish_selector_present():
    r = client.get('/box-builder')
    assert r.status_code == 200
    html = r.text
    assert 'name="finish"' in html, 'Finish select missing'
    for value in ['flat','wood1','wood2','wood3']:
        assert f'value="{value}"' in html, f'Missing finish option {value}'
