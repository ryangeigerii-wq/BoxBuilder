import threading, time, re
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
def run_app_in_thread(app: FastAPI, host: str = "127.0.0.1", port: int = 8999):
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
def test_svg_export_intercept():
    """Intercept object URL used for SVG blob, assert structure & dual hole handling when toggled."""
    if sync_playwright is None:
        pytest.skip("Playwright not installed")
    with run_app_in_thread(fastapi_app) as base_url:
        with sync_playwright() as pw:
            try:
                browser = pw.chromium.launch(headless=True)
            except Exception as e:
                pytest.skip(f"Chromium launch failed: {e}")
            page = browser.new_page()
            # Inject interception for URL.createObjectURL
            page.add_init_script(
                """
                (function(){
                  const orig = URL.createObjectURL;
                  window.__svgPayloads = [];
                  URL.createObjectURL = function(blob){
                    try {
                      if(blob && blob.type === 'image/svg+xml') {
                        const fr = new FileReader();
                        fr.onload = () => { window.__svgPayloads.push(fr.result); };
                        fr.readAsText(blob);
                      }
                    } catch(e) {}
                    return orig.apply(this, arguments);
                  };
                })();
                """
            )
            page.goto(f"{base_url}/box-builder?test=1", wait_until="domcontentloaded")
            for _ in range(30):
                hidden = page.locator('#builder-spinner.is-hide').count() > 0
                exists = page.locator('#builder-spinner').count() > 0
                if hidden or not exists:
                    break
                page.wait_for_timeout(150)
            # Switch to dual layout for two holes
            page.select_option('select[name="subConfig"]', 'dual')
            page.wait_for_timeout(120)
            # Click export
            page.click('button[name="downloadSvg"]')
            for _ in range(25):
                if page.evaluate('window.__svgPayloads.length') > 0:
                    break
                page.wait_for_timeout(120)
            payloads = page.evaluate('window.__svgPayloads') or []
            assert payloads, 'Expected captured SVG payloads'
            svg = payloads[-1]
            assert '<svg' in svg.lower(), 'Missing <svg>'
            assert 'class="front"' in svg or "class='front'" in svg
            assert 'class="cutouts"' in svg or "class='cutouts'" in svg
            # At least two circles for dual holes
            circle_count = len(re.findall(r'<circle ', svg))
            assert circle_count >= 2, f'Expected >=2 circles, got {circle_count}'
            browser.close()
