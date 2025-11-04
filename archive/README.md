# Archived Fun Spin Feature

This directory preserves the removed "Fun Spin" animation feature for the 3D box preview. It was extracted from `three_preview.js` and is currently inactive in the live build.

## 1. Purpose
Fun Spin provided a playful, continuous rotation of the enclosure with:
- Constant angular velocity (seeded random axis)
- Periodic panel texture color randomization
- Smooth orientation reset back to front-facing when stopped
- Optional focus callback to re-center camera / holes

The goal was user engagement and quick surface palette exploration. It was removed to simplify controls and reduce interference with precise inspection interactions.

## 2. Removal Rationale
- Interfered with manual orbit adjustments during detailed layout work
- Added conditional branches and timing complexity in the main animation loop
- Increased texture churn (GPU uploads) when randomizing frequently
- Not essential to core box design workflow

## 3. Archived Source
`fun_spin_feature.js` exports three functions:
- `seedFunSpin(funSpinVel)` — initializes a velocity vector used each frame to rotate the group
- `randomizeTextures(planeMeshes, interiorPanel)` — applies random colors and a generated canvas texture
- `beginOrientationReset(boxGroup, callbackDone)` — tween-like slerp back to identity rotation

These depend on objects present in the main scene:
- `boxGroup` (THREE.Group containing enclosure meshes)
- `planeMeshes` (dictionary of panel meshes: front/back/left/right/top/bottom)
- `interiorPanel` (optional internal decorative panel)
- Helper intentions: `restoreBaseMaterials()`, `focusFrontHoles()` (not archived here — recreate or adjust logic when restoring)

## 4. How to Restore (Checklist)
1. Import functions in `three_preview.js`:
   ```js
   import { seedFunSpin, randomizeTextures, beginOrientationReset } from './archive/fun_spin_feature.js';
   ```
2. Reintroduce state variables near other preview globals:
   ```js
   let funSpin = false;
   const funSpinVel = new THREE.Vector3();
   let lastTextureChangeTime = 0;
   const FUN_SPIN_TEXTURE_INTERVAL = 2000; // ms
   let orientTweenActive = false; // optional boolean if you add guard logic
   ```
3. UI: Add a toggle button to `box_builder.html` (e.g. below Auto Rotate). Example markup:
   ```html
   <button id="funSpinBtn" type="button" class="secondary">Fun Spin</button>
   ```
4. Event binding (in your UI init script):
   ```js
   document.getElementById('funSpinBtn').addEventListener('click', () => {
     funSpin = !funSpin;
     if (funSpin) {
       seedFunSpin(funSpinVel);
       randomizeTextures(planeMeshes, interiorPanel);
       lastTextureChangeTime = performance.now();
     } else {
       beginOrientationReset(boxGroup, () => {
         // Optional: restoreBaseMaterials(); focusFrontHoles();
       });
     }
     updateFunSpinButton();
   });
   function updateFunSpinButton() {
     const btn = document.getElementById('funSpinBtn');
     btn.classList.toggle('active', funSpin);
     btn.textContent = funSpin ? 'Stop Spin' : 'Fun Spin';
   }
   ```
5. Animation loop patch (inside `animate()`):
   ```js
   if (funSpin) {
     boxGroup.rotateOnAxis(funSpinVel.clone().normalize(), funSpinVel.length());
     const now = performance.now();
     if (now - lastTextureChangeTime > FUN_SPIN_TEXTURE_INTERVAL) {
       randomizeTextures(planeMeshes, interiorPanel);
       lastTextureChangeTime = now;
     }
   }
   ```
6. Persistence (optional): store funSpin state in `localStorage` similar to auto-rotate and restore on load.
7. Debounce texture changes: shorten interval or gate by `document.hidden` to avoid background churn.
8. Update README main section when reactivated.

## 5. Testing Strategy
Add / modify Playwright tests:
- Activate Fun Spin; wait for at least one texture change; capture material UUID list before and after.
- Click Stop; assert orientation resets (panel normals roughly aligned with camera facing direction).
- Confirm manual orbit input after stop functions without lingering auto velocity.

Unit test idea (jsdom / headless): mock a simplified group and simulate animate loop steps calling Fun Spin branch.

## 6. Performance & Cautions
- Frequent texture regeneration can cause minor frame drops; keep interval >= 1500 ms.
- Consider disabling during high-precision tasks (hole nudging) or when port overlays are complex.
- Provide an accessible description (aria-label) for users relying on screen readers: "Toggle playful spinning animation".

## 7. Optional Enhancements
- Speed slider controlling `BASE_SPEED` scalar.
- Random axis reseed button separate from start/stop.
- Pause on hover (if user is inspecting details).
- Material theme cycling integrated with finish system rather than ad-hoc colors.
- Frame budget guard: skip texture randomization if `rAF` delta > threshold.

## 8. Clean Removal Procedure (If Reintroduced Then Removed Again)
1. Delete UI button and associated event binding.
2. Remove state variables & animation loop branch.
3. Remove import of archived functions.
4. Re-run tests; ensure no references remain.

## 9. Versioning & Traceability
Keep this file updated with any deviations if the feature evolves (e.g., integration with finish materials). The archive approach ensures minimal merge conflicts and prevents accidental drift in unrelated preview logic.

## 10. Quick Diff Reference (Original Removal Summary)
Removed elements from live `three_preview.js`:
- State vars: funSpin, funSpinVel, lastTextureChangeTime, FUN_SPIN_TEXTURE_INTERVAL, orientTween
- Functions: seedFunSpin, randomizeTextures, beginOrientationReset
- Branches in animate(): angular velocity rotation + periodic texture randomization, orientation tween
- UI button markup & event handlers

## 11. License & Attribution
Same MIT license as project. Original implementation authored within this repository; reuse governed by root LICENSE.

---
Restoration is fully optional; core design flow does not depend on this feature.
