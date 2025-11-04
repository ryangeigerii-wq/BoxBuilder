from fastapi import APIRouter
from .health import router as health_router
from .box import router as box_router
from .subwoofers import router as subwoofers_router
from .ports import router as ports_router
from .export import router as export_router
from .sonic import router as sonic_router
from .presets import router as presets_router

api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(box_router)
api_router.include_router(subwoofers_router)
api_router.include_router(ports_router)
api_router.include_router(export_router)
api_router.include_router(sonic_router)
api_router.include_router(presets_router)

__all__ = ["api_router"]
