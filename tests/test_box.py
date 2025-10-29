from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_create_box_endpoint():
    response = client.get("/boxes/create-box")
    assert response.status_code == 200
    data = response.json()
    assert data["width"] == 12.0
    assert data["height"] == 12.0
    assert data["depth"] == 12.0
