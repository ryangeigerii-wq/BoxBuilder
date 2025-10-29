// Box Builder (Pure Vanilla JS)
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('lm-root');
    if (!root) return;
    const form = root.querySelector('form.box-lm-form');
    if (!form) return;
    // Static (GitHub Pages) fallback: detect pages host and disable server-dependent features.
    (function(){
      try {
        const isPagesHost = /\.github\.io$/i.test(location.hostname) || location.hostname === '127.0.0.1';
        if(!isPagesHost) return;
        // Disable server compute & restart buttons gracefully
        const computeBtnStatic = form.querySelector('button[name="computePort"]');
        if(computeBtnStatic){
          computeBtnStatic.disabled = true;
          computeBtnStatic.title = 'Disabled: static Pages build (no backend)';
          computeBtnStatic.textContent = 'Compute (offline)';
        }
        const restartBtnStatic = form.querySelector('button[name="serverReset"]');
        if(restartBtnStatic){
          restartBtnStatic.disabled = true;
          restartBtnStatic.title = 'Restart unavailable (static build)';
        }
        // Monkey patch fetch for /ports/design to return placeholder without error
        const originalFetch = window.fetch;
        window.fetch = async function(url, opts){
          try {
            const u = (typeof url === 'string') ? url : (url && url.url ? url.url : '');
            if(u.startsWith('/ports/design')){
              return new Response(JSON.stringify({
                offline: true,
                message: 'Static Pages build: backend endpoint unavailable',
                areaPerPortM2: 0,
                physicalLengthPerPortM: 0,
                effectiveLengthPerPortM: 0,
                tuningHzAchieved: 0,
                endCorrectionPerEndM: 0
              }), {status: 200, headers: {'Content-Type': 'application/json'}});
            }
          } catch(err) { /* fall through */ }
          return originalFetch.apply(this, arguments);
        }
      } catch(e) { /* ignore static patch errors */ }
    })();
    // Hide spinner immediately (reduce perceived load time)
    const spinner = document.getElementById('builder-spinner');
    if (spinner) {
      // Apply a minimal fade-out (≈95ms) then remove for visual feedback without noticeable delay
      spinner.classList.add('is-hide');
      setTimeout(() => { try { spinner.remove(); } catch (_) { } }, 120);
    }
    // Enable controls
    form.querySelectorAll('input[disabled],select[disabled],button[disabled]').forEach(el => el.removeAttribute('disabled'));

    // Single source of truth state
    const state = {
      width: 18,
      height: 12,
      depth: 10,
      showGhost: false,
      unit: 'in', // future: 'mm'
      holes: [ // relative offsets from center (inches)
        { dx: 0, dy: 0, nominal: 12, cut: null, spec: null, selected: true }
      ],
      showDims: true,
      toast: '',
      history: [],
      future: [],
      zoomMode: 'default' // starting mode (~45%) close | normal | wide | default
      , portDesign: null
      , depthStyle: 'diagonal' // 'diagonal' | 'horizontal' | 'none'
      , showInternal: false
      , wallThickness: 0.75
      , port: { enabled: false, type: 'slot', count: 1 } // lightweight mirror of form inputs for preview helpers
      , showPortOverlay: true
    };

    const limits = { Wmax: 400, Hmax: 400 };
    const lastValid = { width: state.width, height: state.height, depth: state.depth };

    function pushHistory() {
      state.history.push(JSON.parse(JSON.stringify({ width: state.width, height: state.height, depth: state.depth, holes: state.holes }))); // shallow clone with deep holes
      if (state.history.length > 20) state.history.shift();
      state.future = []; // clear redo stack
    }

    function clampAndRemember(key, raw) {
      let v = parseFloat(raw);
      if (isNaN(v) || v <= 0) { v = lastValid[key]; }
      if (key === 'width') v = Math.min(Math.max(1, v), limits.Wmax);
      if (key === 'height') v = Math.min(Math.max(1, v), limits.Hmax);
      if (key === 'depth') v = Math.max(0, v); // depth can be 0
      lastValid[key] = v;
      state[key] = v;
    }

    function readForm() {
      const inputs = form.querySelectorAll('input[type="number"]');
      clampAndRemember('width', inputs[0]?.value);
      clampAndRemember('height', inputs[1]?.value);
      clampAndRemember('depth', inputs[2]?.value);
      const ghostToggle = form.querySelector('input[type="checkbox"][name="showGhost"]');
      state.showGhost = ghostToggle ? ghostToggle.checked : false;
      // Optional grid input
      // grid snapping removed
      // Editable cut diameter (applies to all holes or selected?) Use single input controlling all holes' cut value.
      const cutInput = form.querySelector('input[name="cutDiameter"]');
      let cutVal = null;
      if (cutInput) {
        const v = parseFloat(cutInput.value);
        if (isFinite(v) && v > 0) cutVal = v;
      }
      // sub layout (single/dual) reconfigure holes if changed
      const layoutSel = form.querySelector('select[name="subConfig"]');
      const desiredLayout = layoutSel ? layoutSel.value : 'single';
      if (desiredLayout === 'single' && state.holes.length !== 1) {
        state.holes = [{ dx: 0, dy: 0, nominal: state.holes[0]?.nominal || 12, cut: cutVal, spec: null, selected: true }];
      } else if (desiredLayout === 'dual' && state.holes.length !== 2) {
        const nominal = state.holes[0]?.nominal || 12;
        state.holes = [
          { dx: -nominal * 0.6, dy: 0, nominal, cut: cutVal, spec: null, selected: true },
          { dx: nominal * 0.6, dy: 0, nominal, cut: cutVal, spec: null, selected: false }
        ];
      }
      // Apply cut value to holes
      state.holes.forEach(h => { h.cut = cutVal; });
      const showDimsToggle = form.querySelector('input[name="showDims"]');
      state.showDims = showDimsToggle ? showDimsToggle.checked : true;
      const depthStyleSel = form.querySelector('select[name="depthStyle"]');
      if (depthStyleSel) { state.depthStyle = depthStyleSel.value; }
      const internalToggle = form.querySelector('input[name="showInternal"]');
      state.showInternal = internalToggle ? internalToggle.checked : false;
      const wallTInput = form.querySelector('input[name="wallThickness"]');
      if (wallTInput) {
        const wt = parseFloat(wallTInput.value);
        if (isFinite(wt) && wt >= 0) { state.wallThickness = wt; }
      }
      const showPortOverlayEl = form.querySelector('input[name="showPortOverlay"]');
      state.showPortOverlay = showPortOverlayEl ? !!showPortOverlayEl.checked : state.showPortOverlay;
      // Port simple state mirror
      const portTypeEl = form.querySelector('[name="portType"]');
      const numPortsEl = form.querySelector('[name="numPorts"]');
      const targetHzEl = form.querySelector('[name="targetHz"]');
      const targetHzVal = parseFloat(targetHzEl?.value);
      const typeVal = portTypeEl?.value || state.port.type;
      const countVal = parseInt(numPortsEl?.value || '1', 10) || 1;
      state.port.type = typeVal;
      state.port.count = countVal;
      state.port.enabled = isFinite(targetHzVal) && targetHzVal > 0 && state.showInternal; // require target + internal toggle
      // Apply snapping to box dims if grid
      // no dimension snapping

      // Dual auto-resize: ensure box wide/tall enough for two cutouts. Never shrink, only expand.
      if (desiredLayout === 'dual' && state.holes.length === 2) {
        // Determine effective diameter (spec > cut > heuristic nominal*0.93)
        const h0 = state.holes[0];
        const nominal = h0.nominal || 12;
        const dia = h0.spec ? h0.spec : (h0.cut ? h0.cut : nominal * 0.93);
        const edgeMargin = 0.5; // consistent with preview enforcement
        const r = dia / 2;
        const minGap = Math.max(1.0, r * 0.3); // ensure some wood between cutouts
        const requiredWidth = 4 * r + minGap + 2 * edgeMargin; // two radii per hole (total 4r) + gap + margins
        if (state.width < requiredWidth) {
          state.width = Math.min(requiredWidth, limits.Wmax);
          lastValid.width = state.width;
          // reflect input field if present
          const widthInput = form.querySelector('input[name="width"]');
          if (widthInput) widthInput.value = state.width.toFixed(2).replace(/\.00$/, '');
          state.toast = state.toast || 'Auto-sized for dual';
        }
        const requiredHeight = 2 * r + 2 * edgeMargin; // vertical fit single row
        if (state.height < requiredHeight) {
          state.height = Math.min(requiredHeight, limits.Hmax);
          lastValid.height = state.height;
          const heightInput = form.querySelector('input[name="height"]');
          if (heightInput) heightInput.value = state.height.toFixed(2).replace(/\.00$/, '');
          state.toast = state.toast || 'Auto-sized for dual';
        }
        // If holes are still at heuristic positions, adjust them to edge-aligned symmetrical spacing.
        // Heuristic pattern recognized by ±nominal*0.6 (within small tolerance) before resize.
        const tol = 0.001;
        const patternMatch = Math.abs(state.holes[0].dx + nominal * 0.6) < tol && Math.abs(state.holes[1].dx - nominal * 0.6) < tol;
        if (patternMatch) {
          const centerLeft = edgeMargin + r; // from left edge
          const centerRight = state.width - edgeMargin - r; // from right edge
          // Convert to dx from center
          state.holes[0].dx = centerLeft - state.width / 2;
          state.holes[1].dx = centerRight - state.width / 2;
        }
      }
    }

    function snap(value) { return value; }

    function format(n) { return n.toFixed(2); }

    // --- Port drawing helpers (slot / dual slot / round+aero) ---
    function buildLocalPortSvg(state, scale, origin, toPx) {
      // Returns string with <g>...</g> or ''
      if (state.portDesign) return ''; // server design takes precedence
      if (!state.localPortEst) return '';
      if (!state.showPortOverlay) return '';
      const est = state.localPortEst;
      const t = state.wallThickness;
      if (est.portType === 'slot') {
        const slotHeightM = parseFloat(form.querySelector('[name="slotHeightM"]')?.value || '0');
        if (!isFinite(slotHeightM) || slotHeightM <= 0) return '';
        const slotGapM = parseFloat(form.querySelector('[name="slotGapM"]')?.value || '0');
        const internalWidthIn = Math.max(0, state.width - 2 * t);
        const gapIn = slotGapM * 39.37;
        const slotHeightIn = slotHeightM * 39.37;
        const numSlots = est.numPorts || 1;
        const usableWidthIn = Math.max(0, internalWidthIn - (numSlots > 1 ? gapIn : 0));
        const singleWidthIn = numSlots > 1 ? usableWidthIn / numSlots : usableWidthIn;
        if (singleWidthIn <= 0) return '';
        const L_in = est.physicalLengthPerPortM * 39.37;
        let g = `<g class='ports local-est'>`;
        for (let i = 0; i < numSlots; i++) {
          // center slots horizontally; distribute by width + gap
          const totalWidthWithGaps = numSlots * singleWidthIn + (numSlots - 1) * gapIn;
          const leftStart = state.width / 2 - totalWidthWithGaps / 2;
          const portXIn = leftStart + i * (singleWidthIn + gapIn);
          const portYIn = state.height / 2 - slotHeightIn / 2;
          const dispPos = toPx(portXIn + singleWidthIn / 2, portYIn + slotHeightIn / 2);
          const wPx = singleWidthIn * scale;
          const hPx = slotHeightIn * scale;
          g += `<rect x='${(dispPos.x - wPx / 2).toFixed(2)}' y='${(dispPos.y - hPx / 2).toFixed(2)}' width='${wPx.toFixed(2)}' height='${hPx.toFixed(2)}' fill='rgba(88,166,255,0.18)' stroke='#58a6ff' stroke-width='1.4' vector-effect='non-scaling-stroke' />`;
          if (i === 0) {
            const lenStart = toPx(portXIn + singleWidthIn / 2, portYIn - 0.6);
            const lenEnd = toPx(portXIn + singleWidthIn / 2 + L_in, portYIn - 0.6);
            g += `<line x1='${lenStart.x.toFixed(2)}' y1='${lenStart.y.toFixed(2)}' x2='${lenEnd.x.toFixed(2)}' y2='${lenEnd.y.toFixed(2)}' stroke='#58a6ff' stroke-dasharray='5 3' stroke-width='1.2' vector-effect='non-scaling-stroke' />`;
            g += `<text x='${((lenStart.x + lenEnd.x) / 2).toFixed(2)}' y='${(lenStart.y - 7).toFixed(2)}' font-size='11' fill='#58a6ff' text-anchor='middle'>L≈${L_in.toFixed(2)}"</text>`;
          }
        }
        g += `</g>`;
        return g;
      } else if (est.portType === 'round' || est.portType === 'aero') {
        const dM = parseFloat(form.querySelector('[name="diameterM"]')?.value || '0');
        if (!isFinite(dM) || dM <= 0) return '';
        const dIn = dM * 39.37;
        const rIn = dIn / 2;
        const count = est.numPorts || 1;
        const gapIn = rIn * 0.6;
        const totalWidthIn = count * dIn + (count - 1) * gapIn;
        const startCenterXIn = state.width / 2 - totalWidthIn / 2 + rIn;
        const centerYIn = state.height * 0.65;
        const L_in = est.physicalLengthPerPortM * 39.37;
        const isAero = est.portType === 'aero';
        const flareM = isAero ? parseFloat(form.querySelector('[name="flareRadiusM"]')?.value || '0') : 0;
        const flareIn = flareM * 39.37;
        let g = `<g class='ports local-est'>`;
        for (let i = 0; i < count; i++) {
          const cxIn = startCenterXIn + i * (dIn + gapIn);
          const pos = toPx(cxIn, centerYIn);
          const radPx = rIn * scale;
          const fill = isAero ? 'rgba(255,181,67,0.18)' : 'rgba(88,166,255,0.15)';
          const stroke = isAero ? '#ffb543' : '#58a6ff';
          g += `<circle cx='${pos.x.toFixed(2)}' cy='${pos.y.toFixed(2)}' r='${radPx.toFixed(2)}' fill='${fill}' stroke='${stroke}' stroke-width='1.2' vector-effect='non-scaling-stroke' />`;
          if (isAero && flareIn > 0) {
            const flareRadPx = (rIn + flareIn * 0.35) * scale;
            g += `<circle cx='${pos.x.toFixed(2)}' cy='${pos.y.toFixed(2)}' r='${flareRadPx.toFixed(2)}' fill='none' stroke='${stroke}' stroke-dasharray='3 3' stroke-width='1' opacity='.6' vector-effect='non-scaling-stroke' />`;
          }
          if (i === 0) {
            const lenStart = toPx(cxIn, centerYIn - rIn - 0.6);
            const lenEnd = toPx(cxIn + L_in, centerYIn - rIn - 0.6);
            g += `<line x1='${lenStart.x.toFixed(2)}' y1='${lenStart.y.toFixed(2)}' x2='${lenEnd.x.toFixed(2)}' y2='${lenEnd.y.toFixed(2)}' stroke='${stroke}' stroke-dasharray='5 3' stroke-width='1.2' vector-effect='non-scaling-stroke' />`;
            g += `<text x='${((lenStart.x + lenEnd.x) / 2).toFixed(2)}' y='${(lenStart.y - 7).toFixed(2)}' font-size='11' fill='${stroke}' text-anchor='middle'>L≈${L_in.toFixed(2)}"</text>`;
          }
        }
        g += `</g>`;
        return g;
      }
      return '';
    }

    function buildServerPortSvg(state, scale, origin, toPx, x, y, dispW, dispH) {
      if (!(state.portDesign && state.portDesign.preview && state.portDesign.preview.ports2D)) return '';
      const ports = state.portDesign.preview.ports2D;
      const scaleFactor = (dispW / state.width);
      return '<g class="ports">' + ports.map(p => {
        if (p.kind === 'circle' && p.r) {
          const cx = x + dispW / 2 + (p.x * scaleFactor * 39.37 * 0.02);
          const cy = y + dispH * 0.75 + (p.y * scaleFactor * 39.37 * 0.02);
          const r = (p.r * 39.37 * scaleFactor * 0.02);
          return `<circle cx='${cx.toFixed(2)}' cy='${cy.toFixed(2)}' r='${r.toFixed(2)}' class='port-shape' />`;
        } else if (p.kind === 'rect' && p.w && p.h) {
          const pw = p.w * 39.37 * scaleFactor * 0.02;
          const ph = p.h * 39.37 * scaleFactor * 0.02;
          const px = x + dispW / 2 + (p.x * scaleFactor * 39.37 * 0.02) - pw / 2;
          const py = y + dispH * 0.75 + (p.y * scaleFactor * 39.37 * 0.02) - ph / 2;
          return `<rect x='${px.toFixed(2)}' y='${py.toFixed(2)}' width='${pw.toFixed(2)}' height='${ph.toFixed(2)}' class='port-shape' />`;
        }
        return '';
      }).join('') + '</g>';
    }

    // Core deterministic axis-aligned preview generator with cutouts & modular port helpers
    function generatePreview() {
      const viewW = 480, viewH = 360, margin = 12; // smaller margin for closer framing
      // Scale uniformly if larger than available area
      const maxW = viewW - margin * 2; // ghost offset considered separately
      const maxH = viewH - margin * 2;
      const ghostOffset = state.showGhost ? Math.min(20 + state.depth * 2, 140) : 0; // used only to position ghost panels, not to shrink scale
      // Allow enlarging small boxes instead of clamping at 1 (ignore ghost offset for scaling)
      let baseScale = Math.min(maxW / (state.width), maxH / (state.height));
      // Apply zoom presets
      // Adjusted zoom factors: close ~ former normal, normal slightly reduced, wide unchanged
      const zoomFactorMap = { close: 0.60, normal: 0.35, wide: 0.25, default: 0.45 };
      const zf = zoomFactorMap[state.zoomMode] || zoomFactorMap.default;
      let scale = baseScale * zf;
      const dispW = state.width * scale;
      const dispH = state.height * scale;
      // Center primary box regardless of ghost; ghost panels offset outward
      const x = (viewW - dispW) / 2;
      const y = (viewH - dispH) / 2;

      // Cutout logic: nominal size derived from a subSize selector if present (fallback 12)
      const sizeSel = form.querySelector('select[name="subSize"]');
      const nominalSel = sizeSel ? parseInt(sizeSel.value, 10) : 12;
      // Update nominal for holes that are purely heuristic (no override/spec)
      state.holes.forEach(h => { if (!h.cut && !h.spec) { h.nominal = nominalSel; } });
      const frontRect = `<rect x='${x.toFixed(2)}' y='${y.toFixed(2)}' width='${dispW.toFixed(2)}' height='${dispH.toFixed(2)}' class='front' />`;
      // Depth responsiveness: scale side panel thickness with depth using hybrid (linear + log) growth, no abrupt stop at ~10in.
      // Previous implementation capped at 36 and used state.depth * scale * 0.35 which visually plateaued when scale shrinks.
      // New approach: base linear component plus logarithmic term to keep increasing while diminishing rate, then clamp to viewport reasonableness.
      const linear = state.depth * scale * 0.20; // gentler linear slope
      const logPart = Math.log10(Math.max(1, state.depth)) * 5 * scale; // adds growth beyond 10"
      let sideThickness = linear + logPart;
      sideThickness = Math.max(4, Math.min(sideThickness, (viewW * 0.25))); // never exceed 25% of viewport width
      const leftPanel = `<rect x='${(x - sideThickness).toFixed(2)}' y='${y.toFixed(2)}' width='${sideThickness.toFixed(2)}' height='${dispH.toFixed(2)}' class='panel-left' />`;
      let ghostBack = '';
      let ghostRight = '';
      let ghostEdges = '';
      if (state.showGhost) {
        const gOff = Math.min(20 + state.depth * 2, 140) * 0.6;
        ghostBack = `<rect x='${(x + gOff).toFixed(2)}' y='${(y + gOff).toFixed(2)}' width='${dispW.toFixed(2)}' height='${dispH.toFixed(2)}' class='ghost-back' />`;
        ghostRight = `<rect x='${(x + gOff + dispW).toFixed(2)}' y='${(y + gOff).toFixed(2)}' width='${sideThickness.toFixed(2)}' height='${dispH.toFixed(2)}' class='ghost-right' />`;
        ghostEdges = [
          `<line x1='${x.toFixed(2)}' y1='${y.toFixed(2)}' x2='${(x + gOff).toFixed(2)}' y2='${(y + gOff).toFixed(2)}' class='ghost-edge' />`,
          `<line x1='${(x + dispW).toFixed(2)}' y1='${y.toFixed(2)}' x2='${(x + gOff + dispW).toFixed(2)}' y2='${(y + gOff).toFixed(2)}' class='ghost-edge' />`,
          `<line x1='${x.toFixed(2)}' y1='${(y + dispH).toFixed(2)}' x2='${(x + gOff).toFixed(2)}' y2='${(y + gOff + dispH).toFixed(2)}' class='ghost-edge' />`,
          `<line x1='${(x + dispW).toFixed(2)}' y1='${(y + dispH).toFixed(2)}' x2='${(x + gOff + dispW).toFixed(2)}' y2='${(y + gOff + dispH).toFixed(2)}' class='ghost-edge' />`
        ].join('');
      }
      // Multiple holes: render circles in one layer (siblings) for nth-child selectors (tests)
      const edgeMargin = 0.5;
      const circles = [];
      const labels = [];
      state.holes.forEach(h => {
        const nominal = h.nominal || nominalSel;
        let dia = h.spec ? h.spec : (h.cut ? h.cut : nominal * 0.93);
        dia = Math.min(dia, state.width, state.height);
        let hx = snap(state.width / 2 + (h.dx || 0));
        let hy = snap(state.height / 2 + (h.dy || 0));
        const r = dia / 2;
        if (hx - r - edgeMargin < 0) hx = r + edgeMargin;
        if (hx + r + edgeMargin > state.width) hx = state.width - r - edgeMargin;
        if (hy - r - edgeMargin < 0) hy = r + edgeMargin;
        if (hy + r + edgeMargin > state.height) hy = state.height - r - edgeMargin;
        const dispX = x + (hx - state.width / 2) * scale + dispW / 2;
        const dispY = y + (hy - state.height / 2) * scale + dispH / 2;
        const dispR = r * scale;
        circles.push(`<circle cx='${dispX.toFixed(2)}' cy='${dispY.toFixed(2)}' r='${dispR.toFixed(2)}' class='cutout${h.selected ? " selected" : ""}' data-idx='${state.holes.indexOf(h)}' />`);
        const badgeType = h.spec ? 'SPEC' : (h.cut ? 'CUT' : 'EST');
        const badgeY = (dispY - dispR - 10).toFixed(2);
        const badgeX = dispX.toFixed(2);
        labels.push(`<text x='${badgeX}' y='${badgeY}' text-anchor='middle' class='badge ${badgeType.toLowerCase()}'>${badgeType}</text>`);
        const innerFontPx = Math.max(6, Math.min(15, dispR * 0.55));
        labels.push(`<text x='${dispX.toFixed(2)}' y='${dispY.toFixed(2)}' text-anchor='middle' dominant-baseline='middle' style='font:${innerFontPx}px system-ui;fill:#ffd28c;'>${dia.toFixed(2)}"</text>`);
      });
      const cutoutsGroup = `<g class='cutouts'>${circles.join('')}${labels.join('')}</g>`;
      // Dimension lines remain
      // Dimension lines: simple horizontal & vertical with labels above/beside front rect
      const dimLineColor = '#555';
      const dimTextColor = '#222';
      const labelFont = `font:13px system-ui;`;
      let dimsGroup = '';
      if (state.showDims) {
        // Arrowhead marker defs
        const arrDef = `<defs><marker id='arrow' viewBox='0 0 10 10' refX='5' refY='5' markerWidth='6' markerHeight='6' orient='auto'><path d='M 0 0 L 10 5 L 0 10 z' fill='${dimLineColor}'/></marker></defs>`;
        // Box width line (above)
        const wy = y - 20;
        const widthLine = `<line x1='${x.toFixed(2)}' y1='${wy.toFixed(2)}' x2='${(x + dispW).toFixed(2)}' y2='${wy.toFixed(2)}' stroke='${dimLineColor}' stroke-width='1' marker-start='url(#arrow)' marker-end='url(#arrow)' />`;
        const widthLabel = `<text x='${(x + dispW / 2).toFixed(2)}' y='${(wy - 6).toFixed(2)}' text-anchor='middle' fill='${dimTextColor}' style='${labelFont}'>W ${state.width.toFixed(2)} in</text>`;
        // Box height line moved to right side
        const hxPosRight = x + dispW + 30;
        const heightLine = `<line x1='${hxPosRight.toFixed(2)}' y1='${y.toFixed(2)}' x2='${hxPosRight.toFixed(2)}' y2='${(y + dispH).toFixed(2)}' stroke='${dimLineColor}' stroke-width='1' marker-start='url(#arrow)' marker-end='url(#arrow)' />`;
        const heightLabel = `<text x='${(hxPosRight + 4).toFixed(2)}' y='${(y + dispH / 2).toFixed(2)}' text-anchor='start' dominant-baseline='middle' fill='${dimTextColor}' style='${labelFont}'>H ${state.height.toFixed(2)} in</text>`;
        // Hole diameter lines & labels (for each hole)
        const holeDims = state.holes.map(h => {
          const nominal = h.nominal;
          const dia = h.spec ? h.spec : (h.cut ? h.cut : nominal * 0.93);
          const r = dia / 2 * scale;
          // find circle center again
          const dispWLocal = state.width * scale;
          const dispHLocal = state.height * scale;
          const baseX = (viewW - dispWLocal - (state.showGhost ? Math.min(20 + state.depth * 2, 140) : 0)) / 2;
          const baseY = (viewH - dispHLocal - (state.showGhost ? Math.min(20 + state.depth * 2, 140) : 0)) / 2;
          const hx = snap(state.width / 2 + (h.dx || 0));
          const hy = snap(state.height / 2 + (h.dy || 0));
          const dispX = baseX + (hx - state.width / 2) * scale + dispWLocal / 2;
          const dispY = baseY + (hy - state.height / 2) * scale + dispHLocal / 2;
          const lineY = dispY + r + 18;
          return `<g class='hole-dim'><line x1='${(dispX - r).toFixed(2)}' y1='${lineY.toFixed(2)}' x2='${(dispX + r).toFixed(2)}' y2='${lineY.toFixed(2)}' stroke='${dimLineColor}' stroke-width='1' marker-start='url(#arrow)' marker-end='url(#arrow)' />
            <text x='${dispX.toFixed(2)}' y='${(lineY + 14).toFixed(2)}' text-anchor='middle' fill='${dimTextColor}' style='${labelFont}'>Ø ${dia.toFixed(2)} in</text></g>`;
        }).join('');
        // Depth guide styles
        let depthGuide = '';
        if (state.depthStyle !== 'none') {
          const depthProjection = Math.min(20 + state.depth * 2, 140); // projection basis
          const frontTopRightX = x + dispW;
          const frontTopRightY = y;
          if (state.depthStyle === 'diagonal') {
            const backTopRightX = frontTopRightX + depthProjection * 0.6;
            const backTopRightY = frontTopRightY + depthProjection * 0.6;
            const depthDiag = `<line x1='${frontTopRightX.toFixed(2)}' y1='${frontTopRightY.toFixed(2)}' x2='${backTopRightX.toFixed(2)}' y2='${backTopRightY.toFixed(2)}' stroke='${dimLineColor}' stroke-width='1' marker-start='url(#arrow)' marker-end='url(#arrow)' />`;
            const midX = (frontTopRightX + backTopRightX) / 2 + 6;
            const midY = (frontTopRightY + backTopRightY) / 2 - 6;
            const depthLabel = `<text x='${midX.toFixed(2)}' y='${midY.toFixed(2)}' fill='${dimTextColor}' style='${labelFont}' text-anchor='start'>D ${state.depth.toFixed(2)} in</text>`;
            depthGuide = depthDiag + depthLabel;
          } else if (state.depthStyle === 'horizontal') {
            // Horizontal line extending rightward, representing depth value scaled proportionally
            const lineStartX = frontTopRightX;
            const lineStartY = frontTopRightY - 14; // slightly above top edge
            const horizLen = Math.min(depthProjection * 0.75, viewW - lineStartX - 10);
            const lineEndX = lineStartX + horizLen;
            const depthLine = `<line x1='${lineStartX.toFixed(2)}' y1='${lineStartY.toFixed(2)}' x2='${lineEndX.toFixed(2)}' y2='${lineStartY.toFixed(2)}' stroke='${dimLineColor}' stroke-width='1' marker-start='url(#arrow)' marker-end='url(#arrow)' />`;
            const labelX = lineStartX + horizLen / 2;
            const labelY = lineStartY - 6;
            const depthLabel = `<text x='${labelX.toFixed(2)}' y='${labelY.toFixed(2)}' fill='${dimTextColor}' style='${labelFont}' text-anchor='middle'>D ${state.depth.toFixed(2)} in</text>`;
            depthGuide = depthLine + depthLabel;
          }
        }
        dimsGroup = `<g class='dims'>${arrDef}${widthLine}${widthLabel}${heightLine}${heightLabel}${holeDims}${depthGuide}</g>`;
      }

      // Build ports after holes but before dimension lines per requested ordering
      function toPx(xIn, yIn) { return { x: x + (xIn - state.width / 2) * scale + dispW / 2, y: y + (yIn - state.height / 2) * scale + dispH / 2 }; }
      const localPorts = buildLocalPortSvg(state, scale, { x, y, dispW, dispH }, toPx);
      const serverPorts = buildServerPortSvg(state, scale, { x, y, dispW, dispH }, toPx, x, y, dispW, dispH);
      const portsGroup = localPorts || serverPorts;
      return `<svg viewBox='0 0 ${viewW} ${viewH}' preserveAspectRatio='xMidYMid meet' role='img' aria-label='Box preview'>
        <defs>
          <pattern id='ghostHatch' width='6' height='6' patternUnits='userSpaceOnUse'>
            <path d='M0 6 L6 0 M-1 1 L1 -1 M5 7 L7 5' stroke='#3a4855' stroke-width='0.6' opacity='0.55'/>
          </pattern>
          <style>
            .front { fill:#1e2630; stroke:#55687a; stroke-width:1.5; vector-effect:non-scaling-stroke; }
            .panel-left { fill:#232e3a; stroke:#4e5d6b; stroke-width:1.2; vector-effect:non-scaling-stroke; }
            .ghost-back { fill:url(#ghostHatch); stroke:#3a4855; stroke-width:1.2; stroke-dasharray:4 3; opacity:.25; vector-effect:non-scaling-stroke; }
            .ghost-right { fill:url(#ghostHatch); stroke:#3a4855; stroke-width:1.2; stroke-dasharray:4 3; opacity:.25; vector-effect:non-scaling-stroke; }
            .ghost-edge { stroke:#3a4855; stroke-width:1; stroke-dasharray:4 3; opacity:.35; vector-effect:non-scaling-stroke; }
            .cutout { fill:#111; stroke:#ff9d4f; stroke-width:1.2; vector-effect:non-scaling-stroke; cursor:pointer; }
            .cutout.selected { stroke:#ffd28c; stroke-width:1.6; }
            .toast { font:11px system-ui; fill:#b65d00; }
            .badge { font:10px system-ui; fill:#fff; stroke:#222; stroke-width:.4; paint-order:stroke; }
            .badge.est { fill:#eee; stroke:#555; }
            .badge.ovr { fill:#ffd28c; stroke:#a06400; }
            .badge.spec { fill:#a7e3ff; stroke:#035b7a; }
            .dims line { vector-effect:non-scaling-stroke; stroke-dasharray:3 2; }
            text { font:12px system-ui; fill:#333; pointer-events:none; }
            .port-shape { fill:#203240; stroke:#58a6ff; stroke-width:1.2; vector-effect:non-scaling-stroke; opacity:.85; }
          </style>
        </defs>
        <rect x='0' y='0' width='${viewW}' height='${viewH}' fill='#f3e2c9' />
        ${ghostBack}${ghostRight}${ghostEdges}${leftPanel}${frontRect}${cutoutsGroup}${portsGroup}${dimsGroup}
        ${state.toast ? `<text x='8' y='${(viewH - 8).toFixed(2)}' class='toast'>${state.toast}</text>` : ''}
      </svg>`;
    }

    // Local port estimation helper (lightweight; uses current form inputs if internal shown)
    function recomputeLocalPort() {
      const targetHzEl = form.querySelector('[name="targetHz"]');
      const portTypeEl = form.querySelector('[name="portType"]');
      const numPortsEl = form.querySelector('[name="numPorts"]');
      const slotHeightEl = form.querySelector('[name="slotHeightM"]');
      const slotGapEl = form.querySelector('[name="slotGapM"]');
      const diameterEl = form.querySelector('[name="diameterM"]');
      const flareEl = form.querySelector('[name="flareRadiusM"]');
      const speedEl = form.querySelector('[name="speedOfSound"]');
      const targetHz = parseFloat(targetHzEl?.value);
      if (!isFinite(targetHz) || targetHz <= 0) return null;
      const portType = portTypeEl?.value || 'slot';
      const numPorts = parseInt(numPortsEl?.value || '1', 10) || 1;
      const speed = parseFloat(speedEl?.value) || 343; // m/s
      if (!state.showInternal) return null; // need internal dims enabled
      const t = state.wallThickness;
      const iW = Math.max(0, state.width - 2 * t);
      const iH = Math.max(0, state.height - 2 * t);
      const iD = Math.max(0, state.depth - 2 * t);
      const internalVolIn3 = iW * iH * iD;
      const internalVolM3 = internalVolIn3 * 0.0000163871;
      if (internalVolM3 <= 0) return null;
      let areaPerPortM2 = null;
      let endCorrectionPerEndM = 0;
      if (portType === 'round' || portType === 'aero') {
        const dM = parseFloat(diameterEl?.value);
        if (!isFinite(dM) || dM <= 0) return null;
        areaPerPortM2 = Math.PI * Math.pow(dM / 2, 2);
        const flareR = (portType === 'aero') ? (parseFloat(flareEl?.value) || 0) : 0;
        const r = dM / 2;
        endCorrectionPerEndM = 0.85 * r - (flareR > 0 ? 0.4 * r * (flareR / r) : 0);
      } else { // slot
        const hM = parseFloat(slotHeightEl?.value);
        if (!isFinite(hM) || hM <= 0) return null;
        const gapM = parseFloat(slotGapEl?.value) || 0;
        const internalWidthM = Math.max(0, iW * 0.0254);
        const wM = Math.max(0, internalWidthM - gapM);
        areaPerPortM2 = wM * hM;
        const Rh = (wM * hM) / (2 * (wM + hM));
        endCorrectionPerEndM = Math.max(0, (1.7 * Math.sqrt(wM * hM / Math.PI) * 0.6 + 0.5 * Rh));
      }
      if (!areaPerPortM2 || areaPerPortM2 <= 0) return null;
      const L_eff = (areaPerPortM2 * speed * speed) / (Math.pow(2 * Math.PI * targetHz, 2) * internalVolM3 / numPorts);
      const physicalLengthPerPortM = Math.max(0, L_eff - 2 * endCorrectionPerEndM);
      return { portType, numPorts, targetHz, areaPerPortM2, effectiveLengthPerPortM: L_eff, physicalLengthPerPortM, endCorrectionPerEndM };
    }

    function update(commit = true) {
      readForm();
      state.localPortEst = recomputeLocalPort();
      if (commit) { state.toast = ''; pushHistory(); }
      const previewPanel = root.querySelector('.panel + .panel .preview-wrapper');
      if (previewPanel) {
        previewPanel.innerHTML = generatePreview();
      }
      const metrics = form.querySelector('.metrics');
      if (metrics) {
        const grossIn3 = state.width * state.height * state.depth;
        const grossFt3 = grossIn3 / 1728;
        const grossL = grossIn3 * 0.0163871;
        let html = `<div><strong>Width:</strong> ${format(state.width)} in</div>
          <div><strong>Height:</strong> ${format(state.height)} in</div>
          <div><strong>Depth:</strong> ${format(state.depth)} in</div>
          <div><strong>Gross:</strong> Gross Vol: ${format(grossIn3)} in³ (${format(grossFt3)} ft³ · ${grossL.toFixed(1)} L)</div>`;
        let internalVolIn3 = null;
        let netVolIn3 = null;
        if (state.showInternal) {
          const t = state.wallThickness;
          const iW = Math.max(0, state.width - 2 * t);
          const iH = Math.max(0, state.height - 2 * t);
          const iD = Math.max(0, state.depth - 2 * t);
          internalVolIn3 = iW * iH * iD;
          const driverDispInput = form.querySelector('input[name="driverDisp"]');
          const bracingDispInput = form.querySelector('input[name="bracingDisp"]');
          const driverDisp = driverDispInput ? parseFloat(driverDispInput.value) || 0 : 0;
          const bracingDisp = bracingDispInput ? parseFloat(bracingDispInput.value) || 0 : 0;
          let portDispIn3 = 0;
          if (state.localPortEst) {
            const areaIn2 = state.localPortEst.areaPerPortM2 * 1550.0031;
            const lenIn = state.localPortEst.physicalLengthPerPortM * 39.37;
            portDispIn3 = areaIn2 * lenIn * state.localPortEst.numPorts;
          } else if (state.portDesign) {
            const areaIn2 = state.portDesign.areaPerPortM2 * 1550.0031;
            const lenIn = state.portDesign.physicalLengthPerPortM * 39.37;
            portDispIn3 = areaIn2 * lenIn * (state.portDesign.numPorts || 1);
          }
          netVolIn3 = internalVolIn3 - driverDisp - bracingDisp - portDispIn3;
          html += `<div style='margin-top:.4rem;opacity:.85;'><strong>Internal (t=${format(t)}"):</strong></div>
            <div>iW ${format(iW)} in · iH ${format(iH)} in · iD ${format(iD)} in</div>
            <div><strong>Internal Vol:</strong> ${format(internalVolIn3)} in³ (${format(internalVolIn3 / 1728)} ft³ · ${(internalVolIn3 * 0.0163871).toFixed(1)} L)</div>`;
          if (portDispIn3 > 0) {
            html += `<div><strong>Port Disp:</strong> ${portDispIn3.toFixed(2)} in³ (${(portDispIn3 / 1728).toFixed(3)} ft³)</div>`;
          }
          if (driverDisp + bracingDisp > 0) {
            html += `<div><strong>Driver+Brace Disp:</strong> ${(driverDisp + bracingDisp).toFixed(2)} in³</div>`;
          }
        }
        if (netVolIn3 !== null) {
          const netFt3 = netVolIn3 / 1728;
          const netL = netVolIn3 * 0.0163871;
          html += `<div><strong>Net Vol:</strong> ${netVolIn3.toFixed(2)} in³ (${netFt3.toFixed(3)} ft³ · ${netL.toFixed(1)} L)</div>`;
          if (netVolIn3 < 0) {
            html += `<div style='color:#b30000;font-weight:600;'>Net volume negative (check displacements)</div>`;
          }
        }
        if (state.portDesign && state.portDesign.tuningHzAchieved) {
          html += `<div style='margin-top:.4rem;'><strong>Tuning:</strong> ${state.portDesign.tuningHzAchieved.toFixed(2)} Hz</div>`;
        } else if (state.localPortEst) {
          const physIn = state.localPortEst.physicalLengthPerPortM * 39.37;
          const areaIn2 = state.localPortEst.areaPerPortM2 * 1550.0031;
          html += `<div style='margin-top:.4rem;'><strong>Tuning (target):</strong> ${state.localPortEst.targetHz.toFixed(2)} Hz (est)</div>`;
          html += `<div><strong>Est Port Len/Port:</strong> ${physIn.toFixed(2)} in (A=${areaIn2.toFixed(1)} in²)</div>`;
        }
        metrics.innerHTML = html;
      }
    }

    form.addEventListener('input', () => update());
    form.addEventListener('change', () => update());

    // Click select hole
    root.addEventListener('click', e => {
      const circle = e.target.closest('circle.cutout');
      if (!circle) return;
      const idx = parseInt(circle.getAttribute('data-idx'), 10);
      state.holes.forEach((h, i) => h.selected = i === idx);
      update(false);
    });

    // Keyboard nudging
    window.addEventListener('keydown', e => {
      const sel = state.holes.find(h => h.selected);
      if (!sel) return;
      const step = 0.25; // fixed nudge step (snapping removed)
      const mult = e.shiftKey ? 5 : 1;
      let moved = false;
      if (e.key === 'ArrowLeft') { sel.dx -= step * mult; moved = true; }
      if (e.key === 'ArrowRight') { sel.dx += step * mult; moved = true; }
      if (e.key === 'ArrowUp') { sel.dy -= step * mult; moved = true; }
      if (e.key === 'ArrowDown') { sel.dy += step * mult; moved = true; }
      if (moved) { e.preventDefault(); update(); }
      // Undo / redo
      if (e.ctrlKey && e.key === 'z') { // undo
        if (state.history.length) {
          const current = state.history.pop();
          state.future.push(JSON.parse(JSON.stringify({ width: state.width, height: state.height, depth: state.depth, holes: state.holes })));
          Object.assign(state, current);
          update(false);
        }
      }
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { // redo
        if (state.future.length) {
          const next = state.future.pop();
          state.history.push(JSON.parse(JSON.stringify({ width: state.width, height: state.height, depth: state.depth, holes: state.holes })));
          Object.assign(state, next);
          update(false);
        }
      }
    });

    // Removed Add Hole (replaced by subConfig)

    // Zoom buttons
    const zoomCloseBtn = root.querySelector('button[name="zoomClose"]');
    const zoomNormalBtn = root.querySelector('button[name="zoomNormal"]');
    const zoomWideBtn = root.querySelector('button[name="zoomWide"]');
    // No dedicated default button; default state starts at mid (0.45) until user chooses.
    function reflectZoomActive() {
      const mapping = { close: zoomCloseBtn, normal: zoomNormalBtn, wide: zoomWideBtn, default: null };
      [zoomCloseBtn, zoomNormalBtn, zoomWideBtn].forEach(btn => { if (btn) btn.classList.remove('is-active'); });
      const activeBtn = mapping[state.zoomMode];
      if (activeBtn) activeBtn.classList.add('is-active');
    }
    function setZoom(mode) {
      state.zoomMode = mode;
      reflectZoomActive();
      update(false);
    }
    reflectZoomActive();
    if (zoomCloseBtn) zoomCloseBtn.addEventListener('click', () => setZoom('close'));
    if (zoomNormalBtn) zoomNormalBtn.addEventListener('click', () => setZoom('normal'));
    if (zoomWideBtn) zoomWideBtn.addEventListener('click', () => setZoom('wide'));

    // Client-side state reset (not server restart) button
    const stateResetBtn = form.querySelector('button[name="stateReset"]');
    if (stateResetBtn) {
      stateResetBtn.addEventListener('click', () => {
        Object.assign(state, {
          width: 12,
          height: 10,
          depth: 8,
          showGhost: false,
          grid: 0,
          holes: [{ dx: 0, dy: 0, nominal: 12, cut: null, spec: null, selected: true }],
          showDims: true,
          toast: 'State reset.',
          history: [],
          future: [],
          zoomMode: 'normal'
        });
        // Reflect inputs
        form.querySelector('input[name="width"]').value = '12';
        form.querySelector('input[name="height"]').value = '10';
        form.querySelector('input[name="depth"]').value = '8';
        // snapping removed: no gridSnap input
        form.querySelector('input[name="showGhost"]').checked = false;
        form.querySelector('input[name="showDims"]').checked = true;
        const cutInputReset = form.querySelector('input[name="cutDiameter"]');
        if (cutInputReset) cutInputReset.value = '';
        update(false);
        reflectZoomActive();
      });
    }

    // Server restart button (calls admin endpoint) - requires backend support
    const serverResetBtn = form.querySelector('button[name="serverReset"]');
    if (serverResetBtn) {
      serverResetBtn.addEventListener('click', async () => {
        serverResetBtn.disabled = true;
        serverResetBtn.textContent = 'Restarting...';
        state.toast = 'Attempting restart…';
        update(false);
        let status = 0;
        try {
          const r = await fetch('/admin/restart', { method: 'POST' });
          status = r.status;
          if (status === 202) {
            state.toast = 'Restart scheduled (watch for reload).';
            console.info('[serverRestart] Accepted 202, server should exit soon for reload');
          } else if (status === 404) {
            state.toast = 'Restart endpoint missing (404).';
            console.warn('[serverRestart] 404 Not Found: /admin/restart. Check route or mount context.');
          } else if (status === 403) {
            state.toast = 'Restart disabled (403).';
            console.warn('[serverRestart] 403 Forbidden: debug may be False.');
          } else if (status >= 500) {
            const txt = await r.text();
            state.toast = 'Restart server error.';
            console.error('[serverRestart] Server error', status, txt);
          } else {
            const txt = await r.text();
            state.toast = 'Restart unexpected status.';
            console.warn('[serverRestart] Unexpected status', status, txt);
          }
        } catch (err) {
          console.error('[serverRestart] Network or fetch error', err);
          state.toast = 'Restart network error.';
        }
        update(false);
        setTimeout(() => { serverResetBtn.disabled = false; serverResetBtn.textContent = 'Restart Server'; }, status === 202 ? 4000 : 3000);
      });
    }
    update();

    // Port design compute integration
    const computeBtn = form.querySelector('button[name="computePort"]');
    const portTypeSel = form.querySelector('select[name="portType"]');
    // Port menu toggle
    const portMenuBtn = form.querySelector('button[name="togglePortMenu"]');
    const portFieldset = form.querySelector('fieldset.port-inputs');
    const cutoutMenuBtn = form.querySelector('button[name="toggleCutoutMenu"]');
    const cutoutFieldset = form.querySelector('fieldset.cutout-inputs');
    function closePortPanel() {
      if (portFieldset) {
        portFieldset.style.display = 'none';
        if (portMenuBtn) {
          const lbl = portMenuBtn.querySelector('.port-menu-label');
          if (lbl) lbl.textContent = 'Port Design ▾';
        }
      }
    }
    function closeCutoutPanel() {
      if (cutoutFieldset) {
        cutoutFieldset.style.display = 'none';
        if (cutoutMenuBtn) {
          const lbl = cutoutMenuBtn.querySelector('.cutout-menu-label');
          if (lbl) lbl.textContent = 'Cutout Settings ▾';
        }
      }
    }
    function openPortPanel() {
      if (!portFieldset) return;
      // Close other
      closeCutoutPanel();
      portFieldset.style.display = 'block';
      // Position logic: ensure not overlapping horizontally with potential cutout fieldset width
      portFieldset.style.left = '0';
      if (portMenuBtn) {
        const lbl = portMenuBtn.querySelector('.port-menu-label');
        if (lbl) lbl.textContent = 'Port Design ▴';
      }
    }
    function openCutoutPanel() {
      if (!cutoutFieldset) return;
      closePortPanel();
      cutoutFieldset.style.display = 'block';
      // If its width would overlap port area, shift right slightly
      cutoutFieldset.style.left = '0';
      if (cutoutMenuBtn) {
        const lbl = cutoutMenuBtn.querySelector('.cutout-menu-label');
        if (lbl) lbl.textContent = 'Cutout Settings ▴';
      }
    }
    if (portMenuBtn && portFieldset) {
      portMenuBtn.addEventListener('click', () => {
        const isOpen = portFieldset.style.display === 'block';
        if (isOpen) closePortPanel(); else openPortPanel();
      });
    }
    if (cutoutMenuBtn && cutoutFieldset) {
      cutoutMenuBtn.addEventListener('click', () => {
        const isOpen = cutoutFieldset.style.display === 'block';
        if (isOpen) closeCutoutPanel(); else openCutoutPanel();
      });
    }
    document.addEventListener('click', e => {
      // Outside click closes both
      if (portFieldset && portFieldset.style.display === 'block') {
        if (!portFieldset.contains(e.target) && !portMenuBtn.contains(e.target) && !(cutoutFieldset?.contains(e.target))) {
          closePortPanel();
        }
      }
      if (cutoutFieldset && cutoutFieldset.style.display === 'block') {
        if (!cutoutFieldset.contains(e.target) && !cutoutMenuBtn.contains(e.target) && !(portFieldset?.contains(e.target))) {
          closeCutoutPanel();
        }
      }
    });
    function readPortInputs() {
      const getNum = name => {
        const el = form.querySelector(`[name="${name}"]`);
        if (!el) return null;
        const v = parseFloat(el.value);
        return isFinite(v) ? v : null;
      };
      return {
        portType: portTypeSel ? portTypeSel.value : 'slot',
        boxVolumeLiters: (() => {
          const provided = getNum('boxVolumeLiters');
          if (provided) return provided;
          // derive from internal dimensions (subtract wall thickness) if possible
          const t = state.wallThickness;
          const iW = Math.max(0, state.width - 2 * t);
          const iH = Math.max(0, state.height - 2 * t);
          const iD = Math.max(0, state.depth - 2 * t);
          const internalVolIn3 = iW * iH * iD; // cubic inches
          const liters = internalVolIn3 * 0.0163871; // 1 in^3 = 0.0163871 L
          return parseFloat(liters.toFixed(3));
        })(),
        targetHz: getNum('targetHz'),
        numPorts: parseInt((form.querySelector('[name="numPorts"]')?.value || '1'), 10),
        slotHeightM: getNum('slotHeightM'),
        slotGapM: getNum('slotGapM'),
        diameterM: getNum('diameterM'),
        flareRadiusM: getNum('flareRadiusM') ?? 0,
        cornerPlacement: form.querySelector('input[name="cornerPlacement"]')?.checked || false,
        extraPhysicalLengthM: getNum('extraPhysicalLengthM') ?? 0,
        speedOfSound: getNum('speedOfSound') ?? 343,
        driverSdM2: getNum('driverSdM2'),
        peakConeExcursionM: getNum('peakConeExcursionM')
      };
    }
    async function computePortDesign() {
      const payload = readPortInputs();
      // basic validation presence
      if (!payload.boxVolumeLiters || !payload.targetHz) {
        state.toast = 'Port: volume & target required';
        update(false); return;
      }
      if (payload.portType === 'slot' && !payload.slotHeightM) {
        state.toast = 'Port: slot height required'; update(false); return;
      }
      if ((payload.portType === 'round' || payload.portType === 'aero') && !payload.diameterM) {
        state.toast = 'Port: diameter required'; update(false); return;
      }
      try {
        const r = await fetch('/ports/design', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!r.ok) {
          const txt = await r.text();
          state.toast = 'Port error';
          console.error('Port design error', txt);
          update(false); return;
        }
        const data = await r.json();
        state.portDesign = data;
        // Local theoretical Helmholtz cross-check
        let localHelmholtz = null;
        const Vb_cu_in = (payload.boxVolumeLiters || 0) / 0.0163871; // liters -> cubic inches
        let areaIn2 = null;
        let endCorrIn = 0;
        if (payload.portType === 'round' || payload.portType === 'aero') {
          const d_in = (payload.diameterM || 0) * 39.37;
          const r_in = d_in / 2;
          areaIn2 = Math.PI * r_in * r_in;
          const flare = payload.portType === 'aero' ? (payload.flareRadiusM || 0) * 39.37 : 0;
          endCorrIn = (0.85 * r_in + 0.85 * r_in) - (flare > 0 ? 0.4 * r_in : 0);
        } else if (payload.portType === 'slot') {
          const h_in = (payload.slotHeightM || 0) * 39.37;
          const t = state.wallThickness;
          const internalWidthIn = Math.max(0, state.width - 2 * t);
          const gap_in = (payload.slotGapM || 0) * 39.37;
          const w_in = Math.max(0, internalWidthIn - gap_in);
          areaIn2 = h_in * w_in;
          const Rh = (w_in * h_in) / (2 * (w_in + h_in));
          endCorrIn = Math.max(0, 1.7 * Math.sqrt(w_in * h_in / Math.PI) * 0.6 + 0.5 * Rh);
        }
        if (Vb_cu_in > 0 && areaIn2 && payload.targetHz) {
          const c_in_s = 13503.9;
          const fb = payload.targetHz;
          const term = Math.pow(c_in_s / (2 * Math.PI * fb), 2) * (areaIn2 / Vb_cu_in);
          const Lphys_in = Math.max(0, term - endCorrIn);
          localHelmholtz = { areaIn2, Lphys_in, endCorrIn, fb };
        }
        // Render summary below port fieldset
        let summary = form.querySelector('.port-summary');
        if (!summary) {
          summary = document.createElement('div');
          summary.className = 'port-summary';
          form.querySelector('.port-inputs')?.appendChild(summary);
        }
        summary.style.marginTop = '1rem';
        summary.style.fontSize = '.8rem';
        summary.style.lineHeight = '1.3';
        summary.innerHTML = `
          <div><strong>Area/Port (server):</strong> ${data.areaPerPortM2.toFixed(5)} m²</div>
          <div><strong>Phys Len (server):</strong> ${data.physicalLengthPerPortM.toFixed(4)} m</div>
          <div><strong>Eff Len (server):</strong> ${data.effectiveLengthPerPortM.toFixed(4)} m</div>
          <div><strong>Tuning Achieved (server):</strong> ${data.tuningHzAchieved.toFixed(2)} Hz</div>
          <div><strong>End Corr/End (server):</strong> ${data.endCorrectionPerEndM.toFixed(4)} m</div>
          ${data.estPeakPortAirVelocityMS ? `<div><strong>Peak Port Velocity:</strong> ${data.estPeakPortAirVelocityMS.toFixed(2)} m/s (Mach ${(data.estMach || 0).toFixed(3)})</div>` : ''}
          ${localHelmholtz ? `<div style='margin-top:.4rem;opacity:.85;'><strong>Local Check:</strong> L≈${localHelmholtz.Lphys_in.toFixed(2)} in (A=${localHelmholtz.areaIn2.toFixed(1)} in², EC≈${localHelmholtz.endCorrIn.toFixed(2)} in)</div>` : ''}
        `;
        state.toast = 'Port design computed';
        // No height animation; nothing to dispatch
        update(false);
      } catch (err) {
        console.error(err);
        state.toast = 'Port compute failed';
        update(false);
      }
    }
    if (computeBtn) { computeBtn.addEventListener('click', computePortDesign); }
    // Dynamic show/hide of port-specific fields
    function reflectPortFields() {
      const type = portTypeSel?.value;
      form.querySelectorAll('.port-slot-only').forEach(el => { el.style.display = (type === 'slot' ? 'flex' : 'none'); });
      form.querySelectorAll('.port-round-aero').forEach(el => { el.style.display = (type === 'round' || type === 'aero' ? 'flex' : 'none'); });
      form.querySelectorAll('.port-aero-only').forEach(el => { el.style.display = (type === 'aero' ? 'flex' : 'none'); });
    }
    portTypeSel?.addEventListener('change', () => { reflectPortFields(); });
    reflectPortFields();
  });
})();
