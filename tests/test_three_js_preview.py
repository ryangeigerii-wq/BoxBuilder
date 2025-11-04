import time
import threading

import pytest
from uvicorn import Config, Server

try:
    from playwright.sync_api import sync_playwright
except ImportError:  # pragma: no cover
    sync_playwright = None

from main import app


def _run_server_in_thread(port: int = 8766):
    config = Config(app=app, host="127.0.0.1", port=port, log_level="warning")
    server = Server(config=config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    # Wait briefly for startup
    for _ in range(50):
        if server.started:  # type: ignore
            break
        time.sleep(0.1)
    return server, thread

@pytest.mark.skipif(sync_playwright is None, reason="Playwright not installed")
def test_three_js_preview_default_on():
    server, thread = _run_server_in_thread()
    base_url = f"http://127.0.0.1:{server.config.port}"  # type: ignore
    try:
        if sync_playwright is None:
            pytest.skip("Playwright not installed")
        with sync_playwright() as pw:
            try:
                browser = pw.chromium.launch(headless=True)
            except Exception as e:
                pytest.skip(f"Chromium launch failed: {e}")
            page = browser.new_page()
            page.goto(f"{base_url}/box-builder?test=1", wait_until="domcontentloaded")
            # Let scripts initialize and spinner hide
            page.wait_for_timeout(600)
            # Check the 3D container exists and is visible by default now (layout side-by-side)
            preview3d = page.locator('#preview3d')
            assert preview3d.count() == 1, "3D preview container missing"
            assert preview3d.evaluate("el => window.getComputedStyle(el).display") != 'none', "3D preview should be visible initially"
            # Canvas element inserted by Three.js renderer
            canvas_count = page.locator('#preview3d canvas').count()
            assert canvas_count == 1, "Three.js canvas not created"
            # No toggle checkbox anymore; ensure no enable3D input exists
            assert page.locator('input[name="enable3D"]').count() == 0, "enable3D checkbox should be removed"
            # Preview should remain visible throughout
            page.wait_for_timeout(300)
            assert preview3d.evaluate("el => window.getComputedStyle(el).display") != 'none', "3D preview should stay visible"
            browser.close()
    finally:
        server.should_exit = True
        thread.join(timeout=5)
