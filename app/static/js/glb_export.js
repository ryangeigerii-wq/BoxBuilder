// GLB Exporter (ES Module) with enriched metadata (ports, volumes)
import { GLTFExporter } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/exporters/GLTFExporter.js';

let latestState = null;
window.addEventListener('boxStateChanged', e => { latestState = e.detail; });

function computeDerived(state) {
    if (!state) return null;
    const t = state.wallThickness || 0.75;
    const grossIn3 = state.width * state.height * state.depth;
    const iW = Math.max(0, state.width - 2 * t);
    const iH = Math.max(0, state.height - 2 * t);
    const iD = Math.max(0, state.depth - 2 * t);
    const internalIn3 = iW * iH * iD;
    return { grossIn3, internalIn3, internalFt3: internalIn3 / 1728, internalLiters: internalIn3 * 0.0163871 };
}

function computePortDisplacement(state) {
    if (!state || !state.port || !state.port.enabled) return null;
    const type = state.port.type;
    const count = state.port.count || 1;
    let perPortAreaIn2 = 0, perPortLengthIn = 0;
    // Prefer localPortEst if available (already accounts for end corrections)
    if (state.localPortEst) {
        perPortAreaIn2 = state.localPortEst.areaPerPortM2 * 1550.0031; // m^2 -> in^2
        perPortLengthIn = state.localPortEst.physicalLengthPerPortM * 39.37; // m -> in
    } else {
        // Fallback rough heuristic using inputs
        if (type === 'slot' && state.port.slotHeightIn) {
            const h = state.port.slotHeightIn;
            let w = state.port.slotWidthIn;
            if (!(w > 0)) {
                const t = state.wallThickness || 0.75;
                const internalW = Math.max(0, state.width - 2 * t);
                const gap = state.port.slotGapIn || 0;
                const usable = internalW - (count - 1) * gap;
                w = usable / count;
            }
            perPortAreaIn2 = h * w;
            perPortLengthIn = state.wallThickness || 0.75; // approximate thickness
        } else if ((type === 'round' || type === 'aero') && state.port.roundDiameterIn) {
            const d = state.port.roundDiameterIn;
            perPortAreaIn2 = Math.PI * Math.pow(d / 2, 2);
            perPortLengthIn = state.wallThickness || 0.75;
        }
    }
    const totalDispIn3 = perPortAreaIn2 * perPortLengthIn * count;
    return { type, count, perPortAreaIn2, perPortLengthIn, totalDispIn3 };
}
function prepareMetadata(group) {
    if (!group) return;
    const md = computeDerived(latestState);
    const portMD = computePortDisplacement(latestState);
    let netAfterPortsIn3 = null;
    if (md && portMD) { netAfterPortsIn3 = md.internalIn3 - portMD.totalDispIn3; }
    group.userData.enclosure = {
        widthIn: latestState?.width,
        heightIn: latestState?.height,
        depthIn: latestState?.depth,
        wallThicknessIn: latestState?.wallThickness,
        finish: latestState?.finish,
        volumes: md || null,
        portDisplacement: portMD || null,
        netInternalAfterPortsIn3: netAfterPortsIn3,
        holes: (latestState?.holes || []).map(h => ({ nominal: h.nominal, cut: h.cut, spec: h.spec, dx: h.dx, dy: h.dy }))
    };
}
function exportGlb() {
    const group = window.__boxGroup;
    if (!group) { alert('3D model not ready yet.'); return; }
    prepareMetadata(group);
    try {
        const exporter = new GLTFExporter();
        exporter.parse(group, result => {
            const blob = new Blob([result], { type: 'model/gltf-binary' });
            applyToViewer(blob);
        }, { binary: true });
    } catch (e) { console.error('GLB export failed', e); alert('Export failed: ' + e.message); }
}
function applyToViewer(blob) {
    const url = URL.createObjectURL(blob);
    const viewer = document.getElementById('boxArViewer');
    if (viewer) { viewer.setAttribute('src', url); }
    // Also trigger a file download
    const a = document.createElement('a');
    a.href = url; a.download = 'box.glb';
    document.body.appendChild(a); a.click(); a.remove();
}
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.querySelector('button[name="generateGlb"]');
    if (btn) { btn.addEventListener('click', exportGlb); }
    const metaBtn = document.querySelector('button[name="downloadMeta"]');
    if (metaBtn) {
        metaBtn.addEventListener('click', () => {
            if (!latestState) { alert('State not ready'); return; }
            const md = computeDerived(latestState);
            const portMD = computePortDisplacement(latestState);
            const payload = { ...latestState, derived: md, portDisplacement: portMD };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'box_metadata.json'; document.body.appendChild(a); a.click(); a.remove();
        });
    }
});
