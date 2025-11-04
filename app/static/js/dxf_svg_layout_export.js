// dxf_svg_layout_export.js - handles requesting backend /export/svg and /export/dxf layout endpoints
(function () {
    function $(sel) { return document.querySelector(sel); }
    function gatherCutSheetState() {
        const form = document.querySelector('.box-lm-form');
        if (!form) return null;
        const numVal = (sel) => {
            const el = form.querySelector(sel);
            if (!el) return undefined;
            const v = parseFloat(el.value);
            return isNaN(v) ? undefined : v;
        };
        const width = numVal('input[name="width"]') || 0;
        const height = numVal('input[name="height"]') || 0;
        const depth = numVal('input[name="depth"]') || 0;
        const wall = numVal('input[name="wallThickness"]') || 0.75;
        const joinStyleEl = form.querySelector('select[name="joinStyle"]');
        const join_style = joinStyleEl ? joinStyleEl.value : 'front_back_overlap';
        const include_ports = !!form.querySelector('input[name="includePorts"]:checked');
        const include_bracing = !!form.querySelector('input[name="includeBracing"]:checked');
        const slot_port_width = numVal('input[name="slotPortWidth"]');
        const slot_port_height = numVal('input[name="slotPortHeight"]');
        const num_slot_ports = numVal('input[name="numSlotPorts"]');
        const brace_strip_width = numVal('input[name="braceStripWidth"]') || 2;
        const brace_count = (numVal('input[name="braceCount"]') || 0);
        const kerf_thickness = numVal('input[name="kerfThickness"]') || 0.125;
        return { width, height, depth, wall_thickness: wall, include_ports, include_bracing, join_style, slot_port_width, slot_port_height, num_slot_ports, brace_strip_width, brace_count, kerf_thickness };
    }
    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
    }
    async function requestLayout(endpoint, filenameBase, btn) {
        try {
            const state = gatherCutSheetState();
            if (!state) throw new Error('Form not found');
            btn.disabled = true; const original = btn.textContent; btn.textContent = 'Generating…';
            const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) });
            if (!res.ok) { const txt = await res.text(); throw new Error('Server error ' + res.status + ': ' + txt); }
            const blob = await res.blob();
            downloadBlob(blob, filenameBase + '_' + state.width + 'x' + state.height + 'x' + state.depth + (endpoint.endsWith('svg') ? '.svg' : '.dxf'));
        } catch (err) {
            console.error(err); alert('Failed: ' + err.message);
        } finally {
            btn.disabled = false; btn.textContent = filenameBase.includes('dxf') ? 'Sheet Layout DXF' : 'Sheet Layout SVG';
        }
    }
    function init() {
        const svgBtn = $('button[name="downloadLayoutSvg"]');
        const dxfBtn = $('button[name="downloadLayoutDxf"]');
        if (svgBtn) svgBtn.addEventListener('click', () => requestLayout('/export/svg', 'layout_sheet', svgBtn));
        if (dxfBtn) dxfBtn.addEventListener('click', () => requestLayout('/export/dxf', 'layout_sheet_dxf', dxfBtn));
    }
    document.addEventListener('DOMContentLoaded', init);
})();
