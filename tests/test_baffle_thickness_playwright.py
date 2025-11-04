import threading, time, pytest, math
from contextlib import contextmanager
from fastapi import FastAPI
from uvicorn import Config, Server

try:
    from playwright.sync_api import sync_playwright
except ImportError:  # pragma: no cover
    sync_playwright = None

from main import app as fastapi_app

@contextmanager
def run_app_in_thread(app: FastAPI, host: str = "127.0.0.1", port: int = 8991):
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
def test_front_baffle_extrude_depth_reacts_to_wall_thickness():
    if sync_playwright is None:
        pytest.skip("Playwright not installed")
    with run_app_in_thread(fastapi_app) as base_url:
        with sync_playwright() as pw:
            try:
                browser = pw.chromium.launch(headless=True)
            except Exception as e:
                pytest.skip(f"Chromium launch failed: {e}")
            page = browser.new_page()
            page.goto(f"{base_url}/box-builder?test=1", wait_until="domcontentloaded")
            # Wait for spinner hide
            for _ in range(40):
                hidden = page.locator('#builder-spinner.is-hide').count() > 0
                exists = page.locator('#builder-spinner').count() > 0
                if hidden or not exists:
                    break
                page.wait_for_timeout(120)
            # Wait for THREE & front baffle presence
            for _ in range(60):
                ready = page.evaluate("!!(window.THREE && window.__frontBaffle && window.__frontBaffle.geometry && window.__frontBaffle.geometry.parameters)")
                if ready:
                    break
                page.wait_for_timeout(100)
            assert page.evaluate("!!window.__frontBaffle"), "frontBaffle not initialized"
            # Read initial wall thickness input (inches) & computed extrude depth (units)
            init_wall = float(page.locator('input[name="wallThickness"]').input_value())
            init_depth = page.evaluate("(function(m){ if(!m||!m.geometry||!m.geometry.parameters) return 0; const p=m.geometry.parameters; return (typeof p.depth==='number'?p.depth:(p.options&&p.options.depth)||0) || (m.userData&&m.userData.wallThicknessUnits)||0; })(window.__frontBaffle)")
            expected_init = pytest.approx(init_wall * 0.05, rel=0.15)
            assert init_depth == pytest.approx(init_wall * 0.05, rel=0.25), f"Initial extrude depth {init_depth} not ~= {expected_init} (wall={init_wall})"
            # Change wall thickness
            new_wall = init_wall + 0.5
            page.fill('input[name="wallThickness"]', f"{new_wall}")
            page.wait_for_timeout(50)
            page.dispatch_event('input[name="wallThickness"]', 'input')
            page.wait_for_timeout(250)
            # Wait for rebuild reflect new geometry (poll depth change)
            new_depth = None
            for _ in range(40):
                new_depth = page.evaluate("(function(m){ if(!m||!m.geometry||!m.geometry.parameters) return 0; const p=m.geometry.parameters; return (typeof p.depth==='number'?p.depth:(p.options&&p.options.depth)||0) || (m.userData&&m.userData.wallThicknessUnits)||0; })(window.__frontBaffle)")
                if abs(new_depth - init_depth) > 1e-6:
                    break
                page.wait_for_timeout(80)
            assert new_depth and new_depth != init_depth, "Extrude depth did not update after wall thickness change"
            assert new_depth == pytest.approx(new_wall * 0.05, rel=0.25), f"Updated extrude depth {new_depth} not ~= {new_wall * 0.05}"
            browser.close()
