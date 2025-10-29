from typing import List, Optional
from fastapi import APIRouter
from app.core.cutouts import get_cutout_diameter

router = APIRouter(prefix="/subwoofers", tags=["subwoofers"])


@router.post("/scrape", summary="Scrape subwoofer data from given URLs")
async def scrape_subwoofers(urls: List[str]):
    return []  # Placeholder until pipeline implemented


@router.get("/crutchfield", summary="Scrape Crutchfield subwoofers")
async def scrape_crutchfield(pages: int = 5):
    return []  # Placeholder until site scraper implemented


@router.get("/cutout/{nominal_size}", summary="Get standard or actual cutout diameter for subwoofer size")
async def cutout(nominal_size: float, actual_spec: Optional[float] = None):
    info = get_cutout_diameter(nominal_size, actual_spec=actual_spec)
    return {
        "nominal_size": info.nominal_size,
        "cutout_diameter": info.cutout_diameter,
        "estimated": info.estimated,
        "ratio_used": info.ratio_used,
        "source": info.source,
        "disclaimer": "Default cutout diameters are automatically estimated using the 0.93× standard. Exact manufacturer specs will override these values when available."
    }

__all__ = ["router"]
