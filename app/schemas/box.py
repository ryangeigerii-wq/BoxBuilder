from pydantic import BaseModel, field_validator
from pydantic import ConfigDict


class BoxSchema(BaseModel):
    width: float = 12.0
    height: float = 12.0
    depth: float = 12.0

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"width": 12.0, "height": 12.0, "depth": 12.0}
        }
    )


class BoxInput(BaseModel):
    width: float
    height: float
    depth: float

    @field_validator("width", "height", "depth")
    def positive(cls, v: float, info):  # type: ignore[override]
        if v <= 0:
            raise ValueError(f"{info.field_name} must be > 0")
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"width": 10.5, "height": 14.0, "depth": 16.25}
        }
    )


class BoxOutput(BaseModel):
    width: float
    height: float
    depth: float
    volume: float  # cubic inches
    volume_cu_ft: float | None = None  # optional convenience

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "width": 10.5,
                "height": 14.0,
                "depth": 16.25,
                "volume": 2386.875,
                "volume_cu_ft": 1.3814,
            }
        }
    )

__all__ = ["BoxSchema", "BoxInput", "BoxOutput"]
