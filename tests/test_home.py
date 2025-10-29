from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_homepage_loads():
    r = client.get("/")
    assert r.status_code == 200
    html = r.text
    # New template fragments
    expected_fragments = [
        "Box Builder",  # title/header
        "API Docs",  # nav link
        "Health",  # nav link
        "Default Box JSON",  # nav link
        "Workspace",  # workspace section
        "Build Box",  # new button label
    ]
    for fragment in expected_fragments:
        assert fragment in html, f"Missing fragment: {fragment}"
