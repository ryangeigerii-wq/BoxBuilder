from fastapi import APIRouter, Response, status
import os, threading, time, sys

admin_router = APIRouter(prefix="/admin", tags=["admin"])

def _delayed_exit(delay: float):
    time.sleep(delay)
    # Avoid exiting in test environments if disabled
    if os.getenv("SERVER_RESET_DISABLED") == "1":
        return
    # Attempt graceful shutdown
    sys.stderr.write("\n[reset] Server exiting for reset request...\n")
    sys.stderr.flush()
    os._exit(0)  # hard exit so uvicorn --reload restarts

@admin_router.post("/reset", status_code=status.HTTP_202_ACCEPTED)
def reset_server():
    """Schedule a process exit so the uvicorn --reload master process restarts.
    Returns 202 immediately. Set SERVER_RESET_DISABLED=1 to noop for tests/CI.
    """
    threading.Thread(target=_delayed_exit, args=(0.5,), daemon=True).start()
    return {"status": "scheduled", "delay_seconds": 0.5}