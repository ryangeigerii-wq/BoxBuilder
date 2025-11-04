/** @jest-environment jsdom */
// port_multi.spec.js - verify multi-port array rendering logic in box_builder.js
// Ensures state.ports iteration path produces expected SVG fragments (rect + circle) when two ports defined.

function setupDom() {
    const html = `
  <div class="builder-layout">
    <form class="box-lm-form">
      <input name="width" type="number" value="20" />
      <input name="height" type="number" value="12" />
      <input name="depth" type="number" value="16" />
      <input name="wallThickness" type="number" value="0.75" />
      <input name="showDims" type="checkbox" checked />
      <input name="showInternal" type="checkbox" />
      <input name="showPortOverlay" type="checkbox" checked />
      <input name="fillHoles" type="checkbox" />
      <input name="showCutouts" type="checkbox" checked />
      <input name="hideFrontPanel" type="checkbox" />
      <input name="portEnabled" type="checkbox" checked />
      <select name="portType"><option value="slot" selected>slot</option></select>
      <input name="numPorts" type="number" value="2" />
      <input name="targetHz" type="number" value="32" />
      <input name="slotHeightIn" type="number" value="2.5" />
      <input name="slotWidthIn" type="number" value="8" />
      <input name="slotGapIn" type="number" value="0.75" />
      <input name="slotInsetIn" type="number" value="0.75" />
      <select name="slotSide"><option value="left" selected>left</option></select>
      <input name="roundDiameterIn" type="number" value="" />
      <input name="roundSpacingIn" type="number" value="" />
      <input name="roundInsetIn" type="number" value="" />
      <input name="flareRadiusIn" type="number" value="" />
      <select name="finish"><option value="espresso" selected>espresso</option></select>
      <select name="depthStyle"><option value="diagonal" selected>diagonal</option></select>
      <select name="subConfig"><option value="single" selected>single</option></select>
      <select name="subSize"><option value="12" selected>12</option></select>
    </form>
  </div>`;
    document.body.innerHTML = html;
}

// Helper to get current exported SVG string (using public exporter if available)
function buildLocalPorts(state) {
    const hook = window.__buildLocalPortSvg;
    if (typeof hook !== 'function') return '';
    // Mimic scale/origin logic used in buildSvgExport (simplified for test):
    const viewW = 480, viewH = 360, margin = 12;
    const maxW = viewW - margin * 2, maxH = viewH - margin * 2;
    const baseScale = Math.min(maxW / state.width, maxH / state.height);
    const zoomFactorMap = { close: 0.60, normal: 0.35, wide: 0.25, default: 0.45 };
    const scale = baseScale * (zoomFactorMap[state.zoomMode] || zoomFactorMap.default);
    const dispW = state.width * scale; const dispH = state.height * scale;
    const x = (viewW - dispW) / 2; const y = (viewH - dispH) / 2;
    function toPx(xIn, yIn) { return { x: x + (xIn - state.width / 2) * scale + dispW / 2, y: y + (yIn - state.height / 2) * scale + dispH / 2 }; }
    return hook(state, scale, { x, y, dispW, dispH }, toPx) || '';
}

describe('Multi-port SVG rendering', () => {
    beforeEach(() => {
        setupDom();
        delete window.__boxBuilderState;
        // Simulate query string to activate test hook exposure inside builder script
        try { window.history.replaceState({}, '', '/box-builder?jest_test_hook=1'); } catch (e) { /* ignore */ }
        require('../box_builder.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));
    });

    test('renders multi ports when state.ports has two entries', () => {
        const state = window.__boxBuilderState;
        expect(state).toBeDefined();
        // Manually append a second port object to simulate multi-port configuration (different type for diversity)
        state.ports.push({
            id: 'p1',
            type: 'round',
            width: 3.5,
            height: 3.5,
            length: 14, // arbitrary
            position: 'front',
            color: '#ff66aa',
            offsetX: 4, // shift right of slot port
            offsetY: -1
        });
        // Ensure legacy count no longer forces single-port path
        state.port.count = 2;
        // Trigger update to rebuild geometry & SVG using multi-port path
        const form = document.querySelector('form.box-lm-form');
        form.dispatchEvent(new Event('input'));
        // Allow debounced update (65ms); use fake timers to flush
        jest.useFakeTimers();
        jest.runAllTimers();
        jest.useRealTimers();
        // Build SVG export and inspect
        const svg = buildLocalPorts(state);
        expect(svg).toContain("class='ports multi'"); // multi-port group wrapper
        // Slot port rect fragment (class='port-item slot') and round port circle fragment
        expect(svg).toMatch(/<g class='port-item slot'[^>]*>/);
        expect(svg).toMatch(/<g class='port-item round'[^>]*>/);
        // Second port custom color stroke should appear
        expect(svg).toContain('#ff66aa');
    });

    test('falls back to legacy single-port fast path when only one port object present', () => {
        const state = window.__boxBuilderState;
        // Remove any additional ports leaving only p0 (auto-populated)
        state.ports = state.ports.slice(0, 1);
        state.port.count = 1;
        const form = document.querySelector('form.box-lm-form');
        form.dispatchEvent(new Event('input'));
        jest.useFakeTimers();
        jest.runAllTimers();
        jest.useRealTimers();
        const svg = buildLocalPorts(state);
        // Should NOT contain multi wrapper; should show consolidated class instead
        expect(svg).not.toContain("class='ports multi'");
        expect(svg).toContain("class='ports consolidated'");
    });
});
