import '../port_math.js';
const PM = globalThis.PortMath;
const single = PM.solvePortLength({ Vb_ft3: 1.5, Fb: 30, type: 'round', d: 4, count: 1 });
const quad = PM.solvePortLength({ Vb_ft3: 1.5, Fb: 30, type: 'round', d: 4, count: 4 });
console.log('single', single);
console.log('quad', quad);
