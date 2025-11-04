import pytest

base_payload = {
    "width": 18.0,
    "height": 12.0,
    "depth": 10.0,
    "wall_thickness": 0.75,
    "include_ports": False,
    "include_bracing": False,
    "join_style": "front_back_overlap",
    "kerf_thickness": 0.125
}

@pytest.mark.parametrize("endpoint,content_type_start,header_snippet", [
    ("/export/svg", "image/svg+xml", "<svg"),  # full cutsheet SVG
    ("/export/dxf", "application/dxf", "0\nSECTION"),  # full cutsheet DXF
    ("/export/basic-svg", "image/svg+xml", "<svg"),  # basic placeholder SVG
    ("/export/basic-dxf", "application/dxf", "0\nSECTION"),  # basic placeholder DXF
])
def test_vector_exports(client, endpoint, content_type_start, header_snippet):
    r = client.post(endpoint, json=base_payload)
    assert r.status_code == 200, r.text
    ct = r.headers.get("content-type", "")
    assert ct.startswith(content_type_start), ct
    body = r.content.decode('utf-8', errors='ignore')
    head_slice = body[:120]
    if header_snippet == "<svg":
        assert "<svg" in head_slice, head_slice
    else:
        assert header_snippet in head_slice, head_slice

