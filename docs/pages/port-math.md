---
layout: page
title: Port Math
permalink: /port-math/
---
# Port Math & Folding

## Core Functions (window.PortMath)
- `solvePortLength(params)` – Computes required physical length from target tuning (Helmholtz) with end corrections.
- `estimatePortVelocity(params)` – Peak velocity estimate to assess Mach thresholds.
- `portResonanceHz(params)` – First longitudinal resonance (quarter-wave) of port.

## Slot Fold Planning
Generates ordered `segments` with axis-aligned runs and `bend` markers; adds vertical and labyrinth legs when required. Multi-slot `portOffsets` distribute area.

Example foldPlan:
```json
{
  "segments": [
    {"axis":"depth","len":14},
    {"kind":"bend","angle":90},
    {"axis":"width","len":18.5},
    {"kind":"bend","angle":90},
    {"axis":"height","len":4},
    {"kind":"bend","angle":90},
    {"axis":"width","len":12.25}
  ],
  "bendPenaltyIn":3.0,
  "effectiveLengthIn":51.75,
  "overflows":false,
  "portOffsets":[-3.5,3.5]
}
```

## Warnings
- `mach_high` – velocity exceeding recommended threshold (≈0.16 Mach)
- `resonance_close` – resonance < 3×Fb
- `fold_overflow` – design length unfittable after labyrinth attempt

## Future Enhancements
- Segment-wise velocity map
- Collision detection with holes/bracing
- Adaptive bend penalty by aspect ratio

Return to [Exports](/exports/) to include port diagnostics in artifacts.
