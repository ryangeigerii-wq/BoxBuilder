# WASM Preview Module

This directory contains a Rust -> WebAssembly implementation of the box preview generator logic.

## Build Requirements
- Rust toolchain (stable) https://www.rust-lang.org/tools/install
- wasm-pack (`cargo install wasm-pack`)

## Building
```powershell
# From repository root
cd app/wasm/preview
wasm-pack build --release --target web
```
This outputs a `pkg/` folder with `.wasm` and JS bindings.

## Integrating in Front-End
1. Copy or serve the generated `pkg/box_preview_bg.wasm` + JS loader under `app/static/js/wasm/` (create the folder if missing).
2. In `box_builder.js`, import the initialization:
```javascript
import init, { generate_preview } from '/static/js/wasm/box_preview.js';
```
3. After DOM ready, call `await init();` then replace internal `generatePreview()` usage with the WASM version, passing serialized state.

Example glue snippet:
```javascript
let wasmReady = false;
let wasmGen = null;
(async () => {
  try {
    const mod = await import('/static/js/wasm/box_preview.js');
    await mod.default();
    wasmGen = mod.generate_preview;
    wasmReady = true;
  } catch(err){ console.warn('WASM load failed, falling back to JS', err); }
})();

function generatePreviewWrapper(state){
  if(wasmReady && wasmGen){
    return wasmGen(JSON.stringify({
      width: state.width,
      height: state.height,
      depth: state.depth,
      showGhost: state.showGhost,
      holes: state.holes,
      showDims: state.showDims,
      zoomMode: state.zoomMode
    }));
  }
  // fallback: existing JS generatePreview()
  return generatePreview();
}
```

## Scope & Parity
Current Rust implementation covers:
- Box rectangle + ghost panel + connecting edges
- Hole clamping & badge types
- Width/height dimension lines
- Zoom modes (close/normal/wide/default)

Not yet implemented in Rust:
- Depth styles (diagonal/horizontal variants)
- Port overlay preview
- Internal volume metrics
- Undo/redo state history

These can be incrementally migrated by mirroring logic from `app/static/js/box_builder.js`.

## Extending
Add new fields to the `State` struct and re-export them via `generate_preview`. Ensure JSON shape matches what JS serializes.

## Testing Logic Outside Browser
You can add a quick unit test:
```rust
#[cfg(test)]
mod tests {
  use super::*;
  #[test]
  fn basic_svg() {
    let state = serde_json::json!({
      "width": 12.0,
      "height": 10.0,
      "depth": 8.0,
      "showGhost": true,
      "holes": [{"dx":0.0,"dy":0.0,"nominal":12.0,"cut":null,"spec":null,"selected":true}],
      "showDims": true,
      "zoomMode": "default"
    });
    let svg = generate_preview(&state.to_string());
    assert!(svg.contains("<svg"));
    assert!(svg.contains("ghost-back"));
  }
}
```
Run with:
```powershell
cargo test
```

## Performance Considerations
For small state sizes, JSON (de)serialization overhead is negligible. If performance becomes critical:
- Expose a function accepting primitive parameters or arrays via `wasm-bindgen` directly.
- Pre-allocate strings or use a builder pattern.

## License
MIT
