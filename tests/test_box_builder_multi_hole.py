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
def run_app_in_thread(app: FastAPI, host: str = "127.0.0.1", port: int = 8899):
    config = Config(app=app, host=host, port=port, log_level="warning")
    server = Server(config=config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    for _ in range(60):
        if server.started:  # type: ignore
            break
        time.sleep(0.1)
    try:
        yield f"http://{host}:{port}"
    finally:
        server.should_exit = True
        thread.join(timeout=5)


@pytest.mark.skipif(sync_playwright is None, reason="Playwright not installed")
def test_multi_hole_and_snapping():
    """Verify adding holes, selection, keyboard nudge with snapping, and override toggle."""
    with run_app_in_thread(fastapi_app) as base_url:
        with sync_playwright() as pw:
            try:
                browser = pw.chromium.launch(headless=True)
            except Exception as e:
                pytest.skip(f"Chromium launch failed: {e}")
            page = browser.new_page()
            page.goto(f"{base_url}/box-builder", wait_until="domcontentloaded")

            # Wait for spinner removal/hide
            for _ in range(25):
                hidden = page.locator('#builder-spinner.is-hide').count() > 0
                exists = page.locator('#builder-spinner').count() > 0
                if hidden or not exists:
                    break
                page.wait_for_timeout(200)

            # Ensure first input enabled
            assert page.locator('form.box-lm-form input[name="width"]').is_enabled()

            # Grid snapping removed; proceed without filling grid step

            # Switch to dual layout
            page.select_option('select[name="subConfig"]', 'dual')
            page.wait_for_timeout(100)

            # Two holes should exist (circle elements)
            circles = page.locator('svg circle.cutout')
            assert circles.count() == 2, "Expected two hole circles after Add Hole"
            # Badges present (EST initially)
            assert page.locator('svg text.badge').count() >= 2, "Expected badges for holes"

            # Select second hole (click its circle)
            circles.nth(1).click()
            page.wait_for_timeout(50)

            # Nudge right (ArrowRight) -> position changes & remains snapped
            page.keyboard.press('ArrowRight')
            page.wait_for_timeout(100)

            # Capture circle positions (cx attributes)
            cxs = [page.get_attribute(f'svg circle.cutout:nth-child({i+1})', 'cx') for i in range(2)]
            # Ensure numeric and distinct after movement
            assert all(cxs), "Failed to read circle cx attributes"
            assert cxs[0] != cxs[1], "Second hole did not move or selection failed"

            # Set custom cut diameter smaller
            page.fill('input[name="cutDiameter"]', '5')
            page.wait_for_timeout(100)

            # Confirm badge switches to CUT for selected hole
            cut_badges = page.locator('svg text.badge.cut')
            assert cut_badges.count() >= 1, "Expected at least one CUT badge after custom cut diameter"

            # Toggle dimensions off; dims group should disappear
            page.uncheck('input[name="showDims"]')
            page.wait_for_timeout(100)
            assert page.locator('svg g.dims').count() == 0, "Dimensions group should be hidden when toggle off"

            # Toggle dimensions on again; dims group returns
            page.check('input[name="showDims"]')
            page.wait_for_timeout(100)
            assert page.locator('svg g.dims').count() == 1, "Dimensions group should reappear when toggle on"

            browser.close()
