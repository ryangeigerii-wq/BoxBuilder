// Box Builder (Pure Vanilla JS)
(function(){
  console.log('[box_builder] Pure vanilla mode - initializing');
  
  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('lm-root');
    const spinner = document.getElementById('builder-spinner');
    
  // Hide initial spinner overlay
    if(spinner) {
      spinner.classList.add('is-hide');
      // Short fade then remove (aligned with 95ms CSS transition)
      setTimeout(() => { if(spinner) { try { spinner.remove(); } catch(_){} } }, 130);
    }
    
    if(!root){ 
      console.error('[box_builder] Root #lm-root not found'); 
      return; 
    }
    
    const form = root.querySelector('form.box-lm-form');
    if(!form){ 
      console.error('[box_builder] Form not found'); 
      return; 
    }
    
  // Enable all form controls (were disabled for no-JS fallback)
  form.querySelectorAll('input[disabled]').forEach(inp => inp.removeAttribute('disabled'));
  form.querySelectorAll('select[disabled]').forEach(sel => sel.removeAttribute('disabled'));
    const btn = form.querySelector('button[disabled]');
    if(btn) btn.removeAttribute('disabled');
    
    // Helper function
    function num(v){ 
      const n = parseFloat(v); 
      return isNaN(n) ? 0 : n; 
    }
    
    // Get current values and calculate volumes
    function getState(){
      const inputs = form.querySelectorAll('input[type="number"]');
      const ghostToggle = form.querySelector('input[type="checkbox"][name="showGhost"]');
      const sizeSel = form.querySelector('select[name="subSize"]');
      const finishSel = form.querySelector('select[name="finish"]');
      const subSize = sizeSel ? parseInt(sizeSel.value, 10) : 12;
      const finish = finishSel ? finishSel.value : 'flat';
      return {
        width: num(inputs[0]?.value || 12),
        height: num(inputs[1]?.value || 10),
        depth: num(inputs[2]?.value || 8),
        driverDisp: num(inputs[3]?.value || 0),
        bracingDisp: num(inputs[4]?.value || 0),
        showGhost: ghostToggle ? ghostToggle.checked : false,
        subSize,
        finish
      };
    }
    
    function calculateVolumes(state){
      const gross = state.width * state.height * state.depth;
      const net = Math.max(0, gross - (state.driverDisp + state.bracingDisp));
      return { 
        gross, 
        net, 
        netFt: net / 1728 
      };
    }
    
    // Generate SVG with proper scaling and centering
  function generateSVG(width, height, depth, showGhost, finish){
      // Scale factor: adjust to ensure reasonable box sizes fit well
      const baseScale = 6;
      const isoDepthFactor = 0.55;
      let wRaw = width * baseScale;
      let hRaw = height * baseScale;
      let dRaw = depth * baseScale * isoDepthFactor;

      const viewW = 480;
      const viewH = 360;
      const margin = 40;

      const bboxWidthRaw = wRaw + dRaw;
      const bboxHeightRaw = hRaw + dRaw;
      const fitScale = Math.min(
        (viewW - margin*2) / bboxWidthRaw,
        (viewH - margin*2) / bboxHeightRaw,
        1.0
      );

      const w = wRaw * fitScale;
      const h = hRaw * fitScale;
      const d = dRaw * fitScale;

      const frontX0 = 0 + d;
      const frontY0 = 0;

      const pointsFront = [
        [frontX0,frontY0], [frontX0+w,frontY0], [frontX0+w,frontY0+h], [frontX0,frontY0+h]
      ];
      const pointsTop = [
        [frontX0,frontY0],[frontX0-d,frontY0-d],[frontX0-d+w,frontY0-d],[frontX0+w,frontY0]
      ];
      const pointsSide = [
        [frontX0+w,frontY0],[frontX0-d+w,frontY0-d],[frontX0-d+w,frontY0-d+h],[frontX0+w,frontY0+h]
      ];

      const allPts = [...pointsFront, ...pointsTop, ...pointsSide];
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      allPts.forEach(([x,y]) => { 
        if(x<minX)minX=x; if(y<minY)minY=y; 
        if(x>maxX)maxX=x; if(y>maxY)maxY=y; 
      });
      
      const shapeW = maxX - minX;
      const shapeH = maxY - minY;
      const offsetX = (viewW - shapeW)/2 - minX;
      const offsetY = (viewH - shapeH)/2 - minY;

      function poly(pts, cls){ 
        return `<polygon class="${cls}" points="${pts.map(p=>p.join(',')).join(' ')}" />`; 
      }
      
      const f = pointsFront.map(([x,y])=>[(x+offsetX).toFixed(2),(y+offsetY).toFixed(2)]);
      const t = pointsTop.map(([x,y])=>[(x+offsetX).toFixed(2),(y+offsetY).toFixed(2)]);
      const s = pointsSide.map(([x,y])=>[(x+offsetX).toFixed(2),(y+offsetY).toFixed(2)]);
      
      // Ghost panels (back faces) - only visible when toggle is on
      let ghostPanels = '';
      if(showGhost) {
        const pointsBack = [
          [frontX0-d,frontY0-d], [frontX0-d+w,frontY0-d], [frontX0-d+w,frontY0-d+h], [frontX0-d,frontY0-d+h]
        ];
        const pointsBottom = [
          [frontX0,frontY0+h],[frontX0-d,frontY0-d+h],[frontX0-d+w,frontY0-d+h],[frontX0+w,frontY0+h]
        ];
        const pointsLeft = [
          [frontX0,frontY0],[frontX0-d,frontY0-d],[frontX0-d,frontY0-d+h],[frontX0,frontY0+h]
        ];
        
        const b = pointsBack.map(([x,y])=>[(x+offsetX).toFixed(2),(y+offsetY).toFixed(2)]);
        const bot = pointsBottom.map(([x,y])=>[(x+offsetX).toFixed(2),(y+offsetY).toFixed(2)]);
        const l = pointsLeft.map(([x,y])=>[(x+offsetX).toFixed(2),(y+offsetY).toFixed(2)]);
        
        ghostPanels = `
          <g class="ghost-panels" opacity="0.35">
            ${poly(b,'ghost back')}
            ${poly(bot,'ghost bottom')}
            ${poly(l,'ghost left')}
            <g class="ghost-edges" fill="none" stroke="#3a4855" stroke-width="0.8" stroke-dasharray="3,2">
              <polyline points="${b.concat([b[0]]).map(p=>p.join(',')).join(' ')}" />
              <polyline points="${bot.concat([bot[0]]).map(p=>p.join(',')).join(' ')}" />
              <polyline points="${l.concat([l[0]]).map(p=>p.join(',')).join(' ')}" />
            </g>
          </g>
        `;
      }
      
      // Build pattern defs if finish is wood
      let patternDefs = '';
      if(finish && finish.startsWith('wood')) {
        // Placeholder images - user must supply actual licensed JPG/PNG under /static/img/textures/
        const imgFile = `/static/img/textures/${finish}.jpg`;
        patternDefs = `
          <pattern id="${finish}-pattern" patternUnits="objectBoundingBox" width="1" height="1">
            <image href="${imgFile}" x="0" y="0" width="256" height="256" preserveAspectRatio="xMidYMid slice" />
          </pattern>`;
      }
      const fillFront = finish && finish.startsWith('wood') ? `url(#${finish}-pattern)` : 'url(#faceGrad)';
      const fillTop = finish && finish.startsWith('wood') ? `url(#${finish}-pattern)` : '#25303a';
      const fillSide = finish && finish.startsWith('wood') ? `url(#${finish}-pattern)` : '#202a33';

      return `<svg viewBox="0 0 ${viewW} ${viewH}" role="img" aria-label="Box wireframe" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="faceGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#1e2630"/>
            <stop offset="100%" stop-color="#2d3946"/>
          </linearGradient>
          <linearGradient id="ghostGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#0d1419"/>
            <stop offset="100%" stop-color="#1a232b"/>
          </linearGradient>
          ${patternDefs}
        </defs>
        ${ghostPanels}
        <g class="box-fig">
          ${poly(t,'face top')}
          ${poly(s,'face side')}
          ${poly(f,'face front')}
          <g class="outline" fill="none" stroke="#4b637a" stroke-width="1.3">
            <polyline points="${t.concat([t[0]]).map(p=>p.join(',')).join(' ')}" />
            <polyline points="${s.concat([s[0]]).map(p=>p.join(',')).join(' ')}" />
            <polyline points="${f.concat([f[0]]).map(p=>p.join(',')).join(' ')}" />
          </g>
        </g>
        <style>
          .face.front { fill:${fillFront}; }
          .face.top { fill:${fillTop}; }
          .face.side { fill:${fillSide}; }
          .face { stroke:#55687a; stroke-width:1; }
          .ghost.back { fill:url(#ghostGrad); stroke:#3a4855; stroke-width:0.8; stroke-dasharray:3,2; }
          .ghost.bottom { fill:#0f171d; stroke:#3a4855; stroke-width:0.8; stroke-dasharray:3,2; }
          .ghost.left { fill:#12191f; stroke:#3a4855; stroke-width:0.8; stroke-dasharray:3,2; }
        </style>
      </svg>`;
    }
    
    // Update UI
    function update(){
      const state = getState();
      const volumes = calculateVolumes(state);
      // Suggested typical driver displacement (rough guideline values in cubic inches)
      const suggestedDispMap = { 8: 10, 10: 20, 12: 35, 15: 60 };
      const suggestedDriverDisp = suggestedDispMap[state.subSize] || null;
      // Standard Cutout Preset heuristic
      const cutoutDiameter = +(state.subSize * 0.93).toFixed(3);

      // If user hasn't set driver displacement (still zero) and we have a suggestion, auto-fill once
      const driverDispInput = form.querySelectorAll('input[type="number"]')[3];
      if(driverDispInput && parseFloat(driverDispInput.value || '0') === 0 && suggestedDriverDisp){
        driverDispInput.value = suggestedDriverDisp;
        // Recalculate with new displacement applied
        state.driverDisp = suggestedDriverDisp;
      }
      
      // Update metrics
      const metrics = form.querySelector('.metrics');
      if(metrics){
        metrics.innerHTML = `
          <div><strong>Gross:</strong> ${volumes.gross.toFixed(2)} in³</div>
          <div><strong>Net:</strong> ${volumes.net.toFixed(2)} in³</div>
          <div><strong>Net:</strong> ${volumes.netFt.toFixed(3)} ft³</div>
          <div><strong>Driver Size:</strong> ${state.subSize}"</div>
          ${suggestedDriverDisp ? `<div><strong>Suggested Driver Disp:</strong> ${suggestedDriverDisp} in³</div>` : ''}
          <div><strong>Cutout Diameter:</strong> ${cutoutDiameter} in <span style="color:#888;">(estimated)</span></div>
          <div><strong>Finish:</strong> ${state.finish}</div>
        `;
      }

      // Update dedicated cutout info block if present
      const cutoutBlock = form.querySelector('.cutout-info');
      if(cutoutBlock){
        const dSpan = cutoutBlock.querySelector('.cutout-diameter');
        const eSpan = cutoutBlock.querySelector('.cutout-estimate');
        if(dSpan) dSpan.textContent = `${cutoutDiameter} in`;
        if(eSpan) eSpan.style.opacity = '1';
      }
      
      // Update preview
      const previewPanel = root.querySelector('.panel + .panel .preview-wrapper');
      if(previewPanel){
        previewPanel.innerHTML = generateSVG(state.width, state.height, state.depth, state.showGhost, state.finish);
      }
      
      console.log('[box_builder] Updated:', state, volumes);
    }
    
    // Attach event listeners
    form.addEventListener('input', update);
    form.addEventListener('change', update); // For checkbox toggle
    
    // Download handler
    if(btn){
      btn.addEventListener('click', () => {
        const state = getState();
  const markup = generateSVG(state.width, state.height, state.depth, state.showGhost, state.finish);
        const blob = new Blob([markup], { type:'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
  a.download = `box_wireframe_${state.subSize}in_${state.finish}.svg`;
        document.body.appendChild(a);
        a.click();
        requestAnimationFrame(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        });
        console.log('[box_builder] SVG downloaded');
      });
    }
    
    // Initial render
    update();
    console.log('[box_builder] Ready - vanilla mode active');
  });
})();
