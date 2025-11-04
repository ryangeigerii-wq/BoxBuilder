# Agent Activity Log & Validation Guide

This document records agent-driven modifications, rationale behind each change, and how to validate the current system state. It complements `README.md` by focusing on the automation workflow and traceability.

## 1. Objectives
- Maintain a lightweight, framework-free frontend for the box builder.
- Incrementally refine UI layout and usability (menus, alignment, visibility).
- Remove abandoned experiments (LemonadeJS, WASM) to reduce cognitive load.
- Preserve determinism in SVG rendering and clear state transitions.
- Provide transparent verification steps after each iterative change.

## 2. Completed Changes (Chronological Summary)
1. Removed LemonadeJS vendor script and associated loader logic from template.
2. Deleted Rust WASM experimental directory and references; reverted to pure JS.
3. Cleaned `box_builder.js`: eliminated duplicate SVG template chunks and stray inline CSS injection.
4. Fixed ghost panel logic: proper edge lines and hatch styling without duplication.
5. Resolved scoping issue for `ghostEdges` variable (moved declaration outside conditional block).
6. Repositioned Wall Thickness input above collapsible menus to emphasize its influence on internal volume.
7. Merged Port Type selection into the Port Design fieldset for cohesive port configuration UX.
8. Centered zoom bar above preview; replaced checkmark highlight with outline-only active state.
9. Moved Cut Diameter into a unified triple row with Subwoofer Size and (renamed) Sub Count.
10. Renamed visible label "Sub Layout" → "Sub Count" while keeping form `name="subConfig"` for backward compatibility.
11. Added CSS class `.triple-field` to standardize field sizing and alignment across multi-column rows.
12. Updated README with implementation summary and detailed validation checklist.
13. Added optional "Show Port Overlay" checkbox to port fieldset; gated local (pre-server) port visualization.
14. Introduced Finish selector with procedural wood variants (light, medium, dark, deep walnut, espresso, flat) and per-panel variation.
15. Added deterministic, cached procedural wood textures (grain + optional knots) to reduce rebuild overhead.

## 3. Files Added / Modified
- Modified: `app/templates/box_builder.html` (layout restructuring, label rename, zoom bar repositioning).
- Modified: `app/static/css/style.css` (added `.triple-field`).
- Modified: `README.md` (added sections: Recent Implementation Summary, Validation Checklist, Manual Command Reference).
- Unmodified core backend files retained for continuity.
- Added: `agents.md` (this file).

## 4. Removed Assets
- `app/static/js/vendor/lemonade.min.js`
- `app/wasm/` directory (Rust experiment)
- `app/core/lemonade_vendor.py`

## 5. Rationale Highlights
- Stack Simplification: Reduces maintenance overhead and onboarding friction.
- Deterministic Rendering: Avoids skewed or pseudo-3D transformations that complicate dimension interpretation.
- Grouping Related Inputs: Port Type consolidated with port parameters; cut diameter grouped with sub size & count.
- UX Clarity: Consistent field alignment reduces visual noise and scanning time.
- Backward Compatibility: Form field names unchanged; only labels altered for clarity.
 - Procedural Finishes: Eliminates need for external image assets while providing realistic variation.
 - Texture Caching: Avoids repeated canvas generation & GPU uploads when dimensions change or finish re-selected.

## 6. Risk Mitigation
- Kept historical state logic intact (undo/redo unaffected by layout changes).
- Preserved query selectors relying on `name` attributes; only visual markup altered.
- Introduced minimal CSS additions rather than large refactors to avoid cascade regressions.

## 7. Validation Procedure (Quick Run)
```powershell
# Environment setup
python -m venv .venv
./.venv/Scripts/Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```
Browser checklist:
- Navigate to `/box-builder`; spinner disappears after JS init.
- Zoom bar centered above Preview (buttons Close / Normal / Wide).
- Wall Thickness located above Port Design & Cutout Settings buttons.
- Port Design menu includes Port Type field inside fieldset.
- Triple row shows: Cut Diameter (placeholder auto), Subwoofer Size, Sub Count.
- Changing dimensions updates SVG without console errors.
- Toggling ghost panels adds hatched semi-transparent panels and edge lines.
- Dual Sub Count adds a second hole; arrow key nudging works for selected hole.
- Leaving Cut Diameter blank applies 0.93× heuristic; entering override updates instantly.
- Undo/Redo functions (Ctrl+Z / Ctrl+Y) revert/apply last change.
- Show Port Overlay checkbox hides local estimated port shapes (server-computed ports still display if available).
 - Changing Finish cycles palettes (Espresso darkest, Light palest); re-selecting the same finish is instant (cache hit).

## 8. Console / Network Assertions
- No network requests to removed Lemonade or WASM resources.
- `/static/js/box_builder.js` returns 200.
- Console free from `ReferenceError` or `TypeError` on load.
 - No external image fetches for wood textures (all procedural).

## 9. Test Execution
```powershell
pytest -q
# Optional Playwright smoke test
pytest tests/test_box_builder_playwright.py -q
```
Smoke test should: load builder, dismiss spinner, confirm dynamic preview updates.

## 10. Future Automation Suggestions
- Add CI step to diff SVG output for a set of canonical dimension inputs.
- Introduce ESLint configuration to catch future scoping mistakes early.
- Add accessibility scan (axe-core) via Playwright.
- Implement a simple snapshot test for triple-field alignment (DOM structure & CSS class presence).

## 11. Rollback Strategy
If UI regressions occur:
1. Revert template changes affecting layout (`box_builder.html`).
2. Remove `.triple-field` class usages; fall back to baseline `.triple` grid.
3. Re-run tests; ensure no JS exceptions tied to removed markup.

## 12. Open Items / Potential Enhancements
- SVG download implementation.
- Port visualization overlay (slot/round dimensions drawn in preview).
- Local storage persistence for last session state.
- Manufacturer spec integration & hole labeling.
- Unit conversion feature (in ↔ mm toggle).
- Discrepancy indicator when server tuning deviates > threshold from target/local estimate.
 - Finish customization UI (grain strength slider, knot toggle) & randomize seed action.
 - Export thumbnails of each finish variant for documentation.

