from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator
from io import BytesIO
from typing import List
import math
from pathlib import Path
from app.core.paths import get_export_path

try:
    from reportlab.lib.pagesizes import letter  # type: ignore
    from reportlab.pdfgen import canvas  # type: ignore
    from reportlab.lib.units import inch  # type: ignore
except Exception:  # pragma: no cover - missing dependency case
    letter = (612, 792)  # type: ignore
    canvas = None  # type: ignore
    inch = 72  # type: ignore

router = APIRouter(prefix="/export", tags=["export"])


class CutSheetRequest(BaseModel):
    width: float
    height: float
    depth: float
    wall_thickness: float = 0.75
    include_ports: bool = False
    include_bracing: bool = False
    join_style: str = "front_back_overlap"  # options: front_back_overlap | side_overlap
    slot_port_height: float | None = None  # if slot port panels needed
    slot_port_width: float | None = None
    num_slot_ports: int | None = None
    brace_strip_width: float = 2.0  # width of brace strips if include_bracing
    brace_count: int = 0  # number of vertical brace strips
    kerf_thickness: float = 0.125  # saw blade thickness (inches) used for spacing

    @field_validator("width", "height", "depth", "wall_thickness")
    def positive(cls, v: float, info):  # type: ignore[override]
        if v <= 0:
            raise ValueError(f"{info.field_name} must be > 0")
        return v
    @field_validator("kerf_thickness")
    def kerf_non_negative(cls, v: float):  # type: ignore[override]
        if v < 0:
            raise ValueError("kerf_thickness must be >= 0")
        return v


class Panel(BaseModel):
    name: str
    w: float  # width in inches
    h: float  # height in inches
    can_rotate: bool = True  # rotation allowed for packing
    material: str = "MDF"
    notes: str | None = None

    @property
    def area(self) -> float:
        return self.w * self.h


class PackedPanel(BaseModel):
    name: str
    x: float
    y: float
    w: float
    h: float
    rotated: bool
    sheet_index: int


class CutSheetResult(BaseModel):
    panels: List[Panel]
    packed: List[PackedPanel]
    sheet_utilization_pct: float
    sheets_used: int
    sheet_w: float = 96.0
    sheet_h: float = 48.0
    kerf_thickness: float = 0.125


class HoleSpec(BaseModel):
    dx: float  # center offset X from panel center (inches)
    dy: float  # center offset Y from panel center (inches)
    nominal: float
    cut: float | None = None  # explicit cut diameter; if absent use heuristic 0.93× nominal

    @property
    def diameter(self) -> float:
        """Effective hole diameter (heuristic fallback)."""
        return self.cut if self.cut and self.cut > 0 else self.nominal * 0.93

class HoleCutSheetRequest(BaseModel):
    panel_width: float
    panel_height: float
    holes: List[HoleSpec]

    @field_validator("panel_width", "panel_height")
    def positive_panel(cls, v: float, info):  # type: ignore[override]
        if v <= 0:
            raise ValueError(f"{info.field_name} must be > 0")
        return v

class HoleCutSheetResponse(BaseModel):
    panel_width: float
    panel_height: float
    hole_count: int
    holes: List[dict]  # each: {cx, cy, dia}
    note: str | None = None


