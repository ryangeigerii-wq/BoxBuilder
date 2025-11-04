import json, os, time
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_create_and_list_preset(tmp_path, monkeypatch):
    # Redirect data directory to temp so test isolated
    monkeypatch.chdir(tmp_path)
    # Force directory
    os.makedirs('data', exist_ok=True)
    # Create preset
    payload = {
        'name': 'Test Sealed 12',
        'config': {
            'width': 32,
            'height': 16,
            'depth': 14,
            'wallThickness': 0.75,
            'subSize': 12,
            'layout': 'single',
            'holes': [{ 'dx':0, 'dy':0, 'nominal':12, 'filled': False }],
            'finish': 'espresso',
            'port': { 'enabled': False, 'type': 'slot', 'count':1 }
        }
    }
    r = client.post('/presets', json=payload)
    assert r.status_code == 200, r.text
    data = r.json()['preset']
    assert data['id']
    pid = data['id']
    # List
    r2 = client.get('/presets')
    assert r2.status_code == 200
    listing = r2.json()
    assert listing['total'] == 1
    assert listing['items'][0]['id'] == pid
    # Get
    r3 = client.get(f'/presets/{pid}')
    assert r3.status_code == 200
    got = r3.json()
    assert got['config']['width'] == 32


def test_update_and_delete_preset(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    os.makedirs('data', exist_ok=True)
    # Create initial
    r = client.post('/presets', json={ 'name': 'Orig', 'config': { 'width':10,'height':10,'depth':10,'wallThickness':0.75,'holes':[{'dx':0,'dy':0,'nominal':10,'filled':False}] } })
    pid = r.json()['preset']['id']
    # Update
    r2 = client.put(f'/presets/{pid}', json={ 'name': 'Updated', 'config': { 'width':11,'height':10,'depth':10,'wallThickness':0.75,'holes':[{'dx':0,'dy':0,'nominal':10,'filled':False}] } })
    assert r2.status_code == 200
    upd = r2.json()['preset']
    assert upd['name'] == 'Updated'
    assert upd['config']['width'] == 11
    # Delete
    r3 = client.delete(f'/presets/{pid}')
    assert r3.status_code == 200
    r4 = client.get('/presets')
    assert r4.status_code == 200
    assert r4.json()['total'] == 0
    # 404 on get after delete
    r5 = client.get(f'/presets/{pid}')
    assert r5.status_code == 404
