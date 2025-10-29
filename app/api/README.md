# app/api/

API layer organizing FastAPI routers.

Structure:
- routes/: Individual route modules (e.g., health, box, subwoofers).

Guidelines:
- Keep route functions thin: validate, delegate to model/service, return schema.
- Shared dependencies (DB sessions, auth) would be injected via Depends (future).

Extending:
1. Create a new file in `routes/` (e.g., `ports.py`).
2. Define an `APIRouter`, add endpoints.
3. Include router in `app/api/routes/__init__.py` or main application wiring.

Testing:
- Use `TestClient` to exercise endpoints; add unit tests in `tests/`.

---
