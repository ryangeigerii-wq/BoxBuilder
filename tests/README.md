# tests/

Validation suite for API, scraping, and UI components.

Categories:
- API: FastAPI endpoints via TestClient.
- Scraping: Parser correctness using fixture HTML.
- UI: Playwright smoke test ensures front-end loads & updates.

Running:
```powershell
pytest -q
```
Optional Browser Install:
```powershell
python -m playwright install chromium
```

Future:
- SVG snapshot tests.
- Accessibility audits.
- Performance benchmarks.

---