## 12.2 Recent Change: Unified Menu Button Styling
Previously, collapsible menu toggle buttons (Finish, Dimensions, Subwoofers, Port) each used unique inline styles. A new CSS class `.menu-toggle` now standardizes appearance (baseline #2d485b background, focus outline, expanded state darken, caret rotation). Export & Actions retains its original styling for visual distinction from configuration groups.

Rationale:
- Reduce inline style repetition and ease future palette adjustments.
- Provide consistent hover/focus affordances and expanded-state feedback.
- Preserve intentional differentiation for the Export group.

Validation:
1. All non-export toggle buttons show unified color and spacing.
2. `aria-expanded` toggling updates background shade (#326078 when open).
3. Caret rotates 180° upon expansion.
4. No JS selectors depended on prior inline styles (confirmed via grep for style-specific tokens).

Rollback:
Reapply prior inline `style` attributes or adjust `.menu-toggle` overrides if unique color coding is desired.

## 12.3 Recent Change: Left Menu Spacing Normalization
Inline `style="margin-bottom:1rem;"` attributes were removed from the Dimensions, Subwoofers, and Export collapsible wrappers. A single CSS rule `.form-panel .collapsible-group { margin-bottom:1rem; }` now governs vertical rhythm with a `:last-of-type` override to eliminate trailing extra space.

Rationale:
- Centralize spacing logic to reduce future template diff noise.
- Ensure consistent visual separation across all configuration groups regardless of order changes.
- Simplify future global spacing adjustments (single CSS edit).

Validation:
1. All form panel menus have uniform 16px-ish gap (1rem) below each group.
2. Final group (Export & Actions) does not add unintended extra bottom gap within panel.
3. Smoke test (`test_box_builder_vanilla_smoke`) passes, confirming no structural impact.

Rollback:
Reintroduce per-wrapper inline margins or adjust the CSS rule if a varied spacing scheme is desired.

## 12.4 Recent Change: Collapsible Padding & Animation Normalization
Added CSS variables `--menu-pad-y`, `--menu-pad-x`, and `--menu-transition` to unify inner padding and expansion timing across all collapsible groups. Replaced mixed padding `.85rem 1rem .9rem` with consistent vertical/horizontal values and standardized both max-height and opacity transitions plus caret rotation to use the same cubic-bezier curve.

Rationale:
- Consistent spatial rhythm improves scanability and reduces cognitive load.
- Single timing curve prevents disjointed fade vs height expansion perception.
- Variables enable rapid future tuning without searching scattered numeric literals.

Validation:
1. Opening any menu shows synchronized height + opacity animation (≈250ms).
2. Caret rotation completes in lockstep with panel expansion.
3. No layout shift or clipping observed on rapid open/close (tested manually).
4. Smoke test passes; no JS dependent on previous padding/transition values.

Rollback:
Restore prior padding literal and individual transition declarations or tweak `--menu-transition` if faster/snappier behavior desired.

## 12.5 Recent Change: Reduced Motion & Fast Toggle + Legend Normalization
Added `@media (prefers-reduced-motion: reduce)` block to disable menu/caret transitions and show panels instantly for users requesting lower motion. Introduced `--menu-transition-fast` (120ms) and a `.fast-toggle` class enabling accelerated open/close feedback without full removal of animation. Normalized all `<legend>` elements via variables (`--legend-font-size`, `--legend-padding-x`, `--legend-opacity`) and removed inline style attributes.

Rationale:
- Accessibility: Honors OS/user agent reduced-motion preference.
- Performance UX: Faster variant supports rapid iteration scenarios (power users) while keeping default smoothness for general users.
- Maintainability: Central legend styling avoids repetitive inline adjustments and eases future typography tuning.

Validation:
1. Smoke test passes; no JS dependent on previous legend inline styles.
2. Applying `.fast-toggle` to a menu button halves animation duration; visual state consistent.
3. Enabling reduced-motion (simulated via dev tools) removes height/opacity transitions; panels appear immediately.

Rollback:
Remove `.fast-toggle` usages and delete the new variables or media query section; reintroduce inline legend styles if granular per-legend differentiation is desired.

## 12.1 Recent Change: Spec Diameter Field Removal
The explicit "Spec Diameter" input was removed from the UI to simplify hole sizing logic. Diameter precedence is now:
1. User-provided Cut Diameter (exact value)
2. Heuristic fallback: `nominal * 0.93`

The `h.spec` property remains in state objects (always null) for backward compatibility with any external scripts expecting it. Badge labeling updated: only CUT (explicit) or EST (heuristic) now render.
Rollback: Re-add the input field block in `box_builder.html` and restore parsing branch in `readForm()` (commit history contains previous implementation).

## 13. Glossary
- Heuristic Cut Diameter: `nominal_size * 0.93` fallback when explicit spec absent.
- Ghost Panels: Semi-transparent geometry providing spatial context for depth/back panels.
- Triple Row: Responsive grid grouping exactly three related inputs.
 - Finish Variant: Procedural wood style keyed by dropdown selection, influencing grain density & knot presence.
 - Grain Strength: Multiplier for number / opacity of grain lines per texture.
 - Knot: Radial gradient artifact; count scales with variant base strength (disabled for flat finish).

## 14. Contact / Maintenance Notes
Changes designed to minimize coupling: front-end logic restricted to a single JS file. Static asset cache busting ensures updates propagate without manual hard refresh.

### 14.1 Output / Export Directory Structure
An `output/` directory is now created at startup (idempotent) with subfolders:
- `glb/` – 3D model exports (future GLB/gltf artifacts)
- `cut_sheets/` – Saved cut-sheet HTML or PDF variants
- `svg/` – Standalone SVG panel / layout exports
- `textures/` – Optional cached procedural texture atlases
- `temp/` – Ephemeral intermediates (safe to purge)

Helper: `app.core.paths.ensure_output_dirs()` guarantees structure; `get_export_path(kind, filename)` builds paths safely. Unknown kinds raise `ValueError`.

Rationale:
- Centralize artifact locations for easier cleanup & backup.
- Prepare for upcoming export endpoints (GLB, SVG snapshot, PDF cut sheet).
- Avoid sprinkling hard-coded relative paths across modules.

Validation:
1. Launch app (dev): folders appear if absent.
2. Read permissions only environment: warning printed but app continues.
3. `from app.core.paths import get_export_path; get_export_path("svg")` returns Path pointing to `output/svg`.

Cleanup / Rotation Strategy:
- Periodic job (future) can prune `temp/` by mtime > threshold.
- User-triggered "Clear Cache" action may delete `textures/` to force regeneration.

Rollback: Remove `ensure_output_dirs()` call in `main.py`, delete `app/core/paths.py`, and optionally delete `output/` root.

---
Generated and maintained by the automated agent to ensure traceability and reproducibility of UI and logic changes.

## 12.6 Recent Change: Compact Spacing Tightening
## 12.7 Recent Change: Finish Variant Sync & Test Auto-Open
Added missing finish variants (light, medium, deep-walnut) to 3D preview `FINISH_VARIANTS` ensuring unique grain parameters and strength values so texture UUIDs differ per selection. Collapsible menus now auto-open when `?test=1` or `?debug=1` is present in the URL to improve Playwright reliability without altering default user experience (still collapsed by default).

Rationale:
- Keep UI dropdown and rendering layer consistent to avoid fallback mapping ambiguity.
- Provide deterministic distinct textures aiding snapshot / UUID-based tests.
- Eliminate flakiness from hidden controls during automated interaction.

Validation:
1. Selecting each finish triggers rebuild with differing internal cache keys and texture UUIDs.
2. Visiting `/box-builder?test=1` shows all menus expanded; removing query collapses them.
3. No console errors; existing selectors unaffected.

Rollback:
Revert `FINISH_VARIANTS` additions and remove auto-open logic in `initCollapsible` (restore always-collapsed initialization).

## 12.8 Change Retired: Comfortable Spacing Toggle Removed
## 12.9 Recent Change: ESLint & Prettier Integration
Added a lightweight front-end linting and formatting toolchain.

Artifacts:
- `package.json` with scripts: `npm run lint`, `npm run lint:fix`, `npm run format`.
- `.eslintrc.cjs` enabling recommended + Prettier integration, browser env, and project globals (THREE, perf APIs).
- `.prettierrc` standardized width (100), single quotes, trailing commas.
- `.eslintignore` excluding Python sources, virtual envs, vendor JS.

Rationale:
- Catch unused variables / accidental console noise early.
- Enforce consistent style for future contributors / automated agent edits.
- Provide fast CI hook potential (`npm run lint` fail on errors).

Validation:
1. Run `npm install` then `npm run lint` → no fatal errors (initial warnings only where intentional underscores ignored).
2. Modify a file with style deviation (e.g., double quotes) then run `npm run format` → corrected.
3. Prettier plugin surfaces formatting issues directly in lint output.

Rollback:
Remove added config files and delete devDependencies from `package.json`.

The previously added Comfortable spacing mode (checkbox, `data-mode="comfortable"` attribute, CSS overrides, localStorage persistence) has been removed. Compact spacing is now the single supported layout density.

Removal Actions:
1. Deleted toggle markup from `box_builder.html`.
2. Removed comfortable mode CSS overrides from `style.css`.
3. Purged density preference logic/localStorage usage from `box_builder.js`.

Rationale:
- Reduce code surface and potential divergence in two spacing modes.
- Simplify future style adjustments (only one set of paddings/gaps).
- Feature considered non-essential for current workflow.

Validation Post-Removal:
1. No `comfortableMode` checkbox or `data-mode` attribute present in DOM.
2. No console errors referencing density keys.
3. Test suite still passes (spacing purely cosmetic).

Rollback (Restore Feature): Reapply removed HTML snippet, CSS overrides, and JS logic (`initDensityToggle` + localStorage key `boxBuilderDensityMode`). Use earlier commit history as reference.

Global builder page spacing reduced for denser layout:
- Builder layout padding 2rem → 1rem and gap 2rem → 1rem.
- Panel padding 1.5rem → ~0.85rem.
- Collapsible menu toggle buttons height/padding decreased; font-size slightly reduced.
- Collapsible body inner padding standardized to ~0.55–0.6rem.
- Mini button heights trimmed (36px → 28px) for tool group.
- Added compact spacing CSS variables (`--space-compact-xs`, `--space-compact-sm`, `--space-compact`).

Rationale:
- Present more controls above the fold on smaller screens.
- Reduce vertical scroll churn during iterative tuning (dimension & port adjustments).
- Preserve clarity with label uppercase and consistent letter spacing even at reduced size.

Validation:
1. All menus initially collapsed; expanding shows reduced padded interior without clipping.
2. No Playwright selector failures for existing button/fieldset names (tests rely on name attributes unaffected).
3. 3D preview still renders at 420px height (unchanged) ensuring visibility.
4. No horizontal overflow at 320px min form width.

Risks & Mitigation:
- Tighter clickable target: maintained min heights (menu toggles ~28–30px) above WCAG comfortable minimum.
- Potential test expecting "Preview" heading now removed: adjust test to look for `#preview3d` container instead if needed.

Rollback Strategy:
1. Restore previous padding values in `style.css` (`builder-layout`, `.panel`, `.collapsible-body`, button classes).
2. Remove newly introduced compact spacing variables if not reused.
3. Increase gap values back to original (2rem) for spacious mode.

Follow-Up Ideas:
- Provide a user toggle (Compact / Comfortable) persisting preference in localStorage.
- Expose CSS custom property knob for panel padding live adjustment (dev/debug mode).

## 12.10 Recent Change: Advanced Port Math Integration
Added `app/static/js/port_math.js` supplying deterministic, unit-consistent formulas for slot and round port calculations. Functions exposed via `window.PortMath` and consumed by `box_builder.js` inside `recomputeLocalPort()` when available.

Implemented Functions:
1. solvePortLength(params): Computes physical port length (in) required to achieve target tuning `Fb` (Hz) using effective length correction. Incorporates:
	- End correction per termination type (unflanged internal vs external flare factor). 
	- Hydraulic radius for rectangular (slot) ports to approximate viscous effects.
	- Equivalent diameter mapping for slot geometry to reuse circular-based corrections.
2. estimatePortVelocity(params): Estimates peak particle velocity (ft/s) given target power (W), efficiency approximation, and net volume displacement leveraging port cross-sectional area.
3. portResonanceHz(params): Computes first longitudinal resonance (quarter-wave) of port given physical length.

Key Constants:
- C_IN_PER_S: 13503.9 (approx speed of sound at 20°C in in/s)
- TWO_PI: 6.283185307179586 for cylindrical/slot conversion contexts.

Data Flow:
1. Form changes trigger `recomputeLocalPort()`.
2. Basic geometry (slot width/height or round diameter) established.
3. Advanced block calls PortMath functions assembling `advanced` object:
	`{ area_total_in2, length_in, effective_length_in, resonance_hz, velocity_ft_s }`.
4. Preview / server sync logic remains untouched; advanced metrics currently informational (available for future UI overlay or diagnostics).

Determinism Guarantees:
- No randomization; outputs depend solely on numeric inputs (Fb, port type, dimensions, number of ports). Repeated calls with identical state yield identical results.

Validation Steps:
1. Open `/box-builder?test=1` for expanded menus.
2. Enter known configuration (e.g., Fb 32 Hz, slot 2in x 12in, internal depth guess). Observe advanced object logged (if temporary console log enabled during debug) or inspect `window.__boxBuilderState.localPort.advanced` via devtools.
3. Adjust Fb up/down: `length_in` changes inversely with sqrt(Fb) trend; `resonance_hz` updates with quarter-wave relation (≈ C/(4*L)).
4. Switch between slot and round maintaining equal area: length difference reflects end correction variance (slot hydraulic radius vs round).

Edge Cases Considered:
- Zero or negative dimension inputs: Guard returns null advanced block; existing validation prevents invalid geometry from propagating.
- Extremely high Fb (>80Hz typical car-audio outlier): Length shrinks; resonance remains > Fb (expected).
- Multiple ports: Area scales linearly; velocity decreases proportionally (lower ft/s for same input power).

Rollback Strategy:
1. Delete `port_math.js`.
2. Remove import/usage (window.PortMath checks) in `box_builder.js` reverting to prior simple length heuristic.
3. Clear any UI references if later surfaced.

Future Enhancements:
- Surface advanced metrics in a collapsible "Port Diagnostics" panel (velocity color-coded vs recommended threshold).
- Integrate compression / Mach number estimation at vent for power scaling.
- Add unit toggle (metric) with synchronized conversion.
- Provide warning badge if resonance < 3 × Fb (potential audible pipe resonance).

Testing Notes:
- Current test suite does not assert advanced math outputs; safe to iterate formulas without breaking existing tests.
- Add prospective unit tests targeting edge cases (slot vs round equivalence, multi-port scaling, resonance relation) before expanding UI usage.

Rationale:
- Enhances predictive accuracy for port design without server round-trip.
- Establishes foundation for future tuning discrepancy indicators and velocity safety checks.

Accessibility & Performance:
- Lightweight arithmetic only; negligible performance impact on recompute cycle.
- No DOM mutations until future UI integration.

## 12.11 Recent Change: Jest JavaScript Unit Testing Integration
Added Jest-based test harness for front-end computational logic (`port_math.js`). This formalizes earlier ad-hoc Node tests into a structured suite for repeatability and CI integration.

Artifacts:
- `jest.config.cjs`: CommonJS config exporting base Jest settings (test environment `node`).
- `app/static/js/tests/port_math.spec.js`: Test cases covering:
	- Slot vs round area equivalence (effective length within 5%).
	- Multi-port scaling proportionality (effective length & total area scale linearly with port count under current model).
	- Quarter-wave resonance relation (`portResonanceHz` ≈ c/(4*L_eff)).
	- Velocity estimation fallbacks (nulls when insufficient Sd/Xmax; decreasing velocity with increased area).
- `package.json` script `test` mapped to `jest --runInBand` for deterministic ordering and reduced concurrency footprint on constrained CI runners.

Execution:
```powershell
# Install JS dev dependencies (if PowerShell policy blocks scripts, you can bypass for this session):
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npm install
npm test
```

Expected Output:
- All tests pass with no snapshot usage (pure numeric assertions).
- No console noise (PortMath functions pure, no logging).

Determinism & Isolation:
- `port_math.js` attaches API to `globalThis.PortMath` for Node environment; tests import via side-effect `import '../port_math.js';`.
- No DOM dependencies; safe to run in Node test environment without jsdom overhead.
- Seedless math ensures stable values across runs; tolerance driven by floating point precision.

Failure Modes:
- Formula refactor increasing slot vs round length variance beyond threshold triggers equivalence test failure.
- Non-linear multi-port adjustments (if added later) require updating proportionality assertion & documenting rationale.
- Resonance failures indicate unit conversion or length regression (check inches↔meters mapping).

Future Additions:
- Aero flare end correction comparative test.
- Edge case tests: very small ports, large volumes, high tuning (>80 Hz).
- Mach threshold warning test once velocity diagnostic surfaces in UI.
- Advanced object shape snapshot once surfaced beyond internal state.

Rollback:
1. Remove `jest.config.cjs` and `port_math.spec.js`.
2. Delete `jest` devDependency and adjust `test` script.
3. Update CI to skip JS unit stage.

## 12.12 Maintenance: Playwright Test Menu Auto-Open Query Adoption
Playwright integration tests now append `?test=1` to `/box-builder` URLs to auto-open collapsible menus, reducing flakiness from interacting with hidden controls.

Changes:
- Updated test navigation calls to use `/box-builder?test=1` except where `debug3d=1` was already specified; combined queries as needed (`?test=1&debug3d=1`).

Validation:
1. `pytest -q` passes unchanged.
2. Manual load with `?test=1` shows all menus expanded; without parameter defaults remain collapsed.
3. No selector updates required (tests rely on `name` attributes unaffected by open state).

Rollback:
Revert URL modifications; ensure tests include explicit button clicks & waits for each menu before interacting with inner inputs.

## 12.13 Planned Cleanup: Legacy `cutOut` Terminology
Remaining references to deprecated per-hole `cutOut` flag are confined to comments/docs. Functional logic uses `filled` and `showCutouts` only.

Planned Steps (next iteration):
1. Replace comment mentions of `cutOut` with clearer "removed hole" phrasing.
2. Legacy `data-hole-cut-out` attribute removed from both live preview and SVG meta export. Tests updated to assert only diameter & coordinate metadata.
3. Document final decision and update this section.

Post-Cleanup Validation (future):
- `grep -i cutOut` returns zero matches outside archives.
- SVG meta export tests updated to reflect attribute change (or absence).

## 12.14 Recent Change: Finish Customization Controls
Added user-facing procedural wood finish customization within the Finish & Style menu:
- Grain Strength slider (0.25–2.0×) multiplies variant baseStrength affecting grain line count, opacity, and line width weighting.
- Knots checkbox toggles radial knot artifacts; disabled automatically for Flat finish.
- Seed number input + Randomize button produce deterministic texture variations (same variant + grain + knots + seed ⇒ identical textures; differing seed ⇒ new pattern).

Implementation Details:
1. Template (`box_builder.html`): inserted new controls adjacent to Finish Variant select.
2. State: `state.finishOptions = { grainStrength, knotsEnabled, seed }` added to `box_builder.js`.
3. Event Binding: input/change listeners schedule debounced update; randomize sets a new pseudo-random seed (LCG using Date.now()).
4. 3D Preview: `three_preview.js` updated to combine variant baseStrength with user grainStrength multiplier and override knot usage + base seed.
5. Texture Cache Key: `${variant}|${panelIndex}|${seed}|${strength}|${useKnots}` ensures immediate cache hits on repeat and differentiation on any change.
6. Tests: `finish_custom.spec.js` verifies seed/grain/knots influence (skips strict assertions if cache not yet populated in stub environment).

Validation:
1. Change Grain Strength value → texture regenerates (visual density difference) with new cache key; re-select previous value yields instant reuse.
2. Uncheck Knots → no radial gradients present in generated textures; cache key segment changes.
3. Click Randomize → seed input updates; preview textures all change; manually restoring previous seed reverts to prior pattern.
4. Flat finish ignores grain/knots settings (single uniform color) though seed still recorded (no effect on appearance).

Rollback Strategy:
1. Remove added finish controls markup from template.
2. Delete `finishOptions` field & listeners from `box_builder.js`.
3. Revert `applyFinishFromState` modifications in `three_preview.js` (restore prior baseStrength-only logic).
4. Delete `finish_custom.spec.js` test file.

Future Enhancements:
- Persist finishOptions in localStorage for session continuity.
- Expose advanced knot count slider and grain randomness jitter control.
- Add metric/imperial toggle for unrelated fields without affecting finish logic.
- Provide thumbnail preview strip for each seed before applying.

## 12.14.1 Change Retired: Finish Customization Simplification
The Grain Strength slider, Knots checkbox, Seed input, and Randomize button were removed. The Finish & Style interface now offers only a texture variant dropdown (visual finish selection). Underlying 3D preview uses each variant's `baseStrength` and default knot usage (except flat).

Rationale:
- Streamline UI for users focusing solely on box geometry without aesthetic fine-tuning.
- Reduce state surface area (`finishOptions` removed) and related listener code.
- Improve onboarding clarity; fewer early decisions required.

Removal Actions:
1. Deleted customization inputs from `box_builder.html` (toolbar simplified).
2. Removed `finishOptions` object and listeners from `box_builder.js`.
3. Reverted `three_preview.js` logic to ignore overrides, using only variant defaults.
4. Deleted Jest test `finish_custom.spec.js` (no longer applicable).

Validation Post-Removal:
1. Finish dropdown still changes textures; selecting same variant reuses cached texture.
2. No references to `finishOptions` remain (`grep -i finishOptions` returns only historical docs entries).
3. Test suite passes (minus removed test file) confirming no dependency on customization controls.

Rollback (Restore Feature): Reintroduce removed HTML controls, reinstate state.finishOptions block & listeners, restore preview overrides, and recreate `finish_custom.spec.js`.

## 15. New Export Endpoints

### 15.1 JSON Config Export
Endpoint: `POST /export/box` (form fields) persists a minimal box configuration to `output/temp/` as a timestamped JSON file. Response includes:
```
{
	"saved": true,
	"file": "output/temp/box_YYYYMMDD-HHMMSS-ffffff.json",
	"bytes": <size>,
	"config": {...}
}
```
Path normalization uses POSIX separators for portability. Atomic write pattern: write `.part` then `os.replace`.

Validation: All core dimensions > 0 else 400 with `{ "error": ... }`.

### 15.2 SVG Export (Placeholder)
Endpoint: `POST /export/svg` (JSON body) returns a simple rectangle SVG (placeholder wireframe) with appropriate headers for browser download:
`Content-Type: image/svg+xml; charset=utf-8` and `Content-Disposition: attachment; filename=box_<timestamp>.svg`.

Current Implementation Notes:
- Accepts `width` and `height`; ignores other fields for now.
- Used only for early integration tests; later will emit full panel layout with dimension lines & optional port/hole vector shapes.

Testing:
- `tests/test_export_json.py` covers JSON export creation & validation.
- `tests/test_export_vector.py` asserts `/export/svg` returns SVG header (and `/export/dxf` placeholder remains TODO/backlog). DXF endpoint currently unimplemented—test will fail until added or param case removed.

Future Enhancements:
- Promote JSON configs from `temp/` to dedicated `configs/` directory with index.
- Add DXF and PDF generation endpoints writing to `output/svg/` and `output/cut_sheets/`.
- Include hash (SHA256) of config to detect duplicates.
- Allow GET retrieval by filename or hash.

Rollback: Remove endpoint blocks in `main.py` and associated tests; delete generated files as needed.

### 15.2.1 SVG Export JSON Metadata Mode (Stored Variant)
Option A implementation adds a metadata mode to the same endpoint without introducing a new route. Supplying `{"mode":"json"}` (along with normal dimension fields) switches behavior from direct download to persisted asset + JSON response.

Request (example minimal body):
```
{ "width": 10, "height": 5, "mode": "json" }
```

Behavior:
1. Generates the placeholder SVG identical to download mode.
2. Writes file to `output/svg/` named `svg_<timestamp>.svg` using atomic write ( `.part` → replace ).
3. Returns JSON:
```
{
	"saved": true,
	"file": "output/svg/svg_YYYYMMDD-HHMMSS-ffffff.svg",
	"bytes": <int>,
	"width": <float>,
	"height": <float>,
	"inline_preview": "<svg ...>...</svg>"  // present only for very small payloads (<8KB) else omitted
}
```

Design Notes:
- Single endpoint avoids client-side branching; `mode` flag governs representation.
- Atomic write ensures no partial file exposure if process interrupted mid-write.
- Paths normalized with POSIX separators for cross-platform test determinism.
- Width/height are echoed for simple client confirmation without re-reading request object.
- `inline_preview` kept small to discourage storing large SVG blobs in state; omitted when size threshold exceeded.

Validation Steps:
1. POST body with mode=json → HTTP 200 JSON, `saved:true`, file path starts with `output/svg/`.
2. File exists on disk; opening file displays same rectangle geometry as direct download variant.
3. Repeat identical request within the same microsecond yields new filename (timestamp includes microseconds) preventing accidental overwrite collisions.
4. Omitting `mode` reverts to original download workflow with appropriate `Content-Type` & `Content-Disposition` headers.

Edge Cases & Guards:
- Missing width/height: currently defaults to internal fallback (may be enhanced with explicit 422 validation later when full layout needs dimensions).
- Extraneous fields ignored (future schema tightening may validate & reject unknown keys once shape stabilizes).
- Large prospective future SVG (>8KB) automatically suppresses `inline_preview` to keep JSON responses light.

Rollback Strategy:
1. Remove conditional mode handling block within `export_svg` in `main.py`.
2. Delete tests referencing JSON mode (`tests/test_export_svg_json_mode.py`).
3. Update this subsection to mark feature as retired or remove entirely.

Planned Next Iterations:
- Enrich metadata with panel list, cutouts, and port geometry objects once SVG generator becomes layout-aware.
- Add optional `hash` field (SHA256 of SVG text) enabling de-duplication and cache validation.
- Introduce `GET /export/svg/:filename` for retrieval instead of embedding large inline previews.

### 15.2.2 Basic Vector Endpoints (Namespace Separation)
Added lightweight placeholder endpoints to avoid schema collision with full cutsheet exports:
- `POST /export/basic-svg` – Simple single-rectangle SVG (accepts { width, height, mode? }). Supports `mode=json` identical to 15.2.1 behavior but without cutsheet packing logic. Stores file under `output/svg/` when JSON mode used.
- `POST /export/basic-dxf` – Minimal DXF stub emitting HEADER + ENTITIES sections and a comment with provided dims.

Rationale:
- Prevents ambiguity between cutsheet-oriented `/export/svg` (requires full `CutSheetRequest` including `depth`) and quick visualization/export needs that only have width/height.
- Facilitates incremental development of advanced panel metadata while keeping a stable simplified contract for early automation and tests.

Testing Adjustments:
- `tests/test_export_vector.py` parameterized to include both full (`/export/svg`, `/export/dxf`) and basic (`/export/basic-svg`, `/export/basic-dxf`) endpoints.
- `tests/test_export_svg_json_mode.py` now targets `/export/basic-svg` to avoid `depth` requirement, eliminating prior 422 errors.

Validation:
1. POST `/export/basic-svg` with `{ "width":10, "height":5 }` returns downloadable SVG with XML prolog.
2. POST `/export/basic-svg` with `mode=json` returns JSON payload containing `saved`, `file`, `bytes`, and panel metadata (single Front panel placeholder) and file exists under `output/svg/`.
3. POST `/export/basic-dxf` returns ASCII DXF starting with `0\nSECTION` and proper content-type `application/dxf`.
4. Full cutsheet endpoints remain unchanged; their stricter schema still validated by existing PDF / DXF / SVG tests.

Rollback Strategy:
1. Remove basic endpoint blocks from `main.py`.
2. Update tests to drop basic variants from parameterization and point JSON mode test back to enhanced cutsheet endpoint (adding required fields) if unified behavior desired.

Future Enhancements:
- Expand basic SVG to optionally include multiple panels passed as an array without invoking packing algorithm.
- Add simple hash (SHA1) to JSON response for cache-friendly client verification.
- Provide `/export/basic-svg?inline=1` query option to skip attachment headers (pure inline response) if later needed for embedding.

#### 15.2.2.1 Hashing & Caching Layer (Basic Exports)
Added deterministic SHA-256 hashing for `/export/basic-svg` and `/export/basic-dxf` responses.

Details:
- Download mode adds `ETag: <sha256>` and `Cache-Control: public, max-age=31536000, immutable` enabling long-lived CDN/browser caching.
- JSON mode (`/export/basic-svg` with `mode=json`) includes a `hash` field in response metadata for client-side dedupe and integrity checks.
- Hash computed over full serialized text (exact bytes written), ensuring reproducibility across identical requests.
- Repeated identical requests produce identical ETag/hash; any geometric change (width/height) alters digest.

Validation:
1. Two identical POSTs produce same `ETag` header.
2. Changing width or height yields different ETag/hash.
3. JSON mode response contains 64-char hex digest.

Rollback:
1. Remove hashlib usage in endpoints and delete ETag/Cache-Control headers.
2. Update tests in `tests/test_basic_export_hashing.py` to drop hash assertions.

Future Work:
- Conditional request support (If-None-Match) to return 304 for unchanged geometry.
- Add content hash to full cutsheet endpoints for parity.

### 15.2.3 Directory Segmentation (Box vs CutSheet, SVG vs DXF)
Implemented explicit separation of persisted export artifacts to prevent mixing lightweight box-level quick exports with full packing / cutsheet outputs.

New Directories (under `output/` root):
- `svg_box/` – Basic box SVG single-panel or minimal layout exports from `/export/basic-svg`.
- `dxf_box/` – Basic box DXF placeholder exports from `/export/basic-dxf`.
- `svg_cutsheets/` – Full packed panel layout SVGs from `/export/svg` (cutsheet endpoint).
- `dxf_cutsheets/` – Full packed layout DXF files from `/export/dxf` (cutsheet endpoint).
- (Existing) `cut_sheets/` – PDF cutsheet documents from `/export/pdf`.

Rationale:
- Avoid ambiguity when enumerating files (previously everything except PDF lived in `output/svg`).
- Enable targeted cleanup (`rm output/svg_box/*.svg` leaves cutsheet assets untouched).
- Provides clearer CI artifact collection (box vs cutsheet groups can be zipped separately).

Behavior Changes:
- All persistence headers (`X-Saved-File`) now return segmented relative paths (`output/svg_box/...`, `output/dxf_cutsheets/...`, etc.).
- JSON mode for basic SVG returns `file: output/svg_box/box_<timestamp>.svg` (previously `output/svg/`).
- Legacy `output/svg/` is no longer written to by current endpoints (may still contain historical files until manual cleanup).

Backward Compatibility / Migration:
- Any scripts expecting `output/svg/` must be updated to check new segmented directories. Suggested migration strategy:
	- Probe ordered list: `svg_box`, `svg_cutsheets`, fallback `svg` for legacy.
	- Emit deprecation warning if only legacy directory is populated.
- A temporary shim function (not yet implemented) could copy new files into legacy folder if strict backward compatibility is required for external tooling; currently deferred to keep storage duplication minimal.

Validation Steps Post-Segmentation:
1. Hit each endpoint (`basic-svg`, `basic-dxf`, `svg`, `dxf`, `pdf`).
2. Confirm each file saved under expected segmented directory and `X-Saved-File` header matches directory.
3. Run segregation test (`tests/test_export_persistence.py::test_segregation_directories`) – ensures presence in each target folder.
4. Ensure no new files appear in `output/svg/` (legacy) after sequence.

Rollback Strategy:
1. Revert directory names inside `main.py` (basic exports) and `app/api/routes/export.py` (cutsheet exports) back to `svg/` & single `dxf/` or original combined folder.
2. Update `paths.py` to remove new kinds (`svg_box`, `svg_cutsheets`, `dxf_box`, `dxf_cutsheets`).
3. Adjust tests to expect legacy paths; remove segregation test.
4. Optional: Move files from segmented directories back into unified folder structure.

Open Follow-Ups:
- Add housekeeping CLI to purge temp or rotate old basic box exports separately from cutsheets.
- Provide an index endpoint that returns grouped listings: `{ box: [...], cutsheets: [...] }` with hashes and timestamps.
- Introduce optional `?inline=1` query for basic endpoints to skip persistence (direct view-only) while keeping segmented default.

### 15.2.4 Helper Utilities (main.py Refactor)
To reduce repeated code across basic export endpoints a small set of local helpers was introduced in `main.py`:

Functions:
1. `utc_timestamp() -> str` – Returns a high-resolution UTC timestamp (`YYYYMMDD-HHMMSS-ffffff`) used for deterministic, collision-resistant filenames.
2. `sha256_hex(text: str) -> str` – Computes SHA-256 hex digest for content; feeds `ETag` header and JSON `hash` field.
3. `persist_text(kind: str, prefix: str, extension: str, content: str) -> Tuple[str, str, str]` – Persists arbitrary text under an export directory keyed by `kind` (e.g. `svg_box`, `dxf_box`). Returns `(filename, rel_path, absolute_path)` where `rel_path` already includes segmented directory (`output/<kind>/<file>`). Ensures directory creation.
4. `build_download_headers(content_type: str, filename: str, rel_path: str, etag: Optional[str]) -> dict` – Centralizes HTTP header construction for download responses (content type, attachment disposition, cache-control, etag, saved file marker).

Usage Pattern:
```
digest = sha256_hex(payload_text)
fname, rel, abs_path = persist_text("svg_box", "box", "svg", payload_text)
headers = build_download_headers("image/svg+xml", fname, rel, etag=digest)
return HTMLResponse(content=payload_text, headers=headers, status_code=200)
```

Rationale:
- Eliminates repeated timestamp/hashing logic in each endpoint.
- Ensures consistent segmented directory naming and header fields.
- Simplifies future addition of new basic formats (e.g., `/export/basic-json` or `/export/basic-pdf`).

Extension Guidance:
- Prefer adding richer export logic (e.g., multi-panel SVG) inside the endpoint body while leaving persistence and header construction to helpers.
- If helpers grow beyond simple wrappers (e.g., need streaming or binary), consider moving them to `app/core/exports.py` for broader reuse.

Rollback:
1. Inline the helper logic back into each endpoint (copy timestamp + hashlib + file write + headers).
2. Remove helper function definitions; ensure no remaining references.
3. Update tests only if relative path format changes (currently stable).

Testing Notes:
- Existing persistence tests exercise `persist_text` indirectly. Direct unit tests optional given minimal complexity.
- Future unit test could simulate a dry-run by calling `persist_text` with a temporary monkeypatched `OUTPUT_ROOT` and asserting path correctness.

Open Follow-Ups (Helpers):
- Add binary-safe variant `persist_bytes` for non-text exports.
- Provide `conditional_etag_response(request, etag)` returning 304 when `If-None-Match` matches.
- Add optional gzip compression decision inside `build_download_headers` (if payload exceeds threshold and client accepts gzip).

# 16. External Manufacturer Scrapers (Removed)
All external manufacturer scrapers have now been purged: Sundown, Crutchfield, and JL Audio. This consolidation eliminates brittle selectors, rate-limit handling, and retry/jitter logic tied to third-party sites. The codebase retains only generic collection/search endpoints plus synthetic fallback generation for test determinism.

Removed Assets & Code Paths (Cumulative):
1. Sundown scraper modules & endpoints.
2. Crutchfield router, site module, concurrency/jitter, UA rotation, start URL overrides, metrics extras.
3. JL Audio scraper (`app/scraping/jlaudio.py`) and endpoint `/subwoofers/jlaudio`.
4. Associated tests (`test_sundown_*`, `test_crutchfield_*`, `test_jlaudio.py`) replaced by skip placeholders or removed.
5. Legacy utilities (`collect_8in.py`, `check_subs.py`).
6. Data records for all three sources converted to neutral `deprecated` placeholders where retained.

Rationale Summary:
* Reduce maintenance overhead from brittle, changing site markup and anti-bot defenses.
* Eliminate test flakiness (network variance, 403/429 blocks, transient HTML changes).
* Simplify CI by removing outbound dependency and retry/jitter behaviors.
* Focus internal logic on deterministic synthetic + user-provided data scenarios.
* Shrink security surface (no external request layer for manufacturer scraping).

Validation Post-Removal (Cumulative):
* `grep -Ri "jlaudio"`, `"crutchfield"`, `"sundown"` return only archival docs/tests skip placeholders and deprecated data markers.
* `/admin/routes` lists only generic collection/search endpoints (no brand-specific paths).
* Purge endpoint default list empty; removal driven by query tokens or source filters.
* Test suite passes with skip placeholders acknowledging removed integrations.

Rollback (Selective Reintroduction Outline):
1. Add a new scraper module (e.g. `app/scraping/<brand>.py`) implementing fetch + parse + synthetic fallback.
2. Register endpoint in `subwoofers.py` (`/subwoofers/<brand>`), keeping isolation from generic collection.
3. Provide tests: live fetch (optional) + forced fallback + persistence merge.
4. Add explicit rate limiting / user-agent rotation only if stability demands; start minimal.
5. Update README & agents logs with activation notes and validation steps.

Historical subsections for previous enhanced scraping behaviors (HTTP/2 preference, retry/multi-cycle collection, UA rotation, jitter delays, start URL overrides, size-based batch collection, metrics extension) have been archived. None remain active after the purge.


### 16.1–16.11 (Archived)
All Crutchfield-specific enhancement notes (HTTP/2 preference, retry & metrics, sample endpoint, size-based batch collection, size data directory init, concurrency parameterization, routes introspection, headers/jitter randomization, user-agent rotation, start URL overrides) are archived. No active code paths depend on these features after purge.
Both the detailed crawler (`crawl_crutchfield` in `app/api/routes/subwoofers.py`) and the lightweight listing scraper (`scrape_crutchfield_subwoofers` in `app/scraping/sites/crutchfield.py`) now instantiate `httpx.AsyncClient` with `http2=True`.

Rationale:
- Improved connection reuse and header compression reduces per-request overhead on multi-page crawls.
- Aligns network layer with modern server capabilities; silent fallback to HTTP/1.1 if remote side does not negotiate h2 avoids breakage.
- Keeps interface identical (no code changes required by callers) while allowing future multiplexing benefits if Crutchfield enables more concurrent streams.

Validation:
1. Unit tests `tests/test_http2.py` assert both scraper entry points pass `http2=True` to the client.
2. No behavioral difference in parsing logic; responses still accessed via `resp.text`.
3. Hashing/persistence of scraped results unchanged; only transport configuration adjusted.

Edge Considerations:
- If the remote site throttles HTTP/2 aggressively, REQUEST_DELAY still spaces requests to remain polite.
- If a regression or library issue surfaces (rare with httpx stable releases), disabling reverts to prior behavior.

Rollback:
1. Remove `http2=True` parameter from each `httpx.AsyncClient` instantiation.
2. Delete `tests/test_http2.py` (or update expectations to False).
3. Update this section marking the feature retired.

Future Follow-Ups:
- Add a metrics snapshot capturing negotiated protocol (h2 vs http/1.1) per run for observability.
- Implement adaptive REQUEST_DELAY based on cumulative response times.
- Introduce retry with exponential backoff for transient 5xx while preserving delay pacing.

<!-- Archived content removed for brevity after purge -->
Added exponential backoff (MAX_RETRIES=3, base 0.6s doubling each retry) and in-memory metrics collection inside `fetch()` used by crawler and future scrape flows.

Metrics Captured:
- attempts: Total request attempts including retries.
- successes / errors: Outcome counts.
- protocol: Map of negotiated `http_version` counts (e.g., HTTP/2).
- latencies: Individual successful request durations; aggregated total + avg + p95.
- last_error: Trimmed message of most recent failure.
- uptime_sec: Seconds since metrics structure initialization.

Endpoint:
- `GET /subwoofers/metrics` returns snapshot JSON (no persistence; resets only on process restart or manual mutation).

Rationale:
- Provides observability for scraper performance & protocol negotiation without external monitoring stack.
- Backoff reduces hammering on transient network hiccups and mitigates rate-related temporary blocks.

Validation:
1. Unit tests (`tests/test_retry_metrics.py`) assert retry sequence (2 failures then success) updates metrics counts and protocol bucket.
2. Exhausted retries test confirms errors increment and last_error populated.
3. Manual curl to `/subwoofers/metrics` after a scrape shows non-zero attempts and protocol counts.

Edge Cases:
- If all attempts fail, latency stats remain empty; avg/p95 null.
- Extremely fast responses (<1ms) still recorded; floating precision retained.
- Protocol may be "unknown" if httpx Response lacks `http_version` attribute in certain adapter scenarios.

Rollback:
1. Remove metrics + retry code in `fetch()` and delete `METRICS` dict & helpers.
2. Drop `/subwoofers/metrics` route.
3. Delete associated tests (`test_retry_metrics.py`).

Future Enhancements:
- Add sliding window stats (last N minutes) separate from lifetime counters.
- Conditional 304 leveraging ETag for exports reusing similar helper approach.
- Integrate circuit-breaker state if error ratio exceeds threshold.
- Expose histogram buckets for latency (e.g., <50ms, <150ms, <500ms, >500ms).

<!-- Archived -->
Added lightweight endpoint `GET /subwoofers/sample?limit=N` returning a small subset of locally stored subwoofers. When the local DB is empty it performs a best-effort one-page seed scrape (swallowing network errors) to avoid failing hard in development environments without outbound connectivity.

Rationale:
- Enables quick UI wiring and dropdown population without requiring a full multi-page crawl.
- Reduces flakiness in early tests and local demos by guaranteeing a fast response.

Behavior:
1. Load existing DB; if empty, attempt single-page `crawl_crutchfield`.
2. Save seeded items if retrieved; return first `limit` items (default 5, max 50).
3. Returns shape: `{ total, returned, items[] }`.

Validation:
- Unit tests `tests/test_subwoofer_sample.py` verify seeding path and limit truncation.
- Manual curl shows deterministic subset after initial seed.

Edge Cases:
- Network failure during seed returns empty list (no exception surface).
- Large limit capped by existing stored count.

Rollback:
1. Remove `/subwoofers/sample` route from `subwoofers.py`.
2. Delete test file `tests/test_subwoofer_sample.py`.
3. Update docs to mark feature retired.

Future Ideas:
- Add query filters (brand, size) mirroring main search endpoint but scoped to subset.
- Provide `?refresh=1` flag to force a reseed crawl.
- Integrate with metrics to tag sample responses with data age.

<!-- Archived -->
Added `GET /subwoofers/collect/size/{size_in}?batch_pages=10&target=50` to iteratively crawl listing pages and assemble a ranked set of subwoofers matching a nominal size (±0.25" tolerance).

Scoring Heuristic:
- Primary: RMS (higher better)
- Secondary: Price (higher treated as premium when RMS equal)
- Tertiary: Newer scrape timestamp
- Tie-break: Brand + model lexical

Parameters:
- `size_in`: Nominal target diameter (e.g., 8.0).
- `batch_pages` (default 10): Listing pages per cycle.
- `target` (default 50): Desired number of matches (capped if fewer available).
- `max_cycles` (default 5): Maximum cycles of `batch_pages` to iterate before stopping.

Response Fields:
`{ requested_size, tolerance, target, found, pages_scanned, cycles_used, ranked_returned, items[] }`

Persistence:
- Merged top results into local DB (`subwoofers.json`) without removing prior entries.

Validation:
1. Unit test `tests/test_collect_size.py` confirms ranking order logic.
2. Manual request returns ranked list; increasing `batch_pages` broadens search.

Edge Cases:
- Insufficient matches: `found < target`; endpoint still returns all collected.
- Transient network failures: crawl loop breaks early; partial results returned.
- Products missing RMS: ranked below all with RMS present.

Rollback:
1. Remove endpoint block and `_rank_subwoofers` helper from `subwoofers.py`.
2. Delete test `tests/test_collect_size.py`.
3. Update docs to mark feature retired or replace with enhanced scoring version.

Future Enhancements:
- Adaptive cycle continuation based on hit rate (reduce batch_pages if diminishing returns).
- Incorporate sensitivity and impedance into score weighting.
- Add `?min_rms=` and `?min_price=` filters.
- Surface a computed `score` field per item in response for transparency.

<!-- Archived -->
Added startup helper `ensure_subwoofer_dirs()` in `main.py` creating a top-level `subwoofers/` directory with size-specific subfolders: `8/`, `10/`, `12/`, `15/`, `18/`.

Rationale:
- Provides fixed, predictable locations for future cached raw scrape artifacts or normalized JSON per size.
- Avoids mixing transient scrape buffers with long-lived aggregated DB file under `data/`.

Validation:
1. Importing `main` (application startup) yields all directories present.
2. Test `tests/test_subwoofer_dirs.py` asserts existence of each size folder.

Usage (future):
- Store per-size snapshots: `subwoofers/8/listing_YYYYMMDD.json` etc.
- Cache intermediate parsed results to accelerate repeated size-focused queries.

Rollback:
1. Remove `ensure_subwoofer_dirs()` function and call from `get_application()`.
2. Delete `tests/test_subwoofer_dirs.py`.
3. Manually remove `subwoofers/` directory if undesired.

Planned Follow-Ups:
- Add a lightweight index endpoint enumerating available size snapshot files.
- Optional rotation/cleanup strategy (retain last N days of snapshots per size).

<!-- Archived -->
Added `product_concurrency` query parameter to both `/subwoofers/collect/size/{size_in}` and `/subwoofers/collect/aggressive/{size_in}` endpoints.

Behavior:
- For each listing page, product detail pages are now fetched via an `asyncio.gather` fan-out gated by a semaphore sized `product_concurrency`.
- Default values: standard collect = 8, aggressive collect = 10.
- Collected items keyed by URL avoid duplicate inserts when the same product appears on multiple listing pages.

Benefits:
- Decreases total time to reach target counts when many product pages must be parsed.
- Preserves polite sequential listing pagination while parallelizing heavier detail fetches.

Test Coverage:
- `tests/test_aggressive_collect_concurrency.py` monkeypatches `fetch` to simulate latency, asserts product fetch count and acceptable elapsed time.

Edge Cases:
- `product_concurrency=1` restores near-serial behavior.
- Upper bounds (40 / 60) prevent excessive simultaneous requests.
- Individual product fetch failures skipped gracefully.

Rollback:
1. Remove semaphore/gather logic and restore sequential loop.
2. Drop `product_concurrency` parameters from endpoint signatures.
3. Delete concurrency test and this section.

Future Work:
- Adaptive concurrency based on observed latency/error rate.
- Streaming partial results before all product pages finish.
- Metrics extension to record average product fetch latency and peak in-flight count.


<!-- Archived (Admin routes introspection retained generally, but Crutchfield-specific notes removed) -->
Added permanent JSON endpoint `GET /admin/routes` enumerating all registered FastAPI routes.

Response Shape Example:
```
{
	"total": 42,
	"generated": "20250115-142210-123456",
	"routes": [
		{
			"path": "/subwoofers/collect/aggressive/{size_in}",
			"methods": ["GET"],
			"name": "aggressive_collect",
			"endpoint_name": "aggressive_collect",
			"tags": ["subwoofers"],
			"params": [ { "name": "size_in", "type": "float", "required": true, "in": "path" } ]
		},
		{ "path": "/admin/routes", "methods": ["GET"], "name": "admin_routes", "endpoint_name": "admin_routes", "tags": [], "params": [] }
	]
}
```

Key Points:
- Uses `utc_timestamp()` for deterministic timestamp formatting.
- Guards route inspection via `isinstance(r, APIRoute)` to avoid attribute errors.
- Exposes path/query/body params with name, type, required flag, and location.

Validation:
1. `GET /admin/routes` returns 200 with JSON.
2. New test `tests/test_routes_index.py` asserts presence of critical endpoints.

Rollback:
Remove the endpoint definition in `main.py` and delete the associated test.

Future Enhancements:
- Filter by tag (`/admin/routes?tag=subwoofers`).
- Flat mode (`?flat=1`) returning `{ path: [methods...] }` map.
- SHA-256 hash of route set for deployment drift detection.
- Middleware and dependency graph summary per route.

Rationale:
Improves visibility during rapid iteration and helps diagnose 404 issues by surfacing the exact registered path templates.

<!-- Archived -->
Enhanced request fingerprint and timing variability for Crutchfield scraping to mitigate 403 Forbidden responses.

Changes:
- Added `HEADERS` dict (User-Agent, Accept, Accept-Language, Cache-Control, Pragma) used for all requests.
- Introduced `_compute_delay()` generating `REQUEST_DELAY + uniform(REQUEST_JITTER_MIN, REQUEST_JITTER_MAX)` unless `SCRAPER_JITTER_OFF` env var is set.
- Updated `fetch()` to apply jittered polite delay after successful response and to use `HEADERS` instead of inline UA only.
- Added test `tests/test_scraper_headers_jitter.py` verifying header presence and jitter behavior; also tests jitter suppression when `SCRAPER_JITTER_OFF=1`.

Rationale:
- Static intervals and minimal headers were likely contributing to 403 blocks; diversified timing and richer headers emulate a standard browser navigation pattern.
- Jitter remains bounded to keep throughput acceptable while avoiding perfectly periodic patterns.

Validation:
1. Run `pytest tests/test_scraper_headers_jitter.py -q` → passes (headers asserted, jitter detected, disable mode confirmed).
2. Manual environment variable: `set SCRAPER_JITTER_OFF=1` (Windows) or `export SCRAPER_JITTER_OFF=1` (Unix) forces base delay only.
3. Metrics `/subwoofers/metrics` still records attempts/errors; latency unaffected by jitter logic (latency measured pre-sleep).

Edge Considerations:
- Excessive jitter ranges can slow accumulation; current window (~0.12–0.38s) keeps average added wait modest (~0.25s).
- If 403 persists, next steps may require rotating multiple User-Agents or adding lightweight cookie management.

Rollback:
1. Remove `HEADERS` dict and `_compute_delay()`; restore previous direct `User-Agent` header in `fetch()`.
2. Delete jitter test file.
3. Remove new constants (`REQUEST_JITTER_MIN`, `REQUEST_JITTER_MAX`).

Future Enhancements:
- Header rotation pool (several modern UA strings) with per-request selection.
- Optional proxy support or configurable outbound IP rotation.
- Adaptive delay: increase jitter upper bound when error ratio spikes.
- Lightweight cookie jar persistence to simulate returning visitor.
- Distinct metrics counters for jitter-applied vs disabled mode.

<!-- Archived -->
Implemented per-request User-Agent rotation to reduce fingerprint consistency.

Details:
- Added `UA_POOL` list of modern Chrome, Firefox, Safari (macOS), Linux Chrome, and Edge signatures.
- Introduced `build_headers()` returning headers with randomly chosen UA each call.
- `fetch()` now calls `client.get(..., headers=build_headers())` ensuring diversity even within one session.
- Initial client instantiations for crawl/collect use a seeded random UA from pool (not necessarily same as subsequent product fetches).
- New test `tests/test_ua_rotation.py` issues 25 fake fetches and asserts at least two distinct UA strings encountered.

Rationale:
- Rotating UA lowers risk of trivial block lists targeting a single static signature.
- Diversity paired with jittered delays mimics organic browsing patterns.

Validation:
1. Run `pytest tests/test_ua_rotation.py -q` → passes, confirming rotation.
2. Inspect metrics after real scrape attempts: protocol counts unaffected; rotation only touches headers.
3. Manual debug: enable logging of chosen UA (optional future enhancement) to observe distribution.

Edge Considerations:
- Over-rotation can raise suspicion if combined with extremely rapid request cadence; current jitter keeps average spacing polite.
- UA strings should be periodically refreshed to match contemporary browser releases (automatable via config file).

Rollback:
1. Remove `UA_POOL` and `build_headers()`; revert to single `HEADERS` dict (or original simple UA string).
2. Delete `tests/test_ua_rotation.py`.
3. Update docs marking rotation as retired.

Future Enhancements:
- Weighted rotation favoring most common market share UA.
- Persist last N UA selections to avoid immediate repeats (simple ring buffer).
- Integrate cookie jar keyed per UA to simulate separate session personas.
- Add optional `SCRAPER_LOCK_UA` env var to force a single UA for diagnostics.

<!-- Archived -->
Added optional `start_url` query parameter to both `/subwoofers/collect/size/{size_in}` and `/subwoofers/collect/aggressive/{size_in}` so targeted category pages (e.g., 8"-specific listings) can seed collection instead of the generic `LISTING_START`.

Behavior:
- If `start_url` provided, crawling begins from that URL; response echoes `start_url` for traceability.
- Referer baseline (`LAST_REFERER`) updated to the chosen start URL, feeding rotated header generation for subsequent requests.
- HTTP/2 fallback logic preserved; override does not affect negotiation.

Validation:
1. `GET /subwoofers/collect/size/8?start_url=<alt>` returns JSON with `start_url` field matching provided URL.
2. Test file `tests/test_start_url_override.py` covers both size and aggressive endpoints.
3. No change to ranking or tolerance logic; only initial pagination entry point altered.

Edge Cases:
- Invalid or non-paginated `start_url` halts after first request; `found` may remain 0.
- If 403 persists on specialized category pages, fallback strategies (headers, delay, proxy) still apply.

Rollback:
1. Remove `start_url` parameter from endpoint signatures and related response fields.
2. Delete test `tests/test_start_url_override.py`.
3. Remove `LAST_REFERER` usage if referer header no longer desired.

Future Enhancements:
- Add `start_url` to metrics snapshot for observability.
- Provide array of seed URLs to broaden initial collection across multiple categories.
- Auto-detect pagination pattern differences and adapt next-link selector accordingly.




