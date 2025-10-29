# app/static/js/

Framework-free JavaScript assets.

Primary File:
- box_builder.js: State mgmt, SVG render, local port estimation, undo/redo.

Design:
- Single state object with history.
- Layer order: ghosts → front → holes → ports → dimensions → toast.
- Local Helmholtz port estimation before server design.

Extension Ideas:
- Add bracing overlay or material thickness visualization.
- Implement SVG export utility.
- Introduce performance profiling for large state.

---
