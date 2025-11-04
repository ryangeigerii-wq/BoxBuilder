import json, os
from pathlib import Path
from fastapi.testclient import TestClient
from main import get_application

app = get_application()
client = TestClient(app)
DB_PATH = Path('data/subwoofers.json')

def seed_test_db():
    items = [
        {
            "source": "crutchfield", "url": "https://example.com/p_111/Test-Sub-X.html", "brand": "BrandX", "model": "ModelX", "size_in": 10.0,
            "rms_w": 400, "peak_w": None, "impedance_ohm": None, "sensitivity_db": None, "mounting_depth_in": None, "cutout_diameter_in": None,
            "displacement_cuft": None, "recommended_box": None, "price_usd": 150.0, "image": None, "scraped_at": 123456.0
        },
        {
            "source": "sonic", "url": "https://sonic.example/item-1", "brand": "CleanBrand", "model": "Alpha10", "size_in": 10.0,
            "rms_w": 600, "peak_w": None, "impedance_ohm": None, "sensitivity_db": None, "mounting_depth_in": None, "cutout_diameter_in": None,
            "displacement_cuft": None, "recommended_box": None, "price_usd": 199.0, "image": None, "scraped_at": 123457.0
        },
        {
            "source": "sonic", "url": "https://sonic.example/item-2", "brand": "CleanBrand", "model": "Beta8", "size_in": 8.0,
            "rms_w": 350, "peak_w": None, "impedance_ohm": None, "sensitivity_db": None, "mounting_depth_in": None, "cutout_diameter_in": None,
            "displacement_cuft": None, "recommended_box": None, "price_usd": 129.0, "image": None, "scraped_at": 123458.0
        }
    ]
    DB_PATH.parent.mkdir(exist_ok=True, parents=True)
    DB_PATH.write_text(json.dumps(items, indent=2), encoding='utf-8')


def test_purge_endpoint_removes_crutchfield_and_test_entries():
    seed_test_db()
    r = client.post('/subwoofers/purge')
    assert r.status_code == 200
    data = r.json()
    assert data['removed'] == 1  # only the single crutchfield BrandX test record
    assert data['after'] == 2
    # DB should reflect removal
    stored = json.loads(DB_PATH.read_text(encoding='utf-8'))
    assert all(it['source'] != 'crutchfield' for it in stored)


def test_picker_endpoint_returns_condensed_sorted():
    seed_test_db()
    # Purge first to ensure no crutchfield leftovers
    client.post('/subwoofers/purge')
    r = client.get('/subwoofers/picker?limit=5')
    assert r.status_code == 200
    payload = r.json()
    assert 'items' in payload
    items = payload['items']
    # Fields limited to condensed set
    assert all(set(i.keys()) == {"brand", "model", "size_in", "rms_w", "price_usd", "source", "url"} for i in items)
    # Sorting: size desc then rms desc -> first item should be size 10 (Alpha10)
    assert items[0]['model'] == 'Alpha10'
    # 8" item should appear after 10" ones
    models_order = [i['model'] for i in items]
    assert models_order.index('Beta8') > models_order.index('Alpha10')
