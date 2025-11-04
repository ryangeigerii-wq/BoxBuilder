"""Application entrypoint for box_builder with Cut Sheet generator.
Run with: uvicorn main:app --reload
"""

from fastapi import FastAPI, Form, Request, Query
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from typing import List, Tuple, Optional
from dataclasses import dataclass

from app.api.routes import api_router
from app.core.config import get_settings
from app.core.paths import ensure_output_dirs
from app.core.paths import get_export_path, ExportType

# -----------------------
# Helpers (local lightweight utilities to reduce duplication)
# -----------------------
def utc_timestamp() -> str:
    from datetime import datetime
    return datetime.utcnow().strftime('%Y%m%d-%H%M%S-%f')

def sha256_hex(text: str) -> str:
    import hashlib
    return hashlib.sha256(text.encode('utf-8')).hexdigest()

def persist_text(kind: ExportType, prefix: str, extension: str, content: str) -> Tuple[str, str, str]:
    """Persist text content under export path kind; returns (filename, rel_path, abs_path).

    rel_path uses segmented directory naming (e.g., output/svg_box/...)."""
    target_dir = get_export_path(kind)
    target_dir.mkdir(parents=True, exist_ok=True)
    fname = f"{prefix}_{utc_timestamp()}.{extension}"
    fpath = target_dir / fname
    fpath.write_text(content, encoding='utf-8')
    rel = f"output/{kind}/{fname}"
    return fname, rel, str(fpath)

def build_download_headers(content_type: str, filename: str, rel_path: str, etag: Optional[str] = None) -> dict:
    headers = {
        "Content-Type": f"{content_type}; charset=utf-8",
        "Content-Disposition": f"attachment; filename={filename}",
        "X-Saved-File": rel_path,
        "Cache-Control": "public, max-age=31536000, immutable",
    }
    if etag:
        headers["ETag"] = etag
    return headers

# -----------------------
# Subwoofer data directory helper
# -----------------------
def ensure_subwoofer_dirs(root: str = "subwoofers") -> None:
    import os
    sizes = ["8", "10", "12", "15", "18"]
    try:
        os.makedirs(root, exist_ok=True)
        for s in sizes:
            os.makedirs(os.path.join(root, s), exist_ok=True)
    except Exception as e:  # pragma: no cover - non-critical
        print(f"[warn] could not create subwoofer dirs: {e}")


# -----------------------
# Utility: simple shelf packer for 4x8 layout
# -----------------------
@dataclass
class Rect:
    name: str
    w: float
    h: float
    qty: int = 1

@dataclass
class Placed:
    name: str
    x: float
    y: float
    w: float
    h: float
    rotated: bool
    idx: int

def pack_on_sheet(rects: List[Rect], sheet_w: float = 96.0, sheet_h: float = 48.0, kerf: float = 0.125, margin: float = 0.25) -> Tuple[List[Placed], float]:
    """Shelf-packing with naive rotation. Tries to place largest first, left->right, top->bottom.
    Adds kerf spacing between parts and margins around the sheet.
    Returns placed rectangles and utilization ratio (0..1)."""
    expanded: List[Tuple[str, float, float, int]] = []
    for r in rects:
        for i in range(r.qty):
            expanded.append((r.name, r.w, r.h, i + 1))

    expanded.sort(key=lambda t: (-(t[1] * t[2]), -max(t[1], t[2])))

    x = margin
    y = margin
    row_height = 0.0
    usable_w = sheet_w - 2 * margin
    usable_h = sheet_h - 2 * margin
    placed: List[Placed] = []
    used_area = 0.0

    def fits_here(w, h, x, y):  # noqa: N803 (short var names retained for clarity)
        return (x + w) <= (margin + usable_w) and (y + h) <= (margin + usable_h)

    for name, w, h, idx in expanded:
        options = [(w, h, False), (h, w, True)]
        chosen = None
        for cand_w, cand_h, rot in options:
            if fits_here(cand_w, cand_h, x, y):
                chosen = (cand_w, cand_h, rot)
                break
        if chosen is None:
            x = margin
            y = y + row_height + kerf
            row_height = 0.0
            for cand_w, cand_h, rot in options:
                if fits_here(cand_w, cand_h, x, y):
                    chosen = (cand_w, cand_h, rot)
                    break
        if chosen is None:
            continue
        cw, ch, rot = chosen
        placed.append(Placed(name=name, x=x, y=y, w=cw, h=ch, rotated=rot, idx=idx))
        used_area += (w * h)
        x = x + cw + kerf
        row_height = max(row_height, ch)

    utilization = used_area / (sheet_w * sheet_h)
    return placed, utilization


