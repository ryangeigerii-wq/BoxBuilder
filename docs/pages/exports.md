---
layout: page
title: Exports
permalink: /exports/
---
# Export Endpoints

## Summary
| Kind | Endpoint | Persisted Dir | Notes |
|------|----------|---------------|-------|
| Config JSON | POST /export/box | output/temp | Timestamped minimal state |
| Basic SVG | POST /export/basic-svg | output/svg_box | Single rectangle placeholder or metadata mode |
| Basic DXF | POST /export/basic-dxf | output/dxf_box | Minimal DXF scaffold |
| Cut Sheet SVG | POST /export/svg | output/svg_cutsheets | Panel layout (packing) |
| Cut Sheet DXF | POST /export/dxf | output/dxf_cutsheets | Packed rectangles, layer separation |
| Cut Sheet PDF | POST /export/pdf | output/cut_sheets | Multi-sheet printable layout |
| Preview PDF | POST /export/preview-pdf | output/preview_pdfs | Isometric + panel list pages |

## Hashing & Caching
Basic exports add SHA-256 digest (ETag header, JSON hash field) for reuse and integrity checks.

## SVG Metadata Mode
`{"mode":"json"}` returns persistence info + inline preview snippet (<8KB).

## DXF Notes
Outputs ASCII DXF with HEADER/TABLES/ENTITIES sections. Lines only; future arcs/circles for cutouts pending.

## Kerf Handling
PDF/SVG/DXF cut sheet endpoints apply kerf spacing (panel dims unchanged; free space reduced). Tweak `kerf_thickness` in request body.

See [Port Math](/port-math/) for integrating port data into exports.
