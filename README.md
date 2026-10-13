# SlateFolio v0.4.1

Flat, GitHub Pages-ready SlateFolio build. Upload all files in this directory to the repository root.

Files: `index.html`, `slatefolio-logo.png`, `manifest.webmanifest`, `.nojekyll`, `README.md`.

This build fixes the v0.4.0 startup bug where event binding stopped at a reference to missing sidebar elements. The sidebar now includes a section list and a New Section control, and all referenced element IDs are present.

Notes are stored in this browser's local storage. Export a backup before replacing deployed files as a precaution.
