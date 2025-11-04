import json

def test_admin_routes_index(client):
    resp = client.get("/admin/routes")
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data and data["total"] > 0
    assert "routes" in data and isinstance(data["routes"], list)
    # Ensure key endpoints present
    paths = {r["path"] for r in data["routes"] if "path" in r}
    expected = [
        "/subwoofers",  # listing/search
        "/subwoofers/collect/size/{size_in}",
        "/subwoofers/collect/aggressive/{size_in}",
        "/admin/routes",
        # NOTE: Manufacturer-specific routes (JL Audio, Sundown, Crutchfield) removed.
    ]
    for p in expected:
        assert p in paths, f"Missing expected route {p} in /admin/routes index"

    # Spot check one route structure
    admin_meta = next(r for r in data["routes"] if r["path"] == "/admin/routes")
    assert isinstance(admin_meta.get("methods"), list)
    assert "GET" in admin_meta.get("methods", [])