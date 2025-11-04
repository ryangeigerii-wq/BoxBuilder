"""Filesystem path helpers for export/output artifacts.

Centralizes logic for creating and retrieving export directories so that
future features (GLB export, SVG snapshotting, texture baking) share a
common, documented structure under the project root `output/`.
"""
from __future__ import annotations

from pathlib import Path
from typing import Literal

ROOT = Path(__file__).resolve().parent.parent.parent  # project root
OUTPUT_ROOT = ROOT / "output"

ExportType = Literal[
    "glb",
    "cut_sheets",
    "svg",  # legacy (generic svg)
    "textures",
    "temp",
    "svg_box",
    "svg_cutsheets",
    "dxf_box",
    "dxf_cutsheets",
]

SUBFOLDERS: list[ExportType] = [
    "glb",
    "cut_sheets",
    "svg",  # legacy consolidated svg
    "textures",
    "temp",
    "svg_box",
    "svg_cutsheets",
    "dxf_box",
    "dxf_cutsheets",
]


def ensure_output_dirs() -> None:
    """Create the output directory tree if missing.

    Idempotent; safe to call on each startup.
    """
    OUTPUT_ROOT.mkdir(exist_ok=True)
    for name in SUBFOLDERS:
        (OUTPUT_ROOT / name).mkdir(exist_ok=True)


def get_export_path(kind: ExportType, filename: str | None = None) -> Path:
    """Return path for an export artifact.

    If `filename` provided, returns the full file path inside the type
    directory; otherwise returns the directory itself.
    """
    if kind not in SUBFOLDERS:
        raise ValueError(f"Unknown export kind: {kind}")
    base = OUTPUT_ROOT / kind
    return base / filename if filename else base


__all__ = ["ensure_output_dirs", "get_export_path", "OUTPUT_ROOT", "SUBFOLDERS"]
