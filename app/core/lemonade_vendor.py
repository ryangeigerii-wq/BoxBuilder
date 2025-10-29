"""Utilities to ensure full LemonadeJS vendor file is present.

If the lightweight shim or an empty placeholder is detected, attempt
an on-start download of the official minified distribution unless
LEMONADE_AUTO_FETCH=0 is set in environment.

Caveats:
- Network fetch occurs only at process start, not per request.
- On failure we keep existing file so fallback logic still works.
- Written file is not re-downloaded if size exceeds a small threshold.
"""
from __future__ import annotations
import os
import httpx

LEMONADE_CDN_URL = "https://cdn.jsdelivr.net/npm/lemonadejs/dist/lemonade.min.js"
MIN_VALID_BYTES = 10_000  # heuristic: real file ~30KB; shim < 10KB


def vendor_path() -> str:
    return os.path.join("app", "static", "js", "vendor", "lemonade.min.js")


def is_placeholder(content: str) -> bool:
    markers = ["Lightweight LemonadeJS shim", "local placeholder"]
    return any(m in content for m in markers)


def needs_download(path: str) -> bool:
    if not os.path.isfile(path):
        return True
    try:
        size = os.path.getsize(path)
        if size < MIN_VALID_BYTES:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                txt = f.read(2048)
            return is_placeholder(txt)
        return False
    except OSError:
        return True


def fetch_full_lemonade(timeout: float = 8.0) -> str | None:
    try:
        with httpx.Client(timeout=timeout) as client:
            r = client.get(LEMONADE_CDN_URL)
            if r.status_code == 200 and r.text.strip():
                return r.text
    except Exception:
        return None
    return None


def ensure_lemonade_vendor() -> dict:
    """Ensure vendor file exists with full Lemonade library.

    Returns a dict with status for logging or health exposure.
    """
    path = vendor_path()
    auto_fetch = os.getenv("LEMONADE_AUTO_FETCH", "1") not in ("0", "false", "False")
    status = {"path": path, "auto_fetch": auto_fetch, "updated": False, "skipped": False, "error": None}

    if not auto_fetch:
        status["skipped"] = True
        return status

    if not needs_download(path):
        status["skipped"] = True
        return status

    code = fetch_full_lemonade()
    if not code:
        status["error"] = "download failed"
        return status

    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(code)
        status["updated"] = True
    except Exception as e:
        status["error"] = f"write failed: {e}"
    return status
