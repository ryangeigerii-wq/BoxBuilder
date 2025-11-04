# BoxBuilder Architecture

## 1. Domain Overview
Designing subwoofer enclosures (speaker boxes) with accurate internal volume, cutout diameters, and layout constraints. The system combines a FastAPI backend (data, health, scraping) with a framework-free vanilla JavaScript frontend that renders a deterministic axis‑aligned SVG preview.

## 2. Core Concepts & Terms
- Width / Height / Depth (W/H/D): External box dimensions in inches.
- Wall Thickness: Used to derive internal available volume (net) from gross external volume.
- Gross Volume: Raw external volume (W × H × D).
- Net Volume: Gross minus displacements (driver, bracing, etc.).
- Subwoofer Nominal Size: Marketed size (8, 10, 12, 15). Used for heuristic cutout diameter if spec not supplied.
- Cutout Diameter Heuristic: `cutout = nominal_size * 0.93` when actual manufacturer spec absent.
- Ghost Panels: Semi‑transparent hatched panels that provide spatial context (depth/side/back) in SVG.
- Holes: Circular cutouts representing subwoofer mounting openings.
- Zoom Presets: Close / Normal / Wide framing modes for SVG viewBox scaling.
- Undo/Redo History: Bounded stack (max length) of committed state transitions (dimension changes, hole moves).

## 3. Goals
1. Deterministic axis‑aligned 2D rendering (avoid pseudo‑3D skew or perspective ambiguity).
2. Framework‑free client (no React/Vue/etc.) to keep payload and cognitive overhead minimal.
3. Fast iterative updates: Single `state` object drives all preview regeneration.
4. Strong backend typing & validation via Pydantic models and schemas.
5. Test‑first mindset: Unit tests for API endpoints; smoke/integration test for frontend load & dynamic behavior.
6. Clear separation of concerns: models vs schemas vs routers.
7. Minimal DOM mutations (full SVG regeneration through one pathway `generatePreview()`).

## 4. Non‑Goals
- 3D rendering or perspective simulation.
- Heavy SPA frameworks or virtual DOM abstractions.
- Over‑engineered state management libraries (Redux, MobX, etc.).
- Implicit network posting of dimension changes (client remains local unless user explicitly triggers endpoints).

## 5. High‑Level Flow
User edits form inputs → `update()` called → state validated & clamped → history recorded → `generatePreview()` returns SVG string → DOM `preview-wrapper` innerHTML replaced → event listeners maintain selections & toast messages.

## 6. Backend Module Overview
- `main.py`: FastAPI app initialization, static files mount, router inclusion.
- `app/core/config.py`: Settings management (environment variables, configuration centralization).
- `app/api/routes/health.py`: Health/status endpoints; may include asset integrity in future.
- `app/api/routes/box.py`: Box creation / sample data endpoints.
- `app/api/routes/subwoofers.py`: Heuristic and specification override logic for cutout diameter; scraping triggers.
- `app/models/box.py`: Internal Python model representations (e.g., Box domain model if present).
- `app/schemas/box.py`: Pydantic Box schema for request/response validation.
- `app/schemas/subwoofer.py`: Pydantic schema for subwoofer cutout responses.
- `app/scraping/*`: (Placeholder) Previously housed external product page scrapers; currently no active third-party scraping logic.

## 7. Frontend Structure
- Template `box_builder.html`: Form layout, zoom controls, collapsible menus, preview container.
- Script `box_builder.js`: All interactive logic (state object, history stacks, rendering, event handlers, heuristics, toast messaging, ghost panel & hole layout algorithms).
- Styles `style.css`: Shared site styling plus builder page classes (`.triple`, `.triple-field`, hatch style definitions inline in SVG when rendered).

