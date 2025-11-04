// pdf_export.js
// Handles requesting the /export/pdf endpoint and downloading the resulting PDF.
(function () {
    function $(sel) { return document.querySelector(sel); } // tiny helper
    function gatherState() {
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
    function init() {
        const btn = document.querySelector('button[name="downloadPdf"]');
        if (!btn) return;
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.textContent = 'Generating…';
            try {
                const state = gatherState();
                if (!state) { throw new Error('Form state missing'); }
                const res = await fetch('/export/pdf', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(state)
                });
                if (!res.ok) {
                    const txt = await res.text();
                    throw new Error('Server error ' + res.status + ': ' + txt);
                }
                const blob = await res.blob();
                downloadBlob(blob, `box_cutsheet_${state.width}x${state.height}x${state.depth}.pdf`);
            } catch (err) {
                console.error(err);
                alert('Failed to generate PDF: ' + err.message);
            } finally {
                btn.disabled = false;
                btn.textContent = 'Download Cut Sheet PDF';
            }
        });
    }
    document.addEventListener('DOMContentLoaded', init);
})();