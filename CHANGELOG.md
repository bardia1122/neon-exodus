# Changelog

All notable changes to NEON EXODUS are recorded here.

## [1.0.0] — 2026-06-13

First public release.

### Added
- Self-contained build: Three.js vendored locally, runs fully offline from `file://`.
- Portable headless smoke test with a localhost server and browser auto-detection.
- GitHub Actions CI that runs the smoke test on every push as the deploy gate.
- GitHub Pages deployment on every green push to `main`.
- PWA support: web manifest + service worker — installable and playable offline.
- Page metadata: viewport, description, SVG favicon, Open Graph / Twitter cards.
- SYSTEM FAULT error screen that surfaces unrecoverable errors instead of a black canvas.
- Version readout on the main menu.
