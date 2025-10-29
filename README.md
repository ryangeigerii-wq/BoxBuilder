# box_builder

Minimal FastAPI backend skeleton.

## Features
- Settings management via `pydantic` (`app/core/config.py`)
- Modular routers (`app/api/routes`) for health and box creation
- Separation of concerns: models vs schemas
- Basic test using `TestClient`

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
- Introduced optional Playwright smoke test description and usage.
 - Implemented local port physics estimation (Helmholtz) with slot, round, aero visualization overlays.
 - Added dual slot and multi-round/aero port overlay rendering with length indicators.
 - Added Show Port Overlay toggle to hide local (pre-server) port drawings while still showing server-computed designs.

Removed technologies / files:
- `app/static/js/vendor/lemonade.min.js` and associated loader logic.
- Entire `app/wasm/` directory (Rust experiment).
- Legacy helper `lemonade_vendor.py`.

Added/Modified assets:
- Updated `box_builder.html` template: field ordering, menu integration, zoom bar repositioning, label rename, alignment improvements.
- Updated CSS (`style.css`): added `.triple-field` and retained responsive grid design.
- JS file `box_builder.js` cleaned (no framework references) and corrected logic around ghost edges & preview generation.

## Validation Checklist
Use this list to verify the current state after pulling latest changes:
1. Static Assets
  - Confirm `/static/js/box_builder.js` loads (Network tab status 200).
  - Ensure no requests to removed WASM or Lemonade assets (search for `wasm` or `lemonade` in Network).
2. Form Layout
  - Wall Thickness appears above Port Design & Cutout Settings buttons.
  - In the Dimensions panel, the row with Cut Diameter / Subwoofer Size / Sub Count is evenly spaced and labels are aligned.
  - Sub Count label visible; source still uses `name="subConfig"` (check DOM inspector).
3. Collapsible Menus
  - Port Design button reveals fieldset containing Port Type; closing/hiding works without layout shift.
  - Cutout Settings fieldset includes override guidance and no duplicate Cut Diameter input outside intended rows.
4. Zoom Bar
  - Positioned above the Preview heading; active button shows outlined highlight (no checkmark glyph).
5. SVG Preview Functionality
  - Changing Width/Height/Depth updates SVG and metrics (Gross/Net volumes).
  - Toggling ghost panels renders semi-transparent hatched panels; ghost edge lines visible.
  - Hole selection and arrow key nudging works (selected hole outlines thicker or styled differently as per JS code).
  - Undo/Redo (Ctrl+Z / Ctrl+Y) affects last dimensional or hole movement changes (history capped at 20).
  - Show Port Overlay: when unchecked, local estimated port shapes (slot/round/aero) are hidden; server design still appears if computed.
6. Cut Diameter Heuristic
  - Leave Cut Diameter blank: computed hole diameter = nominal size × 0.93.
  - Enter a value: override applies immediately.
7. Sub Count Behavior
  - Switching from Single to Dual adds second hole symmetrically (verify bounds enforcement).
8. No Console Errors
  - Open DevTools; console should be free of errors after initial load.
9. Restart Server Button
  - In debug/reload mode: POST to `/admin/restart` triggers toast and spinner reinitialization after reload (if implemented in JS).
10. Tests
  - `pytest -q` passes unit tests.
  - Optional: run Playwright smoke test; should load page, remove spinner, confirm preview updates.

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

## Standard Cutout Preset
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

Current Front-End Features:
- Editable dimensions: width, height, depth (with clamping)
- Subwoofer size select (8 / 10 / 12 / 15)
- Standard Cutout Preset: auto hole diameter = nominal × 0.93 (heuristic)
- Optional per-hole diameter override toggle + value input
- Multi-hole support (single/dual layout selection) with click-to-select
- Keyboard nudging of selected hole (Arrow keys; Shift = ×5)
- Bounds enforcement with automatic adjustments + toast message
- Ghost panels (left side plus optional back/right ghost rectangles) toggle with hatch (opacity 0.25)
- Undo / Redo (Ctrl+Z / Ctrl+Y or Ctrl+Shift+Z)
- Zoom presets (Close / Normal / Wide) above the preview
- State Reset button (restores initial default state without page reload)
- Dev-only Restart Server button (POST /admin/restart) when running with `--reload` & debug=True
- Live SVG preview with layered rendering order: ghosts → front → holes → dimension lines → toast
 - Local port estimation overlay (slot, dual slot, round, aero) with dashed length indicator and annotation.
 - Show Port Overlay toggle to hide local preview without affecting server-computed port visualization.

Planned Enhancements:
- SVG download (button stub present)
- Port and bracing visualization
- Unit switching (in ↔ mm) with automatic conversion & formatting
- Persistent local storage of last session state
- Hole grouping & symmetry duplication tools
- Manufacturer spec fetch & auto-fill overrides
- Future frequency visualization (replaces retired grid snap concept)
 - Server vs local tuning discrepancy indicator (highlight variance threshold)

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
| Undo skips changes | Non-committed update (selection only) | Dimension edits & hole movements commit; selection alone doesn’t push history |

Verification Steps (Browser):
1. Start server: `uvicorn main:app --reload`
2. Open http://127.0.0.1:8000/box-builder
3. Change Width; SVG resizes and metrics update.
4. Add a hole; a new centered circle appears (selected highlight).
5. Nudge with ArrowRight — hole center moves smoothly (fixed 0.25 in base step; Shift = ×5).
6. Toggle ghost; ghost panels render with hatch.
7. Press Ctrl+Z then Ctrl+Y to confirm undo/redo of last movement.
8. Enable override; set diameter smaller; hole shrinks instantly.
9. Switch Zoom preset (Close/Normal/Wide) and observe reframe.
10. Click Reset State; dimensions revert to defaults and toast shows "State reset.".
11. (Dev) Click Restart Server; toast shows "Server restarting..." and after auto-reload the spinner is gone again.

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

Quick Validation:
 1. Enter target tuning & slot height → slot overlay appears.
 2. Change port type to round, set diameter → circles appear with length line.
 3. Switch to aero, set flare radius → dashed flare ring added.
 4. Uncheck Show Port Overlay → local shapes disappear (if server design not yet computed).
 5. Compute server design → server preview persists; toggle has no effect on server shapes.

## License
MIT (add LICENSE file if needed)
