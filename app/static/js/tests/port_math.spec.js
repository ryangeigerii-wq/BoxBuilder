// Load port_math via CommonJS require so Jest (CJS env) doesn't need ESM transforms.
require('../port_math.js');
const PM = globalThis.PortMath;

// Helper to assert relative difference under threshold for clarity.
function expectRelDiffLess(a, b, threshold) {
    const rel = Math.abs(a - b) / b;
    expect(rel).toBeLessThan(threshold);
}

describe('PortMath solvePortLength', () => {
    test('slot vs round area equivalence approximate effective length', () => {
        const slot = PM.solvePortLength({ Vb_ft3: 2.0, Fb: 35, type: 'slot', w: 2, h: 4, count: 1 });
        const areaSlot = slot.area_single_in2;
        const equivD = Math.sqrt((4 * areaSlot) / Math.PI);
        const round = PM.solvePortLength({ Vb_ft3: 2.0, Fb: 35, type: 'round', d: equivD, count: 1 });
        expect(round.area_single_in2).toBeCloseTo(areaSlot, 1e-6);
        expectRelDiffLess(slot.length_eff_in, round.length_eff_in, 0.05); // within 5%
    });

    test('multi-port scaling proportional effective length', () => {
        const single = PM.solvePortLength({ Vb_ft3: 1.5, Fb: 30, type: 'round', d: 4, count: 1 });
        const quad = PM.solvePortLength({ Vb_ft3: 1.5, Fb: 30, type: 'round', d: 4, count: 4 });
        expect(quad.area_total_in2).toBeCloseTo(single.area_total_in2 * 4, 6);
        expect(quad.length_eff_in).toBeCloseTo(single.length_eff_in * 4, 6);
    });
});

describe('PortMath resonance & velocity', () => {
    test('resonance uses quarter-wave and exceeds Fb', () => {
        const res = PM.solvePortLength({ Vb_ft3: 2.5, Fb: 28, type: 'slot', w: 1.5, h: 10, count: 1 });
        const resonance = PM.portResonanceHz(res.length_eff_in);
        const expected = 13503 / (4 * res.length_eff_in);
        expect(resonance).toBeCloseTo(expected, 6);
        expect(resonance).toBeGreaterThan(28);
    });

    test('velocity estimation returns null without Sd/Xmax', () => {
        const vInfo = PM.estimatePortVelocity({ Fb: 32, A_total_in2: 24 });
        expect(vInfo.v_in_per_s).toBeNull();
        expect(vInfo.mach).toBeNull();
        expect(vInfo.ok).toBeNull();
    });

    test('velocity estimation decreases with more area', () => {
        // Provide fake driver surface and excursion
        const single = PM.solvePortLength({ Vb_ft3: 1.5, Fb: 30, type: 'round', d: 4, count: 1 });
        const quad = PM.solvePortLength({ Vb_ft3: 1.5, Fb: 30, type: 'round', d: 4, count: 4 });
        const vSingle = PM.estimatePortVelocity({ Fb: 30, A_total_in2: single.area_total_in2, Sd_in2: 50, Xmax_in: 0.5 });
        const vQuad = PM.estimatePortVelocity({ Fb: 30, A_total_in2: quad.area_total_in2, Sd_in2: 50, Xmax_in: 0.5 });
        expect(vSingle.v_in_per_s).toBeGreaterThan(vQuad.v_in_per_s);
        expect(vSingle.mach).toBeGreaterThan(vQuad.mach);
        expect(vSingle.ok).toBe(vQuad.ok); // boolean threshold unaffected (both likely < 0.16)
    });
});
