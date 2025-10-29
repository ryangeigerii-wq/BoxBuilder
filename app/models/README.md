# app/models/

Domain models encapsulate core logic not tied to HTTP transport.

Example:
- box.py: helpers for volume calculations or geometry validation.

Principles:
- Avoid side effects and I/O in model code.
- Keep serialization in schemas, not models.
- Favor pure functions for easier unit testing.

Future:
- Potential `PortDesign` model centralizing acoustic calculations shared with client.

---
