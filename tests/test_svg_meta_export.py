from app.core.svg_meta_export import build_front_panel_svg
from xml.etree import ElementTree as ET

def test_svg_meta_export_hole_meta_presence():
    holes = [
        {"dx": 0.0, "dy": 0.0, "nominal": 12.0, "cut": None},
        {"dx": -4.0, "dy": 2.5, "nominal": 8.0, "cut": 7.4},
        {"dx": 5.0, "dy": -3.0, "nominal": 10.0, "cut": None},
    ]
    svg = build_front_panel_svg(30.0, 20.0, holes)
    # Parse SVG
    root = ET.fromstring(svg)
    meta_circles = [
        el for el in root.findall('.//{http://www.w3.org/2000/svg}circle')
        if 'hole-meta' in (el.get('class') or '')
    ]
    # Expect all 3 holes in metadata (legacy per-hole cutOut flag removed; uniform treatment)
    assert len(meta_circles) == 3
    # Validate data attributes and heuristic diameters (diameter still based on explicit cut or 0.93 * nominal)
    # Hole 1 nominal 12 -> 11.16 dia
    first_attr = meta_circles[0].get('data-hole-dia-in')
    assert first_attr is not None
    first_dia = float(first_attr)
    assert abs(first_dia - 11.16) < 0.01
    # Hole 2 explicit cut 7.4
    second_attr = meta_circles[1].get('data-hole-dia-in')
    assert second_attr is not None
    second_dia = float(second_attr)
    assert abs(second_dia - 7.4) < 0.01
    # Hole 3 nominal 10 -> 9.3 dia
    third_attr = meta_circles[2].get('data-hole-dia-in')
    assert third_attr is not None
    third_dia = float(third_attr)
    assert abs(third_dia - 9.3) < 0.01
