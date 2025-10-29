from pydantic import BaseModel, HttpUrl
from pydantic import ConfigDict
from typing import Optional


class SubwooferSchema(BaseModel):
    name: str
    brand: Optional[str] = None
    size_in_inches: Optional[float] = None
    rms_watts: Optional[int] = None
    max_watts: Optional[int] = None
    impedance_ohms: Optional[int] = None
    sensitivity_db: Optional[float] = None
    frequency_range_hz: Optional[str] = None  # e.g. "20-250"
    price: Optional[float] = None
    product_url: Optional[HttpUrl] = None
    source: Optional[str] = None

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "SuperBass 12D2",
                "brand": "BassCo",
                "size_in_inches": 12.0,
                "rms_watts": 600,
                "max_watts": 1200,
                "impedance_ohms": 2,
                "sensitivity_db": 89.5,
                "frequency_range_hz": "25-250",
                "price": 249.99,
                "product_url": "https://example.com/superbass-12d2",
                "source": "example.com"
            }
        }
    )

__all__ = ["SubwooferSchema"]
