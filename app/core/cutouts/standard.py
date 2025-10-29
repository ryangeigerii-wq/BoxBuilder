from dataclasses import dataclass
from typing import Optional

_RATIO = 0.93  # Industry heuristic: cutout diameter ≈ 0.93 * nominal size

@dataclass
class CutoutInfo:
    nominal_size: float  # e.g. 12.0 for a 12" sub
    cutout_diameter: float  # resulting recommended hole diameter
    estimated: bool  # True if derived from heuristic, False if actual spec source
    ratio_used: float  # ratio applied (0.93 for heuristic, may differ for actual model later)
    source: Optional[str] = None  # manufacturer or data source id


def get_cutout_diameter(nominal_size: float, actual_spec: Optional[float] = None, source: Optional[str] = None) -> CutoutInfo:
    """Return cutout diameter info for a subwoofer.

    If actual_spec provided, use it (estimated=False).
    Otherwise apply heuristic ratio (estimated=True).
    """
    if actual_spec is not None and actual_spec > 0:
        return CutoutInfo(
            nominal_size=nominal_size,
            cutout_diameter=actual_spec,
            estimated=False,
            ratio_used=actual_spec / nominal_size if nominal_size else actual_spec,
            source=source or "manufacturer"
        )
    # Heuristic path
    diameter = round(nominal_size * _RATIO, 3)  # keep 3 decimals
    return CutoutInfo(
        nominal_size=nominal_size,
        cutout_diameter=diameter,
        estimated=True,
        ratio_used=_RATIO,
        source=source or "standard-heuristic"
    )
