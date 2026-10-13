# SlateFolio v0.4.3

Flat, standalone GitHub Pages build. Upload all five files to the repository root.

## v0.4.3 updates
- Prevents iOS Safari input auto-zoom by keeping form control text at 16px or larger.
- Locks background scrolling while dialogs are open and lets the dialog itself scroll.
- Reworks sidebar navigation into expandable tiers: notebook → sections/subsections → note titles.
- Adds explicit, accessible color swatch buttons and updates a section color immediately when selected.
- Keeps local TrOCR handwriting recognition and adds Tesseract.js as a fallback if the handwriting engine fails.
- Keeps the original scanned image attached to the note while inserting recognized text for review.

Data is stored in local browser storage. Export a backup before replacing app files.
