from fastapi import APIRouter
from app.schemas.box import BoxSchema, BoxInput, BoxOutput
from app.models.box import Box

router = APIRouter(prefix="/boxes", tags=["boxes"])


@router.get("/create-box", response_model=BoxSchema, summary="Create default box")
async def create_box():
    default_box = Box.default()
    return BoxSchema(width=default_box.width, height=default_box.height, depth=default_box.depth)


@router.post("/create", response_model=BoxOutput, summary="Create box and compute volume")
async def create_custom_box(payload: BoxInput):
    volume_cu_in = payload.width * payload.height * payload.depth
    volume_cu_ft = volume_cu_in / 1728.0
    return BoxOutput(
        width=payload.width,
        height=payload.height,
        depth=payload.depth,
        volume=volume_cu_in,
        volume_cu_ft=volume_cu_ft,
    )

__all__ = ["router"]