def derive_panels(req: CutSheetRequest) -> List[Panel]:
    """Derive panel cut sizes considering join style.
    join_style definitions:
      front_back_overlap: Front/Back cover the full left-right width; Sides (Left/Right) are depth x height; Top/Bottom same width x depth.
      side_overlap: Left/Right cover the full height & depth; Front/Back width reduced by 2 * wall_thickness; Top/Bottom width reduced similarly.
    Assumes provided width/height/depth are exterior.
    """
    w = req.width
    h = req.height
    d = req.depth
    t = req.wall_thickness
    panels: List[Panel] = []
    if req.join_style == "front_back_overlap":
        panels.extend([
            Panel(name="Front", w=w, h=h, can_rotate=False, notes="Driver cutouts here"),
            Panel(name="Back", w=w, h=h),
            Panel(name="Left", w=d, h=h),
            Panel(name="Right", w=d, h=h),
            Panel(name="Top", w=w, h=d),
            Panel(name="Bottom", w=w, h=d),
        ])
    elif req.join_style == "side_overlap":
        inner_w = w - 2 * t
        if inner_w <= 0:
            raise HTTPException(status_code=400, detail="Width too small for selected join style and wall thickness")
        panels.extend([
            Panel(name="Front", w=inner_w, h=h, can_rotate=False, notes="Driver cutouts here"),
            Panel(name="Back", w=inner_w, h=h),
            Panel(name="Left", w=d, h=h),
            Panel(name="Right", w=d, h=h),
            Panel(name="Top", w=inner_w, h=d),
            Panel(name="Bottom", w=inner_w, h=d),
        ])
    else:
        raise HTTPException(status_code=400, detail=f"Unknown join_style {req.join_style}")
    # Optional slot port panels (tall divider style)
    if req.include_ports and req.slot_port_height and req.slot_port_width and req.num_slot_ports:
        for i in range(req.num_slot_ports):
            panels.append(Panel(name=f"SlotPortWall{i+1}", w=req.slot_port_width, h=req.slot_port_height, notes="Slot port divider"))
    # Optional brace strips (simple vertical braces)
    if req.include_bracing and req.brace_count > 0:
        brace_h = h - 2 * t  # internal height approximation
        if brace_h <= 0:
            brace_h = h
        for i in range(req.brace_count):
            panels.append(Panel(name=f"Brace{i+1}", w=req.brace_strip_width, h=brace_h, notes="Vertical brace strip"))
    return panels


def pack_panels_maxrect(panels: List[Panel], sheet_w: float, sheet_h: float, kerf: float) -> List[PackedPanel]:
    """Maximal-rectangles style bin packing (simplified):
    - Maintains a list of free rectangles per sheet.
    - Places each panel into the first free rect where it fits (optionally rotated) with kerf spacing applied.
    - Splits the free rectangle into up to two new free rectangles (guillotine split).
    - Starts new sheet when no placement possible.
    Kerf compensation: panel is inflated by kerf in both dimensions for fit test; placement coordinates represent actual panel (not inflated), but subsequent free space subtracts kerf gap.
    """
    remaining = panels[:]
    # Sort by descending area for better packing
    remaining.sort(key=lambda p: p.area, reverse=True)
    packed: List[PackedPanel] = []
    sheet_index = 0
    free_rects: List[tuple[float,float,float,float,int]] = [(0.0, 0.0, sheet_w, sheet_h, sheet_index)]  # x,y,w,h,sheet

    def add_sheet():
        nonlocal sheet_index, free_rects
        sheet_index += 1
        free_rects.append((0.0, 0.0, sheet_w, sheet_h, sheet_index))

    while remaining:
        p = remaining.pop(0)
        placed = False
        for idx, (fx, fy, fw, fh, sidx) in enumerate(free_rects):
            # Try non-rotated then rotated
            for rot in (False, True) if p.can_rotate else (False,):
                pw = p.h if rot else p.w
                ph = p.w if rot else p.h
                test_w = pw + kerf
                test_h = ph + kerf
                if test_w <= fw and test_h <= fh:
                    # Place panel
                    packed.append(PackedPanel(name=p.name, x=fx, y=fy, w=pw, h=ph, rotated=rot, sheet_index=sidx))
                    placed = True
                    # Split free rect: create right and bottom rectangles (guillotine)
                    right_w = fw - test_w
                    right_h = test_h
                    bottom_w = fw
                    bottom_h = fh - test_h
                    # Remove used rect
                    free_rects.pop(idx)
                    # Add new free rects if they have positive area
                    if right_w > 0 and right_h > 0:
                        free_rects.append((fx + test_w, fy, right_w, right_h, sidx))
                    if bottom_w > 0 and bottom_h > 0:
                        free_rects.append((fx, fy + test_h, bottom_w, bottom_h, sidx))
                    break
            if placed:
                break
        if not placed:
            # Start new sheet and retry this panel
            add_sheet()
            remaining.insert(0, p)  # retry with new sheet at front
    return packed


def compute_utilization(packed: List[PackedPanel], sheet_w: float, sheet_h: float) -> float:
    if not packed:
        return 0.0
    sheets = max(p.sheet_index for p in packed) + 1
    used_area = sum(p.w * p.h for p in packed)
    return (used_area / (sheets * sheet_w * sheet_h)) * 100.0


