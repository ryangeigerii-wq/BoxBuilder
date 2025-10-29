# app/schemas/

Pydantic schemas define request/response shapes and validation.

Guidelines:
- Keep business logic out.
- Prefer explicit field types & constraints.
- Use `ConfigDict` for Pydantic v2 style when migrating from legacy `config`.

Versioning:
- Introduce versioned modules (v1/, v2/) if breaking changes occur.

---
