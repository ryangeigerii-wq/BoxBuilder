from fastapi import APIRouter, HTTPException
from app.schemas.port import PortInput, PortDesign, PreviewGeometry, PortShape, PortCenterline
import math

router = APIRouter(prefix="/ports", tags=["ports"])


def _compute_port_design(inp: PortInput) -> PortDesign:
    # Convert volume liters to m^3
    box_vol_m3 = inp.boxVolumeLiters / 1000.0
    # Area per port
    if inp.portType == 'slot':
        if inp.slotHeightM is None:
            raise ValueError('slotHeightM missing for slot port design')
        height = inp.slotHeightM
        base_width = height * 1.2
        area_port = height * base_width
    else:
        if inp.diameterM is None:
            raise ValueError('diameterM missing for round/aero port design')
        diameter = inp.diameterM
        area_port = math.pi * (diameter/2)**2
    total_area = area_port * inp.numPorts
    # Helmholtz: Fb = (c / (2*pi)) * sqrt( (N*Ap) / (Vb * Leff) )
    c = inp.speedOfSound
    target = inp.targetHz
    # Solve effective length Leff = (N*Ap)/(Vb * (2*pi*Fb/c)^2)
    Leff = (inp.numPorts * area_port) / (box_vol_m3 * (2*math.pi*target / c)**2)
    # End corrections per end (approx):
    if inp.portType == 'slot':
        eq_r = math.sqrt(area_port / math.pi)
        end_corr = 0.85 * eq_r
    elif inp.portType == 'round':
        assert inp.diameterM is not None
        diameter = inp.diameterM
        end_corr = 0.85 * (diameter/2)
    else:  # aero
        assert inp.diameterM is not None
        diameter = inp.diameterM
        base_corr = 0.85 * (diameter/2)
        end_corr = max(0.0, base_corr - 0.5 * inp.flareRadiusM)
    ends = 2
    effective_minus_physical = ends * end_corr + inp.extraPhysicalLengthM
    physical_length = max(0.001, Leff - effective_minus_physical)
    effective_length = physical_length + effective_minus_physical
    # Recompute achieved tuning
    achieved = (c / (2*math.pi)) * math.sqrt( (inp.numPorts * area_port) / (box_vol_m3 * effective_length) )
    # Optional velocity estimate
    est_velocity = None
    est_mach = None
    if inp.driverSdM2 and inp.peakConeExcursionM:
        # Peak volume velocity approximation: Sd * 2*pi*Fb * excursion
        vol_vel = inp.driverSdM2 * 2*math.pi*achieved * inp.peakConeExcursionM
        # Convert volume velocity to average port particle velocity: U / (total area)
        est_velocity = vol_vel / total_area
        est_mach = est_velocity / c

    # Basic preview geometry layout
    ports2d = []
    centerlines = []
    if inp.portType == 'slot':
        gap = (inp.slotGapM or 0.0)
        height = inp.slotHeightM
        assert height is not None
        width = area_port / height
        # Total horizontal span for centering
        total_width = inp.numPorts * width + (inp.numPorts - 1) * gap
        start_x = -total_width / 2 + width / 2
        for i in range(inp.numPorts):
            x = start_x + i * (width + gap)
            y = 0.0
            ports2d.append(PortShape(kind='rect', x=x, y=y, w=width, h=height))
            centerlines.append(PortCenterline(x=x, y=y, length=physical_length))
    else:
        spacing = 0.12  # arbitrary spacing placeholder (m)
        assert inp.diameterM is not None
        diameter = inp.diameterM
        for i in range(inp.numPorts):
            x = (i - (inp.numPorts-1)/2) * (spacing + diameter)
            y = 0.0
            ports2d.append(PortShape(kind='circle', x=x, y=y, r=diameter/2))
            centerlines.append(PortCenterline(x=x, y=y, length=physical_length))

    preview = PreviewGeometry(ports2D=ports2d, centerlines=centerlines)

    return PortDesign(
        portType=inp.portType,
        boxVolumeM3=box_vol_m3,
        targetHz=inp.targetHz,
        numPorts=inp.numPorts,
        areaPerPortM2=area_port,
        widthM=(area_port / inp.slotHeightM if inp.portType == 'slot' and inp.slotHeightM else None),
        heightM=(inp.slotHeightM if inp.portType == 'slot' else None),
        diameterM=(inp.diameterM if inp.portType in ('round','aero') else None),
        physicalLengthPerPortM=physical_length,
        effectiveLengthPerPortM=effective_length,
        endCorrectionPerEndM=end_corr,
        totalPortAreaM2=total_area,
        tuningHzAchieved=achieved,
        estPeakPortAirVelocityMS=est_velocity,
        estMach=est_mach,
        preview=preview,
    )


@router.post('/design', response_model=PortDesign)
def design_port(payload: PortInput):
    try:
        return _compute_port_design(payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