def render_pdf(result: CutSheetResult) -> bytes:
    # Lazy import to reduce import-time errors if dependency missing
    if canvas is None:
        # Fallback: minimal valid PDF skeleton with one page and text note
        # This is NOT a full-featured export but allows tests to proceed in environments
        # without reportlab installed.
        minimal = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 44>>stream\nBT /F1 12 Tf 20 100 Td (PDF fallback: install reportlab) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000061 00000 n \n0000000116 00000 n \n0000000250 00000 n \n0000000372 00000 n \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n450\n%%EOF"
        return minimal
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)  # type: ignore[arg-type]
    # Page 1: Overview
    c.setFont("Helvetica-Bold", 16)
    c.drawString(72, 750, "Enclosure Overview")
    c.setFont("Helvetica", 12)
    # Identify base exterior dims from panels (Front width/height; depth from Top panel height)
    front_panel = next((p for p in result.panels if p.name == "Front"), result.panels[0])
    top_panel = next((p for p in result.panels if p.name == "Top"), result.panels[-1])
    depth_val = top_panel.h
    c.drawString(72, 730, f"Exterior (WxHxD): {front_panel.w:.2f} x {front_panel.h:.2f} x {depth_val:.2f} in")
    c.drawString(72, 712, f"Join Style: {('Front/Back overlap' if front_panel.w == result.sheet_w else 'Side overlap')}")
    c.drawString(72, 694, f"Sheets Used: {result.sheets_used} | Utilization: {result.sheet_utilization_pct:.1f}%")
    c.drawString(72, 678, f"Kerf: {getattr(result, 'kerf_thickness', 0.125):.3f} in")
    # Panel summary list truncated if long
    panel_summary = ', '.join(p.name for p in result.panels[:12])
    if len(result.panels) > 12:
        panel_summary += '…'
    c.setFont("Helvetica", 10)
    c.drawString(72, 662, f"Panels: {panel_summary}")
    # Simple wireframe rectangle (not isometric)
    box_w = result.panels[0].w
    box_h = result.panels[0].h
    scale = 250.0 / max(box_w, box_h)
    bw = box_w * scale
    bh = box_h * scale
    x0 = 72
    y0 = 400
    c.rect(x0, y0, bw, bh)
    c.drawString(x0 + bw/2 - 30, y0 - 14, f"W={box_w:.2f}")
    c.drawString(x0 + bw + 10, y0 + bh/2, f"H={box_h:.2f}")
    c.showPage()

    # Subsequent pages: one per sheet
    sheet_draw_w = 400.0
    scale_base = sheet_draw_w / result.sheet_w
    for sheet_idx in range(result.sheets_used):
        c.showPage()
        c.setFont("Helvetica-Bold", 16)
        c.drawString(72, 750, f"Cut Sheet {sheet_idx+1}/{result.sheets_used} (96x48) Kerf {getattr(result, 'kerf_thickness', 0.125):.3f} in")
        c.setFont("Helvetica", 10)
        origin_x = 72
        origin_y = 300
        sheet_draw_h = result.sheet_h * scale_base
        c.rect(origin_x, origin_y, sheet_draw_w, sheet_draw_h)
        for p in result.packed:
            if p.sheet_index != sheet_idx:
                continue
            px = origin_x + p.x * scale_base
            py = origin_y + p.y * scale_base
            pw = p.w * scale_base
            ph = p.h * scale_base
            c.rect(px, py, pw, ph)
            label = f"{p.name} {p.w:.1f}x{p.h:.1f}{' R' if p.rotated else ''}"
            c.drawString(px + 2, py + ph/2, label)
    c.save()
    buf.seek(0)
    return buf.read()


