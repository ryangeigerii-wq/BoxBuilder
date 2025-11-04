---
layout: default
title: Change Log
---
# Change Log

## Removal Milestones
- Purged all external manufacturer scrapers and related tests.
- Removed LemonadeJS, WASM experiment, finish customization controls.
- Consolidated doc references into a single legacy scrapers section.

## Recent Features
- Port math integration (length, velocity, resonance).
- Deterministic procedural wood finishes with caching.
- Basic segmented export directories (SVG/DXF/PDF).

## Upcoming Ideas
- SVG panel layout enrichment (dimension lines & port geometry).
- Velocity/Mach threshold colorization for ports.
- Accessibility & axe-core automated smoke tests.
- Local storage persistence for last design session.

## Testing
Run `pytest -q` before contributing. All tests are deterministic (no network calls required).
