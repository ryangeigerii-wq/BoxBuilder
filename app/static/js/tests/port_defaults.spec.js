/** @jest-environment jsdom */
// port_defaults.spec.js - verify auto-default population of slot port when enabled
// Uses jsdom environment for DOM APIs relied upon by builder script.

function createMinimalDom() {
    // Provide the subset of DOM APIs used by box_builder.js for initialization.
    const formHtml = `
    <div class="builder-layout">
      <form class="box-lm-form">
        <input name="width" type="number" value="14" />
        <input name="height" type="number" value="10" />
        <input name="depth" type="number" value="8" />
        <input name="wallThickness" type="number" value="0.75" />
        <input name="showDims" type="checkbox" checked />
        <input name="showInternal" type="checkbox" />
        <input name="showPortOverlay" type="checkbox" checked />
        <input name="fillHoles" type="checkbox" />
        <input name="showCutouts" type="checkbox" checked />
        <input name="hideFrontPanel" type="checkbox" />
        <input name="portEnabled" type="checkbox" checked />
        <select name="portType"><option value="slot" selected>slot</option></select>
        <input name="numPorts" type="number" value="1" />
        <input name="targetHz" type="number" value="" />
        <input name="slotHeightIn" type="number" value="" />
        <input name="slotWidthIn" type="number" value="" />
        <input name="slotGapIn" type="number" value="" />
        <input name="slotInsetIn" type="number" value="" />
        <select name="slotSide"><option value="">(auto)</option><option value="left">left</option></select>
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
    // Basic parsing using DOMParser via JSDOM fallback - simulate using a temporary element.
    const container = document.createElement('div');
    container.innerHTML = formHtml;
    document.body.innerHTML = '';
    document.body.appendChild(container.firstElementChild);
}

describe('Port default population (slot, 32 Hz)', () => {
    beforeEach(() => {
        // Establish minimal DOM
        createMinimalDom();
        delete window.__boxBuilderState;
        // Require builder script and trigger DOMContentLoaded for init
        require('../box_builder.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));
    });

    test('populates targetHz and slot defaults when blank', () => {
        const state = window.__boxBuilderState;
        expect(state).toBeDefined();
        const port = state.port;
        expect(port.enabled).toBe(true);
        // targetHz default
        expect(port.targetHz).toBe(32);
        // slotHeight heuristic: internal height = height - 2*wallThickness = 10 - 1.5 = 8.5; 22% => 1.87 -> clamped to 2.5
        expect(port.slotHeightIn).toBeCloseTo(2.5, 2);
        // gap default
        expect(port.slotGapIn).toBeCloseTo(0.75, 2);
        // inset default
        expect(port.slotInsetIn).toBeCloseTo(0.75, 2);
        // side default
        expect(port.slotSide).toBe('left');
    });

    test('does not override explicit user-provided values', () => {
        jest.useFakeTimers();
        const form = document.querySelector('form.box-lm-form');
        const target = form.querySelector('input[name="targetHz"]');
        const h = form.querySelector('input[name="slotHeightIn"]');
        const gap = form.querySelector('input[name="slotGapIn"]');
        const inset = form.querySelector('input[name="slotInsetIn"]');
        target.value = '35';
        h.value = '3.25';
        gap.value = '1.00';
        inset.value = '1.25';
        // Dispatch input to schedule update debounce (65ms)
        form.dispatchEvent(new Event('input'));
        // Run pending timers to flush scheduled update
        jest.runAllTimers();
        const state = window.__boxBuilderState;
        expect(state.port.targetHz).toBe(35);
        expect(state.port.slotHeightIn).toBeCloseTo(3.25, 2);
        expect(state.port.slotGapIn).toBeCloseTo(1.0, 2);
        expect(state.port.slotInsetIn).toBeCloseTo(1.25, 2);
        jest.useRealTimers();
    });
});
