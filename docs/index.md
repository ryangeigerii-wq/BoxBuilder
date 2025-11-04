---
layout: default
title: BoxBuilder Overview
---
# BoxBuilder

A deterministic, framework-free subwoofer enclosure designer featuring:

- Pure FastAPI backend (no external scraping dependencies).
- Vanilla JS front-end with SVG + Three.js preview.
- Export endpoints (JSON config, basic SVG/DXF, PDF cut sheets).
- Port math utilities (length, velocity, resonance) for local design feedback.

## Quick Start
```powershell
python -m venv .venv
./.venv/Scripts/Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```
Navigate to `http://127.0.0.1:8000/box-builder`.

## Features
- Heuristic cutout diameter (nominal * 0.93) with override support.
- Ghost panels for depth context.
- Triple-field layout for related dimensions.
- Deterministic procedural wood finishes (cached).

## Exports
| Type | Endpoint | Notes |
|------|----------|-------|
| JSON Config | POST /export/box | Minimal persisted configuration snapshot |
| Basic SVG | POST /export/basic-svg | Single rectangle placeholder + metadata mode |
| Basic DXF | POST /export/basic-dxf | Placeholder DXF structure with hashing |
| PDF Cut Sheet | POST /export/pdf | Multi-sheet panel layout (kerf-aware) |

## Port Math
`app/static/js/port_math.js` supplies deterministic formulas for slot and round ports used by the builder.

## Legacy Scrapers
All external manufacturer scrapers were removed. Reintroduction would require a new isolated module under `app/scraping/sites/` with synthetic fallback for test determinism.

## Jekyll Documentation
This site is built via GitHub Pages (Minima theme). Update docs and push to main; Pages rebuilds automatically.

## Contributing
1. Fork & create a feature branch.
2. Add/adjust tests under `tests/`.
3. Run `pytest -q` before submitting PR.
4. Keep documentation in sync (`README.md`, `docs/`).

## License
MIT
