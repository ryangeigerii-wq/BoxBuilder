from fastapi import APIRouter

router = APIRouter()

@router.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}

__all__ = ["router"]
from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health", summary="Health check")
async def health_check():
    return {"status": "ok"}
