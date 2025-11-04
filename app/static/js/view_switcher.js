// View Mode Switching Logic - Toggle between Assembled and Exploded views
(function () {
    const VIEW_MODE_KEY = 'boxBuilderViewMode';
    let currentViewMode = 'assembled'; // Start with assembled view

    const explodedViewBtn = document.getElementById('explodedViewBtn');
    const view3dBtn = document.getElementById('view3dBtn');
    const preview3d = document.getElementById('preview3d');

    // 3D-specific controls
    const autoRotateBtn = document.getElementById('autoRotateBtn');
    const funSpinBtn = document.getElementById('funSpinBtn');
    const ghostBtn = document.getElementById('ghostBtn');
    const scaleSlider = document.getElementById('scaleSlider');
    const scaleLabel = document.getElementById('scaleSliderLabel');

    function loadViewMode() {
        try {
            const stored = localStorage.getItem(VIEW_MODE_KEY);
            if (stored === 'exploded' || stored === 'assembled') {
                currentViewMode = stored;
            }
        } catch (e) { /* ignore */ }
    }

    function saveViewMode() {
        try {
            localStorage.setItem(VIEW_MODE_KEY, currentViewMode);
        } catch (e) { /* ignore */ }
    }

    function updateButtonStates() {
        if (explodedViewBtn && view3dBtn) {
            if (currentViewMode === 'exploded') {
                explodedViewBtn.style.background = '#444';
                explodedViewBtn.style.color = '#fff';
                view3dBtn.style.background = '#222';
                view3dBtn.style.color = '#ddd';
            } else {
                explodedViewBtn.style.background = '#222';
                explodedViewBtn.style.color = '#ddd';
                view3dBtn.style.background = '#444';
                view3dBtn.style.color = '#fff';
            }
        }
    }

    function showView(mode) {
        currentViewMode = mode;
        saveViewMode();
        updateButtonStates();

        // Trigger exploded mode change in 3D preview
        const event = new CustomEvent('viewModeChanged', {
            detail: { mode: mode, exploded: mode === 'exploded' }
        });
        window.dispatchEvent(event);
    }

    function init() {
        loadViewMode();

        if (explodedViewBtn) {
            explodedViewBtn.addEventListener('click', () => showView('exploded'));
        }

        if (view3dBtn) {
            view3dBtn.addEventListener('click', () => showView('assembled'));
        }

        // Initialize with stored/default view mode
        showView(currentViewMode);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();