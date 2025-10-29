from dataclasses import dataclass


@dataclass
class Box:
    width: float = 12
    height: float = 12
    depth: float = 12

    @classmethod
    def default(cls) -> "Box":
        return cls()

__all__ = ["Box"]
from dataclasses import dataclass


@dataclass
class Box:
    width: float
    height: float
    depth: float

    @classmethod
    def default(cls) -> "Box":
        return cls(width=12.0, height=12.0, depth=12.0)
