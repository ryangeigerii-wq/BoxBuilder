# box_builder

Minimal FastAPI backend skeleton.

## Features
- Settings management via `pydantic` (`app/core/config.py`)
- Modular routers (`app/api/routes`) for health and box creation
- Separation of concerns: models vs schemas
- Basic test using `TestClient`
- Manufacturer scraping endpoints (Sundown & JL Audio 8" subs) with synthetic fallback and enrichment mock test.

## Portability & Fresh Clone Guide
The repository is now structured so a fresh clone can run both backend and front-end + scraping tests with minimal setup. Follow this order for a clean environment bring‑up on a new machine (Windows PowerShell examples shown):

### 1. Clone & Base Python Environment
```powershell
git clone https://github.com/<your-org>/BoxBuilder.git
cd BoxBuilder
python -m venv .venv
./.venv/Scripts/Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 2. (Optional) Install Playwright Browsers
Playwright tests auto-skip if the browser isn’t installed. Install to run the 3D/UI smoke tests:
```powershell
python -m playwright install chromium
```

### 3. (Optional) Node / Jest Front-End Unit Tests
If `package.json` is present (Jest/ESLint toolchain):
```powershell
npm install
npm test   # Runs Jest port math tests
```

### 4. Run Python Test Suite
```powershell
pytest -q
```
Expected result: all tests pass; some are skipped if Playwright/browser not installed. Current known benign warnings:
* Pytest async warnings for tests using `@pytest.mark.asyncio` (no plugin required—pure asyncio)
* Deprecation notices from upstream libraries (pydantic / Starlette) — slated for a future cleanup.

### 5. Launch Dev Server
```powershell
uvicorn main:app --reload
```
Visit: http://127.0.0.1:8000/box-builder and verify:
* Spinner hides
* 3D preview canvas renders (no enable toggle required)
* Dual sub layout adds two hole cylinders
* Export endpoints reachable via /docs

### 6. Quick Verification Checklist (Fresh Clone)
| Check | Expectation |
|-------|-------------|
| `pytest -q` | Pass (Playwright tests may skip) |
| `/admin/routes` | JSON listing with >30 routes |
| `/subwoofers/cutout/12` | Returns heuristic 11.16 dia (0.93×) |
| `/export/basic-svg` (POST width/height) | 200 + ETag header |
| `/export/pdf` | Returns PDF starting with %PDF (if reportlab installed) |
| 3D view | Canvas + hole cylinders present |

### 7. Large / Generated Artifacts
The `subwoofers/8/snapshot_*.json` files are large scrape snapshots produced by tests or exploratory runs. They are useful for diffing parser changes but not required for a minimal runnable clone. You can:
* Keep the most recent snapshot pair only.
* Add older snapshots to `.gitignore` or prune before commit.

Suggested `.gitignore` additions (optional):
```
subwoofers/8/snapshot_*.json
output/svg_box/*.svg
output/dxf_box/*.dxf
output/svg_cutsheets/*.svg
output/dxf_cutsheets/*.dxf
output/cut_sheets/*.pdf
```
Retain directories themselves so code paths creating them do not fail.

### 8. Staging & Committing (PowerShell)
Group staging to keep commit concise:
```powershell
git add README.md main.py app/ tests/ subwoofers/index.json subwoofers/8/latest.json
git add subwoofers/8/snapshot_2025*.json   # if you choose to keep snapshots
git commit -m "portability: add tests, snapshots, and README fresh clone guide"
```

### 9. Common Post-Clone Issues
| Symptom | Cause | Fix |
|---------|-------|-----|
| Playwright tests all skip | Browsers not installed | Run `python -m playwright install chromium` |
| 3D preview blank | GPU/WebGL blocked or missing `three_preview.js` | Check Network tab for 404, disable strict corporate GPU policy |
| PDF endpoint 500 | `reportlab` missing | `pip install -r requirements.txt` |
| Many large JSON snapshots | Legacy scrape outputs | Prune or gitignore older ones |
| Async warning spam in tests | Pytest default warning; no plugin | Accept for now; will tighten with future config |

### 10. Planned Portability Enhancements
* Consolidate very large Playwright test files (reduce per‑file LOC) for faster cold clone install.
* Introduce `pytest --maxfail=1 -q` default in CI to shorten failure feedback.
* Add optional `scripts/cleanup_snapshots.py` for pruning stale snapshot_* files by age.
* Switch deprecation warnings to strict mode after upgrading libraries.

### 11. Minimal Smoke Commands (Copy/Paste)
```powershell
pytest tests/test_sundown.py::test_sundown_basic_shape -q
pytest tests/test_export_vector.py::test_vector_exports -q
pytest tests/test_routes_index.py::test_admin_routes_index -q
```

If all three pass, the core API, export system, and routing registry are healthy.

---

## Project Layout
```
BoxBuilder/
  main.py
  requirements.txt
  app/
    core/
      config.py
    models/
      box.py
    schemas/
      box.py
    api/
      routes/
        __init__.py
        health.py
        box.py
  tests/
    test_box.py
```

## Run Locally
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```
Open http://127.0.0.1:8000/docs for interactive API docs.

### Scraping Quick Start
```powershell
curl http://127.0.0.1:8000/subwoofers/sundown
curl http://127.0.0.1:8000/subwoofers/jlaudio
```
Synthetic fallback returns representative models if live fetch blocked.

Enrichment (polite, delayed detail fetch) endpoint:
```powershell
curl "http://127.0.0.1:8000/subwoofers/sundown/collect?max_models=5&base_delay=0.6&jitter=0.25"
```
Mock enrichment test (`tests/test_sundown_enriched_mock.py`) ensures fallback items do not include enrichment fields.

### Server Immediate Shutdown Troubleshooting
If the server starts then immediately logs "Shutting down":
- Avoid pressing Ctrl+C right after launch (seen as `^C` in terminal).
- Disable auto-reload temporarily: `uvicorn main:app --host 127.0.0.1 --port 8000`.
- Ensure no test runner is concurrently spawning and killing uvicorn.
- The `/admin/restart` endpoint only triggers exit when explicitly posted to.
If persistent, run a minimal stub to verify environment signal behavior.

## GitHub Actions & Pages Deployment

This repository includes two workflows located in `.github/workflows`:

1. `ci.yml` — Runs on push and PR to `main`. Sets up Python 3.11, installs dependencies, and executes `pytest -q` for the full test suite.
2. `pages.yml` — Builds a static snapshot of the box builder and deploys it to GitHub Pages. Triggered on push to `main` or manually via workflow dispatch.

### Static Build Details
The static build script `scripts/build_pages.py` produces a `dist/` folder containing:
- `index.html` (derived from `app/templates/box_builder.html` with an injected offline banner and JS patch)
- `static/` assets (CSS/JS/images) copied from `app/static`

Because GitHub Pages does not run the FastAPI backend, server-only features are disabled:
- Port compute button request to `/ports/design` returns a placeholder JSON response (via a fetch monkey patch).
- Admin restart button is disabled.
- Local heuristic port overlay continues to function (pure client-side logic).

When viewing the Pages site (e.g. `https://<username>.github.io/BoxBuilder/`):
- A detection script in `box_builder.js` disables server actions.
- The UI label for the compute button changes to `Compute (offline)`.

### Manually Running the Static Build Locally
```powershell
python -m venv .venv
./.venv/Scripts/Activate.ps1
pip install -r requirements.txt
python scripts/build_pages.py
```
Then open `dist/index.html` in a browser. (Note: relative `/static/...` paths expect the site to be served from the repository root. For file:// viewing, some browsers may block font/image loads; use a lightweight HTTP server if needed.)

### Verifying Pages Deployment
After a push to `main`:
1. Navigate to the Actions tab; confirm `CI` succeeded.
2. Open the `Deploy Pages` workflow run; ensure both `build` and `deploy` jobs are green.
3. Visit the environment URL shown under the `github-pages` deployment.
4. Confirm the following in the Pages site:
  - Spinner fades and disappears.
  - Port compute button is disabled and shows offline text.
  - Local port overlays appear when internal view + tuning inputs are provided.
  - No network errors for `/ports/design` (requests are intercepted client-side).

### Common Pages Issues
| Symptom | Cause | Mitigation |
|---------|-------|-----------|
| 404 for /static assets | Paths changed or not copied | Ensure `scripts/build_pages.py` ran and `dist/static` exists |
| Compute button still enabled | JS patch not injected | Re-run build; verify `index.html` contains the injected `<script>` snippet |
| Broken images | Case-sensitive path mismatch | Verify filenames in `app/static/img` and references match exactly |
| Styles not applied | CSS not copied or cached | Clear browser cache or add a query parameter (cache bust) manually |
| README.md served instead of builder | GitHub Pages defaulting to repo root without index or incorrect base path | Ensure `dist/index.html` created; script now injects `<base href="/BoxBuilder/">` and rewrites `/static/` → `static/`; redeploy |

### Extending Static Export
Enhancements you can add:
- Add a lightweight service worker to cache static assets for offline usage.
- Generate a `manifest.json` for PWA install support.
- Export additional HTML variants (e.g. simplified builder without port section) by extending `build_pages.py`.

### Security Notes
The static export removes active backend calls; no user data is collected. Any future analytics should be explicitly opt-in and separate from core builder logic.

---

## Tests
```powershell
pytest -q
```
### Playwright Smoke Test (Optional)
An optional headless browser smoke test (`tests/test_box_builder_playwright.py`) verifies the vanilla JS builder loads, hides the spinner, and updates metrics.

Installation & Run Steps (Windows PowerShell):
```powershell
# 1. Install dependencies (includes playwright)
pip install -r requirements.txt

# 2. Install a browser (Chromium is enough)
python -m playwright install chromium

# 3. Run only the smoke test
pytest tests/test_box_builder_playwright.py -q

# Or run all tests (smoke test skips gracefully if launch fails)
pytest -q
```
If Chromium cannot launch (CI without required permissions), the test is skipped. Remove the try/except skip in the test file to enforce strict success.

## Next Steps
- Add persistence (e.g. SQLModel / SQLAlchemy + database session management)
- Introduce logging config and structured logs
- Add validation, error handlers, and custom exceptions
- Environment-specific settings and Docker packaging
- CI workflow (GitHub Actions) for tests & lint
 - Implement and optimize 3D preview (mesh reuse, throttled updates)

## Recent Implementation Summary (Agent Changes)
The project has undergone a series of iterative UI and frontend logic improvements while deliberately remaining framework-free on the client side.

Completed adjustments:
- Removed LemonadeJS and all WASM (Rust) experiment assets to simplify stack.
- Consolidated vanilla `box_builder.js` logic; fixed duplicate SVG template injection and stray style blocks.
- Corrected ghost panel rendering (added distinct ghost edges, removed duplicate hatch lines).
- Fixed scoping bug for `ghostEdges` variable inside `generatePreview()`.
- Reordered form fields: Wall Thickness now precedes port & cutout collapsible menus.
- Merged Port Type selector into Port Design collapsible menu; tightened menu styling.
- Centered zoom bar above Preview and removed previous active button checkmark indicator (now outline-based highlight only).
- Moved Cut Diameter into the same 3-up row with Subwoofer Size and Sub Count for compact grouping.
- Renamed visible label "Sub Layout" → "Sub Count" (underlying `name="subConfig"` preserved for logic).
- Standardized 3-up row alignment via new CSS helper class `.triple-field`.
- Added cache-busted static asset references for proper refresh behavior.
- Added heuristic documentation for cutout diameter (0.93× nominal) and backend override support.
- Deprecated and removed per-hole `cutOut` flag (backend & frontend). All holes are now treated uniformly; filtering decisions (e.g. hiding filled holes) occur purely client-side. Backend `/export/cutsheet-holes` always returns every provided hole with its computed diameter.
- Introduced optional Playwright smoke test description and usage.
 - Added Finish selector with procedural wood variants (Light, Medium, Dark, Deep Walnut, Espresso) plus Flat grey theme.
  - Default finish now set to Espresso (was Flat Grey); change via Finish selector.
 - Implemented per-panel procedural wood grain (strength & knot density derived from variant) with deterministic seeding and caching.
 - Implemented local port physics estimation (Helmholtz) with slot, round, aero visualization overlays.
 - Added dual slot and multi-round/aero port overlay rendering with length indicators.
 - Added Show Port Overlay toggle to hide local (pre-server) port drawings while still showing server-computed designs.
 - Implemented generic auto-fit for box dimensions: width/height/depth automatically expand (never shrink) to fit selected sub size (single or dual). Dual layout uses gap heuristic (max(0.75, 15% of diameter)); depth floor = max(dia*0.70, 6") + wall thickness.
 - Archived Ghost Panels feature (semi-transparent offset back/right panels). Code preserved in `archive/ghost_panels_feature.js` for restoration; UI checkbox and 3D toggle removed.
 - Added experimental GLB exporter + inline `<model-viewer>` AR preview (Generate GLB button creates `box.glb` and loads viewer if supported).
 - GLB metadata enhancement: enclosure dimensions, wall thickness, finish, port config, hole specs, and derived gross/internal volumes injected into glTF `userData` plus downloadable JSON manifest.
 - Added port displacement calculation (slot/round/aero) with per-port area & length; net internal volume after ports included in GLB `userData` and metadata JSON.

Removed technologies / files:
- `app/static/js/vendor/lemonade.min.js` and associated loader logic.
- Entire `app/wasm/` directory (Rust experiment).
- Legacy helper `lemonade_vendor.py`.

Added/Modified assets:
- Updated `box_builder.html` template: field ordering, menu integration, zoom bar repositioning, label rename, alignment improvements, preview panel moved top-right via responsive grid, removed legacy Cutout Settings fieldset, added Subwoofer Model collapsible.
- Updated CSS (`style.css`): added `.triple-field` and responsive grid rules powering two-column (form + preview) layout.
- JS file `box_builder.js` cleaned (no framework references) and corrected logic around ghost edges & preview generation; added Subwoofer Model search (debounced) and model-driven nominal size updates.

## Validation Checklist
Use this list to verify the current state after pulling latest changes:
1. Static Assets
  - Confirm `/static/js/box_builder.js` loads (Network tab status 200).
  - Ensure no requests to removed WASM or Lemonade assets (search for `wasm` or `lemonade` in Network).
2. Layout & Form Placement
  - Preview panel renders top-right of the form on wide screens (CSS grid). On narrow/mobile width it stacks beneath the form.
  - Wall Thickness input precedes collapsible menus (Port Design, Subwoofer Model) for early internal volume clarity.
  - In the Dimensions panel, the triple row (Cut Diameter / Subwoofer Size / Sub Count) is evenly spaced and labels aligned.
  - Sub Count label visible; source still uses `name="subConfig"`.
3. Collapsible Menus
  - Port Design button reveals fieldset containing Port Type; closing/hiding works without layout shift.
  - Subwoofer Model menu lists models (searchable). Legacy Cutout Settings fieldset is removed; cut diameter override now only appears in the triple row.
4. Zoom Bar
  - Centered above preview; active button shows outlined highlight (no checkmark glyph).
5. SVG Preview Functionality
  - Changing Width/Height/Depth updates SVG and metrics (Gross/Net volumes).
  - Ghost panels removed (archived); no hatch elements should appear.
  - Hole selection and arrow key nudging works (selected hole outlines thicker or styled differently as per JS code).
  - Undo/Redo (Ctrl+Z / Ctrl+Y) affects last dimensional or hole movement changes (history capped at 20).
  - Show Port Overlay: when unchecked, local estimated port shapes (slot/round/aero) are hidden; server design still appears if computed.
6. Cut Diameter Heuristic
  - Leave Cut Diameter blank: computed hole diameter = nominal size × 0.93.
  - Enter a value: override applies immediately.
  - Selecting a Subwoofer Model updates nominal size; heuristic re-applies if no explicit override entered.
7. Sub Count Behavior
  - Switching from Single to Dual adds second hole symmetrically (verify bounds enforcement).
  - Increasing sub size (e.g., 10" → 15") auto-expands width/height/depth as needed; decreasing size does not reduce existing dimensions.
8. No Console Errors
  - Open DevTools; console should be free of errors after initial load.
9. Restart Server Button
  - In debug/reload mode: POST to `/admin/restart` triggers toast and spinner reinitialization after reload (if implemented in JS).
10. Tests
  - `pytest -q` passes unit tests.
  - Optional: run Playwright smoke test; should load page, remove spinner, confirm preview updates.

  11. GLB Export
    - Click Generate GLB; a file `box.glb` downloads and `<model-viewer>` shows the model (src blob URL populated).
    - Click Download Metadata JSON; `box_metadata.json` contains full state + derived volume metrics.

## Manual Command Reference (Windows PowerShell)
```powershell
# Create & activate virtual environment
python -m venv .venv
./.venv/Scripts/Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run API server (dev mode)
uvicorn main:app --reload

# Run tests
pytest -q

# Run only Playwright smoke test
pytest tests/test_box_builder_playwright.py -q
```

## Recommended Future Validations
- Add front-end unit tests (e.g., Jest + jsdom) for state transitions if moving beyond pure integration tests.
- Snapshot SVG output for known dimension configurations.
- Lint JavaScript (ESLint config pending) to catch future scoping issues early.
- Add accessibility audit (focus states, ARIA labels for interactive controls).
- Performance check: measure render time for large numbers of holes (future multi-hole feature).

## Recommended VS Code Extensions
These extensions streamline development, enforce consistency, and improve code quality:

| Extension ID | Purpose |
|--------------|---------|
| `github.copilot` | AI code suggestions for rapid iteration. |
| `github.copilot-chat` | In-editor conversational assistance & explanations. |
| `ms-python.python` | Core Python tooling (debugger, environment selection). |
| `ms-python.vscode-pylance` | Fast, accurate Python language server and type checking. |
| `ms-python.black-formatter` | Auto-format Python code to Black style. |
| `charliermarsh.ruff` | Linting & autofixes (fast, includes many flake8/pyupgrade rules). |
| `ms-playwright.playwright` | End-to-end browser test authoring & running. |
| `ms-azuretools.vscode-docker` | Dockerfile & container management (future packaging). |
| `streetsidesoftware.code-spell-checker` | Catches common spelling mistakes in docs & comments. |

Optional bulk install (PowerShell):
```powershell
code --install-extension github.copilot
code --install-extension github.copilot-chat
code --install-extension ms-python.python
code --install-extension ms-python.vscode-pylance
code --install-extension ms-python.black-formatter
code --install-extension charliermarsh.ruff
code --install-extension ms-playwright.playwright
code --install-extension ms-azuretools.vscode-docker
code --install-extension streetsidesoftware.code-spell-checker
```

Suggested configuration tweaks:
```jsonc
// .vscode/settings.json
{
  "python.formatting.provider": "black",
  "editor.formatOnSave": true,
  "ruff.enable": true,
  "ruff.lint.args": ["--fix"],
  "python.analysis.typeCheckingMode": "basic",
  "python.testing.pytestEnabled": true,
  "python.testing.pytestArgs": ["tests"],
  "playwright.trace": "on-first-retry"
}
```

## Subwoofer Model Selection & Standard Cutout Preset
The builder includes a Subwoofer Model collapsible enabling search & selection. Selecting a model updates all hole nominal sizes and triggers dimension auto-fit (expansion only) plus heuristic cut diameter recalculation if no explicit override.

Search UX:
- Debounced (~220 ms) request to `/subwoofers/search`; falls back to local mock if endpoint missing.
- Temporary "Searching…" option appears until results loaded.
- Selection pushes history entry (undo/redo aware).

Cut Diameter Precedence:
1. User-entered override
2. (Future) Manufacturer spec from model data
3. Heuristic fallback (0.93× nominal)

Model selection never silently shrinks existing dimensions; only expands to maintain clearances for chosen size and dual layout spacing heuristics.

Standard Cutout Preset
When a selected subwoofer model does not have manufacturer-provided cutout data, a heuristic is applied:

```
cutout_diameter = nominal_size * 0.93
```

This 0.93× ratio reflects a common industry average for subwoofer basket outer diameter vs. required mounting hole. The backend endpoint `GET /subwoofers/cutout/{nominal_size}` returns:

```json
{
  "nominal_size": 12.0,
  "cutout_diameter": 11.16,
  "estimated": true,
  "ratio_used": 0.93,
  "source": "standard-heuristic",
  "disclaimer": "Default cutout diameters are automatically estimated using the 0.93× standard. Exact manufacturer specs will override these values when available."
}
```

If a real spec becomes available, pass `actual_spec` query param:

```
GET /subwoofers/cutout/12?actual_spec=11.125
```

Response marks `estimated` as false and uses the provided diameter. The builder UI labels heuristic values as "(estimated)" pending override by actual model data.

Planned enhancements:
- Persist per-model overrides in a data store.
- Capture variance stats to refine ratio suggestions per brand.
- Add tolerance range (e.g. ±0.02 in) for manufacturing variation.


## Box Builder (Axis-Aligned Vanilla JS)
The `/box-builder` page uses a framework-free JavaScript implementation (`app/static/js/box_builder.js`). The preview is axis-aligned for clarity and determinism (no faux 3D skewing).

Current Front-End Features (3D-Only Architecture):
- Editable dimensions (W/H/D) with clamping & auto-sizing for dual subs
- Subwoofer size select (8 / 10 / 12 / 15) and Cut Diameter override (heuristic 0.93× nominal when blank)
- Single / Dual layout with symmetry positioning and edge margin enforcement
- Click-to-select hole + keyboard nudging (Arrow keys; Shift = ×5)
-- (Archived) Ghost panels toggle (removed from UI; logic retained internally for potential restoration)
- Undo / Redo history (20 entries) & toast feedback
- Zoom presets (Close / Normal / Wide) influence 2D SVG framing logic (SVG kept internal for upcoming export)
- State Reset & Dev-only Restart Server button
- Internal SVG generator retained (not mounted) for future Download SVG feature
- Always-on Three.js 3D preview (no checkbox) with inertial orbit controls, Shift+drag acceleration, auto-rotate toggle (default off), persistent camera & rotation state (double-click reset removed for simplicity)
- Local port physics estimation (slot / round / aero) powering metrics and 3D port meshes
- Show Port Overlay toggle hides 3D port meshes (metrics remain)
 - Finish selector controlling procedural wood material variant (cached textures / per-panel variation)
 - Grid visibility toggle (persists; hides helper for clean screenshots)
 - Shadow toggle (persists; disables shadowMap + clears panel shadow flags for performance / clarity)
  (Both toggles persist via localStorage keys: `boxBuilder3DGrid`, `boxBuilder3DShadows`.)

Planned Enhancements:
- SVG download (button stub present)
- Port and bracing visualization
- Unit switching (in ↔ mm) with automatic conversion & formatting
- Persistent local storage of last session state
- Hole grouping & symmetry duplication tools
- Manufacturer spec fetch & auto-fill overrides
- Future frequency visualization (replaces retired grid snap concept)
 - Server vs local tuning discrepancy indicator (highlight variance threshold)
 - 3D improvements: internal bracing meshes, transparent cutaways, performance debouncing

Customization Pointers:
- Adjust ghost offset logic inside `generatePreview()` (currently proportional to depth).
- Extend hole data model (e.g. add label, type) in `state.holes` objects.
- Modify palette inside the inline `<style>` block generated with the SVG markup.
- Tweak zoom scale factors in the zoom mode mapping.

Event & State Model:
- Single `state` object acts as source of truth.
- Form changes trigger `update()`; history recorded (max 20 entries).
- Hole selection stored per-hole (`selected: true`).
- Toast messages cleared upon next committed update.

Troubleshooting Quick Reference:
| Symptom | Likely Cause | Resolution |
|---------|--------------|-----------|
| Hole jumps to edge | Bounds enforcement adjusted position | Increase box size or reduce hole diameter / override |
| Nudge not working | Hole not selected | Click desired hole in preview before using arrows |
| Diameter different than expected | Heuristic applied (0.93×) vs override/spec | Enable override or supply manufacturer spec to backend |
| Override ignored | Toggle unchecked | Check the override checkbox and enter numeric diameter |
| Finish not visually changing | Variant uses similar palette or cache reused | Switch to a higher contrast variant (e.g. Light ↔ Espresso) to verify change |
| One panel shows different grain scale | Expected per-panel variation seeding | This is intentional; deterministic by panel index & seed |
| Performance hiccup on first finish switch | Initial procedural texture generation | Subsequent selections use cached textures |
| Undo skips changes | Non-committed update (selection only) | Dimension edits & hole movements commit; selection alone doesn’t push history |

Verification Steps (Browser - 3D):
1. Start server: `uvicorn main:app --reload`
2. Open http://127.0.0.1:8000/box-builder
3. Edit width; metrics update and 3D box mesh resizes.
4. Switch Sub Count to Dual; auto expansion occurs if needed (toast may show). Two hole cylinders appear.
5. Nudge a selected hole with Arrow keys; cylinder moves in 3D.
6. (Ghost panels feature archived; skip — no hatch elements should appear.)
7. Ctrl+Z then Ctrl+Y to undo/redo a prior dimension edit.
8. Enter Cut Diameter override; hole cylinder radius updates.
9. Toggle Auto Rotate button to stop/start slow spin.
10. Shift+drag accelerates orbit.
11. Enable port inputs + Show Internal; configure slot / round / aero parameters; port meshes render.
12. Uncheck Show Port Overlay; port meshes hide while tuning metrics persist.
13. Cycle Finish selector through variants; observe palette & grain density changes. Re-select a previous variant (should apply instantly due to cache reuse, no flicker).
14. Toggle Grid: helper lines appear/disappear; state persists after reload.
15. Toggle Shadows: panel self-shadows and floor shadow appear/disappear; state persists after reload.

Design Principles:
1. Deterministic scaling & centering.
2. Single recompute path (`update()` → `generatePreview()`).
3. Safe clamping: no negative or zero dimensions.
4. Layer order never varies.
5. User intent preserved: auto adjustments surfaced via toast.

If Something Looks Wrong:
- Open DevTools → Console; inspect errors around `box_builder.js`.
- Confirm the inline SVG `<style>` block appears (ensures generate executed).
- Verify each expected input has a `name` attribute (required for query selectors).
- Check that history length ≤ 20 (else logic may have been altered).
 - For 3D preview: ensure `three_preview.js` loaded (Network 200) and canvas present; no checkbox required.
 - Advanced controls: Shift+drag speed-up; Auto Rotate toggle; double-click reset; persistent camera (localStorage `boxBuilder3DCam`).

SVG Download Roadmap:
Will serialize current SVG outerHTML, prepend XML header, and trigger a blob URL download with a descriptive filename: `box_w{W}_h{H}_d{D}_holes{N}.svg`.

Security / Privacy:
- All logic client-side; no dimension data posted automatically.
- Future manufacturer override fetches will be explicit opt-in.
- Restart endpoint allowed only in debug mode; returns 403 in production.

---
## Verifying Browser JavaScript Execution
1. Start server:
  ```powershell
  uvicorn main:app --reload
  ```
2. Navigate to http://127.0.0.1:8000/box-builder
3. Open DevTools (F12) > Console: confirm no errors and observe state update logs.
4. In Network tab ensure `box_builder.js` loads with status 200.
5. Change an input value (e.g. Width). Metrics (Gross/ft³) update immediately and SVG redraws.
6. (Future) Click Download SVG once feature is implemented; will produce descriptive filename.

Cache Busting: The template adds `?v=<timestamp>` to static CSS/JS via the `cache_bust` context variable so hard refresh brings new assets.

Health Endpoint: `GET /assets/health` returns JSON listing critical JS assets with `exists` and `size` fields for quick diagnostics.

If JS appears not to run:
- Confirm no 404s for `/static/js/...` files.
- Check console for syntax errors before the init log.
- Ensure browser JavaScript is not disabled (rare but possible via extensions/policies).

### Script Path Notes
Static assets are served under the `/static` mount defined in `main.py`. The builder script uses a cache-busted URL: `/static/js/box_builder.js?v=<timestamp>`.

## Scraping Module Usage
The scraping feature lets you POST a list of product page URLs and receive parsed subwoofer data.

Endpoint:
```
POST /subwoofers/scrape
Body (JSON): ["https://example.com/subwoofer1", "https://example.com/subwoofer2"]
```

Fast test without real network (uses sample HTML in unit test):
```powershell
pytest -q
```

When integrating real sites, adjust CSS selectors in `app/scraping/parser.py`.

### Crutchfield Specific Scraper
You can scrape Crutchfield subwoofer listing pages directly:
```
GET /subwoofers/crutchfield?pages=3
```
Returns aggregated products from the first 3 pages.

Note: Respect Crutchfield's terms of service and avoid excessive requests. Increase politeness by adding delays if you expand concurrency.

Notes:
- Be respectful of robots.txt and rate limits.
- Add caching or persistence for results if scraping heavy pages.
- Consider rotating user agents and adding retries/backoff for robustness.

### Sundown Manufacturer Scrape (8" Subs)

A lightweight manufacturer endpoint provides 8" Sundown Audio subwoofer models. It attempts a live scrape of the public catalog page and falls back to a small synthetic list if the site blocks requests or the network is unavailable.

Endpoint:
```
GET /subwoofers/sundown
```
Response shape:
```jsonc
{
  "total": 4,
  "source_page": "https://sundownaudio.com/pages/sundown-subwoofer-page",
  "items": [
    {
      "brand": "Sundown Audio",
      "model": "SA-8 V.3",
      "size_in": 8.0,
      "cutout_diameter_in": 7.44,
      "cutout_estimated": true,
      "source": "sundown",
      "url": "https://sundownaudio.com/pages/sundown-subwoofer-page#model-sa-8-v.3",
      "scraped_at": 1712345678.123
    }
  ]
}
```

Cutout diameter uses the same heuristic (0.93 × nominal) unless a precise spec is later integrated. Fallback models are labeled with `source: sundown-synthetic` so they can be visually distinguished or filtered client-side.

Persistence:
- Results are merged into the main subwoofer DB (`subwoofers_db.json`) without overwriting richer existing records.
- A size bucket snapshot updates `subwoofers/8/latest.json` after each successful scrape.

Development Tips:
- If repeated 403/timeout occurs, the endpoint still returns the synthetic fallback ensuring the UI remains functional.
- To extend to other sizes or brands, duplicate the helper structure in `app/scraping/sundown.py` (or create a new module) and add a corresponding router endpoint.
- Consider adding per-model manufacturer cutout overrides once specs are collected; those will supersede the heuristic and set `cutout_estimated: false`.

### JL Audio Manufacturer Scrape (8" Subs)

Endpoint:
```
GET /subwoofers/jlaudio
```
Behavior mirrors the Sundown endpoint. It scrapes the JL Audio car subwoofer collection page for 8" product links (pattern match on `8"`, `8 inch`, or model tokens beginning with `8W`). Non-subwoofer items (amplifiers, enclosures, accessories) are filtered out.

Sample response (abridged):
```jsonc
{
  "total": 1,
  "source_page": "https://www.jlaudio.com/collections/car-subwoofers",
  "items": [
    {
      "brand": "JL Audio",
      "model": "8W3v3",
      "size_in": 8.0,
      "cutout_diameter_in": 7.44,
      "cutout_estimated": true,
      "source": "jlaudio",
      "url": "https://www.jlaudio.com/products/8w3v3-4",
      "scraped_at": 1712345678.321
    }
  ]
}
```

Fallback: If live fetch fails or HTML parsing yields no matches, a synthetic list with representative models (`8W1v3`, `8W3v3`, `8W7AE`, `CP108LG-W3v3`) returns under `source: jlaudio-synthetic`.

Persistence & Merge:
- Same merge & size bucket update strategy as Sundown.
- Duplicate URLs are deduped; re-running the endpoint will not balloon entries.

Extending to Other Sizes:
- Copy `app/scraping/jlaudio.py` and adjust size filter (e.g., `10"` patterns) plus endpoint path (`/subwoofers/jlaudio10`).
- Consider unifying manufacturer scrapers into a single registry with brand + size parameters if expanding further.

Testing:
- `tests/test_jlaudio.py` covers response shape, bucket persistence, and idempotent merging.
- Add a forced-fallback test by monkeypatching `_fetch_html` to return `None` if you need explicit synthetic path coverage.


## Show Port Overlay Feature

The builder includes a real-time, local port geometry estimation prior to server-side design computation. Supported types: slot (single/dual), round (multiple), aero (flared). Each overlay displays a dashed physical length indicator (approximate) for the first port and an annotated `L≈` label.

Toggle Behavior:
 - Checkbox `Show Port Overlay` (in Port Design fieldset) controls visibility of local estimated shapes.
 - Server-computed port preview supersedes local overlay and still renders when toggle is off.

Color Coding:
 - Slot / Round: Blue (#58a6ff stroke)
 - Aero: Amber (#ffb543 stroke) + optional dashed flare ring.

Estimation Inputs:
 - Internal volume (computed from dimensions minus wall thickness)
 - Port parameters (height & gap for slot, diameter & flare radius for round/aero)
 - Target tuning frequency & number of ports

Edge Handling:
 - Missing or zero height/diameter skips rendering.
 - Invalid internal volume or dimensions prevent estimation gracefully.
 - Dual slot width allocation accounts for configured gap and avoids divide-by-zero.

Future Improvements:
 - Velocity-based color gradients.
 - End correction differential display (effective vs physical length).
 - Discrepancy badge when local vs server tuning differs beyond threshold.
  - 3D correlation: show same port effective length highlight in 3D view.

Quick Validation (Ports + 3D):
 1. Enter target tuning & slot height → slot meshes appear; metrics show estimated length.
 2. Change port type to round and set diameter → round cylinders appear (spacing honored).
 3. Switch to aero & add flare radius → cylinders amber + flare torus ring.
 4. Uncheck Show Port Overlay → port meshes disappear; metrics unchanged.
 5. Compute server design (backend) → server metrics populate (3D uses local meshes until server mesh feature added).
 6. Toggle Auto Rotate Off/On → rotation stops/starts.

## 3D Preview (Always On)
The builder now relies on a persistent Three.js WebGL canvas for visualization. The SVG path remains internally generated for metrics consistency & future export, but is not rendered in the UI.

Rendered Elements:
- Box mesh (exterior only)
- Hole cylinders (forward-facing, semi-transparent)
- Port meshes (slot rectangles / round cylinders / aero cylinders + flare ring)
- Optional slow box rotation (toggleable)

Camera & Interaction:
- Drag orbit with inertial damping; Shift accelerates
- Wheel zoom (bounded)
- Double-click reset
- Auto Rotate toggle; camera + rotation persistence via localStorage

Performance & Limits:
- Full group rebuild each state change (planned geometry reuse & selective transforms)
- No CSG subtraction (visual approximation only)
- Port meshes suppressed when Show Port Overlay unchecked (server mesh integration planned)
 - Procedural wood textures generated & cached per (variant, panelIndex, seed, strength, knots) to avoid redundant canvas draws & GPU uploads.

Troubleshooting:
- Missing canvas: verify scripts loaded; fallback message if CDN blocked
- Distorted view: resize window to update aspect
- Stale camera after reset: ensure localStorage not blocked

Roadmap:
- Debounced rebuilds & mesh reuse
- Internal bracing & panel thickness depiction
- SVG + GLTF export
- Slice / cutaway mode
- Port effective vs physical length visual differentiation
 - Finish customization sliders (grain strength, knot toggle) & randomize seed button
 - Material export & screenshot helper
 - Potential reintroduction of archived "Fun Spin" animation as an optional accessibility/engagement mode (currently removed and stored under `archive/`).


## License
MIT (add LICENSE file if needed)

---

## Cut Sheet PDF Export
The builder can generate a multi-page PDF containing:

1. Overview page with exterior dimensions, join style, kerf thickness, utilization summary.
2. One page per 4x8 (96" x 48") MDF sheet showing optimized panel placement using a simplified maximal-rectangles (guillotine split) algorithm with kerf compensation.

### Endpoint
`POST /export/pdf`

Body (JSON):
```json
{
  "width": 18.0,
  "height": 12.0,
  "depth": 10.0,
  "wall_thickness": 0.75,
  "include_ports": false
}
```

Response: `application/pdf` (attachment `box_cutsheet.pdf`).

### Panel Derivation & Join Styles
Assumes input width/height/depth are exterior dimensions.

Join Styles:
| Style | Description | Adjustments |
|-------|-------------|-------------|
| front_back_overlap | Front/Back span full width; sides butt into them | No width reduction; panels: Front/Back (W×H), Left/Right (D×H), Top/Bottom (W×D) |
| side_overlap | Sides span full depth; Front/Back sit between sides | Front/Back & Top/Bottom width reduced by 2×wall_thickness (inner width) |

Brace & Port Panels (optional):
- Slot Port Walls: Each divider sized `slot_port_width × slot_port_height`.
- Brace Strips: Vertical strips sized `brace_strip_width × (H - 2×wall_thickness)` (fallback to full height if subtraction <= 0).

### Packing Algorithm (Max-Rect Simplified)
For each sheet a list of free rectangles is maintained. Panels are sorted by descending area. Each panel attempts placement into the first free rectangle that can fit it (optionally rotated). Kerf thickness is added to both dimensions for fit testing to enforce spacing. When placed, the occupied rectangle is removed and split into right and bottom free rectangles (guillotine split). A new sheet is introduced when no existing free rectangle can accommodate the next panel. Utilization = (sum(panel areas) / (sheet_count × sheet_area)).

Kerf Compensation:
- Input `kerf_thickness` (default 0.125 in) is treated as spacing and added to width/height when evaluating free space.
- Actual stored panel size remains true dimensions; the free rectangles shrink by panel dimension + kerf to leave a cutting gap.

### Front-End Usage
Fill dimensions, pick Join Style, optionally check Include Slot Port Panels / Include Brace Strips and fill their parameters. Click "Download Cut Sheet PDF". Filename pattern: `box_cutsheet_{SHEETS}sheet.pdf`.

### Future Improvements
- More advanced heuristics: best-area-fit / minimal leftover splitting ordering.
- Skyline / maximal rectangles hybrid for higher utilization.
- True kerf-aware dimension reduction (option to subtract kerf rather than spacing). 
- Rabbet/dado/miter join styles auto-adjusting Top/Bottom/Side dimensions.
- Multi-material & thickness grouping (generate separate sheets per material).
- Piece labeling with drill guides, driver cutout center coordinates, port wall orientation.
- DXF/SVG export for CNC workflows.
- Offcut inventory tracking and reuse suggestions.

### Troubleshooting
| Symptom | Cause | Resolution |
|---------|-------|-----------|
| 500 error | Missing `reportlab` install | Run `pip install -r requirements.txt` |
| 400 error (panel too large) | Panel exceeds sheet even rotated | Adjust dimensions or split panel manually |
| Excessive sheet usage | Kerf set too high or many braces/ports | Reduce kerf or brace/port counts |
| PDF blank | `reportlab` font issue (rare) | Update reportlab; view using Adobe Reader |
| Missing port/brace pieces | Check Include checkboxes & numeric fields | Ensure non-zero counts and dimensions |
| Panels overlap visually | Bug in packing split logic | Report issue; temporarily reduce kerf or disable rotation |

### Local Test (PowerShell)
```powershell
Invoke-RestMethod -Uri http://127.0.0.1:8000/export/pdf -Method Post -ContentType 'application/json' -Body '{"width":18,"height":12,"depth":10,"wall_thickness":0.75}' -OutFile cutsheet.pdf
```

Open `cutsheet.pdf` to verify both pages render correctly.

## Sheet Layout SVG & DXF Export
Two additional endpoints provide CNC-friendly vector outputs of the packed panel layout produced by the same derivation + maximal-rectangles packing used for the PDF.

### Endpoints
`POST /export/svg` → `image/svg+xml` attachment `layout_sheet_{SHEETS}sheet.svg`

`POST /export/dxf` → `application/dxf` attachment `box_cutsheet_{SHEETS}sheet.dxf`

Request Body: Identical to PDF (`width`, `height`, `depth`, `wall_thickness`, `join_style`, `kerf_thickness`, optional port & brace params).

### SVG Layout Details
- Scaling: 1 inch = 10 px.
- Multiple sheets rendered side-by-side with 40 px gap.
- Each sheet wrapped in a `<g id="sheetN">` group with a border rectangle.
- Panels rendered as `<rect class="panel">` elements with text labels (name and size; rotated panels marked with `R`).
- Kerf spacing appears visually as gaps between rectangles.
- Lighter fill (`#eee`) and stroke for panels; heavy stroke for sheet border.

### DXF Layout Details (Minimal ASCII R12-Like)
- Layers: `SHEET` (sheet outlines) and `PANEL` (panel rectangles).
- Units: inches (no scaling; each sheet offset +X by 10 in gap).
- Entities: Only LINE segments forming rectangles (no POLYLINE/TEXT yet).
- File sections: HEADER, TABLES (LAYER definitions), ENTITIES, EOF.
- Import: Tested with common CAM/CAD apps; if layer coloring not preserved, verify import settings.

### Example DXF Snippet (Truncated)
```
0
SECTION
2
HEADER
0
ENDSEC
0
SECTION
2
TABLES
0
TABLE
2
LAYER
70
2
0
LAYER
2
SHEET
70
0
62
7
6
CONTINUOUS
0
LAYER
2
PANEL
70
0
62
1
6
CONTINUOUS
0
ENDTAB
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
8
SHEET
10
0.0000
20
0.0000
11
96.0000
21
0.0000
0
ENDSEC
0
EOF
```

### Validation
- SVG file opens in browser: contains `<svg>` root, `<defs>` style, panel `<rect>` and `<text>` labels.
- DXF begins with `0\nSECTION` and ends with `0\nEOF`.
- Kerf gaps visible in SVG; DXF spaces reflect panel placements (no overlapping LINE rectangles).

### Future Enhancements
- Add optional drill center marks (CIRCLE entities / small crosshair in SVG).
- Include text entities in DXF for panel names & dimensions.
- Layer for cutout circles (driver holes) with accurate diameters.
- Option to export combined single-sheet view for CAMs that auto-step-n-repeat.
- Dogbone or fillet markers for CNC inside corners.
- Arcs for circular cutouts (DXF ARC entities) and port circles.

### Troubleshooting
| Symptom | Cause | Fix |
|---------|-------|-----|
| DXF imports with giant scale | CAD expects mm | Set units to inches or scale by 25.4 |
| Missing layers in CAM | Import setting flattening layers | Enable layer import / mapping in preferences |
| SVG shows no labels | Font blocked or truncated download | Re-download; ensure `<text>` elements present |
| Panels overlap | Packing regression | Reduce kerf or report issue; verify join style & dimensions |
| DXF lines merged into polyline | Viewer auto-merging | Accept or disable polyline merge in settings |

---

