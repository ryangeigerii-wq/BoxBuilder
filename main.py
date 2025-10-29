"""Application entrypoint for box_builder.
Run with: uvicorn main:app --reload
"""

from fastapi import FastAPI, Form, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from app.api.routes import api_router
from app.core.config import get_settings


def get_application() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version=settings.version, debug=settings.debug)

    # Static files & templates
    app.mount("/static", StaticFiles(directory="app/static"), name="static")
    templates = Jinja2Templates(directory="app/templates")

    # Include routers
    app.include_router(api_router)


    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    async def home(request: Request):
        from datetime import datetime
        # Simple cache bust value (could be version or build hash). Using date minutes for now.
        cache_bust = datetime.utcnow().strftime("%Y%m%d%H%M")
        return templates.TemplateResponse(
            request,
            "index.html",
            {"year": datetime.utcnow().year, "cache_bust": cache_bust},
        )
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
        svg.append(f"<text x='{(x0+x1)/2:.1f}' y='{y0-10:.1f}' font-size='12' text-anchor='middle'>W={width}\"</text>")
        svg.append(f"<text x='{x1+10:.1f}' y='{(y1+y2)/2:.1f}' font-size='12'>H={height}\"</text>")
        svg.append(f"<text x='{bx1+10:.1f}' y='{by1-10:.1f}' font-size='12'>D={depth}\"</text>")
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
        return templates.TemplateResponse(
            request,
            "box_builder.html",
            {"cache_bust": cache_bust},
        )

    @app.get("/assets/health", include_in_schema=False)
    async def assets_health():
        """Simple asset presence check for critical JS files.
        Returns list with status bool and length for quick diagnostics.
        """
        import os
        base = os.path.join("app", "static", "js")
        targets = [
            ("box_builder.js", os.path.join(base, "box_builder.js")),
        ]
        data = []
        for name, path in targets:
            exists = os.path.isfile(path)
            size = os.path.getsize(path) if exists else 0
            data.append({"name": name, "exists": exists, "size": size})
        return {"assets": data}

    @app.post("/admin/restart", include_in_schema=False)
    async def admin_restart(request: Request):
        """Trigger a development server restart (requires --reload for effect).
        Returns 202 Accepted if shutdown flag set.
        Guarded: only available when debug/settings.debug is True.
        """
        settings = get_settings()
        if not settings.debug:
            return HTMLResponse("<p>Restart disabled in production.</p>", status_code=403)
        # Mark for shutdown; Uvicorn with --reload will respawn.
        # Using app.state so we can introspect later if needed.
        app.state.restart_requested = True
        # Attempt to set should_exit if server available (best effort)
        try:
            # Uvicorn server instance often attached to 'app.router.lifecycle' during runtime; not relying on internals.
            import asyncio
            loop = asyncio.get_event_loop()
            loop.call_later(0.2, setattr, app, 'should_exit', True)  # type: ignore
        except Exception:
            pass
        return HTMLResponse("<p>Restart scheduled.</p>", status_code=202)

    # Deprecated: former /box-builder-lemonade consolidated into /box-builder

    return app



app = get_application()

if __name__ == "__main__":  # Allow `python main.py` direct launch without uvicorn CLI (avoids shell script policy issues)
    import uvicorn
    # Using host/port defaults; debug flag controls reload desire. We avoid reload here to reduce restart complexity under execution policy restrictions.
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=False, log_level="info")
