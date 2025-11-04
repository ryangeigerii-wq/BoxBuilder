import threading, time, pytest, re
from contextlib import contextmanager
from fastapi import FastAPI
from uvicorn import Config, Server

try:
    from playwright.sync_api import sync_playwright
except ImportError:  # pragma: no cover
    sync_playwright = None

from main import app as fastapi_app

@contextmanager
def run_app_in_thread(app: FastAPI, host: str = "127.0.0.1", port: int = 8992):
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
def test_port_geometry_mesh_count_changes():
    """Enable port overlay, adjust parameters, verify port mesh count updates in debug text."""
    if sync_playwright is None:
        pytest.skip("Playwright not installed")
    with run_app_in_thread(fastapi_app) as base_url:
        with sync_playwright() as pw:
            try:
                browser = pw.chromium.launch(headless=True)
            except Exception as e:
                pytest.skip(f"Chromium launch failed: {e}")
            page = browser.new_page()
            page.goto(f"{base_url}/box-builder?test=1&debug3d=1", wait_until="domcontentloaded")
            # Hide spinner
            for _ in range(40):
                hidden = page.locator('#builder-spinner.is-hide').count() > 0
                exists = page.locator('#builder-spinner').count() > 0
                if hidden or not exists:
                    break
                page.wait_for_timeout(120)
            # Open port menu & enable
            page.click('button[name="togglePortMenu"]')
            page.check('input[name="portEnabled"]')
            # Select round port, set diameter & target tuning to trigger overlay calculation heuristics
            page.select_option('select[name="portType"]', 'round')
            page.fill('input[name="roundDiameterIn"]', '4')
            page.fill('input[name="targetHz"]', '32')
            page.wait_for_timeout(300)
            # Poll debug text for non-zero ports
            port_count_1 = 0
            for _ in range(25):
                dbg = page.locator('#three-debug').inner_text() if page.locator('#three-debug').count() else ''
                if 'ports:' in dbg:
                    try:
                        parts = dict(p.split(':',1) for p in dbg.split())
                        port_count_1 = int(parts.get('ports','0'))
                    except Exception:
                        pass
                if port_count_1 > 0:
                    break
                page.wait_for_timeout(120)
            assert port_count_1 > 0, f"Expected initial port count >0, got {port_count_1}"
            # Increase number of ports
            page.fill('input[name="numPorts"]', '2')
            page.wait_for_timeout(300)
            port_count_2 = 0
            for _ in range(25):
                dbg = page.locator('#three-debug').inner_text() if page.locator('#three-debug').count() else ''
                if 'ports:' in dbg:
                    try:
                        parts = dict(p.split(':',1) for p in dbg.split())
                        port_count_2 = int(parts.get('ports','0'))
                    except Exception:
                        pass
                if port_count_2 != port_count_1:
                    break
                page.wait_for_timeout(120)
            assert port_count_2 > port_count_1, f"Expected increased port count after changing numPorts (before={port_count_1} after={port_count_2})"
            browser.close()
