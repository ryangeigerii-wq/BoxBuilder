// Advanced Port Math (Imperial Units) - BoxBuilder
// Provides physical port length solving, velocity estimation, and resonance.
// Exposed globally as window.PortMath.
(function () {
    const C_IN_PER_S = 13503; // ~343 m/s
    const TWO_PI = Math.PI * 2;

    function toIn3(ft3) { return ft3 * 1728; }
    function areaRound(d) { const r = d / 2; return Math.PI * r * r; }
    function areaSlot(w, h) { return w * h; }
    function wettedPerimeterRect(w, h) { return 2 * (w + h); }
    function hydraulicRadiusRect(w, h) { const A = w * h, P = wettedPerimeterRect(w, h); return A / P; }

    function endCorrection({ type, w, h, d, flare = false, flanged = false }) {
        if (type === 'round') {
            const r = d / 2;
            if (flare) return 1.6 * r; // flared free end (expanded effective length)
            return flanged ? 0.85 * r : 0.61 * r; // simple internal vs external free end
        }
        if (type === 'aero') {
            const r = d / 2;
            return 1.6 * r; // treat both ends as flared for aero type
        }
        // slot / rectangular
        const rh = hydraulicRadiusRect(w, h);
        const k = flanged ? 0.85 : 0.75;
        return k * rh;
    }

    function solvePortLength({ Vb_ft3, Fb, type, count = 1, w, h, d, ends = { inner: { flanged: true, flare: false }, outer: { flanged: false, flare: false } } }) {
        const Vb_in3 = toIn3(Vb_ft3);
        const A_single = (type === 'slot') ? areaSlot(w, h) : areaRound(d);
        const A_total = A_single * count;
        const omega = (TWO_PI * Fb) / C_IN_PER_S;
        const L_eff = A_total / (Vb_in3 * (omega * omega));
        const dL_in = endCorrection({ type, w, h, d, flare: ends.inner.flare, flanged: ends.inner.flanged });
        const dL_out = endCorrection({ type, w, h, d, flare: ends.outer.flare, flanged: ends.outer.flanged });
        const L_physical = L_eff - (dL_in + dL_out);
        return {
            area_single_in2: A_single,
            area_total_in2: A_total,
            length_in: Math.max(L_physical, 0.01),
            end_corr_in: dL_in,
            end_corr_out: dL_out,
            length_eff_in: L_eff
        };
    }

    function estimatePortVelocity({ Fb, A_total_in2, Sd_in2, Xmax_in }) {
        if (!Sd_in2 || !Xmax_in) return { v_in_per_s: null, mach: null, ok: null };
        const volumeVelocity = Sd_in2 * Xmax_in * TWO_PI * Fb; // in^3/s peak approx
        const v = Math.SQRT2 * (volumeVelocity / A_total_in2); // peak air velocity in/s
        const mach = v / C_IN_PER_S;
        return { v_in_per_s: v, mach, ok: mach < 0.16 };
    }

    function portResonanceHz(L_eff_in) { return C_IN_PER_S / (4 * L_eff_in); }

    const api = { solvePortLength, estimatePortVelocity, portResonanceHz };
    // Browser global attachment
    if (typeof window !== 'undefined') {
        window.PortMath = api;
    }
    // Node / CommonJS / ESM support for tests
    if (typeof globalThis !== 'undefined') {
        globalThis.PortMath = api;
    }
})();