def render_svg(result: CutSheetResult) -> str:
    """Render a multi-sheet SVG layout. Each sheet becomes a <g> group with a border
    and child rectangles for panels. Coordinates are in pixels; we scale inches by 10px.
    Adds simple labels and kerf annotation in a <text> element per sheet.
    """
    scale = 10.0  # 1 inch = 10 px
    sheet_w_px = result.sheet_w * scale
    sheet_h_px = result.sheet_h * scale
    spacing_px = 40  # gap between sheets
    total_width = result.sheets_used * sheet_w_px + (result.sheets_used - 1) * spacing_px
    total_height = sheet_h_px + 120  # extra area for labels
    parts: List[str] = []
    parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{total_width:.0f}" height="{total_height:.0f}" viewBox="0 0 {total_width:.0f} {total_height:.0f}" font-family="Arial" font-size="12">')
    parts.append(f'<defs><style>.panel{{fill:#eee;stroke:#333;stroke-width:1}} .sheet{{fill:none;stroke:#000;stroke-width:2}} .label{{fill:#000}}</style></defs>')
    parts.append(f'<text x="10" y="20" class="label">Sheets: {result.sheets_used} Utilization: {result.sheet_utilization_pct:.1f}% Kerf: {getattr(result, "kerf_thickness", 0.125):.3f} in</text>')
    for sheet_idx in range(result.sheets_used):
        ox = sheet_idx * (sheet_w_px + spacing_px)
        oy = 40
        parts.append(f'<g id="sheet{sheet_idx+1}" transform="translate({ox:.1f},{oy:.1f})">')
        parts.append(f'<rect class="sheet" x="0" y="0" width="{sheet_w_px:.1f}" height="{sheet_h_px:.1f}" />')
        parts.append(f'<text class="label" x="4" y="-8">Sheet {sheet_idx+1} ({result.sheet_w:.0f}x{result.sheet_h:.0f} in)</text>')
        for p in result.packed:
            if p.sheet_index != sheet_idx:
                continue
            px = p.x * scale
            py = p.y * scale
            pw = p.w * scale
            ph = p.h * scale
            label = f'{p.name} {p.w:.2f}x{p.h:.2f}' + (' R' if p.rotated else '')
            parts.append(f'<rect class="panel" x="{px:.1f}" y="{py:.1f}" width="{pw:.1f}" height="{ph:.1f}" />')
            parts.append(f'<text class="label" x="{px+2:.1f}" y="{py+14:.1f}">{label}</text>')
        parts.append('</g>')
    parts.append('</svg>')
    return '\n'.join(parts)


def render_dxf(result: CutSheetResult) -> str:
    """Render a very small ASCII DXF (R12 style) with LAYER definitions and LINE entities
    for sheet outlines and panel rectangles. Units in inches; each sheet is offset along X.
    """
    lines: List[str] = []
    # HEADER
    lines.extend(['0','SECTION','2','HEADER','0','ENDSEC'])
    # TABLES (define two layers: SHEET and PANEL)
    lines.extend(['0','SECTION','2','TABLES','0','TABLE','2','LAYER','70','2',
                  '0','LAYER','2','SHEET','70','0','62','7','6','CONTINUOUS',
                  '0','LAYER','2','PANEL','70','0','62','1','6','CONTINUOUS',
                  '0','ENDTAB','0','ENDSEC'])
    # ENTITIES
    lines.extend(['0','SECTION','2','ENTITIES'])
    sheet_offset_gap = 10.0  # inches between sheet origins
    for sheet_idx in range(result.sheets_used):
        offset_x = sheet_idx * (result.sheet_w + sheet_offset_gap)
        # Sheet outline rectangle (4 lines)
        sx = offset_x
        sy = 0.0
        ex = sx + result.sheet_w
        ey = sy + result.sheet_h
        def line_entity(x1,y1,x2,y2,layer):
            lines.extend(['0','LINE','8',layer,'10',f'{x1:.4f}','20',f'{y1:.4f}','30','0.0','11',f'{x2:.4f}','21',f'{y2:.4f}','31','0.0'])
        line_entity(sx, sy, ex, sy, 'SHEET')
        line_entity(ex, sy, ex, ey, 'SHEET')
        line_entity(ex, ey, sx, ey, 'SHEET')
        line_entity(sx, ey, sx, sy, 'SHEET')
        for p in result.packed:
            if p.sheet_index != sheet_idx:
                continue
            px = offset_x + p.x
            py = p.y
            pw = p.w
            ph = p.h
            # Panel rectangle
            line_entity(px, py, px+pw, py, 'PANEL')
            line_entity(px+pw, py, px+pw, py+ph, 'PANEL')
            line_entity(px+pw, py+ph, px, py+ph, 'PANEL')
            line_entity(px, py+ph, px, py, 'PANEL')
    lines.extend(['0','ENDSEC','0','EOF'])
    return '\n'.join(lines)


