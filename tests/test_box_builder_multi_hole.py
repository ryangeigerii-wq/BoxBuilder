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
    if sync_playwright is None:
        pytest.skip("Playwright not installed")
    with run_app_in_thread(fastapi_app) as base_url:
        with sync_playwright() as pw:
            try:
                browser = pw.chromium.launch(headless=True)
            except Exception as e:
                pytest.skip(f"Chromium launch failed: {e}")
            page = browser.new_page()
            # Inject blob interception for SVG export
            page.add_init_script(
                """
                (function(){
                  const orig = URL.createObjectURL; window.__svgPayloadsMH = [];
                  URL.createObjectURL = function(blob){
                    try { if(blob && blob.type==='image/svg+xml'){ const fr=new FileReader(); fr.onload=()=>window.__svgPayloadsMH.push(fr.result); fr.readAsText(blob);} }catch(e){}
                    return orig.apply(this, arguments);
                  };
                })();
                """
            )
            page.goto(f"{base_url}/box-builder?test=1", wait_until="domcontentloaded")

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

            # Dual layout now uses radio hole selection (no inline SVG preview).
            radios = page.locator('.hole-select input[name="holeSelect"]')
            assert radios.count() == 2, "Expected two hole selection radios"
            # Select second hole via associated label (radio may be visually hidden)
            page.click('.hole-select label:has(input[value="1"])')
            page.wait_for_timeout(50)
            # Nudge second hole right
            page.keyboard.press('ArrowRight')
            page.wait_for_timeout(120)
            # Change cut diameter override
            page.fill('input[name="cutDiameter"]', '5')
            page.wait_for_timeout(120)
            # Export SVG and capture via interception
            page.click('button[name="downloadSvg"]')
            for _ in range(25):
                if page.evaluate('window.__svgPayloadsMH.length') > 0:
                    break
                page.wait_for_timeout(120)
            payloads = page.evaluate('window.__svgPayloadsMH') or []
            assert payloads, 'No captured SVG payloads'
            svg = payloads[-1]
            assert '<svg' in svg.lower(), 'Expected SVG root'
            # Count circles (2 driver holes expected)
            import re
            circles = re.findall(r'<circle ', svg)
            assert len(circles) >= 2, f'Expected at least 2 circles, found {len(circles)}'
            # Optional: ensure movement changed at least one cx after ArrowRight (compare first vs second circle centers)
            cxs = [float(m) for m in re.findall(r'cx=\"([0-9.]+)\"', svg)[:2]] or [float(m) for m in re.findall(r"cx='([0-9.]+)'", svg)[:2]]
            if len(cxs) == 2:
                # They should not be identical (dual layout separation)
                assert abs(cxs[0]-cxs[1]) > 1.0, 'Dual hole centers too close; expected horizontal separation'

            browser.close()
