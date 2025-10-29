from __future__ import annotations

from typing import List, Literal, Optional
from pydantic import BaseModel, Field, model_validator

PortType = Literal['slot', 'round', 'aero']


class PortInput(BaseModel):
    portType: PortType
    boxVolumeLiters: float = Field(..., gt=0, description="Net internal volume in liters")
    targetHz: float = Field(..., gt=0)
    numPorts: int = Field(1, ge=1, le=2)
    slotHeightM: Optional[float] = Field(None, gt=0, description="Height for slot port (m)")
    slotGapM: Optional[float] = Field(None, ge=0, description="Gap between multiple slot ports (m)")
    diameterM: Optional[float] = Field(None, gt=0, description="Inner diameter for round/aero (m)")
    flareRadiusM: float = Field(0.0, ge=0, description="Flare radius for aero ends (m)")
    cornerPlacement: bool = False
    extraPhysicalLengthM: float = Field(0.0, ge=0, description="Additional physical length per port (m)")
    speedOfSound: float = Field(343.0, gt=0, description="Speed of sound (m/s)")
    driverSdM2: Optional[float] = Field(None, ge=0, description="Effective piston area (m^2)")
    peakConeExcursionM: Optional[float] = Field(None, ge=0, description="Peak excursion at Fb (m)")

    @model_validator(mode='after')
    def validate_type_specific(self):
        if self.portType == 'slot' and not self.slotHeightM:
            raise ValueError('slotHeightM required for slot port')
        if self.portType in ('round','aero') and not self.diameterM:
            raise ValueError('diameterM required for round/aero port')
        return self


class PortDesign(BaseModel):
    portType: PortType
    boxVolumeM3: float
    targetHz: float
    numPorts: int
    areaPerPortM2: float
    widthM: Optional[float] = None
    heightM: Optional[float] = None
    diameterM: Optional[float] = None
    physicalLengthPerPortM: float
    effectiveLengthPerPortM: float
    endCorrectionPerEndM: float
    endsAssumed: int = 2
    totalPortAreaM2: float
    tuningHzAchieved: float
    estPeakPortAirVelocityMS: Optional[float] = None
    estMach: Optional[float] = None
    preview: Optional['PreviewGeometry'] = None


class PortShape(BaseModel):
    kind: Literal['rect', 'circle']
    x: float
    y: float
    w: Optional[float] = None
    h: Optional[float] = None
    r: Optional[float] = None


class PortCenterline(BaseModel):
    x: float
    y: float
    length: float


class PreviewGeometry(BaseModel):
    ports2D: List[PortShape]
    centerlines: List[PortCenterline]
