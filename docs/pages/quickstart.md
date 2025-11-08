---
layout: page
title: Quick Start
permalink: /quickstart/
---
# Quick Start

## Environment Setup (Windows PowerShell)
```powershell
python -m venv .venv
./.venv/Scripts/Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```
Visit http://127.0.0.1:8000/box-builder

## Optional Components
```powershell
# Playwright browser for UI tests
python -m playwright install chromium

# Front-end tests & lint
npm install
npm test
```

## Minimal Smoke Tests
```powershell
pytest tests/test_export_vector.py::test_vector_exports -q
pytest tests/test_routes_index.py::test_admin_routes_index -q
```

## Common Issues
| Symptom | Cause | Fix |
|---------|-------|-----|
| Blank 3D preview | Missing Three.js asset | Check Network panel for 404s |
| PDF export fails | reportlab missing | pip install -r requirements.txt |
| Playwright skips | Browser not installed | python -m playwright install chromium |
| Port overlay absent | Inactive port fields | Enable port & set dimensions |

Proceed to [Exports](/exports/) for artifact generation.
