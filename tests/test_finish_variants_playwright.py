import threading
import time
from contextlib import contextmanager

import pytest

try:
    from playwright.sync_api import sync_playwright
except ImportError:  # pragma: no cover
    sync_playwright = None

from uvicorn import Config, Server
from fastapi import FastAPI

@contextmanager
def run_app_in_thread(app: FastAPI, host: str = "127.0.0.1", port: int = 8766):
    config = Config(app=app, host=host, port=port, log_level="warning")
    server = Server(config=config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    for _ in range(50):
        if server.started:  # type: ignore
            break
        time.sleep(0.1)
    try:
        yield f"http://{host}:{port}"
    finally:
        server.should_exit = True
        thread.join(timeout=5)

@pytest.mark.skipif(sync_playwright is None, reason="Playwright not installed")
def test_finish_variants_texture_cache():
    """Verify that selecting different finish variants changes texture map UUID and re-selecting a variant reuses cached texture."""
    from main import app
    with run_app_in_thread(app) as base_url:
        # sync_playwright may be imported but None if import failed; guard again
        if sync_playwright is None:
            pytest.skip("Playwright import failed")
        with sync_playwright() as pw:
            try:
                browser = pw.chromium.launch(headless=True)
            except Exception as e:
                pytest.skip(f"Chromium launch failed: {e}")
            page = browser.new_page()
            page.goto(f"{base_url}/box-builder?test=1", wait_until="domcontentloaded")
            # Allow initial scripts to load and first rebuild
            page.wait_for_timeout(800)
            # Expose a helper to grab current front baffle texture UUID
            uuid_script = """
                () => {
                  const fb = window.__frontBaffle; 
                  if(!fb || !fb.material || !fb.material.map) return null; 
                  return fb.material.map.uuid;
                }
            """
            def get_uuid():
                return page.evaluate(uuid_script)
            # Start on default (capture UUID)
            initial_finish_value = page.locator('select[name="finish"]').input_value()
            initial_uuid = get_uuid()
            assert initial_uuid, "Initial texture UUID should be present"
            # Re-select the same initial finish to confirm cache immediate reuse (UUID unchanged)
            page.select_option('select[name="finish"]', initial_finish_value)
            page.wait_for_timeout(150)
            initial_uuid_repeat = get_uuid()
            assert initial_uuid_repeat == initial_uuid, "Re-selecting same finish should not regenerate texture"
            # Change to a different finish than initial to force regeneration
            target_first = 'espresso'
            if initial_finish_value == 'espresso':
                target_first = 'wood1'  # default already espresso; pick light wood instead
            page.select_option('select[name="finish"]', target_first)
            page.wait_for_timeout(300)
            first_uuid = get_uuid()
            assert first_uuid and first_uuid != initial_uuid, f"{target_first} texture UUID should differ from initial"
            # Switch to a second distinct finish (espresso if not used yet, else wood2)
            second_variant = 'espresso' if target_first != 'espresso' else 'wood2'
            page.select_option('select[name="finish"]', second_variant)
            page.wait_for_timeout(300)
            second_uuid = get_uuid()
            assert second_uuid and second_uuid != first_uuid, f"{second_variant} texture UUID should differ from {target_first}"
            # Re-select first variant and confirm UUID reuses cached
            page.select_option('select[name="finish"]', target_first)
            page.wait_for_timeout(250)
            first_uuid_repeat = get_uuid()
            assert first_uuid_repeat == first_uuid, f"Re-selecting {target_first} should reuse cached texture UUID"
            # Switch to Flat (no wood grain) and ensure map still exists (solid color texture)
            page.select_option('select[name="finish"]', 'flat')
            page.wait_for_timeout(250)
            flat_uuid = get_uuid()
            assert flat_uuid and flat_uuid not in {first_uuid, second_uuid}, "Flat finish UUID should differ (solid texture)"
            browser.close()
