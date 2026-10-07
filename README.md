# SlateFolio

A local-first digital notebook for GitHub Pages.

## v0.1.0

First build includes:
- Multiple folios/notebooks
- Sections with custom colors
- Rich-text notes
- Tags and global search
- Photo/camera attachments
- Simple drawing canvas
- Local browser storage
- JSON backup/restore
- Printer-friendly section output
- Responsive mobile layout
- SlateFolio branding/icon

## Deploy

Upload the contents of this folder to a GitHub repository and enable **GitHub Pages** from the repository's Pages settings. No build step is required.

## Data

Notes are stored in the browser's localStorage. Use **Backup / Restore** regularly if the data matters. Clearing browser/site data can remove local notes.

## Next planned build

OCR from captured pages, drag-and-drop section/note ordering, nested subsections, richer page layouts, drawing/image annotations, inbox, and more robust import/export validation.


### App icon
The SlateFolio logo is used directly as the browser favicon and the iPhone/iPad Home Screen icon. The manifest is included for installable/PWA support.


### Handwriting OCR
SlateFolio v0.3 adds a local browser handwriting recognizer using Transformers.js and the Xenova `trocr-small-handwritten` model. The model is downloaded on first use and then cached by the browser; the note image is processed in the browser rather than uploaded to an OCR API. A strong Wi-Fi connection is recommended for the first handwriting scan.
