# app/

Top-level application package hosting FastAPI modules and static/template assets.

Contents:
- core/: Configuration and settings management (Pydantic-based).
- api/: Routers/endpoints grouped by feature area (health, box creation, subwoofer scraping).
- models/: Domain models (e.g., Box) containing business logic helpers.
- schemas/: Pydantic schemas for request/response validation.
- scraping/: HTML fetch/parse pipeline and site-specific scrapers.
- templates/: Jinja2 templates for HTML rendering.
- static/: CSS, JS, images (framework-free builder front-end).

Entry Points:
- main.py imports `app` and mounts static files / templates.

Conventions:
- Keep frontend framework-free; logic resides in `static/js/box_builder.js`.
- Pydantic schemas remain thin; transformations belong in models.

Testing:
- Unit tests import routers and call via TestClient under `tests/`.

---