## 8. State & History Model
```text
state = {
  width, height, depth, wallThickness,
  subSize, cutDiameterOverride?, holes: [{x,y,r,selected}],
  showGhost, showDims, zoomMode, ...
  history: [], future: []  // Undo / redo stacks
}
```
Transition Rules:
- Dimension changes and hole movements push a snapshot into history (bounded length).
- Selecting a hole alone does not create a history entry (avoid noisy undo steps).
- Undo pops from `history` and pushes current to `future`; redo does the reverse.

## 9. Key Invariants
- width, height, depth > 0 (clamped; prevent zero or negative geometry).
- hole radius derives from cut diameter (either override or heuristic); cannot exceed min(width,height)/2 minus margin buffer.
- Ghost panel offset deterministic relative to depth (no randomness).
- History length ≤ configured max (e.g. 20) ensures memory bounded.
- Layer order: ghosts → front panel → holes → dimension lines → toast overlays.

## 10. Rendering Pipeline (SVG)
1. Compute scaled geometry values.
2. Build SVG `<style>` block (colors, stroke widths, hatch pattern).
3. Add ghost panels (conditional: `showGhost`).
4. Add primary rectangle (front face).
5. Add hole circles with selection styling.
6. Add dimension lines & text if `showDims`.
7. Return assembled string; assign to preview container.

## 11. Validation & Testing Strategy
- Python Unit Tests: Located under `tests/` (e.g., `test_box.py`, `test_home.py`, `test_subwoofers.py`). Use `TestClient` for API endpoint assertions.
- Scraping Tests: Provide sample HTML fixtures to ensure parser resilience without hitting live site.
- Playwright Smoke Test (optional): Launch builder page, wait for spinner removal, validate preview mutation after input change.
- Manual Browser Checklist: Documented in README & `agents.md` (zoom bar position, ghost panel toggle, heuristic behavior).

## 12. Error Handling
- Frontend: Avoid silent failures; log critical exceptions to console; highlight fallback messaging if SVG generation fails.
- Backend: Pydantic validation errors returned with 422; health endpoint used for quick diagnostics.

## 13. Performance Considerations
- Full SVG regeneration acceptable for modest geometry complexity (few holes). Future multi-hole expansion may require diffing or partial updates.
- No external libraries reduces parse & execution overhead.
- Capped history prevents uncontrolled memory growth.

## 14. Extensibility Points
- Port Visualization: Extend `generatePreview()` to draw slot/round port shapes based on selected parameters.
- SVG Download: Serialize current SVG to Blob → trigger download.
- Persistence Layer: Introduce models with SQLAlchemy or SQLModel; add repository abstraction.
- Unit Conversion: Add toggle to recalc and relabel dimension inputs (in ↔ mm) with formatting.
- Advanced Layout: Hole grouping & symmetry duplication helpers.

## 15. Security / Privacy
- No automatic posting of design data; user-driven only.
- Scraping respects site constraints (add rate limiting/backoff for production use).
- Restart endpoint guarded (debug-only usage recommended).

## 16. Tooling & Developer Experience
- VS Code settings: Black formatting, Ruff lint, pytest integration, Playwright optional.
- Tasks: Automated environment creation, dependency install, server run, tests, lint.
- Launch Configs: Debug FastAPI via `uvicorn` module; debug Pytest test run.
- Dev Container: Reproducible container with Python 3.11 & node feature.

## 17. Future Test Enhancements
- Snapshot tests for SVG output with canonical dimension sets.
- Unit tests for heuristic override precedence (actual spec vs blank vs override).
- Accessibility checks (focus order, ARIA roles for interactive controls).

## 18. Glossary
- Axis‑Aligned: Pure 2D plan view without skew; coordinates map directly to physical dimensions.
- Heuristic Cut Diameter: Fallback calculation using 0.93 ratio when manufacturer spec missing.
- Ghost Panels: Transparent rectangles behind primary face offering depth context.
- Zoom Preset: Predefined viewBox scaling mode.

---
Document maintained to communicate architectural decisions, invariants, and growth paths.
