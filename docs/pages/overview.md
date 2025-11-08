---
layout: page
title: Overview
permalink: /overview/
---
# BoxBuilder Overview

A deterministic, framework-free subwoofer enclosure designer.

## Key Capabilities
- FastAPI backend (no external scraping dependencies)
- Vanilla JS front-end (SVG + Three.js) for live geometry & ports
- Export endpoints (JSON config, SVG/DXF, PDF cut sheets, preview PDFs)
- Deterministic port math (length, velocity, resonance) and slot fold planning

## Architecture Highlights
- Single-page builder interface backed by REST endpoints
- Segmented export directories (`svg_box`, `dxf_cutsheets`, etc.) for artifact clarity
- Procedural finishes (texture cache) for realistic material previews
- 3D preview always-on (no framework overhead)

For a guided setup see [Quick Start](/quickstart/).
