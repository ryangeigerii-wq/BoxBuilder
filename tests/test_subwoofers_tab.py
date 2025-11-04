import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_subwoofer_cutout_endpoint_basic():
    resp = client.get('/subwoofers/cutout/12')
    assert resp.status_code == 200
    data = resp.json()
    assert data['nominal_size'] == 12
    assert 'cutout_diameter' in data
    assert 'estimated' in data
    assert data['disclaimer'].startswith('Default cutout diameters')


def test_subwoofer_cutout_with_actual_spec_override():
    # Provide actual_spec different from heuristic (e.g., 11.125 for a 12 nominal)
    resp = client.get('/subwoofers/cutout/12', params={'actual_spec': 11.125})
    assert resp.status_code == 200
    data = resp.json()
    assert data['nominal_size'] == 12
    assert data['cutout_diameter'] == 11.125
    assert data['estimated'] is False
