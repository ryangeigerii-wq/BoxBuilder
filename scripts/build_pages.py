"""Build a static snapshot of the box builder UI for GitHub Pages.

This strips server-only features and produces a /dist directory containing:
- index.html (builder interface)
- assets copied from app/static (css, js, img)

Limitations:
- No Python/FastAPI backend; port design compute button will be disabled.
- Server restart / admin endpoints not available.
- Any dynamic fetches to /ports/design will be no-ops.
"""
from __future__ import annotations
import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
STATIC_SRC = ROOT / "app" / "static"
TEMPLATE_SRC = ROOT / "app" / "templates" / "box_builder.html"

def clean_dist():
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True, exist_ok=True)

def copy_static():
    if not STATIC_SRC.exists():
        raise SystemExit("Static source missing: app/static")
    shutil.copytree(STATIC_SRC, DIST / "static")

INLINE_WARN = """<!--
This static export runs without the FastAPI backend.
Disabled features:
- Server Port Compute (/ports/design)
- Admin Restart
Local heuristic port overlay still works (client-side only).
-->"""

JS_PATCH_SNIPPET = r"""
<script>
// GitHub Pages static mode detection & feature downgrades
(function(){
  const isPages = /\.github\.io$/.test(location.hostname) || location.hostname === '127.0.0.1';
  if(!isPages) return;
  const root = document.getElementById('lm-root');
  if(!root) return;
  const form = root.querySelector('form.box-lm-form');
  if(!form) return;
  // Disable server-only buttons
  const serverBtn = form.querySelector('button[name=\"computePort\"]');
  if(serverBtn){
    serverBtn.disabled = true; serverBtn.title = 'Disabled in static Pages build'; serverBtn.textContent = 'Compute (offline)';
  }
  const restartBtn = form.querySelector('button[name=\"serverReset\"]');
  if(restartBtn){ restartBtn.disabled = true; restartBtn.title = 'Unavailable on Pages'; }
  // Intercept fetch calls to /ports/design
  const origFetch = window.fetch;
  window.fetch = async function(url, opts){
    if(typeof url === 'string' && url.startsWith('/ports/design')){
      return new Response(JSON.stringify({
        warning: 'Static build: server design unavailable',
        areaPerPortM2: 0, physicalLengthPerPortM: 0, effectiveLengthPerPortM: 0,
        tuningHzAchieved: 0, endCorrectionPerEndM: 0
      }), {status: 200, headers: {'Content-Type': 'application/json'}});
    }
    return origFetch.apply(this, arguments);
  }
})();
</script>
"""

HTML_INSERT_MARKER = "</body>"

def build_html():
    if not TEMPLATE_SRC.exists():
        raise SystemExit("Template missing: app/templates/box_builder.html")
    content = TEMPLATE_SRC.read_text(encoding='utf-8')
    # Adjust relative static paths if needed (we keep /static/ so Pages serves root/static/*)
    # Inject patch snippet before closing body
    if HTML_INSERT_MARKER in content:
        content = content.replace(HTML_INSERT_MARKER, JS_PATCH_SNIPPET + HTML_INSERT_MARKER)
    # Add offline banner near top (after first <body>)
    content = content.replace('<body', '<body data-offline="true"')
    out = DIST / 'index.html'
    out.write_text(INLINE_WARN + '\n' + content, encoding='utf-8')

def main():
    clean_dist()
    copy_static()
    build_html()
    print(f"Static site built at: {DIST}")

if __name__ == '__main__':
    main()
