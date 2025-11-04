// Archived Ghost Panels Feature
// --------------------------------
// This file preserves the previously implemented ghost panel logic
// (semi-transparent offset back/right panels plus connecting edge lines)
// from both the SVG export builder and Three.js preview.
//
// Restoration Steps:
// 1. Re-introduce `showGhost` checkbox and `ghostBtn` toggle in `box_builder.html`.
// 2. Add `showGhost` field back into initial state & `readForm()` in `box_builder.js`.
// 3. Insert the ghost SVG block inside `buildSvgExport()` before hole rendering.
// 4. Re-add ghost button wiring and `ghostMode` transparency logic in `three_preview.js`.
// 5. Optionally restore CSS hatch pattern definitions & ghost styles.
// 6. Re-run tests / manual validation (ensure no opacity layering conflicts with shadows).
//
// Original SVG snippet (from buildSvgExport):
// -------------------------------------------------
// let ghostBack = '';
// let ghostRight = '';
// let ghostEdges = '';
// if (state.showGhost) {
//   const gOff = Math.min(20 + state.depth * 2, 140) * 0.6;
//   ghostBack = `<rect x='${(x + gOff).toFixed(2)}' y='${(y + gOff).toFixed(2)}' width='${dispW.toFixed(2)}' height='${dispH.toFixed(2)}' class='ghost-back' />`;
//   ghostRight = `<rect x='${(x + gOff + dispW).toFixed(2)}' y='${(y + gOff).toFixed(2)}' width='${sideThickness.toFixed(2)}' height='${dispH.toFixed(2)}' class='ghost-right' />`;
//   ghostEdges = [
//     `<line x1='${x.toFixed(2)}' y1='${y.toFixed(2)}' x2='${(x + gOff).toFixed(2)}' y2='${(y + gOff).toFixed(2)}' class='ghost-edge' />`,
//     `<line x1='${(x + dispW).toFixed(2)}' y1='${y.toFixed(2)}' x2='${(x + gOff + dispW).toFixed(2)}' y2='${(y + gOff).toFixed(2)}' class='ghost-edge' />`,
//     `<line x1='${x.toFixed(2)}' y1='${(y + dispH).toFixed(2)}' x2='${(x + gOff).toFixed(2)}' y2='${(y + gOff + dispH).toFixed(2)}' class='ghost-edge' />`,
//     `<line x1='${(x + dispW).toFixed(2)}' y1='${(y + dispH).toFixed(2)}' x2='${(x + gOff + dispW).toFixed(2)}' y2='${(y + gOff + dispH).toFixed(2)}' class='ghost-edge' />`
//   ].join('');
// }
//
// Original Three.js toggle section:
// -------------------------------------------------
// const ghostBtn = document.getElementById('ghostBtn');
// if (ghostBtn) {
//   ghostBtn.style.display = 'inline-block';
//   const reflectGhost = () => { ghostBtn.textContent = 'Ghost: ' + (ghostMode ? 'On' : 'Off'); };
//   ghostBtn.addEventListener('click', () => {
//     ghostMode = !ghostMode;
//     reflectGhost();
//     if (lastState) rebuild(lastState);
//   });
//   reflectGhost();
// }
//
// Materials transparency diff (front/side panels):
// -------------------------------------------------
// frontMaterial.transparent = ghostMode;
// frontMaterial.opacity = ghostMode ? 0.35 : 1.0;
// sideMaterial.transparent = ghostMode;
// sideMaterial.opacity = ghostMode ? 0.25 : 1.0;
//
// Notes:
// - Ghost projection offset used depth scaling formula `Math.min(20 + depth*2, 140)`.
// - Hatch pattern defined as <pattern id='ghostHatch'> in SVG defs.
// - Feature removed to reduce UI surface area and simplify export determinism.
// - Reintroduction should ensure tests cover ghost toggling and hatch visibility.
//
// End of archive.
