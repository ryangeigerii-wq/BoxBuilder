"""Minimal SVG export helper for testing hole-meta circles.
Mirrors front panel logic for visible (non-hidden) holes and adds <circle class='hole-meta'> elements.
This is purely for server-side test verification; client buildSvgExport covers UI export.
"""
from typing import List, Dict

def build_front_panel_svg(width: float, height: float, holes: List[Dict]) -> str:
    """Generate a minimal SVG with hole-meta circles. Each hole dict expects:
    { dx, dy, nominal, cut } (legacy per-hole removal flag deprecated).
    dx/dy: center offsets from panel center in inches.
    diameter heuristic: cut if provided else nominal*0.93.
    """
    panel_w = width
    panel_h = height
    parts = [
        f"<svg xmlns='http://www.w3.org/2000/svg' width='{panel_w*10:.0f}' height='{panel_h*10:.0f}' viewBox='0 0 {panel_w:.4f} {panel_h:.4f}' data-panel-width-in='{panel_w:.4f}' data-panel-height-in='{panel_h:.4f}'>",
        f"<rect x='0' y='0' width='{panel_w:.4f}' height='{panel_h:.4f}' fill='#eee' stroke='#333' stroke-width='0.03' />"
    ]
    for h in holes:
        nominal = float(h.get('nominal', 12.0))
        cut = h.get('cut')
        dia = float(cut) if cut and cut > 0 else nominal * 0.93
        cx = panel_w / 2 + float(h.get('dx', 0.0))
        cy = panel_h / 2 + float(h.get('dy', 0.0))
        # Emit metadata without legacy data-hole-cut-out attribute (removed for simplicity).
        parts.append(
            f"<circle class='hole-meta' cx='{cx:.4f}' cy='{cy:.4f}' r='{(dia/2):.4f}' fill='none' stroke='none' "
            f"data-hole-cx-in='{cx:.4f}' data-hole-cy-in='{cy:.4f}' data-hole-dia-in='{dia:.4f}' />"
        )
    parts.append("</svg>")
    return "".join(parts)

__all__ = ["build_front_panel_svg"]
