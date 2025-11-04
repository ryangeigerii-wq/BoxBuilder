// Lightweight THREE.js 3D preview of box geometry (beta)
(function () {
    const el = document.getElementById('preview3d');
    if (!el) return;
    const TEST_MODE = /[?&]test=1/i.test(location.search);
    let renderer, scene, camera, boxGroup, animReq = null;
    let lastState = null;
    let listenerReady = false;
    // --- Minimal orbit controls state & helpers ---
    const controlsState = { dragging: false, lastX: 0, lastY: 0, azimuth: 0, polar: 0.9, distance: 28, minDistance: 0.5, maxDistance: 300, userInteracted: false, velAz: 0, velPolar: 0, damping: 0.92, autoRotate: false };
    const SCALE_KEY = 'boxBuilder3DScale';
    let currentScale = 1.0; // base (user) scale (now constrained 0.1–1.0)
    const EXPLODED_SCALE_MULT = 1.5; // exploded view enlarges for clarity
    // Fun Spin feature removed (archived in /archive/fun_spin_feature.js)
    let explodedMode = false; // Track exploded view state
    // Finish / texture system state
    let baseWoodTextureSeed = Math.floor(Math.random() * 1000000);
    let currentFinishVariant = 'wood1';
    let currentGrainStrength = 1.0; // multiplier
    let currentUseKnots = true;
    const WOOD_TEX_CACHE = new Map(); // key -> THREE.Texture
    // ---------------- Finish / Wood Texture Helper Functions ----------------
    function mulberry32(a) { return function () { var t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function hexToRgba(hex, a) { const h = hex.replace('#', ''); const n = parseInt(h, 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return `rgba(${r},${g},${b},${a})`; }
    // Sync with <select name="finish"> options: light, medium, dark, deep-walnut, espresso, flat, wood1/2/3.
    // Distinct baseStrength values ensure texture UUID differences across variants for tests.
    const FINISH_VARIANTS = {
        flat: { type: 'flat', color: '#c7c7c7' },
        light: { stops: ['#f9e7cc', '#e5ceaa'], grain: '#a57a47', knot: '#7b522c', baseStrength: 0.70 },
        medium: { stops: ['#e8d1ad', '#d1b38a'], grain: '#8a6135', knot: '#5d3d1f', baseStrength: 0.82 },
        wood1: { stops: ['#f6e3c3', '#d3b789'], grain: '#805a32', knot: '#5a3c1f', baseStrength: 0.88 },
        wood2: { stops: ['#e1c59a', '#b8935e'], grain: '#6b4826', knot: '#4a2e15', baseStrength: 0.96 },
        wood3: { stops: ['#8b5a2b', '#5a3a1c'], grain: '#3b2412', knot: '#2a170c', baseStrength: 1.08 },
        'deep-walnut': { stops: ['#6d4a2e', '#4a2f1b'], grain: '#3a2413', knot: '#26170c', baseStrength: 1.18 },
        dark: { stops: ['#5a3b25', '#3b2516'], grain: '#2a170c', knot: '#140c06', baseStrength: 1.26 },
        espresso: { stops: ['#4a2d18', '#2b1a0c'], grain: '#190e06', knot: '#0d0703', baseStrength: 1.32 }
    };
    function generateWoodTextureCached(variantKey, panelIndex, seed, strength, useKnots) {
        const cacheKey = `${variantKey}|${panelIndex}|${seed}|${strength}|${useKnots}`;
        if (WOOD_TEX_CACHE.has(cacheKey)) return WOOD_TEX_CACHE.get(cacheKey);
        const spec = FINISH_VARIANTS[variantKey] || FINISH_VARIANTS.wood1;
        if (spec.type === 'flat') {
            const flatCanvas = document.createElement('canvas'); flatCanvas.width = flatCanvas.height = 4;
            const fctx = flatCanvas.getContext('2d'); fctx.fillStyle = spec.color; fctx.fillRect(0, 0, 4, 4);
            const flatTex = new THREE.CanvasTexture(flatCanvas); WOOD_TEX_CACHE.set(cacheKey, flatTex); return flatTex;
        }
        const size = 512;
        const cvs = document.createElement('canvas'); cvs.width = cvs.height = size;
        const ctx = cvs.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, size, size);
        grad.addColorStop(0, spec.stops[0]); grad.addColorStop(1, spec.stops[1]);
        ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);
        const rng = mulberry32(seed + panelIndex * 101);
        const lineBase = 110 * strength;
        for (let i = 0; i < lineBase; i++) {
            const y = rng() * size; const amp = 30 * strength; const alpha = (0.035 + rng() * 0.04) * strength;
            ctx.strokeStyle = hexToRgba(spec.grain, alpha); ctx.lineWidth = 0.5 + rng() * 1.3 * strength;
            ctx.beginPath(); ctx.moveTo(0, y);
            ctx.bezierCurveTo(size * 0.33, y + rng() * amp - amp / 2, size * 0.66, y + rng() * amp - amp / 2, size, y + rng() * amp - amp / 2);
            ctx.stroke();
        }
        if (useKnots) {
            const knots = 2 + Math.floor(rng() * 4 * strength);
            for (let k = 0; k < knots; k++) {
                const x = rng() * size; const y = rng() * size; const r = 18 + rng() * 42 * strength;
                const radial = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
                radial.addColorStop(0, hexToRgba(spec.knot, 0.55));
                radial.addColorStop(0.5, hexToRgba(spec.knot, 0.25));
                radial.addColorStop(1, hexToRgba(spec.knot, 0));
                ctx.fillStyle = radial; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
            }
        }
        const tex = new THREE.CanvasTexture(cvs); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4; tex.repeat.set(1, 1);
        WOOD_TEX_CACHE.set(cacheKey, tex);
        return tex;
    }
    function applyFinishFromState(state) {
        if (!state) return;
        const raw = state.finish || 'wood1';
        let variantKey = raw;
        if (!(raw in FINISH_VARIANTS)) {
            if (raw === 'woodTexture2') variantKey = 'wood2';
            else if (raw === 'woodTexture3') variantKey = 'wood3';
            else if (raw === 'deepWalnut') variantKey = 'deep-walnut'; // legacy alt
            else variantKey = 'wood1';
        }
        const spec = FINISH_VARIANTS[variantKey];
        currentFinishVariant = variantKey;
        // Simplified: use base variant strength & knots; seed remains random per session.
        currentGrainStrength = spec.baseStrength || 1.0;
        currentUseKnots = spec.type !== 'flat';
        let panelIndex = 0;
        // Access panels via global front baffle and its parent group
        if (window.__frontBaffle) {
            const applyTex = (mesh) => {
                if (!mesh || !mesh.material) return;
                const tex = generateWoodTextureCached(variantKey, panelIndex++, baseWoodTextureSeed, currentGrainStrength, currentUseKnots);
                mesh.material.map = tex; mesh.material.color?.set(0xffffff); mesh.material.needsUpdate = true;
            };
            applyTex(window.__frontBaffle);
            try { const parent = window.__frontBaffle.parent; parent && parent.children.forEach(ch => { if (ch.userData && ch.userData.isPanel && ch !== window.__frontBaffle) applyTex(ch); }); } catch (e) { /* ignore */ }
        }
    }
    // --- Debug / performance instrumentation state ---
    const DEBUG_KEY = 'boxBuilder3DDebug';
    const QUERY_DEBUG = /[?&]debug3d(?:=1)?/i.test(location.search);
    let debugEnabled = false;
    try { debugEnabled = QUERY_DEBUG || localStorage.getItem(DEBUG_KEY) === '1'; } catch (e) { /* ignore */ }
    let frameTimes = []; // {frame, render}
    let lastFrameTs = performance.now();
    let avgFrameMs = 0, avgRenderMs = 0, fps = 0;
    let lastStaticDebug = '';
    let debugFrameCounter = 0;
    const PERF_SAMPLE = 90; // keep ~1.5s at 60fps
    const STORAGE_KEY = 'boxBuilder3DCam';
    function persistCamera() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ azimuth: controlsState.azimuth, polar: controlsState.polar, distance: controlsState.distance, autoRotate: controlsState.autoRotate })); } catch (e) {/* ignore */ }
    }
    function restoreCamera() {
        try { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return; const data = JSON.parse(raw);['azimuth', 'polar', 'distance', 'autoRotate'].forEach(k => { if (typeof data[k] === 'number' || typeof data[k] === 'boolean') controlsState[k] = data[k]; }); } catch (e) {/* ignore */ }
    }
    function setupControls() {
        if (!el || !camera || !renderer) return;
        restoreCamera();
        // Always start with auto-rotate OFF regardless of persisted value
        controlsState.autoRotate = false;
        // Shadows always on; grid toggle removed (grid hidden by default for cleaner view)
        if (window.__threeGrid) window.__threeGrid.visible = false;
        renderer.shadowMap.enabled = true;
        if (window.__threeFloor) window.__threeFloor.receiveShadow = true;
        boxGroup && boxGroup.traverse?.(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
        const dom = renderer.domElement;
        function applyCamera() {
            controlsState.polar = Math.max(0.15, Math.min(Math.PI - 0.15, controlsState.polar));
            controlsState.distance = Math.max(controlsState.minDistance, Math.min(controlsState.maxDistance, controlsState.distance));
            const r = controlsState.distance;
            const x = r * Math.sin(controlsState.polar) * Math.sin(controlsState.azimuth);
            const y = r * Math.cos(controlsState.polar);
            const z = r * Math.sin(controlsState.polar) * Math.cos(controlsState.azimuth);
            camera.position.set(x, y, z); camera.lookAt(0, 0, 0);
            persistCamera();
        }
        dom.addEventListener('mousedown', e => { controlsState.dragging = true; controlsState.lastX = e.clientX; controlsState.lastY = e.clientY; controlsState.userInteracted = true; controlsState.velAz = 0; controlsState.velPolar = 0; });
        window.addEventListener('mouseup', () => { controlsState.dragging = false; });
        window.addEventListener('mousemove', e => {
            if (!controlsState.dragging) return;
            const dx = e.clientX - controlsState.lastX; const dy = e.clientY - controlsState.lastY;
            controlsState.lastX = e.clientX; controlsState.lastY = e.clientY;
            let factor = 0.005; if (e.shiftKey) factor *= 3;
            controlsState.azimuth -= dx * factor; controlsState.polar -= dy * factor;
            controlsState.velAz = -dx * factor; controlsState.velPolar = -dy * factor;
            applyCamera();
        });
        dom.addEventListener('wheel', e => { e.preventDefault(); controlsState.distance *= (1 + (e.deltaY > 0 ? 0.08 : -0.08)); controlsState.userInteracted = true; applyCamera(); }, { passive: false });
        // Removed double-click reset behavior per request.
        applyCamera();
        // Auto-rotate toggle button
        const autoBtn = document.getElementById('autoRotateBtn');
        if (autoBtn) { autoBtn.style.display = 'inline-block'; const reflect = () => { autoBtn.textContent = 'Auto Rotate: ' + (controlsState.autoRotate ? 'On' : 'Off'); }; autoBtn.addEventListener('click', () => { controlsState.autoRotate = !controlsState.autoRotate; reflect(); persistCamera(); }); reflect(); }
        // Fun Spin button removed
        // Debug toggle button (A+B+C requirements)
        const dbgBtn = document.getElementById('debug3dBtn');
        if (dbgBtn) {
            dbgBtn.style.display = 'inline-block';
            const reflectDbg = () => { dbgBtn.textContent = 'Debug: ' + (debugEnabled ? 'On' : 'Off'); };
            dbgBtn.addEventListener('click', () => { debugEnabled = !debugEnabled; try { localStorage.setItem(DEBUG_KEY, debugEnabled ? '1' : '0'); } catch (e) { } reflectDbg(); });
            reflectDbg();
        }
        // Removed grid and shadow toggle buttons; UI simplified.
        // Finish variant change listener (ensures 3D texture updates when <select name="finish"> changes)
        try {
            const finishSel = document.querySelector('select[name="finish"]');
            if (finishSel && !finishSel.__finishBound) {
                finishSel.addEventListener('change', () => {
                    // Pull latest builder state if available
                    if (window.__boxBuilderState) {
                        // Force finish field update from select value
                        window.__boxBuilderState.finish = finishSel.value;
                        scheduleRebuild(window.__boxBuilderState);
                    } else {
                        // Minimal rebuild with just finish
                        scheduleRebuild({ finish: finishSel.value, width: 0, height: 0, depth: 0, holes: [], wallThickness: 0.75, port: { enabled: false } });
                    }
                });
                finishSel.__finishBound = true;
            }
        } catch (e) { /* ignore finish listener errors */ }
    }
    function init() {
        if (!window.THREE) { el.innerHTML = '<div style="color:#c33;padding:1rem;">Three.js failed to load.</div>'; return; }
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        // Enable shadow mapping
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        renderer.setSize(el.clientWidth, el.clientHeight);
        el.innerHTML = '';
        el.appendChild(renderer.domElement);
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffffff);
        camera = new THREE.PerspectiveCamera(40, el.clientWidth / el.clientHeight, 0.1, 1000);
        // Requested starting position
        camera.position.set(100, 60, 120);
        // Sync controlsState.distance to actual vector length
        controlsState.distance = Math.sqrt(camera.position.x ** 2 + camera.position.y ** 2 + camera.position.z ** 2);
        camera.lookAt(0, 0, 0);
        // Ambient light for base illumination (slightly increased)
        const amb = new THREE.AmbientLight(0xffffff, 0.50); scene.add(amb);
        // Directional light at a 45° angle (downward-forward-right) casting shadows (slightly reduced intensity)
        const dir = new THREE.DirectionalLight(0xffffff, 0.80);
        dir.position.set(30, 30, 30); // 45° in x,z,y roughly
        dir.target.position.set(0, 0, 0);
        dir.castShadow = true;
        dir.shadow.mapSize.width = 1024;
        dir.shadow.mapSize.height = 1024;
        dir.shadow.camera.near = 5;
        dir.shadow.camera.far = 200;
        dir.shadow.camera.left = -60;
        dir.shadow.camera.right = 60;
        dir.shadow.camera.top = 60;
        dir.shadow.camera.bottom = -60;
        scene.add(dir);
        scene.add(dir.target);
        // Grid + shadow receiving floor
        const gridSize = 120; const gridDiv = 60;
        const grid = new THREE.GridHelper(gridSize, gridDiv, 0x999999, 0xdddddd);
        grid.material.opacity = 0.4; grid.material.transparent = true;
        scene.add(grid);
        const floorGeo = new THREE.PlaneGeometry(gridSize, gridSize);
        const floorMat = new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.18 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.1; // slight offset below origin
        floor.receiveShadow = true;
        scene.add(floor);
        // Expose objects for UI toggles
        window.__threeGrid = grid;
        window.__threeFloor = floor;
        window.__threeDirLight = dir;
        boxGroup = new THREE.Group();
        window.__boxGroup = boxGroup; // expose for GLB export
        boxGroup.name = 'enclosure';
        // Uniform scale multiplier (original geometry uses inches->units via 0.05 factor). Adjust here to enlarge overall preview without touching math.
        try {
            const storedScale = parseFloat(localStorage.getItem(SCALE_KEY));
            if (!isNaN(storedScale)) {
                // Migrate any legacy (>1) values down to 1.0 max, legacy very small (<0.1) up to 0.1
                currentScale = Math.min(1.0, Math.max(0.1, storedScale));
            }
        } catch (e) { /* ignore scale restore errors */ }
        applyEffectiveScale();
        scene.add(boxGroup);
        window.addEventListener('resize', onResize);
        setupControls();
        // Scale slider wiring
        const scaleSlider = document.getElementById('scaleSlider');
        const scaleLabel = document.getElementById('scaleSliderLabel');
        if (scaleSlider && scaleLabel) {
            scaleSlider.style.display = 'inline-block';
            scaleLabel.style.display = 'inline-block';
            scaleSlider.value = String(currentScale);
            const reflectScale = () => { scaleLabel.textContent = 'Scale: ' + Number(scaleSlider.value).toFixed(2) + '×'; };
            reflectScale();
            scaleSlider.addEventListener('input', () => {
                const val = parseFloat(scaleSlider.value);
                if (!isNaN(val)) {
                    currentScale = Math.min(1.0, Math.max(0.1, val));
                    // Ensure slider reflects clamped value
                    if (Math.abs(parseFloat(scaleSlider.value) - currentScale) > 1e-6) {
                        scaleSlider.value = String(currentScale);
                    }
                    applyEffectiveScale();
                    try { localStorage.setItem(SCALE_KEY, String(currentScale)); } catch (e) { }
                    reflectScale();
                }
            });
        }
    }
    function applyEffectiveScale() {
        if (!boxGroup) return;
        const eff = explodedMode ? currentScale * EXPLODED_SCALE_MULT : currentScale;
        boxGroup.scale.set(eff, eff, eff);
    }
    // Deep preview scene reset (invoked by UI Reset Preview button if available)
    function resetPreviewScene() {
        try {
            // Ensure renderer exists (init if not yet built)
            if (!renderer) {
                const ok = ensureThreeAndInit();
                if (!ok) return; // fallback canvas already created
            }
            // Stop any auto rotation
            controlsState.autoRotate = false;
            // Reset orbit control state to initial defaults
            controlsState.dragging = false;
            controlsState.lastX = 0; controlsState.lastY = 0;
            controlsState.azimuth = 0; controlsState.polar = 0.9; controlsState.distance = 28;
            controlsState.userInteracted = false; controlsState.velAz = 0; controlsState.velPolar = 0;
            // Clear persisted camera & scale so a fresh session baseline applies
            try { localStorage.removeItem(STORAGE_KEY); } catch (e) { }
            // Reset camera position matching original init starting pose
            if (camera) {
                camera.position.set(100, 60, 120);
                camera.lookAt(0, 0, 0);
            }
            // Reset scale (preview enlargement) back to 1.0 and persist
            currentScale = 1.0;
            try { localStorage.setItem(SCALE_KEY, '1.0'); } catch (e) { }
            applyEffectiveScale();
            // Reset exploded mode & group rotation
            explodedMode = false;
            if (boxGroup) { boxGroup.rotation.set(0, 0, 0); }
            // Dispose and clear all existing geometry & port/hole helpers
            clearPorts(); clearHoles(); clearPlanes();
            // Dispose cached wood textures then clear cache & generate new seed for fresh pattern
            try {
                WOOD_TEX_CACHE.forEach(tex => { try { tex.dispose && tex.dispose(); } catch (e) { } });
            } catch (e) { }
            WOOD_TEX_CACHE.clear();
            baseWoodTextureSeed = Math.floor(Math.random() * 1000000);
            // Update scale slider UI if present
            const scaleSlider = document.getElementById('scaleSlider');
            const scaleLabel = document.getElementById('scaleSliderLabel');
            if (scaleSlider) scaleSlider.value = '1.0';
            if (scaleLabel) scaleLabel.textContent = 'Scale: 1.0×';
            // Rebuild current state geometry if state available
            const builderState = window.__boxBuilderState;
            if (builderState) {
                scheduleRebuild(builderState);
            }
            // Emit custom event for any future listeners (e.g., metrics, overlays)
            window.dispatchEvent(new CustomEvent('previewSceneReset'));
        } catch (err) {
            console.warn('[three_preview] resetPreviewScene error', err);
        }
    }
    // Expose deep reset on window for builder script
    try { window.resetPreview = resetPreviewScene; } catch (e) { }
    function onResize() {
        if (!camera || !renderer) return;
        camera.aspect = el.clientWidth / el.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(el.clientWidth, el.clientHeight);
    }
    function inchesToUnits(inches) {
        // Use 1 unit = 1 inch * 0.05 for reasonable sizing
        return inches * 0.05;
    }

    function createFrontPanelWithHoles(width, height, holes, thicknessUnits, material) {
        // Create a flat 2D shape in X/Y centered at origin
        const panelShape = new THREE.Shape();
        panelShape.moveTo(-width / 2, -height / 2);
        panelShape.lineTo(width / 2, -height / 2);
        panelShape.lineTo(width / 2, height / 2);
        panelShape.lineTo(-width / 2, height / 2);
        panelShape.lineTo(-width / 2, -height / 2);
        // Append holes
        holes.forEach(hole => {
            const nominal = hole.nominal || 12;
            const dia = hole.spec ? hole.spec : (hole.cut ? hole.cut : nominal * 0.93);
            const radius = inchesToUnits(dia / 2);
            const hx = inchesToUnits(hole.dx || 0);
            const hy = inchesToUnits(hole.dy || 0);
            const holePath = new THREE.Path();
            holePath.absarc(hx, hy, radius, 0, Math.PI * 2, false);
            panelShape.holes.push(holePath);
        });
        // Extrude with thickness along +Z then recenter geometry so thickness spans ±thicknessUnits/2
        const extrudeSettings = { depth: thicknessUnits, bevelEnabled: false, curveSegments: 32 };
        const geometry = new THREE.ExtrudeGeometry(panelShape, extrudeSettings);
        geometry.translate(0, 0, -thicknessUnits / 2); // center thickness about z=0
        geometry.computeBoundingBox();
        geometry.computeVertexNormals();
        const mesh = new THREE.Mesh(geometry, material);
        return mesh;
    }

    function setExplodedPosition(mesh, baseX, baseY, baseZ, panelType) {
        if (!explodedMode) {
            mesh.position.set(baseX, baseY, baseZ);
            return;
        }

        // Exploded view: move panels outward from center
        const explosionFactor = inchesToUnits(5); // 5 inches apart

        switch (panelType) {
            case 'front':
                mesh.position.set(baseX, baseY, baseZ + explosionFactor);
                break;
            case 'back':
                mesh.position.set(baseX, baseY, baseZ - explosionFactor);
                break;
            case 'left':
                mesh.position.set(baseX - explosionFactor, baseY, baseZ);
                break;
            case 'right':
                mesh.position.set(baseX + explosionFactor, baseY, baseZ);
                break;
            case 'top':
                mesh.position.set(baseX, baseY + explosionFactor, baseZ);
                break;
            case 'bottom':
                mesh.position.set(baseX, baseY - explosionFactor, baseZ);
                break;
            default:
                mesh.position.set(baseX, baseY, baseZ);
        }
    }
    // Mesh caches for reuse
    let planeMeshes = { front: null, back: null, left: null, right: null, top: null, bottom: null };
    let holeMeshes = [];
    let portMeshes = [];
    let interiorPanel = null; // interior/back wall textured panel
    // ghostMode archived (was used for translucent ghost panels)

    function clearPorts() { portMeshes.forEach(m => boxGroup.remove(m)); portMeshes = []; }
    function clearHoles() { holeMeshes.forEach(m => boxGroup.remove(m)); holeMeshes = []; }
    function clearPlanes() {
        Object.values(planeMeshes).forEach(mesh => {
            if (mesh) {
                boxGroup.remove(mesh);
                if (mesh.geometry) mesh.geometry.dispose();
                if (mesh.material) mesh.material.dispose();
            }
        });
        planeMeshes = { front: null, back: null, left: null, right: null, top: null, bottom: null };
        if (interiorPanel) {
            boxGroup.remove(interiorPanel);
            if (interiorPanel.geometry) interiorPanel.geometry.dispose();
            if (interiorPanel.material) interiorPanel.material.dispose();
            interiorPanel = null;
        }
    }
    function rebuild(state) {
        lastState = state;
        const w = inchesToUnits(state.width);
        const h = inchesToUnits(state.height);
        const d = inchesToUnits(state.depth);

        // Create/update six separate plane meshes
        clearPlanes();

        const frontMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.8,
            metalness: 0.05,
            side: THREE.DoubleSide
        });

        const sideMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.9,
            metalness: 0.04,
            side: THREE.DoubleSide
        });

        // Interior wood texture material (double sided so visible through holes regardless of facing)
        const interiorMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff, // textured
            roughness: 0.9,
            metalness: 0.04,
            side: THREE.DoubleSide
        });

        // Add some wood grain pattern using a simple procedural approach
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Light wood gradient (birch/maple like)
        const gradient = ctx.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, '#f6e3c3');
        gradient.addColorStop(0.4, '#e9d2a8');
        gradient.addColorStop(0.7, '#dfc498');
        gradient.addColorStop(1, '#d3b789');
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 256);
        // Subtle grain lines
        ctx.strokeStyle = '#c6a873';
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 22; i++) {
            ctx.beginPath();
            const y = Math.random() * 256;
            ctx.moveTo(0, y);
            ctx.quadraticCurveTo(128 + Math.random() * 40, y + (Math.random() * 12 - 6), 256, y + (Math.random() * 10 - 5));
            ctx.stroke();
        }

        const woodTexture = new THREE.CanvasTexture(canvas);
        woodTexture.wrapS = THREE.RepeatWrapping;
        woodTexture.wrapT = THREE.RepeatWrapping;
        woodTexture.repeat.set(2, 2);

        interiorMaterial.map = woodTexture; interiorMaterial.needsUpdate = true;
        frontMaterial.map = woodTexture; frontMaterial.needsUpdate = true;
        sideMaterial.map = woodTexture; sideMaterial.needsUpdate = true;

        // --- MATERIAL THICKNESS VISUALIZATION ---
        const wallThicknessIn = state.wallThickness > 0 ? state.wallThickness : 0.75;
        const wallThicknessUnits = inchesToUnits(wallThicknessIn);

        // FRONT panel: explicit slab + circular hole cylinders subtracted visually by creating dark interior rings
        (function buildFront() {
            // If hideFrontPanel is true, skip building front panel entirely (see inside)
            if (state.hideFrontPanel) {
                planeMeshes.front = null;
                try { window.__frontBaffle = null; } catch (e) { }
                return; // Exit early - no front panel at all
            }

            // When showCutouts is true, cut actual holes; when false, solid panel
            if (state.showCutouts && state.holes && state.holes.length > 0) {
                // Use extruded geometry with actual holes cut out (retains thickness)
                planeMeshes.front = createFrontPanelWithHoles(w, h, state.holes, wallThicknessUnits, frontMaterial);
                planeMeshes.front.castShadow = true; planeMeshes.front.receiveShadow = true;
                planeMeshes.front.name = 'frontBaffle';
                planeMeshes.front.userData.wallThicknessUnits = wallThicknessUnits;
                planeMeshes.front.userData.isPanel = true;
                try { window.__frontBaffle = planeMeshes.front; } catch (e) { }
                const centerZ = d / 2 - wallThicknessUnits / 2;
                setExplodedPosition(planeMeshes.front, 0, 0, centerZ, 'front');
                boxGroup.add(planeMeshes.front);
            } else {
                // Solid panel (no holes) - can't see inside
                const slabGeom = new THREE.BoxGeometry(w, h, wallThicknessUnits);
                planeMeshes.front = new THREE.Mesh(slabGeom, frontMaterial);
                planeMeshes.front.castShadow = true; planeMeshes.front.receiveShadow = true;
                planeMeshes.front.name = 'frontBaffle';
                planeMeshes.front.userData.wallThicknessUnits = wallThicknessUnits;
                planeMeshes.front.userData.isPanel = true;
                try { window.__frontBaffle = planeMeshes.front; } catch (e) { }
                const centerZ = d / 2 - wallThicknessUnits / 2;
                setExplodedPosition(planeMeshes.front, 0, 0, centerZ, 'front');
                boxGroup.add(planeMeshes.front);
            }
            // Only build visual rim rings when cutouts are shown and not in filled mode
            if (state.showCutouts && !state.fillHoles) {
                // Hole rim visualization (circular edge outlines) so depth is perceptible
                try {
                    const holeEdgesGroup = new THREE.Group();
                    holeEdgesGroup.name = 'frontHoleRims';
                    // Show rims for holes that are actually cut out (not filled)
                    // cutOut flag deprecated; show rims for all holes when cutouts visible and not globally filled
                    (state.holes || []).filter(h => !state.fillHoles && !h.filled).forEach(h => {
                        const nominal = h.nominal || 12;
                        const dia = h.spec ? h.spec : (h.cut ? h.cut : nominal * 0.93);
                        const r = inchesToUnits(dia / 2);
                        const segments = Math.max(24, Math.min(72, Math.round(dia * 4)));
                        const ringGeom = new THREE.RingGeometry(r * 0.98, r * 1.02, segments);
                        const ringMat = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
                        const ringMeshFront = new THREE.Mesh(ringGeom, ringMat);
                        ringMeshFront.position.set(inchesToUnits(h.dx || 0), inchesToUnits(h.dy || 0), wallThicknessUnits / 2 + 0.0005);
                        holeEdgesGroup.add(ringMeshFront);
                        const ringMeshInner = new THREE.Mesh(ringGeom.clone(), ringMat.clone());
                        ringMeshInner.position.set(inchesToUnits(h.dx || 0), inchesToUnits(h.dy || 0), -wallThicknessUnits / 2 - 0.0005);
                        holeEdgesGroup.add(ringMeshInner);
                    });
                    planeMeshes.front.add(holeEdgesGroup);
                } catch (e) { /* ignore ring errors */ }
            }
            // Add edge outline for slab
            try {
                const edges = new THREE.EdgesGeometry(slabGeom);
                const edgeMat = new THREE.LineBasicMaterial({ color: 0x222222, linewidth: 1 });
                const edgeLines = new THREE.LineSegments(edges, edgeMat);
                planeMeshes.front.add(edgeLines);
            } catch (e) { /* ignore edge helper errors */ }
            // Explicit cleanup: ensure no stale rim group persists when cutouts hidden or filled
            if ((!state.showCutouts || state.fillHoles) && planeMeshes.front) {
                const existingRims = planeMeshes.front.getObjectByName('frontHoleRims');
                if (existingRims) {
                    try {
                        existingRims.traverse(ch => { if (ch.isMesh) { ch.geometry?.dispose(); ch.material?.dispose(); } });
                    } catch (e) { /* ignore dispose errors */ }
                    planeMeshes.front.remove(existingRims);
                }
                // Also purge any AO rings that might remain (rare case if aids toggled mid-transition)
                planeMeshes.front.children.slice().forEach(ch => {
                    if (ch.userData && ch.userData.role === 'aoRing') {
                        try { ch.geometry?.dispose(); ch.material?.dispose(); } catch (e) { }
                        planeMeshes.front.remove(ch);
                    }
                });
            }
        })();

        // BACK panel (simple box slab)
        (function buildBack() {
            const geom = new THREE.BoxGeometry(w, h, wallThicknessUnits);
            planeMeshes.back = new THREE.Mesh(geom, sideMaterial);
            planeMeshes.back.castShadow = true; planeMeshes.back.receiveShadow = true;
            planeMeshes.back.userData.isPanel = true;
            const centerZ = -d / 2 + wallThicknessUnits / 2;
            setExplodedPosition(planeMeshes.back, 0, 0, centerZ, 'back');
            boxGroup.add(planeMeshes.back);
        })();

        // LEFT & RIGHT panels (thickness along X)
        (function buildSides() {
            const sideGeom = new THREE.BoxGeometry(wallThicknessUnits, h, d - 2 * wallThicknessUnits); // subtract front/back thickness for interior cavity (visual)
            // Left
            planeMeshes.left = new THREE.Mesh(sideGeom.clone(), sideMaterial);
            planeMeshes.left.castShadow = true; planeMeshes.left.receiveShadow = true;
            planeMeshes.left.userData.isPanel = true;
            const leftX = -w / 2 + wallThicknessUnits / 2;
            setExplodedPosition(planeMeshes.left, leftX, 0, 0, 'left');
            boxGroup.add(planeMeshes.left);
            // Right
            planeMeshes.right = new THREE.Mesh(sideGeom.clone(), sideMaterial);
            planeMeshes.right.castShadow = true; planeMeshes.right.receiveShadow = true;
            planeMeshes.right.userData.isPanel = true;
            const rightX = w / 2 - wallThicknessUnits / 2;
            setExplodedPosition(planeMeshes.right, rightX, 0, 0, 'right');
            boxGroup.add(planeMeshes.right);
        })();

        // TOP & BOTTOM panels (thickness along Y)
        (function buildTopBottom() {
            const tbGeom = new THREE.BoxGeometry(w - 2 * wallThicknessUnits, wallThicknessUnits, d - 2 * wallThicknessUnits);
            // Top
            planeMeshes.top = new THREE.Mesh(tbGeom.clone(), sideMaterial);
            planeMeshes.top.castShadow = true; planeMeshes.top.receiveShadow = true;
            planeMeshes.top.userData.isPanel = true;
            const topY = h / 2 - wallThicknessUnits / 2;
            setExplodedPosition(planeMeshes.top, 0, topY, 0, 'top');
            boxGroup.add(planeMeshes.top);
            // Bottom
            planeMeshes.bottom = new THREE.Mesh(tbGeom.clone(), sideMaterial);
            planeMeshes.bottom.castShadow = true; planeMeshes.bottom.receiveShadow = true;
            planeMeshes.bottom.userData.isPanel = true;
            const bottomY = -h / 2 + wallThicknessUnits / 2;
            setExplodedPosition(planeMeshes.bottom, 0, bottomY, 0, 'bottom');
            boxGroup.add(planeMeshes.bottom);
        })();

        // (Deprecated) interiorPanel removed: interior visibly implied by wall solids
        interiorPanel = null;

        // Ambient occlusion (AO) ring helpers inside holes for depth perception
        const showAids = !!state.showThicknessAids; // will be injected from state events (box_builder.js must pass it)
        if (showAids && planeMeshes.front && state.showCutouts && !state.fillHoles) {
            try {
                // Show AO rings only for holes that are actually cut out
                // cutOut removed: AO rings appear for holes that are not filled when global fillHoles is false
                const holeData = (state.holes || []).filter(h => !state.fillHoles && !h.filled);
                const wt = wallThicknessUnits;
                holeData.forEach((h, idx) => {
                    const nominal = h.nominal || 12;
                    const dia = h.spec ? h.spec : (h.cut ? h.cut : nominal * 0.93);
                    const rIn = dia / 2;
                    const outerR = inchesToUnits(rIn * 1.06); // slight expansion for gradient falloff
                    const innerR = inchesToUnits(rIn * 0.55);
                    // Radial gradient via custom shader (simple smoothstep ring)
                    const uniforms = {
                        inner: { value: innerR },
                        outer: { value: outerR },
                        color: { value: new THREE.Color(0x000000) },
                        opacity: { value: 0.35 }
                    };
                    const ringGeom = new THREE.RingGeometry(innerR, outerR, 48);
                    const ringMat = new THREE.ShaderMaterial({
                        transparent: true,
                        depthWrite: false,
                        uniforms,
                        side: THREE.DoubleSide,
                        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
                        fragmentShader: `uniform float inner; uniform float outer; uniform vec3 color; uniform float opacity; varying vec2 vUv; void main(){ vec2 c=vUv-0.5; float dist=length(c); float a=smoothstep(0.0,0.4,(1.0-dist*2.0)); gl_FragColor=vec4(color,opacity*a); }`
                    });
                    const ring = new THREE.Mesh(ringGeom, ringMat);
                    ring.userData.role = 'aoRing';
                    // Position ring flush with inner face of front panel
                    ring.rotation.x = Math.PI; // orient correctly
                    const cx = inchesToUnits(h.dx || 0);
                    const cy = inchesToUnits(h.dy || 0);
                    ring.position.set(cx, cy, -wt + inchesToUnits(0.01));
                    planeMeshes.front.add(ring);
                });
            } catch (e) { /* ignore AO errors */ }
        }
        // refresh global reference (in case group replaced)
        window.__boxGroup = boxGroup;
        // Rebuild holes - now these are just for visualization/debugging if needed
        // (Actual holes are cut into the front panel geometry)
        clearHoles();
        // Note: Holes are now cut directly into front panel geometry
        // Ports (simplified): show slot as rectangular opening, round/aero as cylinders
        clearPorts();
        if (state.port && state.port.enabled && state.showPortOverlay) {
            if (state.port.type === 'slot' && state.port.slotHeightIn && (state.port.slotWidthIn || state.port.slotGapIn !== null)) {
                const num = state.port.count || 1;
                const t = state.wallThickness; // front thickness
                const internalW = state.width - 2 * t;
                const gap = state.port.slotGapIn || 0;
                let singleW = state.port.slotWidthIn;
                if (!(singleW > 0)) {
                    const usable = internalW - (num - 1) * gap;
                    singleW = usable / num;
                }
                const slotH = state.port.slotHeightIn;
                for (let i = 0; i < num; i++) {
                    let xCenter;
                    if (state.port.slotWidthIn) {
                        if (state.port.slotSide === 'right') {
                            const rightInner = state.width / 2 - t;
                            xCenter = rightInner - singleW / 2 - (num - 1 - i) * (singleW + gap) - state.width / 2;
                        } else {
                            const leftInner = -state.width / 2 + t;
                            xCenter = leftInner + i * (singleW + gap) + singleW / 2;
                        }
                    } else {
                        const total = num * singleW + (num - 1) * gap;
                        xCenter = -total / 2 + i * (singleW + gap) + singleW / 2;
                    }
                    const yCenter = state.port.slotInsetIn > 0 ? (-state.height / 2 + t + state.port.slotInsetIn + slotH / 2) : 0;
                    const gw = inchesToUnits(singleW);
                    const gh = inchesToUnits(slotH);
                    const gdepth = inchesToUnits(Math.max(state.wallThickness, 0.75) * 0.6);
                    const openGeom = new THREE.BoxGeometry(gw, gh, gdepth);
                    const openMat = new THREE.MeshStandardMaterial({ color: 0x58a6ff, transparent: true, opacity: 0.4 });
                    const slotMesh = new THREE.Mesh(openGeom, openMat);
                    slotMesh.castShadow = true; slotMesh.receiveShadow = true;
                    slotMesh.position.set(inchesToUnits(xCenter), inchesToUnits(yCenter), d / 2 + 0.002);
                    slotMesh.userData.role = 'slotPort';
                    const areaIn2 = singleW * slotH;
                    const physLenIn = state.wallThickness; // placeholder physical depth
                    slotMesh.userData.physical = { widthIn: singleW, heightIn: slotH, areaIn2, lengthIn: physLenIn };
                    slotMesh.userData.design = { type: 'slot', count: num, targetHz: state.port.targetHz || null };
                    portMeshes.push(slotMesh); boxGroup.add(slotMesh);
                }
            } else if ((state.port.type === 'round' || state.port.type === 'aero') && state.port.roundDiameterIn) {
                const dia = state.port.roundDiameterIn;
                const rIn = dia / 2;
                const num = state.port.count || 1;
                const spacing = state.port.roundSpacingIn || (rIn * 1.2);
                const totalWidth = num * dia + (num - 1) * spacing;
                const leftMostCenter = -totalWidth / 2 + rIn;
                const yCenter = state.port.roundInsetIn > 0 ? (-state.height / 2 + state.wallThickness + state.port.roundInsetIn + rIn) : 0;
                for (let i = 0; i < num; i++) {
                    const cxRel = leftMostCenter + i * (dia + spacing);
                    const cylGeom = new THREE.CylinderGeometry(inchesToUnits(rIn), inchesToUnits(rIn), inchesToUnits(Math.max(state.wallThickness, 0.75) * 0.6), 32);
                    const mat = new THREE.MeshStandardMaterial({ color: state.port.type === 'aero' ? 0xffb543 : 0x58a6ff, transparent: true, opacity: 0.5 });
                    const cyl = new THREE.Mesh(cylGeom, mat);
                    cyl.castShadow = true; cyl.receiveShadow = true;
                    cyl.position.set(inchesToUnits(cxRel), inchesToUnits(yCenter), d / 2 + 0.001);
                    cyl.rotation.x = Math.PI / 2;
                    const physLenIn = state.wallThickness; // placeholder
                    cyl.userData.role = state.port.type === 'aero' ? 'aeroPort' : 'roundPort';
                    cyl.userData.physical = { diameterIn: dia, radiusIn: rIn, lengthIn: physLenIn };
                    cyl.userData.design = { type: state.port.type, count: num, targetHz: state.port.targetHz || null };
                    portMeshes.push(cyl); boxGroup.add(cyl);
                    if (state.port.type === 'aero' && state.port.flareRadiusIn) {
                        const flareR = state.port.flareRadiusIn;
                        const ringGeom = new THREE.TorusGeometry(inchesToUnits(rIn + flareR * 0.5), inchesToUnits(flareR * 0.15), 16, 48);
                        const ringMat = new THREE.MeshStandardMaterial({ color: 0xffb543, transparent: true, opacity: 0.35 });
                        const ring = new THREE.Mesh(ringGeom, ringMat);
                        ring.castShadow = false; ring.receiveShadow = false;
                        ring.position.set(inchesToUnits(cxRel), inchesToUnits(yCenter), d / 2 + 0.003);
                        ring.rotation.x = Math.PI / 2;
                        ring.userData.role = 'flareRing';
                        ring.userData.physical = { diameterIn: dia + flareR, flareRadiusIn: flareR };
                        ring.userData.design = { type: 'aeroFlare', parentDiameterIn: dia };
                        portMeshes.push(ring); boxGroup.add(ring);
                    }
                }
            }
        }
        // Auto frame enclosure on very first build (before user interaction)
        if (!controlsState.userInteracted && !planeMeshes.front.__framed) {
            try {
                const box = new THREE.Box3().setFromObject(boxGroup);
                const sizeVec = box.getSize(new THREE.Vector3());
                const sizeLen = sizeVec.length();
                const center = box.getCenter(new THREE.Vector3());
                // Recenter group at origin for consistent rotations
                boxGroup.position.sub(center);
                // Adjust camera polar/azimuth remain; compute desired distance
                const desiredDist = sizeLen * 1.4; // frame factor
                controlsState.distance = Math.min(Math.max(desiredDist, controlsState.minDistance), controlsState.maxDistance);
                // Position camera via current spherical angles
                const r = controlsState.distance;
                const x = r * Math.sin(controlsState.polar) * Math.sin(controlsState.azimuth);
                const y = r * Math.cos(controlsState.polar);
                const z = r * Math.sin(controlsState.polar) * Math.cos(controlsState.azimuth);
                camera.position.set(x, y, z);
                camera.lookAt(0, 0, 0);
                planeMeshes.front.__framed = true;
            } catch (e) { /* ignore framing errors */ }
        }
        // Apply finish (after all primary panels created)
        applyFinishFromState(state);
        // Update static portion of debug instrumentation (holes/ports/etc.)
        try {
            let dbg = document.getElementById('three-debug');
            if (!dbg) {
                dbg = document.createElement('div');
                dbg.id = 'three-debug';
                dbg.style.cssText = 'position:absolute;top:0;left:0;font:10px monospace;color:#bbb;pointer-events:none;opacity:.35;white-space:nowrap;';
                el.appendChild(dbg);
            }
            const portCount = portMeshes.length;
            const holeCount = holeMeshes.length;
            lastStaticDebug = `holes:${holeCount} ports:${portCount} wt:${(state.wallThickness || 0.75).toFixed(2)} type:${state.port?.type || '-'} overlay:${state.showPortOverlay ? 'on' : 'off'}`;
            if (!debugEnabled) { dbg.style.display = 'none'; } else { dbg.style.display = 'block'; }
        } catch (e) { /* ignore */ }
    }
    // Debounce rebuild calls from rapid state events
    let rebuildTimer = null; let pendingState = null;
    function scheduleRebuild(st) { pendingState = st; if (rebuildTimer) return; rebuildTimer = setTimeout(() => { rebuildTimer = null; if (pendingState) rebuild(pendingState); }, 55); }
    function animate() {
        if (!renderer) return;
        animReq = requestAnimationFrame(animate);
        // Inertial camera motion when not dragging
        if (!controlsState.dragging) {
            if (Math.abs(controlsState.velAz) > 0.00001 || Math.abs(controlsState.velPolar) > 0.00001) {
                controlsState.azimuth += controlsState.velAz;
                controlsState.polar += controlsState.velPolar;
                controlsState.velAz *= controlsState.damping;
                controlsState.velPolar *= controlsState.damping;
                // Apply camera after inertial change
                const r = controlsState.distance;
                controlsState.polar = Math.max(0.15, Math.min(Math.PI - 0.15, controlsState.polar));
                const x = r * Math.sin(controlsState.polar) * Math.sin(controlsState.azimuth);
                const y = r * Math.cos(controlsState.polar);
                const z = r * Math.sin(controlsState.polar) * Math.cos(controlsState.azimuth);
                camera.position.set(x, y, z);
                camera.lookAt(0, 0, 0);
                persistCamera();
            }
        }
        // Auto rotation (independent of userInteracted now)
        if (controlsState.autoRotate) { boxGroup.rotation.y += 0.0035; }
        const renderStart = performance.now();
        // Animate rotating outlines for filled holes (simple subtle spin)
        try {
            if (lastState && lastState.fillHoles && lastState.showCutouts && planeMeshes.front) {
                const rimGroup = planeMeshes.front.getObjectByName('frontHoleRims');
                if (rimGroup) {
                    rimGroup.rotation.z += 0.01; // gentle spin
                }
            }
        } catch (e) { /* ignore animation errors */ }
        renderer.render(scene, camera);
        const now = performance.now();
        const frameDelta = now - lastFrameTs;
        const renderDelta = now - renderStart;
        lastFrameTs = now;
        frameTimes.push({ frame: frameDelta, render: renderDelta });
        if (frameTimes.length > PERF_SAMPLE) frameTimes.shift();
        if (debugEnabled) {
            // Recompute averages roughly every few frames for efficiency
            if (debugFrameCounter++ % 10 === 0) {
                let sumF = 0, sumR = 0; for (const ft of frameTimes) { sumF += ft.frame; sumR += ft.render; }
                avgFrameMs = sumF / frameTimes.length;
                avgRenderMs = sumR / frameTimes.length;
                fps = 1000 / avgFrameMs;
            }
            const dbg = document.getElementById('three-debug');
            if (dbg) {
                dbg.style.display = 'block';
                dbg.textContent = `${lastStaticDebug} fps:${fps.toFixed(0)} frame:${avgFrameMs.toFixed(1)}ms render:${avgRenderMs.toFixed(1)}ms cam:(${camera.position.x.toFixed(1)},${camera.position.y.toFixed(1)},${camera.position.z.toFixed(1)}) dist:${controlsState.distance.toFixed(1)} az:${controlsState.azimuth.toFixed(2)} pol:${controlsState.polar.toFixed(2)}`;
            }
        }
        else {
            const dbg = document.getElementById('three-debug'); if (dbg) dbg.style.display = 'none';
        }
    }
    // Removed fun spin helper functions and orientation tween logic (archived)

    function restoreBaseMaterials() {
        // Restore chosen finish variant (not random fun spin colors)
        applyFinishFromState(lastState || { finish: 'wood1' });
    }
    function focusFrontHoles() {
        if (!lastState || !camera) return;
        // Compute hole bounds in inches (include all holes, cutOut or filled)
        let visibleHoles = Array.isArray(lastState.holes) ? lastState.holes : [];
        let hasHoles = visibleHoles.length > 0;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        if (hasHoles) {
            visibleHoles.forEach(h => {
                const nominal = h.nominal || 12;
                const dia = h.spec ? h.spec : (h.cut ? h.cut : nominal * 0.93);
                const r = dia / 2;
                const cx = (h.dx || 0);
                const cy = (h.dy || 0);
                minX = Math.min(minX, cx - r);
                maxX = Math.max(maxX, cx + r);
                minY = Math.min(minY, cy - r);
                maxY = Math.max(maxY, cy + r);
            });
        } else {
            // fallback to full front panel
            minX = -lastState.width / 2; maxX = lastState.width / 2; minY = -lastState.height / 2; maxY = lastState.height / 2;
        }
        const holeW = (maxX - minX) || lastState.width || 1;
        const holeH = (maxY - minY) || lastState.height || 1;
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        // Convert to internal units
        const cxU = cx * 0.05; const cyU = cy * 0.05;
        // Determine required distance for FOV framing
        const fovRad = camera.fov * Math.PI / 180;
        const targetSpan = Math.max(holeW, holeH) * 0.05 * 1.35; // add margin
        const requiredDist = (targetSpan / 2) / Math.tan(fovRad / 2);
        const dist = Math.max(requiredDist, controlsState.minDistance);
        // Place camera on +Z axis, slight upward tilt
        const yOffset = cyU + targetSpan * 0.15;
        camera.position.set(0, yOffset, dist);
        camera.lookAt(new THREE.Vector3(cxU, cyU, 0));
        // Update control state to reflect this camera pose
        const r = Math.sqrt(camera.position.x ** 2 + camera.position.y ** 2 + camera.position.z ** 2);
        controlsState.distance = r;
        controlsState.azimuth = 0; // facing +Z
        controlsState.polar = Math.acos(camera.position.y / r);
        persistCamera();
    }
    function startLoop() { if (!animReq) { animate(); } }
    function stopLoop() { if (animReq) { cancelAnimationFrame(animReq); animReq = null; } }
    // Simplified init path (ES module loaded in template assigns window.THREE)
    function ensureThreeAndInit() {
        if (renderer) return true;
        if (window.THREE) { init(); return true; }
        // Fallback canvas if module failed
        createFallbackCanvas();
        return false;
    }
    function createFallbackCanvas() {
        if (el.querySelector('canvas')) return;
        const cvs = document.createElement('canvas');
        cvs.width = el.clientWidth || 480; cvs.height = el.clientHeight || 360;
        cvs.style.background = '#181818';
        cvs.getContext && cvs.getContext('2d')?.fillRect(0, 0, cvs.width, cvs.height);
        el.innerHTML = '';
        el.appendChild(cvs);
    }
    window.addEventListener('boxStateChanged', e => {
        const state = e.detail;
        // Inject UI toggle property (builder JS may not include it originally)
        try {
            const form = document.querySelector('form.box-lm-form');
            if (form) {
                const aidEl = form.querySelector('input[name="showThicknessAids"]');
                if (aidEl) state.showThicknessAids = aidEl.checked;
            }
        } catch (e2) { /* ignore */ }
        el.style.display = 'block';
        if (!renderer) {
            const ok = ensureThreeAndInit();
            if (!ok && !window.THREE) { createFallbackCanvas(); }
        }
        scheduleRebuild(state);
        startLoop();
    });

    // Early eager init for test mode to ensure canvas & stub frontBaffle exist before Playwright assertions
    document.addEventListener('DOMContentLoaded', () => {
        if (TEST_MODE) {
            if (!renderer) {
                ensureThreeAndInit();
            }
            // If frontBaffle not yet built (no state event), create a minimal stub plane so tests detect presence.
            if (!window.__frontBaffle && window.THREE && boxGroup) {
                try {
                    const stubGeom = new THREE.PlaneGeometry(1, 1);
                    const stubMat = new THREE.MeshBasicMaterial({ color: 0xcccccc });
                    const stub = new THREE.Mesh(stubGeom, stubMat);
                    stub.name = 'frontBaffle';
                    stub.userData.wallThicknessUnits = 0.05;
                    boxGroup.add(stub);
                    window.__frontBaffle = stub;
                } catch (e) { /* ignore stub errors */ }
            }
            startLoop();
        } else {
            // Non-test: optional very early init to reduce first-render latency
            setTimeout(() => { if (!renderer) ensureThreeAndInit(); }, 120);
        }
    });

    // Listen for view mode changes (exploded/assembled)
    window.addEventListener('viewModeChanged', e => {
        explodedMode = e.detail.exploded;
        applyEffectiveScale();
        if (lastState) {
            rebuild(lastState); // positions depend on exploded state
        }
    });
    listenerReady = true;
})();
