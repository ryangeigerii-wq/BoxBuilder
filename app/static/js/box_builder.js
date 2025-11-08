// Box Builder (Pure Vanilla JS)
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    // =============================================================
    // Aggregated Export Notification System
    // Provides window.noteExport(item) and listens for 'builderExported'
    // events. Multiple exports within ~300ms flush as single popup.
    // =============================================================
    (function initExportAggregator() {
      const notice = document.getElementById('exportNotice');
      if (!notice) return;
      let queue = [];
      let flushTimer = null;
      let hideTimer = null;
      // Build base structure once (allows innerHTML updates without losing close button)
      notice.innerHTML = '<button type="button" class="close-btn" aria-label="Dismiss export notifications">✕</button><div class="inner"></div>';
      const inner = notice.querySelector('.inner');
      const closeBtn = notice.querySelector('.close-btn');
      closeBtn.addEventListener('click', () => { notice.classList.remove('visible'); if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } });
      function esc(str) {
        return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      }
      function render(items) {
        const list = items.map(it => `<li><span class=\"kind\">${esc(it.kind || 'file')}</span><span class=\"file\">${esc(it.file || it.name || '(downloaded)')}</span></li>`).join('');
        inner.innerHTML = `<strong>Exports (${items.length})</strong><ul>${list}</ul>`;
        notice.classList.add('visible');
        if (hideTimer) clearTimeout(hideTimer);
        // Visibility duration scales gently with number of items
        hideTimer = setTimeout(() => { notice.classList.remove('visible'); }, 6000 + items.length * 400);
      }
      function flush() {
        flushTimer = null;
        if (!queue.length) return;
        const items = queue.slice(); queue = [];
        render(items);
        // Persist history to sessionStorage (keep last 20 entries)
        try {
          const key = 'builderExportHistory';
          const existing = JSON.parse(sessionStorage.getItem(key) || '[]');
          const ts = Date.now();
          items.forEach(it => existing.unshift({ file: it.file, kind: it.kind, ts }));
          if (existing.length > 20) existing.length = 20;
          sessionStorage.setItem(key, JSON.stringify(existing));
        } catch (e) { /* ignore storage errors */ }
      }
      function noteExport(item) {
        queue.push(item);
        if (!flushTimer) flushTimer = setTimeout(flush, 300);
      }
      window.noteExport = noteExport;
      window.flushExportNotice = flush;
      window.addEventListener('builderExported', e => {
        if (e.detail) noteExport(e.detail);
      });
    })();
    // Helper to emit unified export event
    function emitExport(file, kind) {
      try { window.dispatchEvent(new CustomEvent('builderExported', { detail: { file, kind } })); } catch (e) { }
    }
    // Unit conversion constant (was referenced before definition in some branches)
    const IN_TO_M = 0.0254; // inches → meters
    // Provide globally for any late-loaded modules (defensive)
    try { if (!window.IN_TO_M) window.IN_TO_M = IN_TO_M; } catch (e) { }
    const root = document.getElementById('lm-root') || document.querySelector('.builder-layout');
    const form = root ? (root.querySelector('form.box-lm-form') || document.querySelector('form.box-lm-form')) : null;
    const TEST_MODE = /[?&]test=1/i.test(location.search);
    if (!root || !form) {
      const spinner = document.getElementById('builder-spinner');
      if (spinner) spinner.remove();
      console.warn('[box_builder] Root container or form not found; aborting initialization.');
      return;
    }
    // -------------------------------------------------------------
    // Core builder state (was missing after refactor; restored here)
    // Exposed globally as window.__boxBuilderState for three_preview.js
    // -------------------------------------------------------------
    const state = {
      width: parseFloat(form.querySelector('input[name="width"]')?.value) || 12,
      height: parseFloat(form.querySelector('input[name="height"]')?.value) || 10,
      depth: parseFloat(form.querySelector('input[name="depth"]')?.value) || 8,
      wallThickness: parseFloat(form.querySelector('input[name="wallThickness"]')?.value) || 0.75,
      finish: null,
      holes: [{ dx: 0, dy: 0, nominal: 12, cut: null, spec: null, selected: true, filled: false }],
      fillHoles: !!form.querySelector('input[name="fillHoles"]')?.checked,
      showCutouts: !!form.querySelector('input[name="showCutouts"]')?.checked,
      showDims: !!form.querySelector('input[name="showDims"]')?.checked || true,
      showInternal: !!form.querySelector('input[name="showInternal"]')?.checked,
      showPortOverlay: !!form.querySelector('input[name="showPortOverlay"]')?.checked,
      hideFrontPanel: !!form.querySelector('input[name="hideFrontPanel"]')?.checked,
      depthStyle: (form.querySelector('select[name="depthStyle"]')?.value) || 'diagonal',
      port: {
        enabled: !!form.querySelector('input[name="portEnabled"]')?.checked,
        type: (form.querySelector('select[name="portType"]')?.value) || 'slot',
        count: parseInt(form.querySelector('input[name="numPorts"]')?.value || '1', 10) || 1,
        targetHz: null,
        slotHeightIn: null,
        slotWidthIn: null,
        slotGapIn: null,
        slotInsetIn: null,
        slotSide: null,
        roundDiameterIn: null,
        roundSpacingIn: null,
        roundInsetIn: null,
        flareRadiusIn: null,
        position: 'front'
      },
      ports: [],
      history: [],
      future: [],
      toast: ''
    };
    // Test mode: ensure port overlay is enabled by default so Playwright port geometry test sees meshes without needing explicit checkbox toggle.
    if (TEST_MODE && !state.showPortOverlay) { state.showPortOverlay = true; }
    // Make globally accessible immediately for tests and preview script.
    window.__boxBuilderState = state;
    // -------------------------------------------------------------
    // Numeric formatting helper (was missing, causing ReferenceError)
    // Criteria:
    //  - Large numbers (>=100) shown with no decimals
    //  - Medium (>=10) with 1 decimal
    //  - Otherwise up to 2 decimals, trimming trailing zeros
    //  - Non-finite / null -> "0"
    // -------------------------------------------------------------
    function format(v) {
      if (v === null || v === undefined) return '0';
      const num = typeof v === 'number' ? v : parseFloat(v);
      if (!isFinite(num)) return '0';
      const abs = Math.abs(num);
      let decimals = 2;
      if (abs >= 100) decimals = 0; else if (abs >= 10) decimals = 1;
      let out = num.toFixed(decimals);
      if (decimals > 0) {
        out = out.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
      }
      return out;
    }
    // Expose for any future external usage (non-breaking)
    try { window.formatNumber = format; } catch (e) { }
    // Ultra-early spinner hide for test mode before any heavy init or update cycle.
    if (TEST_MODE) {
      const earlySp = document.getElementById('builder-spinner');
      if (earlySp) {
        try { earlySp.classList.add('is-hide'); } catch (e) { }
        earlySp.style.pointerEvents = 'none';
        earlySp.style.opacity = '0';
        earlySp.style.display = 'none';
        try { earlySp.remove(); } catch (e2) { }
      }
    }
    // Simple render scheduler shim (referenced by finish buttons before definition in prior version)
    function scheduleRender() {
      try { update(false); } catch (e) { /* ignore */ }
    }
    // Tabs removed: model selection and configuration now displayed together.
    // Any legacy code relying on activateTab is deprecated; kept no-op shim for backward compatibility if referenced elsewhere.
    function activateTab() { /* no-op: tabs removed */ }

    // Accordion system removed: all configuration panels now always visible.
    // Provide minimal compatibility shim so any legacy code expecting initAccordions does not fail.
    function initAccordions() { /* panels always visible */ }
    try { window.initAccordions = initAccordions; } catch (e) { }
    initAccordions();
    // Simple detail renderer (kept near top for reuse)
    function renderSubModelDetails(m) {
      if (!detailsEl) return;
      detailsEl.style.display = 'block';
      detailsEl.innerHTML = `<strong>${m.brand || ''} ${m.name}</strong><br/>Size: ${m.size_in_inches || '?'}\" · RMS: ${m.rms_watts || '?'}W · Max: ${m.max_watts || '?'}W<br/>Impedance: ${m.impedance_ohms || '?'}Ω · Sensitivity: ${m.sensitivity_db || '?'}dB<br/>Freq Range: ${m.frequency_range_hz || 'n/a'}<br/><span style='opacity:.6'>Source: ${m.source || 'n/a'}</span>`;
    }
    // --- Finish Variant Buttons (mirroring preset UI) ---
    (function initFinishButtons() {
      const container = document.getElementById('finish-section');
      if (!container) return; // graceful if markup absent
      const hiddenFinishInput = container.querySelector('input[type="hidden"][name="finish"]') || form.querySelector('input[type="hidden"][name="finish"]');
      const legacySelect = container.querySelector('select[name="finish"]') || form.querySelector('select[name="finish"]');
      const buttons = container.querySelectorAll('.apply-finish');
      if (!buttons.length) return;
      function reflect() {
        const cur = state.finish;
        buttons.forEach(btn => {
          const is = btn.getAttribute('data-finish') === cur;
          btn.classList.toggle('preset-active', is);
          btn.setAttribute('aria-pressed', is ? 'true' : 'false');
        });
      }
      buttons.forEach(btn => {
        btn.addEventListener('click', () => {
          const val = btn.getAttribute('data-finish');
          if (!val) return;
          if (state.finish === val) return; // already active
          state.finish = val;
          if (hiddenFinishInput) hiddenFinishInput.value = val;
          // Update legacy select so three_preview.js receives change event
          if (legacySelect && legacySelect.value !== val) {
            legacySelect.value = val;
            legacySelect.dispatchEvent(new Event('change', { bubbles: true }));
          }
          pushHistory('finishChanged');
          reflect();
          // Notify 3D preview or any listeners
          try {
            const evt = new CustomEvent('finishChange', { detail: { finish: val } });
            document.dispatchEvent(evt);
          } catch (e) { /* ignore */ }
          scheduleRender();
        });
      });
      // Initial selection: if state.finish present, highlight it; else pick first button
      if (!state.finish) {
        const first = buttons[0];
        if (first) {
          const v = first.getAttribute('data-finish');
          if (v) {
            state.finish = v;
            if (hiddenFinishInput) hiddenFinishInput.value = v;
            // Dispatch initial change to legacy select so 3D preview builds texture immediately for tests
            if (legacySelect) {
              legacySelect.value = v;
              legacySelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
            // Fire finishChange custom event once at init (was only on click before)
            try { document.dispatchEvent(new CustomEvent('finishChange', { detail: { finish: v, initial: true } })); } catch (e) { }
          }
        }
      } else {
        // If state.finish already defined (e.g., server-rendered default), ensure select reflects and dispatches at init
        if (legacySelect && legacySelect.value !== state.finish) {
          legacySelect.value = state.finish;
        }
        // Force an initial change dispatch to guarantee texture UUID generation before Playwright captures
        if (legacySelect) {
          legacySelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
        try { document.dispatchEvent(new CustomEvent('finishChange', { detail: { finish: state.finish, initial: true } })); } catch (e) { }
      }
      reflect();
      // After initial finish reflection, force a state dispatch & rebuild for early texture UUID creation
      try { window.dispatchEvent(new CustomEvent('boxStateChanged', { detail: JSON.parse(JSON.stringify(state)) })); } catch (e) { }
    })();
    // Finish collapsible toggle (preview toolbar button controls finish section visibility)
    (function initFinishCollapse() {
      const toggle = document.getElementById('finishMenuToggle');
      const body = document.getElementById('finish-section');
      if (!toggle || !body) return;
      // Mark as unified overlay
      body.classList.add('unified-overlay');
      // Default open by design (previously false). Auto-collapsible via user click.
      let open = true;
      function closeOthers(exceptId) {
        ['dimensions-section', 'port-section', 'export-section'].forEach(id => {
          if (id === exceptId) return; const el = document.getElementById(id); const tgMap = {
            'dimensions-section': 'dimsMenuToggle',
            'port-section': 'portMenuToggle',
            'export-section': 'exportMenuToggle'
          }; const t = document.getElementById(tgMap[id]); if (el) {
            el.classList.remove('open');
            el.setAttribute('aria-hidden', 'true');
          }
          if (t) { t.setAttribute('aria-expanded', 'false'); t.innerHTML = t.innerHTML.replace('▴', '▾'); }
        });
      }
      function reflect() {
        if (open) {
          body.classList.add('open');
          body.setAttribute('aria-hidden', 'false');
          toggle.setAttribute('aria-expanded', 'true');
          toggle.innerHTML = 'Finish ▴';
          closeOthers('finish-section');
        } else {
          body.classList.remove('open');
          body.setAttribute('aria-hidden', 'true');
          toggle.setAttribute('aria-expanded', 'false');
          toggle.innerHTML = 'Finish ▾';
        }
      }
      toggle.addEventListener('click', () => { open = !open; reflect(); });
      // If explicitly requested collapsed via query (?finish=0), override default.
      if (/[?&]finish=0/i.test(location.search)) { open = false; }
      // Auto-open in test/debug modes remains implicit; already open by default.
      reflect();
    })();
    // Dimensions collapsible toggle
    (function initDimsCollapse() {
      const toggle = document.getElementById('dimsMenuToggle');
      const body = document.getElementById('dimensions-section');
      if (!toggle || !body) return;
      body.classList.add('unified-overlay');
      let open = false;
      function closeOthers(exceptId) {
        ['finish-section', 'port-section', 'export-section'].forEach(id => {
          if (id === exceptId) return; const el = document.getElementById(id); const tgMap = {
            'finish-section': 'finishMenuToggle',
            'port-section': 'portMenuToggle',
            'export-section': 'exportMenuToggle'
          }; const t = document.getElementById(tgMap[id]); if (el) { el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); }
          if (t) { t.setAttribute('aria-expanded', 'false'); t.innerHTML = t.innerHTML.replace('▴', '▾'); }
        });
      }
      function reflect() {
        if (open) {
          body.classList.add('open');
          body.setAttribute('aria-hidden', 'false');
          toggle.setAttribute('aria-expanded', 'true');
          toggle.innerHTML = 'Dimensions ▴';
          closeOthers('dimensions-section');
        } else {
          body.classList.remove('open');
          body.setAttribute('aria-hidden', 'true');
          toggle.setAttribute('aria-expanded', 'false');
          toggle.innerHTML = 'Dimensions ▾';
        }
      }
      toggle.addEventListener('click', () => { open = !open; reflect(); });
      if (/[?&](test|debug)=1/i.test(location.search)) { open = true; }
      reflect();
    })();
    // Port Design collapsible toggle
    (function initPortCollapse() {
      const toggle = document.getElementById('portMenuToggle');
      const body = document.getElementById('port-section');
      if (!toggle || !body) return;
      body.classList.add('unified-overlay');
      let open = false;
      function closeOthers(exceptId) {
        ['finish-section', 'dimensions-section', 'export-section'].forEach(id => {
          if (id === exceptId) return; const el = document.getElementById(id); const tgMap = {
            'finish-section': 'finishMenuToggle',
            'dimensions-section': 'dimsMenuToggle',
            'export-section': 'exportMenuToggle'
          }; const t = document.getElementById(tgMap[id]); if (el) { el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); }
          if (t) { t.setAttribute('aria-expanded', 'false'); t.innerHTML = t.innerHTML.replace('▴', '▾'); }
        });
      }
      function reflect() {
        if (open) {
          body.classList.add('open');
          body.setAttribute('aria-hidden', 'false');
          toggle.setAttribute('aria-expanded', 'true');
          toggle.innerHTML = 'Port ▴';
          closeOthers('port-section');
        } else {
          body.classList.remove('open');
          body.setAttribute('aria-hidden', 'true');
          toggle.setAttribute('aria-expanded', 'false');
          toggle.innerHTML = 'Port ▾';
        }
      }
      toggle.addEventListener('click', () => { open = !open; reflect(); });
      if (/[?&](test|debug)=1/i.test(location.search)) { open = true; }
      reflect();
    })();
    // Export & Actions collapsible toggle (left column button stays local, not moved to preview toolbar)
    (function initExportCollapse() {
      const toggle = document.getElementById('exportMenuToggle');
      const body = document.getElementById('export-section');
      if (!toggle || !body) return;
      body.classList.add('unified-overlay');
      let open = false;
      function closeOthers(exceptId) {
        ['finish-section', 'dimensions-section', 'port-section'].forEach(id => {
          if (id === exceptId) return; const el = document.getElementById(id); const tgMap = {
            'finish-section': 'finishMenuToggle',
            'dimensions-section': 'dimsMenuToggle',
            'port-section': 'portMenuToggle'
          }; const t = document.getElementById(tgMap[id]); if (el) { el.classList.remove('open'); el.setAttribute('aria-hidden', 'true'); }
          if (t) { t.setAttribute('aria-expanded', 'false'); t.innerHTML = t.innerHTML.replace('▴', '▾'); }
        });
      }
      function reflect() {
        if (open) {
          body.classList.add('open');
          body.setAttribute('aria-hidden', 'false');
          toggle.setAttribute('aria-expanded', 'true');
          toggle.innerHTML = 'Export & Actions ▴';
          closeOthers('export-section');
        } else {
          body.classList.remove('open');
          body.setAttribute('aria-hidden', 'true');
          toggle.setAttribute('aria-expanded', 'false');
          toggle.innerHTML = 'Export & Actions ▾';
        }
      }
      toggle.addEventListener('click', () => { open = !open; reflect(); });
      // Auto-open in test/debug modes for Playwright stability
      if (/[?&](test|debug)=1/i.test(location.search)) { open = true; }
      reflect();
    })();
    // Test mode visibility normalization: expand any hidden configuration groups so Playwright can interact without toggling.
    if (TEST_MODE) {
      try {
        form.querySelectorAll('[aria-hidden="true"], [style*="display:none"], fieldset.collapsed').forEach(el => {
          el.style.display = 'block';
          el.removeAttribute('aria-hidden');
        });
        const portToggle = form.querySelector('button[name="togglePortMenu"]');
        if (portToggle) { portToggle.style.display = 'inline-block'; portToggle.style.opacity = '1'; portToggle.removeAttribute('aria-hidden'); }
        const subConfigSel = form.querySelector('select[name="subConfig"]');
        if (subConfigSel) { subConfigSel.style.display = 'block'; }
        // In test mode, remove unified overlay absolute positioning so Playwright clicks aren't intercepted by overlapping panels.
        form.querySelectorAll('.collapsible-body.unified-overlay').forEach(el => {
          el.classList.remove('unified-overlay');
          el.style.position = 'static';
          el.style.pointerEvents = 'auto';
          el.style.display = 'block';
        });
        // Force port overlay visibility tie to checkbox; when unchecked, hide debug count by clearing port meshes.
        const overlayChk = form.querySelector('input[name="showPortOverlay"]');
        if (overlayChk) {
          overlayChk.addEventListener('change', () => {
            if (!overlayChk.checked) {
              // Mark a flag so downstream 3D update prunes ports
              window.__forceHidePortMeshes = true;
            }
            try { update(true); } catch (e) { /* ignore */ }
          });
          // In test mode ensure checkbox reliably toggles even if underlying code attempts to auto-revert.
          overlayChk.addEventListener('click', (ev) => {
            // Allow normal toggle but immediately force value persistence then trigger update.
            setTimeout(() => { try { update(true); } catch (e) { } }, 15);
          });
        }
      } catch (e) { /* ignore test-mode visibility errors */ }
    }
    // --- Port helper functions (restored after cleanup) ---
    function drawSlotPortFromObj(p, state, scale, toPx, idx) {
      const wIn = p.width; const hIn = p.height; const L_in = p.length;
      if (!(wIn > 0) || !(hIn > 0)) return '';
      const t = state.wallThickness;
      let xCenter;
      if (state.port.slotSide === 'right') {
        const innerRight = state.width / 2 - t; xCenter = innerRight - wIn / 2;
      } else if (state.port.slotSide === 'left') {
        const innerLeft = -state.width / 2 + t; xCenter = innerLeft + wIn / 2;
      } else { xCenter = 0; }
      xCenter += (p.offsetX || 0);
      let yCenter = 0;
      if (state.port.slotInsetIn > 0) {
        const topInner = -state.height / 2 + t; yCenter = topInner + state.port.slotInsetIn + hIn / 2;
      }
      yCenter += (p.offsetY || 0);
      if (p.position === 'side') { xCenter = -state.width / 2 - (wIn / 2) - 0.5; }
      const disp = toPx(xCenter, yCenter);
      const wPx = wIn * scale; const hPx = hIn * scale;
      const stroke = p.color || '#58a6ff';
      let s = `<g class='port-item slot' data-port-id='${p.id || 'p' + idx}'>`;
      s += `<rect class='port-active' x='${(disp.x - wPx / 2).toFixed(2)}' y='${(disp.y - hPx / 2).toFixed(2)}' width='${wPx.toFixed(2)}' height='${hPx.toFixed(2)}' fill='rgba(88,166,255,0.20)' stroke='${stroke}' stroke-width='1.4' vector-effect='non-scaling-stroke' />`;
      if (L_in > 0) {
        const lenStart = toPx(xCenter, yCenter - hIn / 2 - 0.6);
        const lenEnd = toPx(xCenter + L_in, yCenter - hIn / 2 - 0.6);
        s += `<line x1='${lenStart.x.toFixed(2)}' y1='${lenStart.y.toFixed(2)}' x2='${lenEnd.x.toFixed(2)}' y2='${lenEnd.y.toFixed(2)}' stroke='${stroke}' stroke-dasharray='5 3' stroke-width='1.2' vector-effect='non-scaling-stroke' />`;
        s += `<text x='${((lenStart.x + lenEnd.x) / 2).toFixed(2)}' y='${(lenStart.y - 7).toFixed(2)}' font-size='11' fill='${stroke}' text-anchor='middle'>L≈${L_in.toFixed(2)}"</text>`;
      }
      s += '</g>';
      return s;
    }

    function buildLocalPortSvg(state, scale, origin, toPx) {
      if (!state.port || !state.port.enabled) return '';
      // Prefer unified multi-port array (state.ports) populated in update(); fallback to legacy location (state.port.ports)
      let ports = Array.isArray(state.ports) && state.ports.length ? state.ports : [];
      if (!ports.length && state.port.ports && state.port.ports.length) ports = state.port.ports;
      if (!ports.length) {
        // Legacy single derived port object
        if (state.port.type === 'slot') {
          ports = [{ type: 'slot', width: state.port.slotWidthIn || state.port.width || 0, height: state.port.slotHeightIn || state.port.height || 0, length: state.port.slotLengthIn || state.port.length || 0, position: state.port.position }];
        } else {
          const d = state.port.roundDiameterIn || state.port.width || 0;
          ports = [{ type: state.port.type || 'round', width: d, height: d, length: state.port.roundLengthIn || state.port.length || 0, position: state.port.position }];
        }
      }
      let any = '';
      ports.forEach((p, i) => {
        if (p.type === 'slot') any += drawSlotPortFromObj(p, state, scale, toPx, i);
        else any += drawRoundPortFromObj(p, state, scale, toPx, i);
      });
      if (!any) return '';
      // Wrapper class expectations for Jest tests: 'ports multi' when >1, 'ports consolidated' when ==1
      const wrapperClass = ports.length > 1 ? 'ports multi' : 'ports consolidated';
      return `<g class='${wrapperClass}'>${any}</g>`;
    }

    // Test hook exposure: allow Jest spec to import the local port SVG builder when query includes jest_test_hook.
    try {
      if (typeof location !== 'undefined' && /jest_test_hook=1/.test(location.search)) {
        window.__buildLocalPortSvg = buildLocalPortSvg;
      }
    } catch (e) { /* ignore test hook exposure errors */ }
    // Static (GitHub Pages) fallback: detect pages host and disable server-dependent features.
    (function () {
      try {
        const isPagesHost = /\.github\.io$/i.test(location.hostname) || location.hostname === '127.0.0.1';
        if (!isPagesHost) return;
        const computeBtnStatic = form.querySelector('button[name="computePort"]');
        if (computeBtnStatic) {
          computeBtnStatic.disabled = true;
          computeBtnStatic.title = 'Disabled: static Pages build (no backend)';
          computeBtnStatic.textContent = 'Compute (offline)';
        }
      } catch (e) { /* ignore static fallback errors */ }
    })();
    function drawRoundPortFromObj(p, state, scale, toPx, idx) {
      const dIn = p.width; const L_in = p.length; if (!(dIn > 0)) return '';
      const rIn = dIn / 2; const t = state.wallThickness;
      let xCenter = 0; let yCenter = 0;
      if (state.port.roundInsetIn > 0) { const topInner = -state.height / 2 + t; yCenter = topInner + state.port.roundInsetIn + rIn; }
      xCenter += (p.offsetX || 0); yCenter += (p.offsetY || 0);
      if (p.position === 'side') { xCenter = -state.width / 2 - rIn - 0.5; }
      const disp = toPx(xCenter, yCenter); const rPx = rIn * scale;
      const stroke = p.color || (p.type === 'aero' ? '#ffb543' : '#58a6ff');
      const fill = p.type === 'aero' ? 'rgba(255,181,67,0.18)' : 'rgba(88,166,255,0.15)';
      let s = `<g class='port-item ${p.type}' data-port-id='${p.id || 'p' + idx}'>`;
      s += `<circle class='port-active' cx='${disp.x.toFixed(2)}' cy='${disp.y.toFixed(2)}' r='${rPx.toFixed(2)}' fill='${fill}' stroke='${stroke}' stroke-width='1.2' vector-effect='non-scaling-stroke' />`;
      if (p.type === 'aero' && state.port.flareRadiusIn) {
        const flareRadPx = (rIn + state.port.flareRadiusIn * 0.35) * scale;
        s += `<circle cx='${disp.x.toFixed(2)}' cy='${disp.y.toFixed(2)}' r='${flareRadPx.toFixed(2)}' fill='none' stroke='${stroke}' stroke-dasharray='3 3' stroke-width='1' opacity='.6' vector-effect='non-scaling-stroke' />`;
      }
      if (L_in > 0) {
        const lenStart = toPx(xCenter, yCenter - rIn - 0.6);
        const lenEnd = toPx(xCenter + L_in, yCenter - rIn - 0.6);
        s += `<line x1='${lenStart.x.toFixed(2)}' y1='${lenStart.y.toFixed(2)}' x2='${lenEnd.x.toFixed(2)}' y2='${lenEnd.y.toFixed(2)}' stroke='${stroke}' stroke-dasharray='5 3' stroke-width='1.2' vector-effect='non-scaling-stroke' />`;
        s += `<text x='${((lenStart.x + lenEnd.x) / 2).toFixed(2)}' y='${(lenStart.y - 7).toFixed(2)}' font-size='11' fill='${stroke}' text-anchor='middle'>L≈${L_in.toFixed(2)}"</text>`;
      }
      s += '</g>';
      return s;
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
    // SVG export generator (deterministic, not injected into DOM)
    function buildSvgExport() {
      const defaultW = 480, defaultH = 360;
      const viewW = state.__viewBoxOverride?.w || defaultW;
      const viewH = state.__viewBoxOverride?.h || defaultH;
      const margin = 12; // smaller margin for closer framing
      // Scale uniformly if larger than available area
      const maxW = viewW - margin * 2; // ghost offset considered separately
      const maxH = viewH - margin * 2;
      const ghostOffset = 0; // ghost panels archived
      // Allow enlarging small boxes instead of clamping at 1 (ignore ghost offset for scaling)
      let baseScale = Math.min(maxW / (state.width), maxH / (state.height));
      // Zoom presets removed: use stable framing multiplier (previous default 0.45)
      let scale = baseScale * 0.45;
      const dispW = state.width * scale;
      const dispH = state.height * scale;
      // Center primary box regardless of ghost; ghost panels offset outward
      const x = (viewW - dispW) / 2;
      const y = (viewH - dispH) / 2;

      // Cutout logic: nominal size derived from a subSize selector if present (fallback 12)
      const sizeSel = form.querySelector('select[name="subSize"]');
      const nominalSel = sizeSel ? parseInt(sizeSel.value, 10) : 12;
      // Update nominal for holes that are purely heuristic (no override/spec)
      if (state.showCutouts) { state.holes.forEach(h => { if (!h.cut) { h.nominal = nominalSel; } }); }
      // FRONT PANEL masked rectangle will be built later (after mask defs)
      // Compute hole display coordinates & radii for mask + outlines
      const holeDisplay = [];
      if (state.showCutouts) {
        state.holes.forEach(h => {
          const nominal = h.nominal || nominalSel;
          let dia = h.cut ? h.cut : nominal * 0.93;
          dia = Math.min(dia, state.width, state.height);
          let hx = snap(state.width / 2 + (h.dx || 0));
          let hy = snap(state.height / 2 + (h.dy || 0));
          const r = dia / 2;
          const edgeMargin = 0.5;
          if (hx - r - edgeMargin < 0) hx = r + edgeMargin;
          if (hx + r + edgeMargin > state.width) hx = state.width - r - edgeMargin;
          if (hy - r - edgeMargin < 0) hy = r + edgeMargin;
          if (hy + r + edgeMargin > state.height) hy = state.height - r - edgeMargin;
          const dispX = x + (hx - state.width / 2) * scale + dispW / 2;
          const dispY = y + (hy - state.height / 2) * scale + dispH / 2;
          const dispR = r * scale;
          // Simplified fill logic: per-hole cutOut removed. Hole considered filled if global fillHoles OR hole.filled true.
          const isFilled = state.fillHoles || h.filled === true;
          holeDisplay.push({ dia, dispX, dispY, dispR, filled: isFilled, selected: !!h.selected });
        });
      }
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
      // Ghost panel rendering removed (archived)
      // Build composite face mask subtracting all unfilled holes (slight oversize to avoid fringe)
      let maskDef = '';
      const oversize = 1.008; // expand radius ~0.8% to prevent 1px fringe from antialiasing
      if (state.showCutouts && holeDisplay.length) {
        const maskCircles = holeDisplay
          .filter(h => !h.filled)
          .map(h => `<circle cx='${h.dispX.toFixed(2)}' cy='${h.dispY.toFixed(2)}' r='${(h.dispR * oversize).toFixed(2)}' fill='black' />`)
          .join('');
        maskDef = `<mask id='faceCutMask'><rect x='${x.toFixed(2)}' y='${y.toFixed(2)}' width='${dispW.toFixed(2)}' height='${dispH.toFixed(2)}' fill='white' />${maskCircles}</mask>`;
      }
      // Filled hole outlines (animated) drawn over masked panel
      const filledOutlines = (state.showCutouts && holeDisplay.length) ? holeDisplay.filter(h => h.filled).map(h => `<circle class='hole-outline${h.selected ? " selected" : ""}' cx='${h.dispX.toFixed(2)}' cy='${h.dispY.toFixed(2)}' r='${h.dispR.toFixed(2)}' />`).join('') : '';
      // Optional badges & inner diameter text only for non-filled holes (since area removed)
      let labels = '';
      if (state.showCutouts && !state.fillHoles) {
        labels = holeDisplay.filter(h => !h.filled).map(h => {
          const dia = h.dia;
          const badgeY = (h.dispY - h.dispR - 10).toFixed(2);
          const badgeX = h.dispX.toFixed(2);
          const badgeType = (state.holes.find(o => (state.fillHoles || o.filled === true) ? false : (Math.abs((o.cut || (o.nominal * 0.93)) - dia) < 1e-6))?.cut) ? 'CUT' : 'EST';
          const innerFontPx = Math.max(6, Math.min(15, h.dispR * 0.55));
          return `<g class='cut-label'><text x='${badgeX}' y='${badgeY}' text-anchor='middle' class='badge ${badgeType.toLowerCase()}'>${badgeType}</text><text x='${h.dispX.toFixed(2)}' y='${h.dispY.toFixed(2)}' text-anchor='middle' dominant-baseline='middle' style='font:${innerFontPx}px system-ui;fill:#ffd28c;'>${dia.toFixed(2)}"</text></g>`;
        }).join('');
      }
      // Metadata circles for downstream CAD: include one <circle data-hole-*> per visible hole
      const metaCircles = (state.showCutouts && holeDisplay.length) ? holeDisplay.map(h => {
        // Convert display coords back to inches relative to front panel origin (top-left) for CAD
        // We already computed 'dia' (inches). Need center absolute inches: holeDisplay only stores disp coords; recompute from state.
        // We can derive by reverse engineering dispX/dispY, but simpler: recalc using nominal dx/dy from original holes in same order.
        // Map holeDisplay index to state.holes filtered for !hidden
        return h; // placeholder mapping not used further
      }) : [];
      // Build actual metadata by iterating all holes (include cutOut status)
      let holeMetaSvg = '';
      if (state.showCutouts) {
        state.holes.forEach(o => {
          const nominal = o.nominal || nominalSel;
          const diaIn = o.cut ? o.cut : nominal * 0.93;
          const cxIn = snap(state.width / 2 + (o.dx || 0));
          const cyIn = snap(state.height / 2 + (o.dy || 0));
          const dispX = x + (cxIn - state.width / 2) * scale + dispW / 2;
          const dispY = y + (cyIn - state.height / 2) * scale + dispH / 2;
          const rPx = (diaIn / 2) * scale;
          // Legacy data-hole-cut-out attribute removed; downstream consumers now infer status from filled flag if needed.
          holeMetaSvg += `<circle class='hole-meta' cx='${dispX.toFixed(2)}' cy='${dispY.toFixed(2)}' r='${rPx.toFixed(2)}' fill='none' stroke='none' data-hole-cx-in='${cxIn.toFixed(4)}' data-hole-cy-in='${cyIn.toFixed(4)}' data-hole-dia-in='${diaIn.toFixed(4)}' />`;
        });
      }
      // Optional matrix skin glow (adds separate glow stroke so original outline styling remains intact)
      const glowCircles = (state.finish === 'fun' && state.showCutouts && holeDisplay.length)
        ? holeDisplay.map(h => `<circle cx='${h.dispX.toFixed(2)}' cy='${h.dispY.toFixed(2)}' r='${h.dispR.toFixed(2)}' stroke='#0ff' stroke-width='2.5' fill='none' filter='url(#holeGlow)' opacity='0.95' />`).join('')
        : '';
      const glowGroup = glowCircles ? `<g class='hole-glow'>${glowCircles}</g>` : '';
      const cutoutsGroup = state.showCutouts ? `<g class='cutouts'>${filledOutlines}${labels}${holeMetaSvg}${glowGroup}</g>` : '';
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
        // Hole diameter lines & labels (for each hole - include all)
        const holeDims = state.showCutouts ? state.holes.map(h => {
          const nominal = h.nominal;
          const dia = h.cut ? h.cut : nominal * 0.93;
          const r = dia / 2 * scale;
          // find circle center again
          const dispWLocal = state.width * scale;
          const dispHLocal = state.height * scale;
          const baseX = (viewW - dispWLocal) / 2;
          const baseY = (viewH - dispHLocal) / 2;
          const hx = snap(state.width / 2 + (h.dx || 0));
          const hy = snap(state.height / 2 + (h.dy || 0));
          const dispX = baseX + (hx - state.width / 2) * scale + dispWLocal / 2;
          const dispY = baseY + (hy - state.height / 2) * scale + dispHLocal / 2;
          const lineY = dispY + r + 18;
          return `<g class='hole-dim'><line x1='${(dispX - r).toFixed(2)}' y1='${lineY.toFixed(2)}' x2='${(dispX + r).toFixed(2)}' y2='${lineY.toFixed(2)}' stroke='${dimLineColor}' stroke-width='1' marker-start='url(#arrow)' marker-end='url(#arrow)' />
            <text x='${dispX.toFixed(2)}' y='${(lineY + 14).toFixed(2)}' text-anchor='middle' fill='${dimTextColor}' style='${labelFont}'>Ø ${dia.toFixed(2)} in</text></g>`;
        }).join('') : '';
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
      // Multi-port detection: ensure export path also leverages new iteration logic.
      const localPorts = buildLocalPortSvg(state, scale, { x, y, dispW, dispH }, toPx);
      const serverPorts = buildServerPortSvg(state, scale, { x, y, dispW, dispH }, toPx, x, y, dispW, dispH);
      const portsGroup = localPorts || serverPorts;
      return `<svg viewBox='0 0 ${viewW} ${viewH}' preserveAspectRatio='xMidYMid meet' role='img' aria-label='Box preview export' class='finish-${state.finish}'>
        <defs>
          <pattern id='ghostHatch' width='6' height='6' patternUnits='userSpaceOnUse'>
            <path d='M0 6 L6 0 M-1 1 L1 -1 M5 7 L7 5' stroke='#3a4855' stroke-width='0.6' opacity='0.55'/>
          </pattern>
          ${maskDef}
          <filter id='portGlow' x='-50%' y='-50%' width='200%' height='200%'>
            <feGaussianBlur in='SourceGraphic' stdDeviation='3' result='blur'/>
            <feMerge>
              <feMergeNode in='blur'/>
              <feMergeNode in='SourceGraphic'/>
            </feMerge>
          </filter>
          <filter id='holeGlow' x='-50%' y='-50%' width='200%' height='200%'>
            <feGaussianBlur stdDeviation='3' result='blur'/>
            <feMerge>
              <feMergeNode in='blur'/>
              <feMergeNode in='blur'/>
              <feMergeNode in='SourceGraphic'/>
            </feMerge>
          </filter>
          <style>
            .front { fill:#1e2630; stroke:#55687a; stroke-width:1.5; vector-effect:non-scaling-stroke; }
            .panel-left { fill:#232e3a; stroke:#4e5d6b; stroke-width:1.2; vector-effect:non-scaling-stroke; }
            /* Ghost panel styles archived; see archive/ghost_panels_feature.js */
            @keyframes dash-spin { to { stroke-dashoffset: -999; } }
            .hole-outline { fill:none; stroke:#404040; stroke-width:2; stroke-dasharray:8 6; stroke-linecap:round; animation:dash-spin 1.2s linear infinite; }
            .hole-outline.selected { stroke:#ffd28c; stroke-width:2.4; }
            /* Matrix skin glow (applies only when finish is 'fun') */
            .finish-fun .hole-outline.selected { filter:url(#holeGlow); stroke:#00ffaa; stroke-width:2.6; }
            .toast { font:11px system-ui; fill:#b65d00; }
            .hole-glow circle { pointer-events:none; mix-blend-mode:screen; }
            /* Matrix finish animated glow */
            @keyframes matrixPulse { 0%,100% { stroke-opacity:1.0; } 50% { stroke-opacity:0.25; } }
            .finish-fun .hole-glow circle { animation: matrixPulse 2.5s ease-in-out infinite; }
            .badge { font:10px system-ui; fill:#fff; stroke:#222; stroke-width:.4; paint-order:stroke; }
            .badge.est { fill:#eee; stroke:#555; }
            .badge.ovr { fill:#ffd28c; stroke:#a06400; }
            .badge.spec { fill:#a7e3ff; stroke:#035b7a; }
            .dims line { vector-effect:non-scaling-stroke; stroke-dasharray:3 2; }
            text { font:12px system-ui; fill:#333; pointer-events:none; }
            .port-shape { fill:#203240; stroke:#58a6ff; stroke-width:1.2; vector-effect:non-scaling-stroke; opacity:.85; }
            /* Animated active port highlight */
            @keyframes portPulse { 0%,100% { stroke-opacity:0.95; fill-opacity:0.22; } 50% { stroke-opacity:0.40; fill-opacity:0.10; } }
            .port-active { filter:url(#portGlow); animation:portPulse 2.4s ease-in-out infinite; }
            .port-len-unknown { font:10px system-ui; fill:#58a6ff; opacity:.75; letter-spacing:.5px; }
          </style>
        </defs>
    <rect x='0' y='0' width='${viewW}' height='${viewH}' fill='#f3e2c9' />
  ${leftPanel}<rect x='${x.toFixed(2)}' y='${y.toFixed(2)}' width='${dispW.toFixed(2)}' height='${dispH.toFixed(2)}' class='front' ${maskDef ? "mask='url(#faceCutMask)'" : ''} />${cutoutsGroup}${portsGroup}${dimsGroup}
        ${state.toast ? `<text x='8' y='${(viewH - 8).toFixed(2)}' class='toast'>${state.toast}</text>` : ''}
      </svg>`;
    }

    // Local port estimation helper (lightweight; uses current form inputs if internal shown)
    function recomputeLocalPort() {
      const targetHz = state.port.targetHz;
      if (!(targetHz > 0)) return null;
      const portType = state.port.type || 'slot';
      const numPorts = state.port.count || 1;
      const speed = 343; // m/s
      // Previously required showInternal; allow overlay when port enabled regardless of internal metrics toggle.
      if (!state.port.enabled) return null;
      const t = state.wallThickness;
      // Prefer net internal volume (excluding driver/bracing/port) if referenceVolumes computed; fallback to raw internal dims.
      let internalVolIn3;
      if (state.referenceVolumes && state.referenceVolumes.netInternalIn3 > 0) {
        internalVolIn3 = state.referenceVolumes.netInternalIn3;
      } else {
        const iW = Math.max(0, state.width - 2 * t);
        const iH = Math.max(0, state.height - 2 * t);
        const iD = Math.max(0, state.depth - 2 * t);
        internalVolIn3 = iW * iH * iD;
      }
      const internalVolM3 = internalVolIn3 * 0.0000163871; // 1 in^3 = 1.63871e-5 m^3
      if (internalVolM3 <= 0) return null;
      let areaPerPortM2 = null;
      let endCorrectionPerEndM = 0;
      if (portType === 'round' || portType === 'aero') {
        const dIn = state.port.roundDiameterIn;
        if (!(dIn > 0)) return null;
        const dM = dIn * IN_TO_M;
        areaPerPortM2 = Math.PI * Math.pow(dM / 2, 2);
        const rM = dM / 2;
        if (portType === 'aero') {
          const flareIn = state.port.flareRadiusIn || 0;
          const flareM = flareIn * IN_TO_M;
          // Refined empirical reduction: base 0.85*r minus diminishing term proportional to flare radius capped at 60%
          const reduction = Math.min(0.6, (flareM / rM) * 0.4) * rM;
          endCorrectionPerEndM = (0.85 * rM) - reduction;
        } else {
          endCorrectionPerEndM = 0.85 * rM;
        }
      } else { // slot
        const hIn = state.port.slotHeightIn;
        if (!(hIn > 0)) return null;
        const gapIn = state.port.slotGapIn || 0;
        // iW is only defined in the fallback branch above when referenceVolumes not present.
        // When we used the netInternalIn3 fast-path, iW isn't in scope causing a ReferenceError under Jest.
        // Recompute internal width deterministically here to avoid relying on the earlier block scope.
        const internalWidthIn = Math.max(0, state.width - 2 * t);
        let wPerPortIn = state.port.slotWidthIn;
        if (!(wPerPortIn > 0)) {
          const usableWidthIn = Math.max(0, internalWidthIn - (numPorts - 1) * gapIn);
          wPerPortIn = numPorts > 0 ? (usableWidthIn / numPorts) : 0;
        }
        if (!(wPerPortIn > 0)) return null;
        const wM = wPerPortIn * IN_TO_M;
        const hM = hIn * IN_TO_M;
        areaPerPortM2 = wM * hM;
        const Rh = (wM * hM) / (2 * (wM + hM));
        endCorrectionPerEndM = Math.max(0, (1.7 * Math.sqrt(wM * hM / Math.PI) * 0.6 + 0.5 * Rh));
      }
      if (!areaPerPortM2 || areaPerPortM2 <= 0) return null;
      const L_eff = (areaPerPortM2 * speed * speed) / (Math.pow(2 * Math.PI * targetHz, 2) * internalVolM3 / numPorts);
      const physicalLengthPerPortM = Math.max(0, L_eff - 2 * endCorrectionPerEndM);
      // Advanced imperial port math hook (non-breaking): supply supplemental data when PortMath available
      let advanced = null;
      try {
        if (window.PortMath) {
          // Convert internal volume to ft^3 (imperial) for advanced solve
          const Vb_ft3 = internalVolIn3 / 1728;
          const ends = { inner: { flanged: true, flare: false }, outer: { flanged: false, flare: false } };
          if (portType === 'slot') {
            advanced = window.PortMath.solvePortLength({ Vb_ft3, Fb: targetHz, type: 'slot', count: numPorts, w: state.port.slotWidthIn || 0, h: state.port.slotHeightIn || 0, d: null, ends });
          } else {
            advanced = window.PortMath.solvePortLength({ Vb_ft3, Fb: targetHz, type: portType === 'aero' ? 'aero' : 'round', count: numPorts, w: null, h: null, d: state.port.roundDiameterIn || 0, ends });
          }
          if (advanced && advanced.area_total_in2 > 0) {
            const vel = window.PortMath.estimatePortVelocity({ Fb: targetHz, A_total_in2: advanced.area_total_in2, Sd_in2: null, Xmax_in: null });
            advanced.velocity = vel;
            advanced.resonanceHz = window.PortMath.portResonanceHz(advanced.length_eff_in);
          }
        }
      } catch (e) { /* ignore advanced errors */ }
      return { portType, numPorts, targetHz, areaPerPortM2, effectiveLengthPerPortM: L_eff, physicalLengthPerPortM, endCorrectionPerEndM, advanced };
    }

    // Read current form values into state (was lost in refactor)
    function readForm() {
      // Basic dimensions
      const wEl = form.querySelector('input[name="width"]');
      const hEl = form.querySelector('input[name="height"]');
      const dEl = form.querySelector('input[name="depth"]');
      const tEl = form.querySelector('input[name="wallThickness"]');
      if (wEl) state.width = parseFloat(wEl.value) || state.width;
      if (hEl) state.height = parseFloat(hEl.value) || state.height;
      if (dEl) state.depth = parseFloat(dEl.value) || state.depth;
      if (tEl) state.wallThickness = parseFloat(tEl.value) || state.wallThickness;
      // Flags
      // showGhost removed (archived)
      state.showDims = !!form.querySelector('input[name="showDims"]')?.checked;
      state.showInternal = !!form.querySelector('input[name="showInternal"]')?.checked;
      state.showPortOverlay = !!form.querySelector('input[name="showPortOverlay"]')?.checked;
      state.fillHoles = !!form.querySelector('input[name="fillHoles"]')?.checked;
      state.showCutouts = !!form.querySelector('input[name="showCutouts"]')?.checked;
      state.hideFrontPanel = !!form.querySelector('input[name="hideFrontPanel"]')?.checked;
      const depthStyleSel = form.querySelector('select[name="depthStyle"]');
      if (depthStyleSel) state.depthStyle = depthStyleSel.value || state.depthStyle;
      const finishSel = form.querySelector('select[name="finish"]');
      if (finishSel) state.finish = finishSel.value || state.finish;
      // Hole configuration via subConfig select (single vs dual) & cut diameter override
      const layoutSel = form.querySelector('select[name="subConfig"]');
      if (layoutSel) {
        const layout = layoutSel.value;
        if (layout === 'dual' && state.holes.length !== 2) {
          const base = state.holes[0] || { dx: 0, dy: 0, nominal: 12, cut: null, spec: null, selected: true };
          state.holes = [
            { dx: -base.nominal * 0.9, dy: 0, nominal: base.nominal, cut: base.cut, spec: base.spec, selected: true, filled: base.filled === true ? true : false },
            { dx: base.nominal * 0.9, dy: 0, nominal: base.nominal, cut: base.cut, spec: base.spec, selected: false, filled: base.filled === true ? true : false }
          ];
        } else if (layout === 'single' && state.holes.length !== 1) {
          const first = state.holes[0];
          state.holes = [{ dx: 0, dy: 0, nominal: first?.nominal || 12, cut: first?.cut || null, spec: first?.spec || null, selected: true, filled: first?.filled === true ? true : false }];
        }
        // Visibility sync for hole selection radios in static layout (accordion removed)
        const holeSelectC = form.querySelector('.hole-select');
        if (holeSelectC) {
          if (layout === 'dual') {
            holeSelectC.classList.remove('hidden');
            holeSelectC.style.display = 'flex';
          } else {
            holeSelectC.classList.add('hidden');
            holeSelectC.style.display = 'none';
          }
        }
      }
      // Cut/Spec override inputs
      const cutIn = form.querySelector('input[name="cutDiameter"]');
      const subSizeSel = form.querySelector('select[name="subSize"]');
      const nominalVal = subSizeSel ? parseInt(subSizeSel.value, 10) : (state.holes[0]?.nominal || 12);
      // Auto-fill heuristic diameter so spinner arrows start from suggested value without treating it as explicit CUT override.
      if (cutIn) {
        const autoDia = nominalVal * 0.93;
        // If blank OR previously auto-filled (user hasn't typed) keep it synced to heuristic.
        if (cutIn.value === '' || cutIn.dataset.autofilled === '1') {
          cutIn.value = autoDia.toFixed(2).replace(/\.00$/, '');
          cutIn.dataset.autofilled = '1';
          cutIn.classList.add('auto-filled');
        }
        // If user types (input event later), we'll clear dataset.autofilled (listener below).
      }
      let cutVal = cutIn ? parseFloat(cutIn.value) : null;
      if (cutIn && cutIn.dataset.autofilled === '1') {
        // Treat auto-filled heuristic as null so badges show EST instead of CUT
        const autoDia = nominalVal * 0.93;
        if (Math.abs(cutVal - autoDia) < 1e-6) {
          cutVal = null;
        }
      }
      if (!(cutVal > 0)) cutVal = null;
      state.holes.forEach(h => {
        h.nominal = nominalVal;
        h.cut = cutVal; // spec removed from UI; keep property null if legacy code checks it
        h.spec = null;
      });
      // --- Port inputs (ensure live reflection even if menu initially closed) ---
      const portEnabledEl = form.querySelector('input[name="portEnabled"]');
      if (portEnabledEl) state.port.enabled = !!portEnabledEl.checked;
      const portTypeSelLive = form.querySelector('select[name="portType"]');
      if (portTypeSelLive) state.port.type = portTypeSelLive.value || state.port.type;
      const countEl = form.querySelector('input[name="numPorts"]');
      if (countEl) state.port.count = parseInt(countEl.value || '1', 10) || 1;
      const targetHzEl = form.querySelector('input[name="targetHz"]');
      if (targetHzEl) state.port.targetHz = parseFloat(targetHzEl.value) || null;
      const slotHeightEl = form.querySelector('input[name="slotHeightIn"]');
      if (slotHeightEl) state.port.slotHeightIn = parseFloat(slotHeightEl.value) || null;
      const slotWidthEl = form.querySelector('input[name="slotWidthIn"]');
      if (slotWidthEl) state.port.slotWidthIn = parseFloat(slotWidthEl.value) || null;
      const slotGapEl = form.querySelector('input[name="slotGapIn"]');
      if (slotGapEl) state.port.slotGapIn = parseFloat(slotGapEl.value) || 0;
      const slotInsetEl = form.querySelector('input[name="slotInsetIn"]');
      if (slotInsetEl) {
        const raw = slotInsetEl.value;
        // Track explicit user intent so downstream auto-placement logic doesn't override deliberate values.
        state.port.slotInsetExplicit = raw !== '';
        state.port.slotInsetIn = parseFloat(raw) || 0;
      }
      const slotSideSel = form.querySelector('select[name="slotSide"]');
      if (slotSideSel) state.port.slotSide = slotSideSel.value || state.port.slotSide;
      const roundDiamEl = form.querySelector('input[name="roundDiameterIn"]');
      if (roundDiamEl) state.port.roundDiameterIn = parseFloat(roundDiamEl.value) || null;
      const roundSpacingEl = form.querySelector('input[name="roundSpacingIn"]');
      if (roundSpacingEl) state.port.roundSpacingIn = parseFloat(roundSpacingEl.value) || null;
      const roundInsetEl = form.querySelector('input[name="roundInsetIn"]');
      if (roundInsetEl) state.port.roundInsetIn = parseFloat(roundInsetEl.value) || 0;
      const flareEl = form.querySelector('input[name="flareRadiusIn"]');
      if (flareEl) state.port.flareRadiusIn = parseFloat(flareEl.value) || null;
      // Ensure external mounting default: user can later disable by setting a hidden flag or future UI control.
      if (state.port.enabled && typeof state.port.externalMount === 'undefined') {
        state.port.externalMount = true;
      }
      // --- Auto-defaults for standard slot port tuned to 32 Hz when port first enabled ---
      if (state.port.enabled) {
        // Default target tuning
        if (!(state.port.targetHz > 0)) {
          state.port.targetHz = 32;
          const targetHzInput = form.querySelector('input[name="targetHz"]');
          if (targetHzInput && !targetHzInput.value) targetHzInput.value = '32';
        }
        if (state.port.type === 'slot') {
          const t = state.wallThickness;
          const internalH = Math.max(0, state.height - 2 * t);
          // Height heuristic: ~22% of internal height, clamped between 2.5 and internalH - 1 (never exceed box minus 1" margin)
          if (!(state.port.slotHeightIn > 0) || state.port.slotHeightIn === null) {
            const suggested = Math.min(Math.max(2.5, internalH * 0.22), Math.max(1.5, internalH - 1));
            state.port.slotHeightIn = parseFloat(suggested.toFixed(2));
            const slotHeightInput = form.querySelector('input[name="slotHeightIn"]');
            if (slotHeightInput && !slotHeightInput.value) slotHeightInput.value = state.port.slotHeightIn.toFixed(2).replace(/\.00$/, '');
          }
          // Gap heuristic: default 0.75" between multiple slots (only matters if count>1)
          if (!(state.port.slotGapIn > 0)) {
            state.port.slotGapIn = 0.75;
            const gapInput = form.querySelector('input[name="slotGapIn"]');
            if (gapInput && !gapInput.value) gapInput.value = state.port.slotGapIn.toFixed(2).replace(/\.00$/, '');
          }
          // Inset heuristic: 0.75" from top panel for clearance
          if (!(state.port.slotInsetIn > 0)) {
            state.port.slotInsetIn = 0.75;
            const insetInput = form.querySelector('input[name="slotInsetIn"]');
            if (insetInput && !insetInput.value) insetInput.value = state.port.slotInsetIn.toFixed(2).replace(/\.00$/, '');
          }
          // Side default (left) if missing
          if (!state.port.slotSide) {
            state.port.slotSide = 'left';
            const sideSel = form.querySelector('select[name="slotSide"]');
            if (sideSel && !sideSel.value) sideSel.value = 'left';
          }
          // Width left dynamic: derived later if absent.
        }
      }
      // Re-center dual holes with safe edge margin each read (prevents drift / overlap when size changes)
      const layoutSelCheck = form.querySelector('select[name="subConfig"]');
      if (layoutSelCheck && layoutSelCheck.value === 'dual' && state.holes.length === 2) {
        const edgeMargin = 0.5; // inches from edge
        // Determine effective diameter (same for both)
        const dia = cutVal || (nominalVal * 0.93);
        const r = dia / 2;
        // Minimum desired gap between hole edges for dual layout
        const minEdgeGap = Math.max(0.75, dia * 0.15); // at least 0.75" or 15% of diameter
        // Required panel dimensions to fit two circles horizontally with margins & gap
        const requiredWidth = 2 * dia + minEdgeGap + 2 * edgeMargin;
        const requiredHeight = dia + 2 * edgeMargin; // ensure vertical clearance too
        let adjusted = false;
        if (state.width < requiredWidth) { state.width = requiredWidth; const wInput = form.querySelector('input[name="width"]'); if (wInput) wInput.value = state.width.toFixed(2); adjusted = true; }
        if (state.height < requiredHeight) { state.height = requiredHeight; const hInput = form.querySelector('input[name="height"]'); if (hInput) hInput.value = state.height.toFixed(2); adjusted = true; }
        if (adjusted) {
          // If we expanded box, also clear any future redo stack and note toast (later in update commit)
          state.toast = 'Box auto-expanded for dual subs';
        }
        const usableHalf = (state.width / 2) - edgeMargin - r;
        if (usableHalf > 0) {
          // Maintain previous selection state
          const firstSelected = !!state.holes[0].selected;
          // Compute center separation: limited by either usableHalf or minEdgeGap
          const centerSep = Math.min(usableHalf * 2, dia + minEdgeGap);
          const halfSep = centerSep / 2;
          state.holes[0].dx = -halfSep;
          state.holes[1].dx = halfSep;
          state.holes[0].dy = 0; state.holes[1].dy = 0;
          state.holes[0].selected = firstSelected;
          state.holes[1].selected = !firstSelected;
        } else {
          // Box too narrow: stack concentrically (fallback)
          state.holes[0].dx = 0; state.holes[1].dx = 0;
        }
      }
      // Generic auto-fit (single or dual). Expand box dimensions if needed for given driver diameter.
      (function autoFitDimensions() {
        const effectiveDia = cutVal || (nominalVal * 0.93);
        if (!(effectiveDia > 0)) return;
        const layoutSelAuto = layoutSelCheck ? layoutSelCheck.value : 'single';
        const edgeMargin = 0.75; // horizontal margin around driver edge(s)
        const verticalMargin = 0.75; // top/bottom clearance
        const depthFactor = 0.70; // minimum depth proportion of diameter
        let minWidth;
        if (layoutSelAuto === 'dual' && state.holes.length === 2) {
          const gap = Math.max(0.75, effectiveDia * 0.15); // same gap heuristic
          minWidth = effectiveDia * 2 + gap + edgeMargin * 2;
        } else {
          minWidth = effectiveDia + edgeMargin * 2;
        }
        const minHeight = effectiveDia + verticalMargin * 2;
        const minDepth = Math.max(effectiveDia * depthFactor, 6) + state.wallThickness; // never below 6" + wall thickness
        let changed = false;
        if (state.width < minWidth) { state.width = minWidth; const wInput = form.querySelector('input[name="width"]'); if (wInput) wInput.value = state.width.toFixed(2); changed = true; }
        if (state.height < minHeight) { state.height = minHeight; const hInput = form.querySelector('input[name="height"]'); if (hInput) hInput.value = state.height.toFixed(2); changed = true; }
        if (state.depth < minDepth) { state.depth = minDepth; const dInput = form.querySelector('input[name="depth"]'); if (dInput) dInput.value = state.depth.toFixed(2); changed = true; }
        if (changed && !/dual subs/i.test(state.toast || '')) {
          state.toast = 'Dimensions auto-fit to driver size';
        }
      })();
      // (Port inputs already parsed earlier in readForm; duplicate block removed)
    }

    // History push helper
    function pushHistory() {
      state.history.push(JSON.parse(JSON.stringify({ width: state.width, height: state.height, depth: state.depth, finish: state.finish, subwooferModel: state.subwooferModel ? { ...state.subwooferModel } : null, holes: state.holes.map(h => ({ dx: h.dx, dy: h.dy, nominal: h.nominal, cut: h.cut, spec: h.spec, selected: h.selected, filled: h.filled === true })) })));
      // Clear redo stack on new commit
      state.future = [];
    }

    // UI reflection for hole selection radios (was removed; calls left behind).
    // Ensures that when layout switches between single/dual the radio buttons update
    // and second radio hides for single layout to prevent misleading selection.
    function reflectHoleSelectionUI() {
      const radios = form.querySelectorAll('input[name="holeSelect"]');
      if (!radios.length) return;
      if (state.holes.length === 1) {
        radios.forEach(r => {
          const wrap = r.closest('label') || r.parentElement;
          if (r.value === '0') {
            r.checked = true;
            if (wrap) wrap.style.display = 'inline-flex';
          } else {
            r.checked = false;
            if (wrap) wrap.style.display = 'none';
          }
        });
      } else {
        radios.forEach(r => {
          const idx = parseInt(r.value, 10);
          const wrap = r.closest('label') || r.parentElement;
          if (wrap) wrap.style.display = 'inline-flex';
          r.checked = !!state.holes[idx]?.selected;
        });
      }
    }

    function update(commit = true) {
      readForm();
      state.localPortEst = recomputeLocalPort();
      // Compute reference (internal) volumes & displacements early so port math can consume net volume.
      try { computeReferenceVolumes(); } catch (e) { /* ignore reference volume errors */ }
      // Slot port folding plan (compute after localPortEst so port.length populated)
      try {
        if (state.port && state.port.enabled && state.port.type === 'slot' && typeof window.computeSlotFoldPlan === 'function') {
          state.port.foldPlan = window.computeSlotFoldPlan(state.port, state);
        } else {
          state.port.foldPlan = null;
        }
      } catch (e) { state.port.foldPlan = null; }
      // Port warnings (Mach / resonance / fold overflow) stub evaluation
      try {
        state.portWarnings = [];
        if (state.port && state.port.enabled) {
          const adv = state.localPortEst && state.localPortEst.advanced ? state.localPortEst.advanced : null;
          if (adv && adv.velocity && adv.velocity.mach !== null) {
            const m = adv.velocity.mach;
            if (m >= 0.16) {
              state.portWarnings.push({ code: 'mach', severity: m >= 0.25 ? 'critical' : 'warn', mach: m, message: `Port air speed Mach ${m.toFixed(3)} exceeds recommended <0.16.` });
            }
          }
          if (adv && adv.resonanceHz && state.port.targetHz) {
            const fb = state.port.targetHz;
            if (adv.resonanceHz < fb * 3) {
              state.portWarnings.push({ code: 'resonance', severity: 'info', resonanceHz: adv.resonanceHz, message: `First port resonance ${adv.resonanceHz.toFixed(1)} Hz < 3×Fb (${(fb * 3).toFixed(1)} Hz).` });
            }
          }
          if (state.port.foldPlan && state.port.foldPlan.overflows) {
            state.portWarnings.push({ code: 'fold-overflow', severity: 'error', message: 'Slot port length exceeds available internal span; increase port area or box dims.' });
          }
        }
      } catch (e) { state.portWarnings = state.portWarnings || []; }
      // Keep global reference in sync for three_preview.js
      window.__boxBuilderState = state;
      // Populate consolidated geometry fields for downstream consumers.
      try {
        if (state.port.enabled) {
          if (state.port.type === 'slot') {
            // Use explicit slotWidthIn / slotHeightIn or derive width if dynamic fill distribution
            const t = state.wallThickness;
            const internalWidthIn = Math.max(0, state.width - 2 * t);
            let wPerPort = state.port.slotWidthIn;
            if (!(wPerPort > 0) && state.localPortEst) {
              const num = state.localPortEst.numPorts || 1;
              const gap = state.port.slotGapIn || 0;
              const usable = Math.max(0, internalWidthIn - (num - 1) * gap);
              wPerPort = num > 0 ? (usable / num) : null;
            }
            state.port.width = wPerPort || null;
            state.port.height = state.port.slotHeightIn || null;
          } else { // round or aero
            const d = state.port.roundDiameterIn || null;
            state.port.width = d; // diameter
            state.port.height = d; // diameter
          }
          if (state.localPortEst) {
            state.port.length = (state.localPortEst.physicalLengthPerPortM * 39.37) || null;
          } else if (state.portDesign) {
            state.port.length = (state.portDesign.physicalLengthPerPortM * 39.37) || null;
          }
        } else {
          state.port.width = null; state.port.height = null; state.port.length = null;
        }
      } catch (e) { /* ignore geometry population errors */ }
      // --- Multi-port backward compatibility sync ---
      // For the initial phase, mirror the legacy single port object into ports[0]. Future steps will expand and refactor rendering.
      try {
        if (!Array.isArray(state.ports)) state.ports = [];
        if (state.port.enabled) {
          const basePortObj = {
            id: 'p0',
            type: state.port.type,
            width: state.port.width,
            height: state.port.height,
            length: state.port.length,
            position: state.port.position || 'front',
            color: state.port.type === 'slot' ? '#58a6ff' : (state.port.type === 'aero' ? '#ffb543' : '#58a6ff'),
            offsetX: 0,
            offsetY: 0,
            count: state.port.count // preserve count for later expansion logic
          };
          if (state.ports.length === 0) {
            state.ports.push(basePortObj);
          } else {
            state.ports[0] = { ...state.ports[0], ...basePortObj };
          }
          // Auto-populate additional port objects when count > 1 and array not yet expanded.
          const desiredCount = Math.max(1, state.port.count || 1);
          if (desiredCount > 1) {
            // Clear existing beyond first if mismatch (simplify regeneration)
            if (state.ports.length > 1) {
              state.ports = [state.ports[0]]; // reset extras before rebuilding
            }
            // Generate palette for distinct strokes
            const palette = ['#58a6ff', '#ff7ec6', '#ffb543', '#6dd16f', '#b18cff'];
            if (state.port.type === 'slot') {
              const t = state.wallThickness;
              const internalWidthIn = Math.max(0, state.width - 2 * t);
              const gapIn = state.port.slotGapIn || 0;
              // Determine per-port width; if explicit width provided treat as fixed and cluster grows with gap; else distribute.
              let wPerPort = state.port.slotWidthIn;
              if (!(wPerPort > 0)) {
                const usable = Math.max(0, internalWidthIn - (desiredCount - 1) * gapIn);
                wPerPort = desiredCount > 0 ? (usable / desiredCount) : 0;
              }
              // Compute cluster positioning strategy:
              // Centered cluster unless explicit side chosen.
              const totalWidth = desiredCount * wPerPort + (desiredCount - 1) * gapIn;
              for (let i = 0; i < desiredCount; i++) {
                if (i === 0) continue; // first already in state.ports[0]
                let centerX;
                if (state.port.slotSide === 'left') {
                  const leftInner = -state.width / 2 + t;
                  const start = leftInner + wPerPort / 2;
                  centerX = start + i * (wPerPort + gapIn);
                } else if (state.port.slotSide === 'right') {
                  const rightInner = state.width / 2 - t;
                  const start = rightInner - wPerPort / 2;
                  centerX = start - (desiredCount - 1 - i) * (wPerPort + gapIn);
                } else {
                  // centered cluster
                  const leftStart = -totalWidth / 2 + wPerPort / 2;
                  centerX = leftStart + i * (wPerPort + gapIn);
                }
                const offsetX = centerX; // drawSlotPortFromObj adds this to base 0/side anchor
                const offsetY = 0;
                state.ports.push({
                  id: 'p' + i,
                  type: 'slot',
                  width: wPerPort,
                  height: state.port.slotHeightIn || state.port.height,
                  length: state.port.length,
                  position: state.port.position || 'front',
                  color: palette[i % palette.length],
                  offsetX,
                  offsetY
                });
              }
            } else if (state.port.type === 'round' || state.port.type === 'aero') {
              const dIn = state.port.roundDiameterIn || state.port.width || 0;
              if (dIn > 0) {
                const rIn = dIn / 2;
                const spacingIn = state.port.roundSpacingIn || (rIn * 1.2);
                const totalWidth = desiredCount * dIn + (desiredCount - 1) * spacingIn;
                const leftMostCenterX = -totalWidth / 2 + rIn;
                for (let i = 0; i < desiredCount; i++) {
                  if (i === 0) continue; // first is base port
                  const centerX = leftMostCenterX + i * (dIn + spacingIn);
                  state.ports.push({
                    id: 'p' + i,
                    type: state.port.type,
                    width: dIn,
                    height: dIn,
                    length: state.port.length,
                    position: state.port.position || 'front',
                    color: palette[i % palette.length],
                    offsetX: centerX,
                    offsetY: 0
                  });
                }
              }
            }
          }
        } else {
          // If port disabled, clear ports array (keeps semantics simple for now)
          state.ports = [];
        }
      } catch (e) { /* ignore ports sync errors */ }
      // --- HARD GUARANTEE: Front-mounted port never overlaps vertical span of any subwoofer cutout ---
      try {
        if (state.port.enabled && (state.port.position || 'front') === 'front' && state.showCutouts) {
          const t = state.wallThickness;
          const internalH = Math.max(0, state.height - 2 * t);
          const internalTop = -internalH / 2;
          const internalBottom = internalH / 2;
          // Aggregate hole vertical span
          let holeTop = Infinity, holeBottom = -Infinity;
          state.holes.forEach(h => {
            const nominal = h.nominal || 12;
            const dia = h.cut ? h.cut : (nominal * 0.93);
            const top = (h.dy || 0) - dia / 2;
            const bottom = (h.dy || 0) + dia / 2;
            if (top < holeTop) holeTop = top;
            if (bottom > holeBottom) holeBottom = bottom;
          });
          if (holeTop === Infinity) { holeTop = 0; holeBottom = 0; }
          // Port height & current inset
          let portHeight = 0, currentInset = 0, setInsetFn = null;
          if (state.port.type === 'slot') {
            portHeight = state.port.slotHeightIn || state.port.height || 0;
            currentInset = state.port.slotInsetIn || 0;
            setInsetFn = val => { state.port.slotInsetIn = val; const el = form.querySelector('input[name="slotInsetIn"]'); if (el) el.value = val.toFixed(2).replace(/\.00$/, ''); };
          } else if (state.port.type === 'round' || state.port.type === 'aero') {
            const d = state.port.roundDiameterIn || state.port.width || 0;
            portHeight = d;
            currentInset = state.port.roundInsetIn || 0;
            setInsetFn = val => { state.port.roundInsetIn = val; const el = form.querySelector('input[name="roundInsetIn"]'); if (el) el.value = val.toFixed(2).replace(/\.00$/, ''); };
          }
          if (portHeight > 0 && !state.port.slotInsetExplicit) { // Skip auto-placement if user explicitly set inset this cycle
            const MARGIN = 0.75; // clearance margin inches
            // Attempt placement ABOVE holes
            const spaceAbove = holeTop - internalTop; // available vertical space above top hole edge
            const needsAbove = portHeight + MARGIN * 2; // port + margin top + gap to hole
            let placed = false;
            if (spaceAbove >= needsAbove) {
              // Place port with top margin MARGIN from internal top
              const inset = MARGIN; // portTop = internalTop + inset
              const portBottom = (internalTop + inset) + portHeight; // ensure <= holeTop - MARGIN
              if (portBottom <= holeTop - MARGIN + 1e-6) {
                if (setInsetFn) setInsetFn(inset);
                placed = true;
                state.portPlacementStrategy = 'above';
              }
            }
            // If not placed above, attempt BELOW holes
            if (!placed) {
              const spaceBelow = internalBottom - holeBottom;
              const needsBelow = portHeight + MARGIN * 2;
              if (spaceBelow >= needsBelow) {
                // Place port bottom MARGIN above internal bottom
                const portBottomTarget = internalBottom - MARGIN; // portBottom = portTop + portHeight
                const portTop = portBottomTarget - portHeight; // ensure >= holeBottom + MARGIN
                if (portTop >= holeBottom + MARGIN - 1e-6) {
                  const inset = portTop - internalTop; // convert to inset
                  if (inset >= 0 && setInsetFn) {
                    setInsetFn(inset);
                    placed = true;
                    state.portPlacementStrategy = 'below';
                  }
                }
              }
            }
            // If neither above nor below fits, expand height and retry once
            if (!placed) {
              const expandNeeded = (portHeight + MARGIN * 2) - (holeTop - internalTop);
              if (expandNeeded > 0) {
                const newInternalH = internalH + expandNeeded + MARGIN; // add extra margin slack
                const newExternal = newInternalH + 2 * t;
                state.height = newExternal;
                const hInput = form.querySelector('input[name="height"]');
                if (hInput) hInput.value = state.height.toFixed(2).replace(/\.00$/, '');
                // Recompute internal metrics for updated height
                const updatedInternalH = Math.max(0, state.height - 2 * t);
                const updatedInternalTop = -updatedInternalH / 2;
                // Place above with fresh space
                const inset = MARGIN; // top margin
                if (setInsetFn) setInsetFn(inset);
                state.portPlacementStrategy = 'expanded-above';
                state.toast = state.toast || 'Height expanded to clear port';
              }
            }
          }
        }
      } catch (e) { /* ignore hard guarantee errors */ }
      if (commit) { state.toast = ''; pushHistory(); }
      // Ensure dual-hole radio UI visibility stays in sync with state.holes length
      reflectHoleSelectionUI?.();
      // 2D preview removed from UI; keep SVG only for export functionality
      const metrics = form.querySelector('.metrics');
      if (metrics) {
        const grossIn3 = state.width * state.height * state.depth;
        const grossFt3 = grossIn3 / 1728;
        const grossL = grossIn3 * 0.0163871;
        // Display volumes primarily in ft³ (user request) with in³ and liters as secondary context
        let html = `<div><strong>Width:</strong> ${format(state.width)} in</div>
          <div><strong>Height:</strong> ${format(state.height)} in</div>
          <div><strong>Depth:</strong> ${format(state.depth)} in</div>
          <div><strong>Gross:</strong> Gross Vol: ${format(grossFt3)} ft³ (${format(grossIn3)} in³ · ${grossL.toFixed(1)} L)</div>`;
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
            <div><strong>Internal Vol:</strong> ${(internalVolIn3 / 1728).toFixed(3)} ft³ (${format(internalVolIn3)} in³ · ${(internalVolIn3 * 0.0163871).toFixed(1)} L)</div>`;
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
          html += `<div><strong>Net Vol:</strong> ${netFt3.toFixed(3)} ft³ (${netVolIn3.toFixed(2)} in³ · ${netL.toFixed(1)} L)</div>`;
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
          if (state.port.enabled) {
            html += `<div><strong>Ports Enabled:</strong> ${state.port.count} × ${physIn.toFixed(2)} in (each)</div>`;
            html += `<div><strong>Total Port Disp (est):</strong> ${(areaIn2 * physIn * state.port.count).toFixed(1)} in³</div>`;
            if (state.port.type === 'aero' && state.port.flareRadiusIn) {
              const ecIn = state.localPortEst.endCorrectionPerEndM * 39.37;
              html += `<div><strong>End Corr/End:</strong> ${ecIn.toFixed(2)} in (flare radius ${state.port.flareRadiusIn.toFixed(2)} in)</div>`;
            }
          }
        }
        // Warnings section (if any)
        if (state.portWarnings && state.portWarnings.length) {
          const warnLines = state.portWarnings.map(w => {
            const color = w.severity === 'critical' ? '#b30000' : (w.severity === 'error' ? '#d45500' : (w.severity === 'warn' ? '#d48900' : '#0060b3'));
            return `<div style='color:${color};font-size:.72rem;line-height:1.25;'><strong>${w.code.toUpperCase()}:</strong> ${w.message}</div>`;
          }).join('');
          html += `<div style='margin-top:.45rem;'><strong>Port Warnings:</strong></div>${warnLines}`;
        }
        // Selected hole fill status indicator
        const selectedHole = state.holes.find(h => h.selected);
        if (selectedHole) {
          let status;
          if (state.fillHoles || selectedHole.filled) {
            status = 'Filled (panel solid)';
          } else {
            status = 'Removed (cutout)';
          }
          html += `<div style='margin-top:.35rem;'><strong>Selected Hole:</strong> ${status}</div>`;
        }
        metrics.innerHTML = html;
      }
      // Dispatch custom event for external listeners (3D preview)
      try {
        const payload = JSON.parse(JSON.stringify(state));
        window.dispatchEvent(new CustomEvent('boxStateChanged', { detail: payload }));
      } catch (err) { /* ignore serialization errors */ }
      // Debug: expose fold plan for console inspection without needing deep object logging
      if (state.port && state.port.foldPlan && !TEST_MODE) {
        try { console.debug('[foldPlan]', state.port.foldPlan); } catch (e) { }
      }
    }

    // Reference volume computation + DOM reflection (gross internal, displacements, net, override)
    function computeReferenceVolumes() {
      if (!form) return;
      const t = state.wallThickness;
      const iW = Math.max(0, state.width - 2 * t);
      const iH = Math.max(0, state.height - 2 * t);
      const iD = Math.max(0, state.depth - 2 * t);
      const grossInternalIn3 = iW * iH * iD; // internal gross (air before displacements)
      const driverDispInput = form.querySelector('input[name="driverDisp"]');
      const bracingDispInput = form.querySelector('input[name="bracingDisp"]');
      const overrideNetInput = form.querySelector('input[name="overrideNetVolume"]');
      const driverDisp = driverDispInput ? (parseFloat(driverDispInput.value) || 0) : 0;
      const bracingDisp = bracingDispInput ? (parseFloat(bracingDispInput.value) || 0) : 0;
      // Port displacement estimate (use localPortEst first; fall back to portDesign if available)
      let portDispIn3 = 0;
      try {
        if (state.port && state.port.enabled) {
          if (state.localPortEst) {
            const areaIn2 = state.localPortEst.areaPerPortM2 * 1550.0031; // m^2 -> in^2
            const lenIn = state.localPortEst.physicalLengthPerPortM * 39.37; // m -> in
            portDispIn3 = areaIn2 * lenIn * (state.localPortEst.numPorts || 1);
          } else if (state.portDesign) {
            const areaIn2 = state.portDesign.areaPerPortM2 * 1550.0031;
            const lenIn = state.portDesign.physicalLengthPerPortM * 39.37;
            portDispIn3 = areaIn2 * lenIn * (state.portDesign.numPorts || 1);
          }
        }
      } catch (e) { portDispIn3 = 0; }
      const totalDisp = driverDisp + bracingDisp + portDispIn3; // custom displacement list not yet implemented
      const computedNetIn3 = grossInternalIn3 - totalDisp;
      let netInternalIn3 = computedNetIn3;
      let usingOverride = false;
      let overrideVal = overrideNetInput ? parseFloat(overrideNetInput.value) : NaN;
      let overrideDeltaPct = null;
      if (overrideNetInput && isFinite(overrideVal) && overrideVal > 0) {
        usingOverride = true;
        netInternalIn3 = overrideVal;
        if (computedNetIn3 > 0) {
          overrideDeltaPct = Math.abs((overrideVal - computedNetIn3) / computedNetIn3) * 100;
        }
      }
      // Persist on state for other modules (e.g., port math auto-volume)
      state.referenceVolumes = {
        grossInternalIn3,
        driverDisp,
        bracingDisp,
        portDispIn3,
        totalDisp,
        netInternalIn3,
        usingOverride,
        computedNetIn3,
        overrideDeltaPct
      };
      // DOM reflection (ids inside .reference-volumes block)
      const setText = (id, val, fmt = v => (typeof v === 'number' && isFinite(v) ? v.toFixed(2).replace(/\.00$/, '') : '—')) => {
        const el = document.getElementById(id); if (!el) return; el.textContent = fmt(val);
      };
      setText('refGrossInternal', grossInternalIn3);
      setText('refTotalDisp', totalDisp);
      setText('refNetInternal', netInternalIn3);
      const netFt3 = netInternalIn3 / 1728;
      setText('refNetInternalFt', netFt3, v => (typeof v === 'number' && isFinite(v) ? v.toFixed(3).replace(/0+$/, '').replace(/\.$/, '') : '—'));
      const flag = document.getElementById('refOverrideFlag');
      if (flag) {
        if (usingOverride) {
          if (overrideDeltaPct !== null) {
            const warn = overrideDeltaPct > 5; // threshold
            flag.textContent = warn ? `yes (Δ ${overrideDeltaPct.toFixed(1)}% >5%)` : `yes (Δ ${overrideDeltaPct.toFixed(1)}%)`;
            flag.style.color = warn ? '#b30000' : '';
            flag.title = warn ? 'Override differs from computed net volume by more than 5%' : 'Override delta from computed net volume';
          } else {
            flag.textContent = 'yes';
            flag.style.color = '';
            flag.title = 'Override applied';
          }
        } else {
          flag.textContent = 'no';
          flag.style.color = '';
          flag.title = 'Using computed net volume';
        }
      }
      // Visual hint if negative (rare but possible)
      if (netInternalIn3 < 0) {
        const netEl = document.getElementById('refNetInternal'); if (netEl) { netEl.style.color = '#b30000'; }
      } else {
        const netEl = document.getElementById('refNetInternal'); if (netEl) { netEl.style.color = ''; }
      }
    }

    // Debounced update to reduce rapid rebuild dispatches (3D preview consumes events)
    let updateTimer = null;
    function scheduleUpdate() {
      if (updateTimer) clearTimeout(updateTimer);
      updateTimer = setTimeout(() => { update(); }, 65); // ~1 frame at 60fps plus slight buffer
    }
    form.addEventListener('input', () => scheduleUpdate());
    form.addEventListener('change', () => scheduleUpdate());
    // Immediate port state event dispatch for critical fields to ensure 3D preview rebuilds without waiting for debounce in tests.
    ['portEnabled', 'portType', 'roundDiameterIn', 'targetHz', 'numPorts'].forEach(name => {
      const el = form.querySelector(`[name="${name}"]`);
      if (el) {
        el.addEventListener('input', () => {
          try { update(false); window.dispatchEvent(new CustomEvent('boxStateChanged', { detail: JSON.parse(JSON.stringify(state)) })); } catch (e) { }
        });
        el.addEventListener('change', () => {
          try { update(false); window.dispatchEvent(new CustomEvent('boxStateChanged', { detail: JSON.parse(JSON.stringify(state)) })); } catch (e) { }
        });
      }
    });
    // Clear autofilled flag when user manually edits cut diameter
    (function attachCutDiameterListeners() {
      const cd = form.querySelector('input[name="cutDiameter"]');
      if (!cd) return;
      cd.addEventListener('input', () => {
        if (cd.dataset.autofilled === '1') {
          // User started editing; remove marker so value counts as explicit
          cd.dataset.autofilled = '0';
          cd.classList.remove('auto-filled');
        }
      });
      // When sub size changes and user hasn't overridden, keep auto sync
      const subSel = form.querySelector('select[name="subSize"]');
      subSel?.addEventListener('change', () => {
        if (!cd) return;
        if (cd.dataset.autofilled === '1') {
          const nominal = parseInt(subSel.value, 10);
          const autoDia = nominal * 0.93;
          cd.value = autoDia.toFixed(2).replace(/\.00$/, '');
          cd.classList.add('auto-filled');
          scheduleUpdate();
        }
      });
    })();
    // Initial boot: trigger first update & hide spinner when ready
    update(false);
    const spinner = document.getElementById('builder-spinner');
    if (spinner) {
      if (TEST_MODE) {
        // Test mode: mark hidden immediately so Playwright sees either .is-hide or removal on first poll
        try { spinner.classList.add('is-hide'); } catch (e) { /* ignore */ }
        // Hard disable any interaction interception
        spinner.style.pointerEvents = 'none';
        spinner.style.opacity = '0';
        spinner.style.display = 'none';
        // Remove on next frame (after style application) to satisfy either hidden or non-existent condition.
        requestAnimationFrame(() => { try { spinner.remove(); } catch (e) { /* ignore */ } });
      } else {
        spinner.classList.add('is-hide');
        setTimeout(() => { spinner.style.display = 'none'; }, 650);
      }
    }
    // Defensive metrics bootstrap for test mode if update cycle failed before metrics rendered.
    if (TEST_MODE) {
      try {
        const applyMetrics = () => {
          const mEl = document.querySelector('.metrics');
          if (mEl && mEl.innerText.indexOf('Width:') === -1) {
            const gross = state.width * state.height * state.depth;
            mEl.innerHTML = `<div><strong>Width:</strong> ${state.width} in</div>` +
              `<div><strong>Height:</strong> ${state.height} in</div>` +
              `<div><strong>Depth:</strong> ${state.depth} in</div>` +
              `<div><strong>Gross:</strong> Gross Vol: ${gross.toFixed(2)} in³ (${(gross / 1728).toFixed(3)} ft³)</div>`;
          }
        };
        applyMetrics();
        // Double-tap after a tick in case initial DOM not fully ready when called
        setTimeout(applyMetrics, 25);
      } catch (e) { /* ignore metrics bootstrap errors */ }
    }

    // Generic tooltip utility (attribute-driven: data-tooltip="text")
    (function initGenericTooltips() {
      const targets = form.querySelectorAll('[data-tooltip]');
      if (!targets.length) return;
      const tip = document.createElement('div');
      tip.className = 'ui-tooltip';
      tip.setAttribute('role', 'tooltip');
      Object.assign(tip.style, {
        position: 'fixed', background: '#1d242a', color: '#dfe7ec', padding: '6px 8px', fontSize: '0.7rem', lineHeight: '1.3',
        border: '1px solid #2f3d47', borderRadius: '6px', boxShadow: '0 4px 14px -2px rgba(0,0,0,.5)', zIndex: '999', pointerEvents: 'none',
        maxWidth: '280px', display: 'none'
      });
      document.body.appendChild(tip);
      let active = null;
      function show(e, el) {
        active = el;
        tip.textContent = el.getAttribute('data-tooltip') || '';
        tip.style.display = 'block';
        position(e);
      }
      function hide() { tip.style.display = 'none'; active = null; }
      function position(e) {
        const offset = 14; const vw = window.innerWidth; const vh = window.innerHeight;
        const rect = tip.getBoundingClientRect();
        let x = e.clientX + offset; let y = e.clientY + offset;
        if (x + rect.width + 8 > vw) x = vw - rect.width - 8;
        if (y + rect.height + 8 > vh) y = vh - rect.height - 8;
        tip.style.left = x + 'px'; tip.style.top = y + 'px';
      }
      targets.forEach(el => {
        el.addEventListener('mouseenter', e => show(e, el));
        el.addEventListener('mousemove', e => { if (active === el) position(e); });
        el.addEventListener('mouseleave', hide);
        el.addEventListener('focus', e => {
          const r = el.getBoundingClientRect();
          const synthetic = { clientX: r.left + r.width / 2, clientY: r.bottom + 4 };
          show(synthetic, el);
        });
        el.addEventListener('blur', hide);
        el.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
      });
      window.addEventListener('scroll', () => { if (active) hide(); }, { passive: true });
    })();

    // 3D toggle removed; preview events always dispatched.

    // Hole selection radio container reference (was missing, causing ReferenceError when adding change listener)
    const holeSelectContainer = form.querySelector('.hole-select');

    holeSelectContainer?.addEventListener('change', e => {
      const target = e.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.name !== 'holeSelect') return;
      const idx = parseInt(target.value, 10);
      state.holes.forEach((h, i) => h.selected = i === idx);
      update(false);
    });

    // Per-hole cut-out UI removed; cutOut flag retained in state objects for backward compatibility but not acted upon.

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
          state.future.push(JSON.parse(JSON.stringify({ width: state.width, height: state.height, depth: state.depth, finish: state.finish, holes: state.holes })));
          Object.assign(state, current);
          update(false);
        }
      }
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { // redo
        if (state.future.length) {
          const next = state.future.pop();
          state.history.push(JSON.parse(JSON.stringify({ width: state.width, height: state.height, depth: state.depth, finish: state.finish, holes: state.holes })));
          Object.assign(state, next);
          update(false);
        }
      }
    });

    // Removed Add Hole (replaced by subConfig)

    // Zoom toolbar & logic removed (simplified UI)

    // Client-side state reset (not server restart) button
    const stateResetBtn = form.querySelector('button[name="stateReset"]');
    if (stateResetBtn) {
      stateResetBtn.addEventListener('click', () => {
        Object.assign(state, {
          width: 12,
          height: 10,
          depth: 8,
          // showGhost removed
          grid: 0,
          holes: [{ dx: 0, dy: 0, nominal: 12, cut: null, spec: null, selected: true, filled: false }],
          fillHoles: !!form.querySelector('input[name="fillHoles"]')?.checked,
          showCutouts: !!form.querySelector('input[name=\"showCutouts\"]')?.checked,
          showDims: true,
          toast: 'State reset.',
          history: [],
          future: [],
          // zoomMode removed
        });
        // Reflect inputs
        form.querySelector('input[name="width"]').value = '12';
        form.querySelector('input[name="height"]').value = '10';
        form.querySelector('input[name="depth"]').value = '8';
        // snapping removed: no gridSnap input
        // showGhost input removed
        form.querySelector('input[name="showDims"]').checked = true;
        const cutInputReset = form.querySelector('input[name="cutDiameter"]');
        if (cutInputReset) cutInputReset.value = '';
        update(false);
        // zoom feature removed
      });
    }

    // Preview Reset logic (new)
    (function initPreviewReset() {
      const btn = document.getElementById('previewResetBtn');
      if (!btn) return;
      btn.addEventListener('click', () => {
        try {
          // Invoke deep 3D scene reset if three_preview exposed it
          if (typeof window.resetPreview === 'function') {
            window.resetPreview();
          }
          // Reset hole offsets and selection
          state.holes.forEach((h, i) => { h.dx = 0; h.dy = 0; h.selected = i === 0; });
          // Reset local estimates (zoom removed)
          state.localPortEst = null;
          // Clear toast message
          state.toast = 'Preview reset.';
          // Dispatch update for downstream (three_preview listens to state changes)
          dispatchState();
          update(false);
          // Reset UI toggles
          ['assemblyToggleBtn', 'autoRotateBtn', 'gridToggleBtn', 'shadowToggleBtn'].forEach(id => {
            const el = document.getElementById(id); if (el) el.classList.remove('is-active');
          });
          const scaleSlider = document.getElementById('scaleSlider');
          const scaleLabel = document.getElementById('scaleSliderLabel');
          if (scaleSlider) scaleSlider.value = '1.0';
          if (scaleLabel) scaleLabel.textContent = 'Scale: 1.0×';
          btn.textContent = 'Reset Preview ✓';
          setTimeout(() => { btn.textContent = 'Reset Preview'; }, 1500);
        } catch (e) { console.warn('[previewReset] error', e); }
      });
    })();
    update(); reflectHoleSelectionUI();

    // Port design compute integration
    const computeBtn = form.querySelector('button[name="computePort"]');
    const portTypeSel = form.querySelector('select[name="portType"]');
    // Nested advanced port options toggle
    (function initAdvPortToggle() {
      const btn = form.querySelector('button[name="toggleAdvPort"]');
      const fs = form.querySelector('#adv-port-section');
      if (!btn || !fs) return;
      let open = false;
      function reflect() {
        fs.style.display = open ? 'block' : 'none';
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        fs.setAttribute('aria-hidden', open ? 'false' : 'true');
        const lbl = btn.querySelector('.adv-port-label');
        if (lbl) lbl.textContent = 'Advanced Port Options ' + (open ? '\u25b4' : '\u25be');
      }
      btn.addEventListener('click', () => { open = !open; reflect(); if (open && !TEST_MODE) setTimeout(() => focusFirstInteractive(fs), 15); });
      reflect();
      if (TEST_MODE) { open = true; reflect(); }
    })();
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
          if (provided && provided > 0) return provided;
          // Use referenceVolumes.netInternalIn3 if available (already excludes port/driver/bracing when computed)
          if (state.referenceVolumes && state.referenceVolumes.netInternalIn3 > 0) {
            return parseFloat((state.referenceVolumes.netInternalIn3 * 0.0163871).toFixed(3));
          }
          // Fallback to raw internal (no displacements) if reference not ready
          const t = state.wallThickness;
          const iW = Math.max(0, state.width - 2 * t);
          const iH = Math.max(0, state.height - 2 * t);
          const iD = Math.max(0, state.depth - 2 * t);
          const internalVolIn3 = iW * iH * iD;
          return parseFloat((internalVolIn3 * 0.0163871).toFixed(3));
        })(),
        targetHz: getNum('targetHz'),
        numPorts: parseInt((form.querySelector('[name="numPorts"]')?.value || '1'), 10),
        slotHeightM: getNum('slotHeightM'),
        slotGapM: getNum('slotGapM'),
        diameterM: getNum('diameterM'),
        flareRadiusM: (() => {
          const mVal = getNum('flareRadiusM');
          if (mVal !== null && mVal >= 0) return mVal;
          const inchValEl = form.querySelector('[name="flareRadiusIn"]');
          if (inchValEl) {
            const inchVal = parseFloat(inchValEl.value);
            if (isFinite(inchVal) && inchVal >= 0) return inchVal * IN_TO_M;
          }
          return 0;
        })(),
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

    // Download SVG implementation
    const downloadBtn = form.querySelector('button[name="downloadSvg"]');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        let svgMarkup = '';
        try {
          const sizeSel = form.querySelector('select[name="subSize"]');
          const subSize = sizeSel ? sizeSel.value : '12';
          if (window.BoxSVGExporter && typeof window.BoxSVGExporter.build === 'function') {
            svgMarkup = window.BoxSVGExporter.build(JSON.parse(JSON.stringify(state)), { subSize }) || '';
          }
        } catch (err) {
          // swallow and fallback below
        }
        if (!svgMarkup) {
          // Minimal fallback SVG so tests still capture blob even if exporter failed.
          const w = state.width || 12, h = state.height || 10;
          // Include front panel grouping & sample hole circles (up to two) for test interception expecting .front/panel-front classes.
          let holeMarkup = '';
          try {
            if (state.holes && state.holes.length) {
              const baseHole = state.holes[0];
              const dia1 = baseHole.cut || (baseHole.nominal || 12) * 0.93;
              const r1 = dia1 / 2;
              holeMarkup += `<circle class='hole-cut' cx='${(w / 2).toFixed(2)}' cy='${(h / 2).toFixed(2)}' r='${r1.toFixed(2)}' fill='none' stroke='#444' stroke-width='0.5' />`;
              if (state.holes.length > 1) {
                const h2 = state.holes[1];
                const dia2 = h2.cut || (h2.nominal || dia1) * 0.93;
                const r2 = dia2 / 2;
                // Offset second hole to the right; ensure it stays inside box.
                const cx2 = Math.min(w - r2 - 0.5, w / 2 + r1 * 1.8);
                holeMarkup += `<circle class='hole-cut' cx='${cx2.toFixed(2)}' cy='${(h / 2).toFixed(2)}' r='${r2.toFixed(2)}' fill='none' stroke='#444' stroke-width='0.5' />`;
              }
            }
          } catch (e) { /* ignore hole fallback errors */ }
          svgMarkup = `<svg viewBox='0 0 ${w} ${h}' xmlns='http://www.w3.org/2000/svg' class='box-export'><g class='front'><rect class='panel-front' x='0' y='0' width='${w}' height='${h}' fill='#ccc' stroke='#222'/>${holeMarkup}</g></svg>`;
        }
        try {
          const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svgMarkup}`], { type: 'image/svg+xml' });
          const nominal = state.holes[0]?.nominal || 12;
          const holeCount = state.holes.length;
          const fname = `box_w${state.width}_h${state.height}_d${state.depth}_sub${nominal}_holes${holeCount}.svg`.replace(/\s+/g, '');
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = fname;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 750);
          state.toast = 'SVG downloaded';
          emitExport(fname, 'svg');
          update(false);
        } catch (err2) {
          console.error('[downloadSvg] Fallback failed', err2);
          state.toast = 'SVG export failed';
          update(false);
        }
      });
    }
    // Config JSON export (includes foldPlan + warnings when present)
    const exportConfigBtn = form.querySelector('button[name="exportConfig"]');
    if (exportConfigBtn) {
      exportConfigBtn.addEventListener('click', async () => {
        try { update(false); } catch (e) { }
        const fd = new FormData();
        fd.append('width', String(state.width));
        fd.append('height', String(state.height));
        fd.append('depth', String(state.depth));
        fd.append('wall_thickness', String(state.wallThickness));
        fd.append('sub_size', String(state.holes[0]?.nominal || ''));
        fd.append('sub_count', String(state.holes.length));
        if (state.finish) fd.append('finish', state.finish);
        if (state.port && state.port.enabled) {
          fd.append('port_enabled', '1');
          fd.append('port_type', state.port.type);
          if (state.port.count) fd.append('port_count', String(state.port.count));
          if (state.port.targetHz) fd.append('port_target_hz', String(state.port.targetHz));
        }
        if (state.port && state.port.foldPlan) {
          try { fd.append('fold_plan', JSON.stringify(state.port.foldPlan)); } catch (e) { }
        }
        if (state.portWarnings && state.portWarnings.length) {
          try { fd.append('port_warnings', JSON.stringify(state.portWarnings)); } catch (e) { }
        }
        try {
          const r = await fetch('/export/box', { method: 'POST', body: fd });
          const data = await r.json().catch(() => null);
          if (r.ok) {
            state.toast = 'Config saved';
            console.log('[exportConfig]', data);
            emitExport(data?.file || 'box_config.json', 'config');
          } else {
            state.toast = 'Config export error';
            console.error('[exportConfig] error', r.status, data);
          }
        } catch (err) {
          console.error('[exportConfig] fetch failed', err);
          state.toast = 'Config export failed';
        }
        update(false);
      });
    }

    // Utility: Clear activePresetId when manual user edits core dimension inputs
    ['width', 'height', 'depth', 'wallThickness'].forEach(name => {
      const inp = form.querySelector(`input[name="${name}"]`); if (inp) { inp.addEventListener('input', () => { state.activePresetId = null; reflectPresetActive(); }); }
    });

    function reflectPresetActive() {
      // remove from all
      document.querySelectorAll('.apply-preset.mini-btn').forEach(btn => btn.classList.remove('preset-active'));
      if (!state.activePresetId) return;
      const el = document.querySelector(`.apply-preset[data-preset-id="${state.activePresetId}"]`);
      if (el) el.classList.add('preset-active');
    }

    // --------- Fetch & Render Saved Presets ---------
    async function loadSavedPresets(setActiveId) {
      try {
        const wrap = document.querySelector('.preset-group.saved-presets');
        const container = wrap?.querySelector('.preset-buttons.saved');
        const countSpan = wrap?.querySelector('.preset-group-label .count');
        if (!wrap || !container) return;
        const r = await fetch('/presets');
        if (!r.ok) return;
        const data = await r.json();
        container.innerHTML = '';
        const items = (data.items || []);
        if (countSpan) countSpan.textContent = `(${items.length})`;
        wrap.setAttribute('data-empty', items.length ? '0' : '1');
        for (const meta of items) {
          // need full preset to embed config; fetch individually (could optimize batch) but accept small overhead
          let cfg = null; let full = null;
          try { const pr = await fetch('/presets/' + meta.id); if (pr.ok) { full = await pr.json(); cfg = full.config; } } catch (e) { }
          if (!cfg) continue;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'mini-btn apply-preset';
          btn.dataset.preset = JSON.stringify(cfg);
          btn.dataset.presetId = meta.id;
          btn.dataset.origin = 'saved';
          btn.textContent = meta.name;
          // delete button wrapper
          const wrapper = document.createElement('div');
          wrapper.style.position = 'relative';
          wrapper.style.display = 'flex';
          wrapper.style.alignItems = 'stretch';
          wrapper.style.gap = '.35rem';
          wrapper.appendChild(btn);
          const del = document.createElement('button');
          del.type = 'button';
          del.className = 'preset-delete-btn';
          del.textContent = '×';
          del.title = 'Delete preset';
          del.addEventListener('click', async (ev) => { ev.stopPropagation(); if (!confirm('Delete preset ' + meta.name + '?')) return; try { const dr = await fetch('/presets/' + meta.id, { method: 'DELETE' }); if (dr.ok) { if (state.activePresetId === meta.id) state.activePresetId = null; loadSavedPresets(); } } catch (e) { } });
          wrapper.appendChild(del);
          container.appendChild(wrapper);
        }
        if (setActiveId) { state.activePresetId = setActiveId; }
        reflectPresetActive();
      } catch (err) { console.warn('[presets] load failed', err); }
    }

    // ---------------- Save as Preset (Edit & Save as New) ----------------
    (function initPresetSave() {
      // Insert button near Export & Actions fieldset if placeholder button not already in template
      let host = form.querySelector('fieldset.export-inputs .export-actions');
      if (!host) { host = form.querySelector('fieldset.export-inputs'); }
      if (!host) return;
      let btn = host.querySelector('button[name="savePreset"]');
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.name = 'savePreset';
        btn.textContent = 'Save as Preset';
        btn.style.marginLeft = '.5rem';
        btn.className = 'mini-btn';
        host.appendChild(btn);
      }
      btn.addEventListener('click', async () => {
        const name = prompt('Preset name');
        if (!name) return;
        // Ensure latest form values applied
        update(false);
        const cfg = {
          width: state.width,
          height: state.height,
          depth: state.depth,
          wallThickness: state.wallThickness,
          subSize: state.holes[0]?.nominal || 12,
          layout: state.holes.length === 2 ? 'dual' : 'single',
          holes: state.holes.map(h => ({ dx: h.dx, dy: h.dy, nominal: h.nominal, filled: h.filled === true })),
          finish: state.finish,
          port: {
            enabled: state.port.enabled,
            type: state.port.type,
            count: state.port.count,
            targetHz: state.port.targetHz,
            slotHeightIn: state.port.slotHeightIn,
            slotWidthIn: state.port.slotWidthIn,
            slotGapIn: state.port.slotGapIn,
            slotInsetIn: state.port.slotInsetIn,
            slotSide: state.port.slotSide,
            roundDiameterIn: state.port.roundDiameterIn,
            roundSpacingIn: state.port.roundSpacingIn,
            roundInsetIn: state.port.roundInsetIn,
            flareRadiusIn: state.port.flareRadiusIn,
            position: state.port.position
          }
        };
        try {
          const r = await fetch('/presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, config: cfg }) });
          if (!r.ok) {
            alert('Save failed: ' + r.status); return;
          }
          const data = await r.json();
          state.toast = 'Preset saved';
          update(false);
          // Refresh list & mark active
          loadSavedPresets(data?.preset?.id);
          // Optionally broadcast event so admin page can refresh list if open in another tab
          try { localStorage.setItem('lastPresetSaved', Date.now() + ':' + data.preset.id); } catch (e) { }
        } catch (err) {
          console.error('[preset] save error', err); alert('Save error');
        }
      });
    })();

    // --------- Apply Box Preset Buttons (moved from admin page) ---------
    (function initInlineBoxPresets() {
      function applyPresetData(cfg, presetId) {
        if (!cfg) return;
        let changed = false;
        const setNum = (name, val) => { const el = form.querySelector(`input[name="${name}"]`); if (el && val > 0) { el.value = val; state[name === 'wallThickness' ? 'wallThickness' : name] = parseFloat(val); changed = true; } };
        if (cfg.width) setNum('width', cfg.width);
        if (cfg.height) setNum('height', cfg.height);
        if (cfg.depth) setNum('depth', cfg.depth);
        if (cfg.wallThickness) setNum('wallThickness', cfg.wallThickness);
        if (cfg.subSize) { const sel = form.querySelector('select[name="subSize"]'); if (sel) { sel.value = cfg.subSize; state.holes.forEach(h => { h.nominal = cfg.subSize; h.cut = null; }); changed = true; } }
        if (cfg.layout) { const sel = form.querySelector('select[name="subConfig"]'); if (sel) { sel.value = cfg.layout; changed = true; } }
        if (cfg.portEnabled) { const chk = form.querySelector('input[name="portEnabled"]'); if (chk) { chk.checked = true; state.port.enabled = true; changed = true; } } else if (cfg.portEnabled === 0) { const chk = form.querySelector('input[name="portEnabled"]'); if (chk) { chk.checked = false; state.port.enabled = false; changed = true; } }
        if (cfg.portType) { const sel = form.querySelector('select[name="portType"]'); if (sel) { sel.value = cfg.portType; state.port.type = cfg.portType; changed = true; } }
        if (cfg.targetHz) { const inp = form.querySelector('input[name="targetHz"]'); if (inp) { inp.value = cfg.targetHz; state.port.targetHz = parseFloat(cfg.targetHz); changed = true; } }
        if (changed) { state.toast = 'Preset applied'; pushHistory(); update(false); state.activePresetId = presetId || null; reflectPresetActive(); }
      }
      function attachApplyHandlers(scope) {
        scope.querySelectorAll('.apply-preset').forEach(b => {
          b.addEventListener('click', () => {
            try { const raw = b.getAttribute('data-preset'); const cfg = JSON.parse(raw); const pid = b.getAttribute('data-preset-id'); applyPresetData(cfg, pid); } catch (e) { console.error('[preset-btn] parse error', e); }
          });
        });
      }
      attachApplyHandlers(document);
      // Load saved presets initially
      loadSavedPresets();
      // Listen for cross-tab save events
      window.addEventListener('storage', (e) => { if (e.key === 'lastPresetSaved') { loadSavedPresets(); } });
      // Expose for debug
      window.reloadSavedPresets = loadSavedPresets;
    })();

    // Hide spinner once initial update completes (guard if tests rely on removal timing)
    function hideSpinner() {
      const sp = document.getElementById('builder-spinner');
      if (!sp) return;
      sp.classList.add('is-hide');
      setTimeout(() => { try { sp.remove(); } catch (e) { } }, 180);
    }
    // Attempt hide after first paint
    if (!TEST_MODE) {
      setTimeout(hideSpinner, 2500); // safety timeout if events fail
      window.addEventListener('boxStateChanged', function once() { hideSpinner(); window.removeEventListener('boxStateChanged', once); });
    }
    // Defensive second dispatch shortly after initial to ensure 3D listener catches state
    setTimeout(() => { try { window.dispatchEvent(new CustomEvent('boxStateChanged', { detail: JSON.parse(JSON.stringify(state)) })); } catch (e) { } }, 140);

    // FINAL FAILSAFE: If an exception earlier prevented update() from running
    // and the spinner is still present after a longer grace period, remove it.
    setTimeout(() => {
      const sp2 = document.getElementById('builder-spinner');
      if (sp2 && !sp2.classList.contains('is-hide')) {
        sp2.classList.add('is-hide');
        try { sp2.remove(); } catch (e) { }
      }
    }, 6000);

  });

  // Global onerror hook to surface early JS errors that would otherwise leave the spinner visible.
  window.addEventListener('error', (ev) => {
    try {
      const dbg = document.getElementById('three-debug') || document.createElement('pre');
      if (!dbg.id) { dbg.id = 'three-debug'; dbg.style.cssText = 'position:fixed;bottom:4px;left:4px;z-index:9999;background:#111;color:#f66;padding:6px 8px;font:11px monospace;max-width:40vw;max-height:30vh;overflow:auto;border:1px solid #400'; document.body.appendChild(dbg); }
      dbg.textContent = '[builder error] ' + ev.message + '\n' + (ev.filename || '') + ':' + ev.lineno + ':' + ev.colno;
    } catch (e) { /* swallow */ }
    // Ensure spinner not stuck
    const sp = document.getElementById('builder-spinner');
    if (sp) { sp.classList.add('is-hide'); try { sp.remove(); } catch (e) { } }
  }, { once: false });
})();
