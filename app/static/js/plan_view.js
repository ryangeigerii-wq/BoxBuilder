// Plan View (2D Orthographic) - Top-down projection for cut planning
(function () {
    const planEl = document.getElementById('planView');
    if (!planEl) return;

    let renderer, scene, camera, planGroup;
    let lastState = null;
    let listenerReady = false;

    // Storage for persisting view settings
    const PLAN_STORAGE_KEY = 'boxBuilderPlanView';
    let planSettings = {
        showLabels: true,
        showDimensions: true,
        gridVisible: true,
        scale: 1.0
    };

    function loadSettings() {
        try {
            const stored = localStorage.getItem(PLAN_STORAGE_KEY);
            if (stored) {
                planSettings = { ...planSettings, ...JSON.parse(stored) };
            }
        } catch (e) { /* ignore */ }
    }

    function saveSettings() {
        try {
            localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(planSettings));
        } catch (e) { /* ignore */ }
    }

    function init() {
        if (!window.THREE) {
            planEl.innerHTML = '<div style="color:#c33;padding:1rem;">Three.js required for Plan View.</div>';
            return;
        }

        // Orthographic camera for top-down view
        const aspect = planEl.clientWidth / planEl.clientHeight;
        const frustumSize = 20; // inches viewing area
        camera = new THREE.OrthographicCamera(
            -frustumSize * aspect / 2, frustumSize * aspect / 2,
            frustumSize / 2, -frustumSize / 2,
            0.1, 100
        );
        camera.position.set(0, 20, 0); // Looking down from above
        camera.lookAt(0, 0, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        renderer.setSize(planEl.clientWidth, planEl.clientHeight);
        renderer.setClearColor(0xffffff, 1);

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffffff);

        // Grid helper for reference
        const gridSize = 30;
        const gridDivisions = 30;
        const grid = new THREE.GridHelper(gridSize, gridDivisions, 0xcccccc, 0xeeeeee);
        grid.rotateX(Math.PI / 2); // Rotate to be horizontal
        scene.add(grid);

        planGroup = new THREE.Group();
        planGroup.name = 'planGroup';
        scene.add(planGroup);

        planEl.innerHTML = '';
        planEl.appendChild(renderer.domElement);

        // Basic zoom controls
        planEl.addEventListener('wheel', (e) => {
            e.preventDefault();
            const scaleFactor = e.deltaY > 0 ? 1.1 : 0.9;
            camera.left *= scaleFactor;
            camera.right *= scaleFactor;
            camera.top *= scaleFactor;
            camera.bottom *= scaleFactor;
            camera.updateProjectionMatrix();
            render();
        }, { passive: false });

        window.addEventListener('resize', onResize);
        loadSettings();
    }

    function onResize() {
        if (!camera || !renderer) return;
        const aspect = planEl.clientWidth / planEl.clientHeight;
        const frustumSize = 20;
        camera.left = -frustumSize * aspect / 2;
        camera.right = frustumSize * aspect / 2;
        camera.top = frustumSize / 2;
        camera.bottom = -frustumSize / 2;
        camera.updateProjectionMatrix();
        renderer.setSize(planEl.clientWidth, planEl.clientHeight);
        render();
    }

    function inchesToUnits(inches) {
        return inches * 0.1; // Scale for plan view
    }

    function clearPlan() {
        while (planGroup.children.length > 0) {
            const child = planGroup.children[0];
            planGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        }
    }

    function addPanelOutline(width, height, x = 0, z = 0, label = '') {
        // Panel outline as line segments
        const points = [
            new THREE.Vector3(x - width / 2, 0, z - height / 2),
            new THREE.Vector3(x + width / 2, 0, z - height / 2),
            new THREE.Vector3(x + width / 2, 0, z + height / 2),
            new THREE.Vector3(x - width / 2, 0, z + height / 2),
            new THREE.Vector3(x - width / 2, 0, z - height / 2)
        ];

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 2 });
        const line = new THREE.Line(geometry, material);
        planGroup.add(line);

        // Add label if provided
        if (label && planSettings.showLabels) {
            addTextLabel(label, x, z + height / 2 + 0.5);
        }
    }

    function addHoleCenter(x, z, diameter, label = '') {
        // Hole center as circle outline
        const radius = inchesToUnits(diameter / 2);
        const geometry = new THREE.RingGeometry(radius * 0.95, radius * 1.05, 32);
        const material = new THREE.MeshBasicMaterial({ color: 0xff6600, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(geometry, material);
        ring.position.set(inchesToUnits(x), 0.01, inchesToUnits(z));
        ring.rotation.x = -Math.PI / 2;
        planGroup.add(ring);

        // Center point
        const pointGeometry = new THREE.CircleGeometry(0.05, 8);
        const pointMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const point = new THREE.Mesh(pointGeometry, pointMaterial);
        point.position.set(inchesToUnits(x), 0.02, inchesToUnits(z));
        point.rotation.x = -Math.PI / 2;
        planGroup.add(point);

        // Label
        if (label && planSettings.showLabels) {
            addTextLabel(label, inchesToUnits(x), inchesToUnits(z) - radius - 0.3);
        }
    }

    function addTextLabel(text, x, z) {
        // Simple text representation using small geometry
        // In a full implementation, you'd use THREE.TextGeometry or canvas-based labels
        const labelDiv = document.createElement('div');
        labelDiv.style.cssText = `
            position: absolute;
            color: #333;
            font: 10px monospace;
            pointer-events: none;
            transform: translate(-50%, -50%);
        `;
        labelDiv.textContent = text;

        // Convert 3D position to screen coordinates
        const vector = new THREE.Vector3(x, 0, z);
        vector.project(camera);

        const widthHalf = planEl.clientWidth / 2;
        const heightHalf = planEl.clientHeight / 2;

        labelDiv.style.left = (vector.x * widthHalf + widthHalf) + 'px';
        labelDiv.style.top = (-vector.y * heightHalf + heightHalf) + 'px';

        planEl.appendChild(labelDiv);
    }

    function addDimensionLine(x1, z1, x2, z2, label) {
        if (!planSettings.showDimensions) return;

        const points = [
            new THREE.Vector3(inchesToUnits(x1), 0.01, inchesToUnits(z1)),
            new THREE.Vector3(inchesToUnits(x2), 0.01, inchesToUnits(z2))
        ];

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x0066cc, linewidth: 1 });
        const line = new THREE.Line(geometry, material);
        planGroup.add(line);

        // Dimension label at midpoint
        const midX = (x1 + x2) / 2;
        const midZ = (z1 + z2) / 2;
        addTextLabel(label, inchesToUnits(midX), inchesToUnits(midZ) + 0.2);
    }

    function rebuildPlan(state) {
        if (!renderer || !scene) return;

        lastState = state;
        clearPlan();

        const w = state.width;
        const h = state.height;
        const d = state.depth;

        // Front panel (where holes are cut)
        addPanelOutline(inchesToUnits(w), inchesToUnits(h), 0, -inchesToUnits(d / 2), 'Front Panel');

        // Back panel
        addPanelOutline(inchesToUnits(w), inchesToUnits(h), 0, inchesToUnits(d / 2), 'Back Panel');

        // Side panels
        addPanelOutline(inchesToUnits(d), inchesToUnits(h), -inchesToUnits(w / 2), 0, 'Left Panel');
        addPanelOutline(inchesToUnits(d), inchesToUnits(h), inchesToUnits(w / 2), 0, 'Right Panel');

        // Top and bottom panels (show as dashed lines since they're above/below)
        addPanelOutline(inchesToUnits(w), inchesToUnits(d), 0, 0, 'Top/Bottom');

        // Add holes with their centers and labels
        state.holes.forEach((hole, index) => {
            const nominal = hole.nominal || 12;
            const dia = hole.spec ? hole.spec : (hole.cut ? hole.cut : nominal * 0.93);

            // Holes are on the front panel
            const holeX = (hole.dx || 0);
            const holeZ = -d / 2; // Front panel position

            addHoleCenter(holeX, holeZ, dia, `Hole ${index + 1}\n${dia.toFixed(2)}"`);
        });

        // Add dimension lines
        if (planSettings.showDimensions) {
            // Overall dimensions
            addDimensionLine(-w / 2, -d / 2 - 2, w / 2, -d / 2 - 2, `${w}"`);
            addDimensionLine(-w / 2 - 2, -d / 2, -w / 2 - 2, d / 2, `${d}"`);
        }

        render();
    }

    function render() {
        if (!renderer || !scene || !camera) return;
        renderer.render(scene, camera);
    }

    // Debounced rebuild
    let rebuildTimer = null;
    let pendingState = null;
    function scheduleRebuild(state) {
        pendingState = state;
        if (rebuildTimer) return;
        rebuildTimer = setTimeout(() => {
            rebuildTimer = null;
            if (pendingState) rebuildPlan(pendingState);
        }, 100);
    }

    // Listen for state changes
    window.addEventListener('boxStateChanged', e => {
        const state = e.detail;
        if (!renderer) {
            init();
        }
        scheduleRebuild(state);
    });

    listenerReady = true;
})();