// Basic unit tests for port_math.js functions without a test framework.
// Run via: npm run test:js
// Provides assertions and prints results; exits non-zero on failure.
// Converted from ESM import to CommonJS require for Jest compatibility.
require('../port_math.js');

function assertAlmostEqual(actual, expected, tol = 1e-3, msg = '') {
    if (Math.abs(actual - expected) > tol) {
        throw new Error(`Assertion failed: ${msg} expected ~${expected}, got ${actual}`);
    }
}

function assert(cond, msg) {
    if (!cond) throw new Error(`Assertion failed: ${msg}`);
}

function testSlotRoundAreaEquivalence() {
    // Same area: round d chosen to match slot w*h
    const slot = globalThis.PortMath.solvePortLength({ Vb_ft3: 2.0, Fb: 35, type: 'slot', w: 2, h: 4, count: 1 });
    const areaSlot = slot.area_single_in2;
    const equivDiameter = Math.sqrt((4 * areaSlot) / Math.PI); // areaRound(d) = areaSlot
    const round = globalThis.PortMath.solvePortLength({ Vb_ft3: 2.0, Fb: 35, type: 'round', d: equivDiameter, count: 1 });
    // Areas close
    assertAlmostEqual(round.area_single_in2, areaSlot, 1e-6, 'slot vs round area');
    // Effective length should be similar (differences only from end corrections)
    assert(Math.abs(slot.length_eff_in - round.length_eff_in) / round.length_eff_in < 0.02, 'Effective length within 2%');
    return 'testSlotRoundAreaEquivalence passed';
}

function testMultiPortScaling() {
    const single = globalThis.PortMath.solvePortLength({ Vb_ft3: 1.5, Fb: 30, type: 'round', d: 4, count: 1 });
    const quad = globalThis.PortMath.solvePortLength({ Vb_ft3: 1.5, Fb: 30, type: 'round', d: 4, count: 4 });
    // Total area should be 4x
    assertAlmostEqual(quad.area_total_in2, single.area_total_in2 * 4, 1e-6, 'multi-port area scaling');
    // Current formula (L_eff = A_total / (Vb_in3 * (omega^2))) scales L_eff directly with total area.
    assertAlmostEqual(quad.length_eff_in, single.length_eff_in * 4, 1e-6, 'effective length scales directly with area in current model');
    return 'testMultiPortScaling passed';
}

function testResonanceRelation() {
    const res = globalThis.PortMath.solvePortLength({ Vb_ft3: 2.5, Fb: 28, type: 'slot', w: 1.5, h: 10, count: 1 });
    const resonance = globalThis.PortMath.portResonanceHz(res.length_eff_in);
    // Quarter-wave relation: f ~ c/(4L_eff). Already using that formula.
    const expected = 13503 / (4 * res.length_eff_in);
    assertAlmostEqual(resonance, expected, 1e-6, 'resonance formula check');
    // Resonance should be higher than tuning frequency Fb
    assert(resonance > 28, 'resonance above Fb');
    return 'testResonanceRelation passed';
}

describe('PortMath standalone logic (legacy runner converted)', () => {
    test('slot vs round area equivalence', () => {
        testSlotRoundAreaEquivalence();
    });
    test('multi-port scaling', () => {
        testMultiPortScaling();
    });
    test('resonance relation', () => {
        testResonanceRelation();
    });
});
