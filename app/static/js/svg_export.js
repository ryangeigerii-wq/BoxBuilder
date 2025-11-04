// svg_export.js - standalone deterministic SVG generator for box builder (per-hole cutOut flag deprecated; holes always treated uniformly)
// Exports global BoxSVGExporter with build(state, options) returning SVG markup string.
// state: current builder state (subset used). options.subSize ensures nominal fallback.
(function () {
  function build(state, options) {
    const viewW = 480, viewH = 360, margin = 12;
    const nominalSel = parseInt(options?.subSize || (state.holes[0]?.nominal) || 12, 10);
    const zoomFactorMap = { close: 0.60, normal: 0.35, wide: 0.25, default: 0.45 };
    const ghostOffset = state.showGhost ? Math.min(20 + state.depth * 2, 140) : 0;
    const maxW = viewW - margin * 2; const maxH = viewH - margin * 2;
    let baseScale = Math.min(maxW / (state.width), maxH / (state.height));
    const zf = zoomFactorMap[state.zoomMode] || zoomFactorMap.default;
    const scale = baseScale * zf;
    const dispW = state.width * scale; const dispH = state.height * scale;
    const x = (viewW - dispW) / 2; const y = (viewH - dispH) / 2;
    state.holes.forEach(h => { if (!h.cut && !h.spec) { h.nominal = nominalSel; } });
    const frontRect = `<rect x='${x.toFixed(2)}' y='${y.toFixed(2)}' width='${dispW.toFixed(2)}' height='${dispH.toFixed(2)}' class='front' />`;
    const linear = state.depth * scale * 0.20;
    const logPart = Math.log10(Math.max(1, state.depth)) * 5 * scale;
    let sideThickness = linear + logPart; sideThickness = Math.max(4, Math.min(sideThickness, (viewW * 0.25)));
    const leftPanel = `<rect x='${(x - sideThickness).toFixed(2)}' y='${y.toFixed(2)}' width='${sideThickness.toFixed(2)}' height='${dispH.toFixed(2)}' class='panel-left' />`;
    let ghostBack = '', ghostRight = '', ghostEdges = '';
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
    const edgeMargin = 0.5; const circles = []; const labels = [];
    state.holes.forEach(h => {
      const nominal = h.nominal || nominalSel;
      let dia = h.spec ? h.spec : (h.cut ? h.cut : nominal * 0.93);
      dia = Math.min(dia, state.width, state.height);
      const r = dia / 2; let hx = state.width / 2 + (h.dx || 0); let hy = state.height / 2 + (h.dy || 0);
      if (hx - r - edgeMargin < 0) hx = r + edgeMargin; if (hx + r + edgeMargin > state.width) hx = state.width - r - edgeMargin;
      if (hy - r - edgeMargin < 0) hy = r + edgeMargin; if (hy + r + edgeMargin > state.height) hy = state.height - r - edgeMargin;
      const dispX = x + (hx - state.width / 2) * scale + dispW / 2;
      const dispY = y + (hy - state.height / 2) * scale + dispH / 2; const dispR = r * scale;
      circles.push(`<circle cx='${dispX.toFixed(2)}' cy='${dispY.toFixed(2)}' r='${dispR.toFixed(2)}' class='cutout${h.selected ? " selected" : ""}' />`);
      const badgeType = h.spec ? 'SPEC' : (h.cut ? 'CUT' : 'EST');
      labels.push(`<text x='${dispX.toFixed(2)}' y='${(dispY - dispR - 10).toFixed(2)}' text-anchor='middle' class='badge ${badgeType.toLowerCase()}'>${badgeType}</text>`);
    });
    const cutoutsGroup = `<g class='cutouts'>${circles.join('')}${labels.join('')}</g>`;
    const dimLineColor = '#555', dimTextColor = '#222', labelFont = 'font:13px system-ui;';
    let dimsGroup = '';
    if (state.showDims) {
      const arrDef = `<defs><marker id='arrow' viewBox='0 0 10 10' refX='5' refY='5' markerWidth='6' markerHeight='6' orient='auto'><path d='M 0 0 L 10 5 L 0 10 z' fill='${dimLineColor}'/></marker></defs>`;
      const wy = y - 20; const widthLine = `<line x1='${x.toFixed(2)}' y1='${wy.toFixed(2)}' x2='${(x + dispW).toFixed(2)}' y2='${wy.toFixed(2)}' stroke='${dimLineColor}' stroke-width='1' marker-start='url(#arrow)' marker-end='url(#arrow)' />`;
      const widthLabel = `<text x='${(x + dispW / 2).toFixed(2)}' y='${(wy - 6).toFixed(2)}' text-anchor='middle' fill='${dimTextColor}' style='${labelFont}'>W ${state.width.toFixed(2)} in</text>`;
      const hxPosRight = x + dispW + 30; const heightLine = `<line x1='${hxPosRight.toFixed(2)}' y1='${y.toFixed(2)}' x2='${hxPosRight.toFixed(2)}' y2='${(y + dispH).toFixed(2)}' stroke='${dimLineColor}' stroke-width='1' marker-start='url(#arrow)' marker-end='url(#arrow)' />`;
      const heightLabel = `<text x='${(hxPosRight + 4).toFixed(2)}' y='${(y + dispH / 2).toFixed(2)}' text-anchor='start' dominant-baseline='middle' fill='${dimTextColor}' style='${labelFont}'>H ${state.height.toFixed(2)} in</text>`;
      dimsGroup = `<g class='dims'>${arrDef}${widthLine}${widthLabel}${heightLine}${heightLabel}</g>`;
    }
    // --- Multi-port export integration (mirrors logic from box_builder buildLocalPortSvg) ---
    function toPx(xIn, yIn) { return { x: x + (xIn - state.width / 2) * scale + dispW / 2, y: y + (yIn - state.height / 2) * scale + dispH / 2 }; }
    let portsGroup = '';
    if (state.showPortOverlay && state.port && state.port.enabled) {
      if (Array.isArray(state.ports) && state.ports.length > 0 && !(state.ports.length === 1 && state.port.count === 1)) {
        let g = "<g class='ports multi'>";
        state.ports.forEach((p, idx) => {
          if (!(p && p.width > 0 && p.height > 0)) return;
          try {
            if (p.type === 'slot') {
              // Simplified slot render
              const wPx = p.width * scale; const hPx = p.height * scale;
              const t = state.wallThickness;
              let xCenter;
              if (state.port.slotSide === 'right') { xCenter = state.width / 2 - t - p.width / 2; }
              else if (state.port.slotSide === 'left') { xCenter = -state.width / 2 + t + p.width / 2; }
              else { xCenter = 0; }
              xCenter += (p.offsetX || 0);
              let yCenter = 0;
              if (state.port.slotInsetIn > 0) { const topInner = -state.height / 2 + t; yCenter = topInner + state.port.slotInsetIn + p.height / 2; }
              yCenter += (p.offsetY || 0);
              if (p.position === 'side') { xCenter = -state.width / 2 - (p.width / 2) - 0.5; }
              const disp = toPx(xCenter, yCenter);
              const stroke = p.color || '#58a6ff';
              g += `<g class='port-item slot' data-port-id='${p.id || 'p' + idx}'><rect class='port-active' x='${(disp.x - wPx / 2).toFixed(2)}' y='${(disp.y - hPx / 2).toFixed(2)}' width='${wPx.toFixed(2)}' height='${hPx.toFixed(2)}' fill='rgba(88,166,255,0.20)' stroke='${stroke}' stroke-width='1.3' vector-effect='non-scaling-stroke' />`;
              if (p.length > 0) {
                const lenStart = toPx(xCenter, yCenter - p.height / 2 - 0.6);
                const lenEnd = toPx(xCenter + p.length, yCenter - p.height / 2 - 0.6);
                g += `<line x1='${lenStart.x.toFixed(2)}' y1='${lenStart.y.toFixed(2)}' x2='${lenEnd.x.toFixed(2)}' y2='${lenEnd.y.toFixed(2)}' stroke='${stroke}' stroke-dasharray='5 3' stroke-width='1.1' vector-effect='non-scaling-stroke' />`;
              }
              g += '</g>';
            } else if (p.type === 'round' || p.type === 'aero') {
              const d = p.width; const r = d / 2; const t = state.wallThickness;
              let xCenter = 0; let yCenter = 0;
              if (state.port.roundInsetIn > 0) { const topInner = -state.height / 2 + t; yCenter = topInner + state.port.roundInsetIn + r; }
              xCenter += (p.offsetX || 0); yCenter += (p.offsetY || 0);
              if (p.position === 'side') { xCenter = -state.width / 2 - r - 0.5; }
              const disp = toPx(xCenter, yCenter); const rPx = r * scale;
              const stroke = p.color || (p.type === 'aero' ? '#ffb543' : '#58a6ff');
              const fill = p.type === 'aero' ? 'rgba(255,181,67,0.18)' : 'rgba(88,166,255,0.15)';
              g += `<g class='port-item ${p.type}' data-port-id='${p.id || 'p' + idx}'><circle class='port-active' cx='${disp.x.toFixed(2)}' cy='${disp.y.toFixed(2)}' r='${rPx.toFixed(2)}' fill='${fill}' stroke='${stroke}' stroke-width='1.2' vector-effect='non-scaling-stroke' />`;
              if (p.length > 0) {
                const lenStart = toPx(xCenter, yCenter - r - 0.6); const lenEnd = toPx(xCenter + p.length, yCenter - r - 0.6);
                g += `<line x1='${lenStart.x.toFixed(2)}' y1='${lenStart.y.toFixed(2)}' x2='${lenEnd.x.toFixed(2)}' y2='${lenEnd.y.toFixed(2)}' stroke='${stroke}' stroke-dasharray='5 3' stroke-width='1.1' vector-effect='non-scaling-stroke' />`;
              }
              g += '</g>';
            }
          } catch (e) { /* ignore individual port errors */ }
        });
        g += '</g>';
        portsGroup = g;
      } else if (state.port.width && state.port.height) {
        // Consolidated single-port fallback
        if (state.port.type === 'slot') {
          const wPx = state.port.width * scale; const hPx = state.port.height * scale; const t = state.wallThickness; let xCenter;
          if (state.port.slotSide === 'right') { xCenter = state.width / 2 - t - state.port.width / 2; }
          else if (state.port.slotSide === 'left') { xCenter = -state.width / 2 + t + state.port.width / 2; }
          else { xCenter = 0; }
          let yCenter = 0; if (state.port.slotInsetIn > 0) { const topInner = -state.height / 2 + t; yCenter = topInner + state.port.slotInsetIn + state.port.height / 2; }
          const disp = toPx(xCenter, yCenter);
          portsGroup = `<g class='ports consolidated'><rect class='port-active' x='${(disp.x - wPx / 2).toFixed(2)}' y='${(disp.y - hPx / 2).toFixed(2)}' width='${wPx.toFixed(2)}' height='${hPx.toFixed(2)}' fill='rgba(88,166,255,0.20)' stroke='#58a6ff' stroke-width='1.3' vector-effect='non-scaling-stroke' /></g>`;
        } else if (state.port.type === 'round' || state.port.type === 'aero') {
          const d = state.port.width; const r = d / 2; const stroke = state.port.type === 'aero' ? '#ffb543' : '#58a6ff'; const fill = state.port.type === 'aero' ? 'rgba(255,181,67,0.18)' : 'rgba(88,166,255,0.15)';
          let yCenter = 0; const t = state.wallThickness; if (state.port.roundInsetIn > 0) { const topInner = -state.height / 2 + t; yCenter = topInner + state.port.roundInsetIn + r; }
          const disp = toPx(0, yCenter); const rPx = r * scale;
          portsGroup = `<g class='ports consolidated'><circle class='port-active' cx='${disp.x.toFixed(2)}' cy='${disp.y.toFixed(2)}' r='${rPx.toFixed(2)}' fill='${fill}' stroke='${stroke}' stroke-width='1.2' vector-effect='non-scaling-stroke' /></g>`;
        }
      }
    }
    return `<svg viewBox='0 0 ${viewW} ${viewH}' preserveAspectRatio='xMidYMid meet'>
      <defs>
        <pattern id='ghostHatch' width='6' height='6' patternUnits='userSpaceOnUse'>
          <path d='M0 6 L6 0 M-1 1 L1 -1 M5 7 L7 5' stroke='#3a4855' stroke-width='0.6' opacity='0.55'/>
        </pattern>
        <style>
          .front { fill:#1e2630; stroke:#55687a; stroke-width:1.5; vector-effect:non-scaling-stroke; }
          .panel-left { fill:#232e3a; stroke:#4e5d6b; stroke-width:1.2; vector-effect:non-scaling-stroke; }
          .ghost-back,.ghost-right { fill:url(#ghostHatch); stroke:#3a4855; stroke-width:1.2; stroke-dasharray:4 3; opacity:.25; vector-effect:non-scaling-stroke; }
          .ghost-edge { stroke:#3a4855; stroke-width:1; stroke-dasharray:4 3; opacity:.35; vector-effect:non-scaling-stroke; }
          .cutout { fill:#111; stroke:#ff9d4f; stroke-width:1.2; vector-effect:non-scaling-stroke; }
          .cutout.selected { stroke:#ffd28c; stroke-width:1.6; }
          .badge { font:10px system-ui; fill:#fff; stroke:#222; stroke-width:.4; paint-order:stroke; }
          .badge.est { fill:#eee; stroke:#555; }
          .badge.cut { fill:#ffd28c; stroke:#a06400; }
          .badge.spec { fill:#a7e3ff; stroke:#035b7a; }
          .dims line { vector-effect:non-scaling-stroke; stroke-dasharray:3 2; }
        </style>
      </defs>
      <rect x='0' y='0' width='${viewW}' height='${viewH}' fill='#f3e2c9' />
      ${ghostBack}${ghostRight}${ghostEdges}${leftPanel}${frontRect}${cutoutsGroup}${portsGroup}${dimsGroup}
    </svg>`;
  }
  window.BoxSVGExporter = { build };
})();