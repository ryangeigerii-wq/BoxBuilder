# Output / Export Directory

This directory contains generated assets created at runtime or via export actions.
It is organized by type. Subdirectories are created automatically on startup.

Subfolders:
- `glb/` : 3D model exports (GLB / binary glTF)
- `cut_sheets/` : Generated cut sheet HTML snapshots or future PDF exports
- `svg/` : Standalone SVG render exports of box layouts or panels
- `textures/` : Cached or baked procedural texture atlases (if persisted)
- `temp/` : Ephemeral intermediate files (cleanable)

A `.gitkeep` file in each subfolder preserves the structure in version control.

You can safely clear `temp/` and `textures/` to reclaim space; GLB and SVG exports
are user artifacts and should be retained as needed.
