from fastapi import APIRouter
from .health import router as health_router
from .box import router as box_router
from .subwoofers import router as subwoofers_router
from .ports import router as ports_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(box_router)
api_router.include_router(subwoofers_router)
api_router.include_router(ports_router)

__all__ = ["api_router"]
