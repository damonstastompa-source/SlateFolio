import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm';

let pipePromise = null;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function findHandwrittenLines(src) {
  return loadImage(src).then(img => {
    const maxW = 1800;
    const scale = Math.min(1, maxW / img.naturalWidth);
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    const rows = new Uint32Array(h);
    const xs = new Uint16Array(h);
    const xe = new Uint16Array(h);
    xs.fill(w); xe.fill(0);

    for (let y=0; y<h; y++) {
      let count=0, minx=w, maxx=0;
      const row=y*w*4;
      for (let x=0; x<w; x++) {
        const i=row+x*4, r=data[i], g=data[i+1], b=data[i+2];
        const max=Math.max(r,g,b), min=Math.min(r,g,b);
        // Dark neutral ink: deliberately rejects the blue notebook rules.
        const ink = max < 165 && (max-min) < 48;
        if (ink) { count++; if(x<minx)minx=x; if(x>maxx)maxx=x; }
      }
      rows[y]=count; xs[y]=minx; xe[y]=maxx;
    }

    const threshold=Math.max(7, Math.floor(w*0.004));
    const bands=[];
    let start=-1,last=-1,minX=w,maxX=0;
    for(let y=0;y<h;y++){
      if(rows[y]>=threshold){
        if(start<0) start=y;
        last=y;
        minX=Math.min(minX,xs[y]); maxX=Math.max(maxX,xe[y]);
      } else if(start>=0 && y-last>7){
        if(last-start>=5 && maxX>minX) bands.push([start,last,minX,maxX]);
        start=-1; minX=w; maxX=0;
      }
    }
    if(start>=0 && last-start>=5 && maxX>minX) bands.push([start,last,minX,maxX]);

    // Merge tiny fragments that belong to the same handwritten line.
    const merged=[];
    for(const b of bands){
      const prev=merged[merged.length-1];
      if(prev && b[0]-prev[1] < 20 && Math.abs(((prev[0]+prev[1])/2)-((b[0]+b[1])/2)) < 42){
        prev[1]=b[1]; prev[2]=Math.min(prev[2],b[2]); prev[3]=Math.max(prev[3],b[3]);
      } else merged.push(b.slice());
    }

    return merged.map(([y1,y2,x1,x2])=>{
      const padX=Math.max(18,Math.round(w*0.015));
      const padY=Math.max(16,Math.round((y2-y1)*0.55));
      const sx=Math.max(0,x1-padX), ex=Math.min(w-1,x2+padX);
      const sy=Math.max(0,y1-padY), ey=Math.min(h-1,y2+padY);
      const c=document.createElement('canvas'); c.width=ex-sx+1; c.height=ey-sy+1;
      c.getContext('2d').drawImage(canvas,sx,sy,c.width,c.height,0,0,c.width,c.height);
      return c.toDataURL('image/jpeg',0.94);
    }).filter(x=>x.length>100);
  });
}

async function getPipe(onProgress) {
  if(!pipePromise){
    const useGpu=!!navigator.gpu;
    pipePromise=pipeline('image-to-text','Xenova/trocr-small-handwritten',{
      device: useGpu ? 'webgpu' : 'wasm',
      dtype: useGpu ? 'fp16' : 'q8',
      progress_callback: info => {
        if(info.status==='progress' && typeof info.progress==='number') onProgress?.(info.progress);
      }
    });
  }
  return pipePromise;
}

async function transcribe(src, hooks={}) {
  const lines=await findHandwrittenLines(src);
  if(!lines.length) throw new Error('No handwriting lines detected');
  hooks.onLines?.(lines.length);
  const pipe=await getPipe(hooks.onModelProgress);
  const out=[];
  for(let i=0;i<lines.length;i++){
    hooks.onLine?.(i+1,lines.length);
    const result=await pipe(lines[i],{max_new_tokens:64,num_beams:2});
    const text=(result?.[0]?.generated_text||'').trim();
    if(text) out.push(text);
  }
  return out.join('\n');
}

window.SlateHandwritingOCR={transcribe};
