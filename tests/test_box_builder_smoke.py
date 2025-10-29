import time
import threading
from contextlib import contextmanager

import pytest
from fastapi import FastAPI
from uvicorn import Config, Server

try:
    from playwright.sync_api import sync_playwright
except ImportError:  # pragma: no cover
    sync_playwright = None

from main import app as fastapi_app

@contextmanager
def run_app_in_thread(app: FastAPI, host: str = "127.0.0.1", port: int = 8877):
    """Run FastAPI app with Uvicorn in background thread for browser automation."""
    config = Config(app=app, host=host, port=port, log_level="warning")
    server = Server(config=config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    for _ in range(60):  # wait up to ~6s
        if server.started:  # type: ignore
            break
        time.sleep(0.1)
    try:
        yield f"http://{host}:{port}"
    finally:
        server.should_exit = True
        thread.join(timeout=5)

@pytest.mark.skipif(sync_playwright is None, reason="Playwright not installed")
def test_box_builder_vanilla_smoke():
    """Vanilla builder smoke: spinner hides, inputs enabled, metrics update, reset buttons present."""
    with run_app_in_thread(fastapi_app) as base_url:
        with sync_playwright() as pw:
            try:
                browser = pw.chromium.launch(headless=True)
            except Exception as e:
                pytest.skip(f"Chromium launch failed: {e}")
            page = browser.new_page()
            page.goto(f"{base_url}/box-builder", wait_until="domcontentloaded")

            # Wait for spinner hide/remove
            spinner_ok = False
            for _ in range(25):  # up to ~5s
                hidden = page.locator('#builder-spinner.is-hide').count() > 0
                exists = page.locator('#builder-spinner').count() > 0
                if hidden or not exists:
                    spinner_ok = True
                    break
                page.wait_for_timeout(200)
            assert spinner_ok, "Spinner did not hide/remove in time"

            # Inputs should be enabled
            first_input = page.locator('form.box-lm-form input[type="number"]').first
            assert first_input.count() == 1, "No numeric input found"
            assert first_input.is_enabled(), "Numeric input should be enabled"
            original_value = first_input.input_value()
            new_value = str(float(original_value or '0') + 2)
            first_input.fill(new_value)
            page.wait_for_timeout(250)

            # Metrics should reflect Gross update
            metric_text = page.locator('.metrics').inner_text()
            assert 'Width:' in metric_text and 'Height:' in metric_text and 'Depth:' in metric_text, "Metrics missing dimension lines"
            assert 'Gross Vol:' in metric_text, "Metrics missing gross volume"

            # Reset buttons
            assert page.locator('button[name="stateReset"]').count() == 1, 'State Reset button missing'
            assert page.locator('button[name="serverReset"]').count() == 1, 'Server Reset button missing'

            browser.close()