# -----------------------
# FastAPI app
# -----------------------
def get_application() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version=settings.version, debug=settings.debug)

    # Ensure export/output directory structure exists early.
    try:
        ensure_output_dirs()
    except Exception as e:  # pragma: no cover - non-critical startup aid
        # We intentionally swallow errors here to avoid blocking server start
        # in read-only environments; diagnostics can be added later.
        print(f"[warn] could not initialize output directories: {e}")

    # Ensure subwoofer size directories exist (8,10,12,15,18)
    ensure_subwoofer_dirs()

    app.mount("/static", StaticFiles(directory="app/static"), name="static")
    templates = Jinja2Templates(directory="app/templates")
    app.include_router(api_router)

    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    async def home(request: Request):
        from datetime import datetime
        cache_bust = datetime.utcnow().strftime("%Y%m%d%H%M")
        return templates.TemplateResponse("index.html", {"request": request, "year": datetime.utcnow().year, "cache_bust": cache_bust})

    @app.post("/box-volume", response_class=HTMLResponse, include_in_schema=False)
    async def box_volume(width: float = Form(...), height: float = Form(...), depth: float = Form(...)):
        if min(width, height, depth) <= 0:
            return HTMLResponse("<p>All dimensions must be greater than zero. <a href='/'>&larr; Back</a></p>", status_code=400)

        volume_cu_in = width * height * depth
        volume_cu_ft = volume_cu_in / 1728.0

        max_face = 250.0
        scale = max_face / max(width, height)
        w_px = width * scale
        h_px = height * scale
        depth_scale = 0.5
        d_px = depth * scale * depth_scale

        x0, y0 = 40, 40
        x1, y1 = x0 + w_px, y0
        x2, y2 = x1, y0 + h_px
        x3, y3 = x0, y0 + h_px
        bx0, by0 = x0 + d_px, y0 - d_px
        bx1, by1 = x1 + d_px, y1 - d_px
        bx2, by2 = x2 + d_px, y2 - d_px
        bx3, by3 = x3 + d_px, y3 - d_px

        def line(a, b):
            return f"<line x1='{a[0]:.1f}' y1='{a[1]:.1f}' x2='{b[0]:.1f}' y2='{b[1]:.1f}' stroke='#222' stroke-width='2' />"

        svg = ["<svg width='360' height='360' style='background:#fafafa;border:1px solid #ddd'>"]
        svg.append(line((x0, y0), (x1, y1)))
        svg.append(line((x1, y1), (x2, y2)))
        svg.append(line((x2, y2), (x3, y3)))
        svg.append(line((x3, y3), (x0, y0)))
        svg.append(line((bx0, by0), (bx1, by1)))
        svg.append(line((bx1, by1), (bx2, by2)))
        svg.append(line((bx2, by2), (bx3, by3)))
        svg.append(line((bx3, by3), (bx0, by0)))
        svg.append(line((x0, y0), (bx0, by0)))
        svg.append(line((x1, y1), (bx1, by1)))
        svg.append(line((x2, y2), (bx2, by2)))
        svg.append(line((x3, y3), (bx3, by3)))
        svg.append(f"<text x='{(x0+x1)/2:.1f}' y='{y0-10:.1f}' font-size='12' text-anchor='middle'>W={width}\"")
        svg.append(f"<text x='{x1+10:.1f}' y='{(y1+y2)/2:.1f}' font-size='12'>H={height}\"")
        svg.append(f"<text x='{bx1+10:.1f}' y='{by1-10:.1f}' font-size='12'>D={depth}\"")
        svg.append("</svg>")
        svg_markup = "".join(svg)

        html = f"""
        <html><head><title>Box Wireframe</title><style>
        body{{font-family:Arial;margin:2rem;}}
        code{{background:#f5f5f5;padding:2px 4px;border-radius:4px;}}
        a.button{{display:inline-block;margin-top:1rem;padding:.6rem 1rem;background:#eee;border:1px solid #ccc;text-decoration:none;}}
        .metrics{{margin-bottom:1rem;}}
        </style></head><body>
        <h1>Box Volume Result (Wireframe)</h1>
        <div class='metrics'>
          <p>Width: <code>{width}</code> in &nbsp; Height: <code>{height}</code> in &nbsp; Depth: <code>{depth}</code> in</p>
          <p>Volume: <strong>{volume_cu_in:.3f}</strong> cu in / <strong>{volume_cu_ft:.4f}</strong> cu ft</p>
        </div>
        {svg_markup}
        <p><small>Wireframe uses simplified isometric projection; dimensions labeled.</small></p>
        <p><a class='button' href='/'>Back to Home</a></p>
        </body></html>
        """
        return HTMLResponse(html)

    @app.get("/box-builder", response_class=HTMLResponse, include_in_schema=False)
    async def box_builder(request: Request):
        from datetime import datetime
        cache_bust = datetime.utcnow().strftime("%Y%m%d%H%M")
        return templates.TemplateResponse("box_builder.html", {"request": request, "cache_bust": cache_bust})

    # -----------------------
    # NEW: Cut Sheet route
    # -----------------------
    @app.get("/cut-sheet", response_class=HTMLResponse)
    async def cut_sheet(
        request: Request,
        W: float = Query(..., description="Outside width in inches"),
        H: float = Query(..., description="Outside height in inches"),
        D: float = Query(..., description="Outside depth in inches"),
        t: float = Query(0.75, description="Wall thickness in inches"),
        kerf: float = Query(0.125, description="Saw kerf spacing in inches"),
        margin: float = Query(0.25, description="Edge margin in inches"),
        rotate_sides: bool = Query(True, description="Allow side panels to rotate for better fit"),
    ):
        if min(W, H, D, t) <= 0:
            return HTMLResponse("<p>All dimensions must be positive.</p>", status_code=400)

        panels = [
            Rect("Front", W, H, qty=1),
            Rect("Back", W, H, qty=1),
            Rect("Top", W, D - 2 * t, qty=1),
            Rect("Bottom", W, D - 2 * t, qty=1),
            Rect("Left Side", D, H - 2 * t, qty=1),
            Rect("Right Side", D, H - 2 * t, qty=1),
        ]

        if rotate_sides:
            for p in panels:
                if "Side" in p.name and p.h > p.w:
                    p.w, p.h = p.h, p.w

        placed, util = pack_on_sheet(panels, sheet_w=96.0, sheet_h=48.0, kerf=kerf, margin=margin)
        efficiency = util * 100.0

        px_per_in = 5.0
        sheet_w_px = int(96 * px_per_in)
        sheet_h_px = int(48 * px_per_in)

        def rect_svg(p: Placed, color: str):
            x = p.x * px_per_in
            y = p.y * px_per_in
            w = p.w * px_per_in
            h = p.h * px_per_in
            label = f"{p.name} #{p.idx} • {p.w:.2f}×{p.h:.2f}\""
            return f"""
            <g>
              <rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" fill="{color}" fill-opacity="0.15" stroke="{color}" stroke-width="1.5"/>
              <text x="{x + 6:.1f}" y="{y + 16:.1f}" font-size="12" font-family="Arial">{label}</text>
            </g>
            """

        palette = {
            "Front": "#2b8a3e",
            "Back": "#2b8a3e",
            "Top": "#1c7ed6",
            "Bottom": "#1c7ed6",
            "Left Side": "#e8590c",
            "Right Side": "#e8590c",
        }

        parts_svg = "\n".join(rect_svg(p, palette.get(p.name, "#333")) for p in placed)

        svg = f"""
        <svg width="{sheet_w_px}" height="{sheet_h_px}" viewBox="0 0 {sheet_w_px} {sheet_h_px}" style="background:#fff;border:1px solid #ccc">
          <defs>
            <pattern id="grid" width="{px_per_in}" height="{px_per_in}" patternUnits="userSpaceOnUse">
              <path d="M {px_per_in} 0 L 0 0 0 {px_per_in}" fill="none" stroke="#eee" stroke-width="1"/>
            </pattern>
          </defs>
          <rect x="0" y="0" width="{sheet_w_px}" height="{sheet_h_px}" fill="url(#grid)" />
          <rect x="0" y="0" width="{sheet_w_px}" height="{sheet_h_px}" fill="none" stroke="#666" stroke-width="2"/>
          {parts_svg}
          <text x="{sheet_w_px - 8}" y="{sheet_h_px - 8}" text-anchor="end" font-size="12" font-family="Arial" fill="#333">
            Sheet: 96×48 in • Kerf: {kerf:.3f}" • Margin: {margin:.2f}" • Utilization: {efficiency:.1f}%
          </text>
        </svg>
        """

        def row(name, w, h, q):
            return f"<tr><td>{name}</td><td>{w:.3f}\"</td><td>{h:.3f}\"</td><td>{q}</td></tr>"

        rows = "".join(row(p.name, p.w, p.h, p.qty) for p in panels)

        html = f"""
        <html>
        <head>
          <title>Cut Sheet • {W:.2f}×{H:.2f}×{D:.2f} in</title>
          <style>
            body {{ font-family: Arial, sans-serif; margin: 24px; color:#222; }}
            .wrap {{ display:flex; gap:24px; align-items:flex-start; flex-wrap:wrap; }}
            table {{ border-collapse: collapse; }}
            th, td {{ border: 1px solid #ccc; padding: 6px 10px; }}
            th {{ background:#f6f6f6; }}
            .hint {{ color:#666; font-size: 13px; }}
            .controls a {{ display:inline-block; margin-right:10px; }}
          </style>
        </head>
        <body>
          <h1>Cut Sheet</h1>
          <p class="hint">Box outside dims: <b>{W:.3f} × {H:.3f} × {D:.3f}</b> in, wall thickness <b>{t:.3f}\"</b>. This layout uses a shelf-packing heuristic with kerf and margins.</p>
          <div class="wrap">
            <div>
              {svg}
            </div>
            <div>
              <h2>Panel List</h2>
              <table>
                <thead><tr><th>Panel</th><th>Width</th><th>Height</th><th>Qty</th></tr></thead>
                <tbody>{rows}</tbody>
              </table>
              <p class="hint">Utilization: <b>{efficiency:.1f}%</b> of 4×8 sheet (96×48\"). If parts don't all appear, they didn't fit on a single sheet.</p>
              <div class="controls">
                <a href="/cut-sheet?W={W}&H={H}&D={D}&t={t}&kerf={kerf}&margin={margin}&rotate_sides={'true' if rotate_sides else 'false'}">Permalink</a>
                <a href="/">Home</a>
              </div>
            </div>
          </div>
        </body>
        </html>
        """
        return HTMLResponse(html)

    @app.get("/assets/health", include_in_schema=False)
    async def assets_health():
        import os
        base = os.path.join("app", "static", "js")
        targets = [("box_builder.js", os.path.join(base, "box_builder.js"))]
        data = []
        for name, path in targets:
            exists = os.path.isfile(path)
            size = os.path.getsize(path) if exists else 0
            data.append({"name": name, "exists": exists, "size": size})
        return {"assets": data}

    # -----------------------
    # JSON Export Endpoint
    # -----------------------
    @app.post("/export/box", response_class=JSONResponse)
    async def export_box(
        request: Request,
        width: float = Form(...),
        height: float = Form(...),
        depth: float = Form(...),
        wall_thickness: float = Form(0.75),
        sub_size: Optional[float] = Form(None),
        sub_count: Optional[int] = Form(None),
        finish: Optional[str] = Form(None),
    ):
        """Persist a minimal box configuration as JSON to the output directory.

        Returns JSON metadata including relative file path. Designed for future
        expansion (SVG + GLB generation referencing same config stub).
        """
        if min(width, height, depth, wall_thickness) <= 0:
            return JSONResponse({"error": "All core dimensions must be > 0"}, status_code=400)

        payload = {
            "width": width,
            "height": height,
            "depth": depth,
            "wall_thickness": wall_thickness,
            "sub_size": sub_size,
            "sub_count": sub_count,
            "finish": finish,
            "source": "box_builder",
        }
        from datetime import datetime
        ts = datetime.utcnow().strftime("%Y%m%d-%H%M%S-%f")
        fname = f"box_{ts}.json"
        target_dir = get_export_path("temp")  # temp until promoted to curated folder
        target_dir.mkdir(parents=True, exist_ok=True)
        path = target_dir / fname
        # Atomic-ish write: write to tmp then rename
        tmp_path = path.with_suffix('.json.part')
        import json, os
        with tmp_path.open('w', encoding='utf-8') as f:
            json.dump(payload, f, indent=2)
        os.replace(tmp_path, path)
        # Normalize relative path (POSIX style) and prepend output/ root for clarity.
        rel_under_output = path.relative_to(get_export_path("temp").parent)
        rel_posix = rel_under_output.as_posix()
        rel_str = rel_posix if rel_posix.startswith("output/") else f"output/{rel_posix}"
        size_bytes = path.stat().st_size
        return {"saved": True, "file": rel_str, "bytes": size_bytes, "config": payload}

    # -----------------------
    # SVG Export Endpoint (simple placeholder geometry)
    # -----------------------
    @app.post("/export/basic-svg")
    async def export_basic_svg(request: Request):  # Manual JSON parsing to avoid validation 422s
        """Export a simple (basic) SVG wireframe for provided box dimensions.

        JSON body fields:
          width (float), height (float)
          mode: "download" (default) returns attachment; "json" returns metadata with file path.

        In json mode the SVG is persisted to output/svg and response is JSON:
          { saved: true, file: "output/svg/box_....svg", bytes: N }
        """
        try:
            payload = await request.json()
        except Exception:
            return JSONResponse({"error": "Invalid JSON body"}, status_code=400)
        mode = str(payload.get("mode", "download")).lower()
        try:
            w = float(payload.get("width"))
            h = float(payload.get("height"))
            # depth is optional for basic 2D outline; parse if present
            _depth_raw = payload.get("depth")
            if _depth_raw is not None:
                try:
                    _ = float(_depth_raw)
                except Exception:
                    return JSONResponse({"error": "depth must be numeric if provided"}, status_code=400)
        except Exception:
            return JSONResponse({"error": "width & height required numeric"}, status_code=400)
        if w <= 0 or h <= 0:
            return JSONResponse({"error": "dimensions must be > 0"}, status_code=400)

        ts = utc_timestamp()
        # Basic panel geometry placeholder: treat provided width/height as single front panel.
        panels = [
            {"name": "Front", "x": 0.0, "y": 0.0, "w": w, "h": h, "rotation": 0}
        ]
        panel_rects = "".join(
            f"<rect data-panel='{p['name']}' data-w='{p['w']}' data-h='{p['h']}' x='{p['x']}' y='{p['y']}' width='{p['w']}' height='{p['h']}'/>" for p in panels
        )
        svg_markup = (
            "<?xml version='1.0' encoding='UTF-8'?>\n"
            f"<svg xmlns='http://www.w3.org/2000/svg' width='{w*10:.0f}' height='{h*10:.0f}' viewBox='0 0 {w} {h}' data-panels='1' data-meta-version='1'>"
            "<title>Box Panels</title>"
            "<desc>Placeholder panel layout; will expand with full cut list in future versions.</desc>"
            "<style>rect{stroke:#222;stroke-width:0.05;fill:none;font-family:sans-serif}</style>"
            f"{panel_rects}"  # no extra whitespace for predictable hashing later
            "</svg>"
        )

        digest = sha256_hex(svg_markup)
        if mode == "json":
            fname, rel, fpath = persist_text("svg_box", "box", "svg", svg_markup)
            import os
            meta = {
                "saved": True,
                "file": rel,
                "bytes": os.path.getsize(fpath),
                "width": w,
                "height": h,
                "panel_count": len(panels),
                "panels": panels,
                "hash": digest,
            }
            return JSONResponse(meta)
        # download mode
        fname, rel, fpath = persist_text("svg_box", "box", "svg", svg_markup)
        headers = build_download_headers("image/svg+xml", fname, rel, etag=digest)
        return HTMLResponse(content=svg_markup, headers=headers, status_code=200)

    # -----------------------
    # DXF Export Endpoint (placeholder)
    # -----------------------
    @app.post("/export/basic-dxf")
    async def export_basic_dxf(request: Request):
        """Return a very small placeholder DXF file for early integration tests.

        Accepts same JSON body as SVG for forward compatibility but currently
        only uses width/height for simple bounding box comment. A real DXF
        implementation will emit LINE entities or POLYLINE definitions.
        """
        try:
            payload = await request.json()
        except Exception:
            payload = {}
        w = payload.get("width", 0)
        h = payload.get("height", 0)
        ts = utc_timestamp()
        # Minimal DXF content meeting header expectations; SECTION/ENDSEC/EOF
        # Using a simple comment with dims (not standard DXF entity) for now.
        dxf = (
            "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1027\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n"
            f"999\nBOX {w}x{h}\n0\nENDSEC\n0\nEOF\n"
        )
        digest = sha256_hex(dxf)
        fname, rel, _ = persist_text("dxf_box", "box", "dxf", dxf)
        headers = build_download_headers("application/dxf", fname, rel, etag=digest)
        return HTMLResponse(content=dxf, headers=headers, status_code=200)

    @app.post("/admin/restart", include_in_schema=False)
    async def admin_restart(request: Request):
        settings = get_settings()
        if not settings.debug:
            return HTMLResponse("<p>Restart disabled in production.</p>", status_code=403)
        try:
            import asyncio
            request.app.state.restart_requested = True
            loop = asyncio.get_event_loop()
            loop.call_later(0.2, setattr, request.app, 'should_exit', True)  # type: ignore
        except Exception:
            pass
        return HTMLResponse("<p>Restart scheduled.</p>", status_code=202)

    @app.get("/admin/routes", response_class=JSONResponse)
    async def admin_routes():  # pragma: no cover - simple introspection
        """Return JSON metadata for registered routes.

        Fields per route:
          method(s), path, name, endpoint (func name), tags, has_params
        Useful for debugging 404 issues and external tooling introspection.
        """
        routes_info = []
        from fastapi.routing import APIRoute
        for r in app.router.routes:
            path = getattr(r, "path", None)
            methods = list(getattr(r, "methods", []))
            name = getattr(r, "name", None)
            endpoint = getattr(r, "endpoint", None)
            ep_name = getattr(endpoint, "__name__", None)
            tags = getattr(r, "tags", None) or []
            params = []
            if isinstance(r, APIRoute):
                try:
                    for p in r.dependant.path_params + r.dependant.query_params + r.dependant.body_params:
                        params.append({
                            'name': p.name,
                            'type': getattr(p.type_, '__name__', str(p.type_)),
                            'required': p.required,
                            'in': p.in_,
                        })
                except Exception:
                    pass
            routes_info.append({
                'path': path,
                'methods': methods,
                'name': name,
                'endpoint': ep_name,
                'tags': tags,
                'param_count': len(params),
                'params': params,
            })
        return {'total': len(routes_info), 'routes': routes_info}

    return app


app = get_application()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True, log_level="info")
