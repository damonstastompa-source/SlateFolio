# SlateFolio v0.3.1

Standalone, local-first digital notebook web app for GitHub Pages.

## Upload to GitHub
Upload every file in this folder to the repository root. No folders are required.

## Included
- Multiple folios/notebooks
- Sections and color coding
- Rich notes, tags, photos, drawings
- Search
- Local browser storage
- JSON backup/restore
- Printing
- SlateFolio logo + app icon/PWA metadata
- Local browser handwriting transcription using Transformers.js + Xenova TrOCR

## Handwriting scan
The handwriting engine runs in the browser. The first scan downloads the model and may take a while; the browser caches it for later scans. v0.3.1 uses WASM/q8 first for iPhone/iPad compatibility and automatically tries WebGPU if that path fails.

For best results, photograph one notebook page straight-on with the page filling most of the frame and good lighting.
