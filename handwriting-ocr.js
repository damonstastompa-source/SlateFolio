// SlateFolio local handwriting OCR
// Runs TrOCR in the browser. The page image is never sent to an OCR API.
let pipePromise = null;
let pipeMode = '';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The selected image could not be opened.'));
    img.src = src;
  });
}

function makeLineCrops(src) {
  return loadImage(src).then(img => {
    const maxW = 2200;
    const scale = Math.min(1, maxW / img.naturalWidth);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    // Ignore the outer notebook edge/spiral area when possible.
    const left = Math.floor(w * .04), right = Math.floor(w * .97);
    const top = Math.floor(h * .035), bottom = Math.floor(h * .985);
    const rows = new Uint32Array(bottom - top);
    const xs = new Uint16Array(bottom - top), xe = new Uint16Array(bottom - top);
    xs.fill(w); xe.fill(0);

    // Pencil/ink is usually dark and low-saturation. This deliberately rejects
    // the pale blue notebook rules so they don't become fake text lines.
    for (let yy = top; yy < bottom; yy++) {
      let count = 0, minx = w, maxx = 0;
      const row = yy * w * 4;
      for (let x = left; x < right; x++) {
        const i = row + x * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const hi = Math.max(r, g, b), lo = Math.min(r, g, b);
        const lowSat = (hi - lo) < 55;
        const dark = hi < 175;
        if (dark && lowSat) { count++; minx = Math.min(minx, x); maxx = Math.max(maxx, x); }
      }
      const j = yy - top;
      rows[j] = count; xs[j] = minx; xe[j] = maxx;
    }

    const threshold = Math.max(4, Math.floor((right - left) * .0022));
    const raw = [];
    let start = -1, last = -1, minX = w, maxX = 0;
    const finish = () => {
      if (start >= 0 && last - start >= 4 && maxX > minX) raw.push([start + top, last + top, minX, maxX]);
      start = -1; last = -1; minX = w; maxX = 0;
    };
    for (let j = 0; j < rows.length; j++) {
      if (rows[j] >= threshold) {
        if (start < 0) start = j;
        last = j;
        minX = Math.min(minX, xs[j]); maxX = Math.max(maxX, xe[j]);
      } else if (start >= 0 && j - (last - top) > 9) finish();
    }
    finish();

    // Merge fragments belonging to the same written line, but never merge
    // neighboring notebook lines too aggressively.
    const bands = [];
    for (const b of raw) {
      const prev = bands[bands.length - 1];
      const gap = prev ? b[0] - prev[1] : 999;
      if (prev && gap < 16 && (b[3] - b[2]) > (right - left) * .08) {
        prev[1] = b[1]; prev[2] = Math.min(prev[2], b[2]); prev[3] = Math.max(prev[3], b[3]);
      } else bands.push(b.slice());
    }

    const crops = [];
    for (const [y1, y2, x1, x2] of bands) {
      const padX = Math.max(20, Math.round(w * .018));
      const padY = Math.max(14, Math.round((y2 - y1) * .8));
      const sx = Math.max(0, x1 - padX), ex = Math.min(w - 1, x2 + padX);
      const sy = Math.max(0, y1 - padY), ey = Math.min(h - 1, y2 + padY);
      if (ex - sx < 70 || ey - sy < 12) continue;

      const c = document.createElement('canvas');
      // TrOCR works best when the handwritten line is presented clearly on white.
      c.width = (ex - sx + 1) * 2;
      c.height = (ey - sy + 1) * 2;
      const cc = c.getContext('2d');
      cc.fillStyle = '#fff'; cc.fillRect(0, 0, c.width, c.height);
      cc.imageSmoothingEnabled = true;
      cc.drawImage(canvas, sx, sy, ex - sx + 1, ey - sy + 1, 0, 0, c.width, c.height);
      crops.push(c.toDataURL('image/png'));
    }
    return crops;
  });
}

async function getPipe(hooks) {
  if (pipePromise) return pipePromise;
  pipePromise = (async () => {
    try {
      hooks?.onModelStatus?.('Loading local handwriting engine (CPU mode for maximum iPhone compatibility)…');
      const mod = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm');
      const { pipeline, env } = mod;
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      // WASM + q8 is the compatibility path on iPhone/iPad. WebGPU can be
      // enabled later once the core workflow is proven stable.
      pipeMode = 'WASM / q8';
      return await pipeline('image-to-text', 'Xenova/trocr-small-handwritten', {
        device: 'wasm',
        dtype: 'q8',
        progress_callback: info => {
          if (info?.status === 'progress' && typeof info.progress === 'number') hooks?.onModelProgress?.(info.progress);
          else if (info?.status === 'initiate') hooks?.onModelStatus?.(`Preparing handwriting model: ${info.file ?? ''}`);
        }
      });
    } catch (wasmErr) {
      // One automatic GPU retry. Some desktop browsers are substantially faster here.
      try {
        hooks?.onModelStatus?.('CPU engine unavailable; trying compatible GPU mode…');
        const mod = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm');
        const { pipeline, env } = mod;
        env.allowLocalModels = false; env.useBrowserCache = true;
        pipeMode = 'WebGPU / fp16';
        return await pipeline('image-to-text', 'Xenova/trocr-small-handwritten', {
          device: 'webgpu', dtype: 'fp16',
          progress_callback: info => {
            if (info?.status === 'progress' && typeof info.progress === 'number') hooks?.onModelProgress?.(info.progress);
          }
        });
      } catch (gpuErr) {
        throw new Error(`Handwriting engine could not start. CPU: ${wasmErr?.message || wasmErr}; GPU: ${gpuErr?.message || gpuErr}`);
      }
    }
  })();
  return pipePromise;
}

async function transcribe(src, hooks = {}) {
  const lines = await makeLineCrops(src);
  if (!lines.length) throw new Error('I could not find handwriting lines in this photo. Move closer and make sure the page fills most of the picture.');
  hooks.onLines?.(lines.length);
  const pipe = await getPipe(hooks);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    hooks.onLine?.(i + 1, lines.length, pipeMode);
    const result = await pipe(lines[i], { max_new_tokens: 96, num_beams: 4 });
    const text = (Array.isArray(result) ? result[0]?.generated_text : result?.generated_text || '').trim();
    if (text) out.push(text);
  }
  if (!out.length) throw new Error('The handwriting model ran, but did not return any text.');
  return out.join('\n');
}

window.SlateHandwritingOCR = { transcribe };
