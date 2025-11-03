"""Health endpoint router.

Single /health route returning {"status": "ok"}. Prior duplicate definitions
were consolidated to avoid confusion and potential shadowing.
"""
from fastapi import APIRouter

router = APIRouter(tags=["health"])

@router.get("/health", summary="Health check")
async def health():  # pragma: no cover - trivial
    return {"status": "ok"}

__all__ = ["router"]
