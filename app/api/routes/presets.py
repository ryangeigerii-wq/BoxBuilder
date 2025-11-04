from __future__ import annotations
import json, time, uuid
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/presets", tags=["presets"])

DATA_DIR = Path("data")
DATA_DIR.mkdir(parents=True, exist_ok=True)
PRESETS_PATH = DATA_DIR / "presets.json"


@dataclass
class Preset:
    id: str
    name: str
    created_at: float
    updated_at: float
    config: Dict[str, Any]


def _load() -> List[Preset]:
    if not PRESETS_PATH.exists():
        return []
    try:
        raw = json.loads(PRESETS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []
    items: List[Preset] = []
    for obj in raw:
        try:
            items.append(Preset(**obj))
        except Exception:
            # skip bad entries
            pass
    return items


def _save(items: List[Preset]) -> None:
    try:
        PRESETS_PATH.write_text(json.dumps([asdict(i) for i in items], indent=2), encoding="utf-8")
    except Exception:
        pass


def _find(items: List[Preset], pid: str) -> Optional[Preset]:
    for p in items:
        if p.id == pid:
            return p
    return None


@router.get("/")
@router.get("", include_in_schema=False)
async def list_presets(limit: int = Query(100, ge=1, le=500)):
    items = _load()
    # newest first
    items.sort(key=lambda p: p.updated_at, reverse=True)
    out = [
        {"id": p.id, "name": p.name, "updated_at": p.updated_at, "created_at": p.created_at}
        for p in items[:limit]
    ]
    return {"total": len(items), "items": out}


@router.get('/{preset_id}')
async def get_preset(preset_id: str):
    items = _load()
    p = _find(items, preset_id)
    if not p:
        raise HTTPException(404, "preset not found")
    return asdict(p)


@router.post('/')
@router.post('', include_in_schema=False)
async def create_preset(payload: Dict[str, Any]):
    name = (payload.get('name') or '').strip()
    config = payload.get('config') or {}
    if not name:
        raise HTTPException(400, 'name required')
    # Minimal required config keys (dimensions)
    for key in ['width', 'height', 'depth', 'wallThickness']:
        if key not in config:
            raise HTTPException(400, f'missing config.{key}')
        try:
            if float(config[key]) <= 0:
                raise HTTPException(400, f'config.{key} must be > 0')
        except ValueError:
            raise HTTPException(400, f'config.{key} must be numeric')
    now = time.time()
    items = _load()
    pid = uuid.uuid4().hex[:12]
    preset = Preset(id=pid, name=name, created_at=now, updated_at=now, config=config)
    items.append(preset)
    _save(items)
    return {"saved": True, "preset": asdict(preset)}


@router.put('/{preset_id}')
async def update_preset(preset_id: str, payload: Dict[str, Any]):
    items = _load()
    p = _find(items, preset_id)
    if not p:
        raise HTTPException(404, 'preset not found')
    name = (payload.get('name') or p.name).strip()
    config = payload.get('config') or p.config
    if not name:
        raise HTTPException(400, 'name required')
    p.name = name
    p.config = config
    p.updated_at = time.time()
    _save(items)
    return {"updated": True, "preset": asdict(p)}


@router.delete('/{preset_id}')
async def delete_preset(preset_id: str):
    items = _load()
    new_items = [p for p in items if p.id != preset_id]
    if len(new_items) == len(items):
        raise HTTPException(404, 'preset not found')
    _save(new_items)
    return {"deleted": True, "id": preset_id}


__all__ = ["router"]
