// Archived Fun Spin Feature (removed from live build)
// This file preserves the original logic for potential future re-introduction.
// Dependencies: THREE.js scene with boxGroup, planeMeshes, interiorPanel, restoreBaseMaterials(), focusFrontHoles().

/*
Original integrated variables/state (now removed from three_preview.js):
  let funSpin = false;
  let funSpinVel = new THREE.Vector3();
  let lastTextureChangeTime = 0;
  const FUN_SPIN_TEXTURE_INTERVAL = 2000; // ms
  let orientTween = null; // orientation reset tween
*/

export function seedFunSpin(funSpinVel) {
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
    if (dir.lengthSq() < 0.0001) dir.set(0, 1, 0);
    dir.normalize();
    const BASE_SPEED = 0.035;
    funSpinVel.copy(dir.multiplyScalar(BASE_SPEED));
}

export function randomizeTextures(planeMeshes, interiorPanel) {
    const palette = [0x223240, 0x334455, 0x445566, 0x556677, 0x667788, 0x8899aa, 0x2e3b55, 0x3d4f6a];
    const randColor = () => palette[Math.floor(Math.random() * palette.length)];
    for (const key of Object.keys(planeMeshes)) {
        const mesh = planeMeshes[key];
        if (mesh && mesh.material && mesh.material.color) {
            mesh.material.color.setHex(randColor());
            mesh.material.needsUpdate = true;
        }
    }
    if (interiorPanel && interiorPanel.material) {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const hueShift = Math.random() * 40 - 20;
        function adjust(hex) {
            const c = parseInt(hex.replace('#', ''), 16);
            let r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
            r = Math.min(255, Math.max(0, r + hueShift));
            g = Math.min(255, Math.max(0, g + hueShift * 0.6));
            b = Math.min(255, Math.max(0, b + hueShift * 0.3));
            return `rgb(${r},${g},${b})`;
        }
        const gradient = ctx.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, adjust('#D2B48C'));
        gradient.addColorStop(0.3, adjust('#8B4513'));
        gradient.addColorStop(0.7, adjust('#A0522D'));
        gradient.addColorStop(1, adjust('#654321'));
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, 256, 256);
        ctx.strokeStyle = adjust('#654321'); ctx.lineWidth = 1;
        for (let i = 0; i < 20; i++) { ctx.beginPath(); ctx.moveTo(0, Math.random() * 256); ctx.quadraticCurveTo(128 + Math.random() * 64, Math.random() * 256, 256, Math.random() * 256); ctx.stroke(); }
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2, 2);
        interiorPanel.material.map = tex;
        interiorPanel.material.needsUpdate = true;
    }
}

export function beginOrientationReset(boxGroup, callbackDone) {
    const startQ = boxGroup.quaternion.clone();
    const endQ = new THREE.Quaternion();
    const deltaQ = startQ.clone().inverse().multiply(endQ);
    const angle = 2 * Math.acos(Math.min(1, Math.max(-1, deltaQ.w)));
    const duration = angle < 0.08 ? 160 : 650;
    const tween = { start: startQ, end: endQ, startTime: performance.now(), duration };
    function step() {
        const tRaw = (performance.now() - tween.startTime) / tween.duration;
        const t = tRaw >= 1 ? 1 : (tRaw < 0 ? 0 : tRaw);
        THREE.Quaternion.slerp(tween.start, tween.end, boxGroup.quaternion, t);
        boxGroup.rotation.setFromQuaternion(boxGroup.quaternion, undefined, true);
        if (t < 1) requestAnimationFrame(step); else { callbackDone && callbackDone(); }
    }
    requestAnimationFrame(step);
}

// Usage (previous live implementation outline):
// funSpin = true -> seedFunSpin(funSpinVel); randomizeTextures(...);
// animate loop: if funSpin apply angular velocity; periodic randomizeTextures();
// funSpin off -> beginOrientationReset(boxGroup, () => { restoreBaseMaterials(); focusFrontHoles(); });
