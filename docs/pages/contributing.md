---
layout: page
title: Contributing
permalink: /contributing/
---
# Contributing Guide

## Workflow
1. Fork & branch: `feat/<short-topic>`
2. Add/adjust tests in `tests/` (aim for failing test first when fixing bugs)
3. Run:
```powershell
pytest -q
npm test   # if front-end changes
```
4. Commit with conventional prefix (`feat:`, `fix:`, `docs:`, `ci:`, `refactor:`)
5. Open PR; ensure CI + Pages pass.

## Commit Scope Examples
- `feat(port-fold): add vertical leg support`
- `fix(export-svg): correct panel order in metadata`
- `docs(pages): reorg overview and quickstart`

## Code Style
- Python: ruff + black (auto-fix where possible)
- JS: Prettier (pending mass-format cleanup)

## Testing Focus
- Deterministic numeric outputs (port math, packing)
- Export artifact presence & header integrity
- 3D preview smoke (Playwright) kept minimal to reduce flake

## PR Checklist
- [ ] Tests added/updated
- [ ] All tests pass locally
- [ ] Docs updated (if user-visible change)
- [ ] No large unrelated formatting diffs

## Release Suggestions
Tag semantic versions when introducing breaking API changes to export endpoints.
