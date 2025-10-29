"""Simple smoke test script.
Run: python smoke.py
"""
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

print("/health =>", client.get("/health").status_code)
print("/ =>", client.get("/").status_code)
print("/boxes/create-box =>", client.get("/boxes/create-box").status_code)
resp = client.post("/boxes/create", json={"width": 2, "height": 3, "depth": 4})
print("/boxes/create =>", resp.status_code, resp.json())