@router.post("/cutsheet-holes", response_model=HoleCutSheetResponse)
async def export_cutsheet_holes(payload: HoleCutSheetRequest):
    """Return normalized hole center positions and diameters for the front panel cutsheet.
    Coordinates returned as absolute from panel origin: (0,0) top-left, (panel_width,panel_height) bottom-right.
    Input dx/dy are offsets from panel center; we convert to absolute by adding half-width/height.

    Per-hole cutOut (deprecated) removed: all provided holes are returned.
    """
    try:
        holes_out: List[dict] = []
        for h in payload.holes:
            dia = h.diameter
            cx = payload.panel_width / 2 + h.dx
            cy = payload.panel_height / 2 + h.dy
            cx = max(dia / 2, min(payload.panel_width - dia / 2, cx))
            cy = max(dia / 2, min(payload.panel_height - dia / 2, cy))
            holes_out.append({"cx": round(cx, 4), "cy": round(cy, 4), "dia": round(dia, 4)})
        return HoleCutSheetResponse(panel_width=payload.panel_width, panel_height=payload.panel_height, hole_count=len(holes_out), holes=holes_out, note=None)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to derive hole cutsheet: {e}")


@router.post("/pdf")
async def export_pdf(payload: CutSheetRequest):
    try:
        panels = derive_panels(payload)
        packed = pack_panels_maxrect(panels, 96.0, 48.0, payload.kerf_thickness)
        util = compute_utilization(packed, 96.0, 48.0)
        sheets_used = max(p.sheet_index for p in packed) + 1 if packed else 0
        result = CutSheetResult(panels=panels, packed=packed, sheet_utilization_pct=util, sheets_used=sheets_used, kerf_thickness=payload.kerf_thickness)
        pdf_bytes = render_pdf(result)
        # Persist PDF
        target_dir = get_export_path("cut_sheets")
        target_dir.mkdir(parents=True, exist_ok=True)
        fname = f"cutsheet_{sheets_used}sheet.pdf"
        fpath = target_dir / fname
        fpath.write_bytes(pdf_bytes)
        rel = f"output/cut_sheets/{fname}"
        return StreamingResponse(BytesIO(pdf_bytes), media_type="application/pdf", headers={
            "Content-Disposition": f"attachment; filename={fname}",
            "X-Saved-File": rel
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {e}")


@router.post("/svg")
async def export_svg(payload: CutSheetRequest):
    """Generate an SVG layout of the packed panels."""
    try:
        panels = derive_panels(payload)
        packed = pack_panels_maxrect(panels, 96.0, 48.0, payload.kerf_thickness)
        util = compute_utilization(packed, 96.0, 48.0)
        sheets_used = max(p.sheet_index for p in packed) + 1 if packed else 0
        result = CutSheetResult(panels=panels, packed=packed, sheet_utilization_pct=util, sheets_used=sheets_used, kerf_thickness=payload.kerf_thickness)
        svg_text = render_svg(result)
        target_dir = get_export_path("svg_cutsheets")
        target_dir.mkdir(parents=True, exist_ok=True)
        fname = f"cutsheet_{sheets_used}sheet.svg"
        fpath = target_dir / fname
        fpath.write_text(svg_text, encoding='utf-8')
        rel = f"output/svg_cutsheets/{fname}"
        return StreamingResponse(BytesIO(svg_text.encode('utf-8')), media_type="image/svg+xml", headers={
            "Content-Disposition": f"attachment; filename={fname}",
            "X-Saved-File": rel
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate SVG: {e}")


@router.post("/dxf")
async def export_dxf(payload: CutSheetRequest):
    """Generate a simple ASCII DXF (R12-like) of the packed layout."""
    try:
        panels = derive_panels(payload)
        packed = pack_panels_maxrect(panels, 96.0, 48.0, payload.kerf_thickness)
        util = compute_utilization(packed, 96.0, 48.0)
        sheets_used = max(p.sheet_index for p in packed) + 1 if packed else 0
        result = CutSheetResult(panels=panels, packed=packed, sheet_utilization_pct=util, sheets_used=sheets_used, kerf_thickness=payload.kerf_thickness)
        dxf_text = render_dxf(result)
        target_dir = get_export_path("dxf_cutsheets")
        target_dir.mkdir(parents=True, exist_ok=True)
        fname = f"cutsheet_{sheets_used}sheet.dxf"
        fpath = target_dir / fname
        fpath.write_text(dxf_text, encoding='utf-8')
        rel = f"output/dxf_cutsheets/{fname}"
        return StreamingResponse(BytesIO(dxf_text.encode('utf-8')), media_type="application/dxf", headers={
            "Content-Disposition": f"attachment; filename={fname}",
            "X-Saved-File": rel
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate DXF: {e}")

__all__ = ["router"]
