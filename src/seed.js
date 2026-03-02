// Browser-side mosaic seeder. Clears existing drawings and fills every slot
// with a generated drawing that uses the reference image region as background.

import { getImage, addDrawing, clearDrawings } from './store.js';

// ── Color extraction (mirrors color-extract.js, adds per-color weights) ───────

function colorDist([r1,g1,b1],[r2,g2,b2]) {
  return Math.sqrt((r1-r2)**2+(g1-g2)**2+(b1-b2)**2);
}
function saturation([r,g,b]) {
  const max=Math.max(r,g,b),min=Math.min(r,g,b); return max===0?0:(max-min)/max;
}
function toHex([r,g,b]) {
  return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
}

function pickDistinct(pixels, count) {
  const candidates = pixels
    .filter(([r,g,b]) => { const a=(r+g+b)/3; return a>15&&a<240; })
    .sort((a,b) => saturation(b)-saturation(a));
  if (!candidates.length) return pixels.slice(0,count).map(toHex);
  const sel = [candidates[0]];
  for (const p of candidates) {
    if (sel.length>=count) break;
    if (Math.min(...sel.map(s=>colorDist(p,s)))>=28) sel.push(p);
  }
  if (sel.length<count) {
    for (const p of candidates) {
      if (sel.length>=count) break;
      if (!sel.some(s=>colorDist(p,s)<12)) sel.push(p);
    }
  }
  return sel;
}

function extractSlotPalette(img, slotIndex, cols, rows) {
  const slotW = img.width/cols, slotH = img.height/rows;
  const col = slotIndex%cols, row = Math.floor(slotIndex/cols);
  const res = 16;
  const sc = document.createElement('canvas');
  sc.width = sc.height = res;
  sc.getContext('2d').drawImage(img, col*slotW, row*slotH, slotW, slotH, 0, 0, res, res);
  const {data} = sc.getContext('2d').getImageData(0,0,res,res);
  const pixels = [];
  for (let i=0;i<data.length;i+=4) pixels.push([data[i],data[i+1],data[i+2]]);

  const selected = pickDistinct(pixels, 5);
  const counts = new Array(selected.length).fill(0);
  for (const px of pixels) {
    let best=0, bestD=Infinity;
    for (let i=0;i<selected.length;i++) { const d=colorDist(px,selected[i]); if(d<bestD){bestD=d;best=i;} }
    counts[best]++;
  }
  const total = pixels.length||1;
  const weights = [...counts.map(c=>c/total), 0.02];
  const wsum = weights.reduce((a,b)=>a+b,0);
  return {
    palette: [...selected.map(toHex), '#ffffff'],
    weights: weights.map(w=>w/wsum),
  };
}

// ── Drawing techniques ─────────────────────────────────────────────────────────

function rnd(a,b) { return a+Math.random()*(b-a); }
function rndInt(a,b) { return Math.floor(rnd(a,b+1)); }

function weightedPick(arr, weights) {
  let acc=0, r=Math.random();
  for (let i=0;i<arr.length;i++) { acc+=weights[i]; if(r<=acc) return arr[i]; }
  return arr[arr.length-1];
}

function squiggle(ctx, w, h, pc) {
  for (let p=0;p<rndInt(3,7);p++) {
    ctx.beginPath(); ctx.strokeStyle=pc(); ctx.lineWidth=6;
    let x=rnd(0,w), y=rnd(0,h); ctx.moveTo(x,y);
    for (let i=0;i<rndInt(8,20);i++) {
      const cx1=x+rnd(-w*.35,w*.35), cy1=y+rnd(-h*.35,h*.35);
      x=rnd(.05*w,.95*w); y=rnd(.05*h,.95*h);
      ctx.quadraticCurveTo(cx1,cy1,x,y);
    }
    ctx.stroke();
  }
}

function scribbleFill(ctx, w, h, pc) {
  ctx.strokeStyle=pc(); ctx.lineWidth=6;
  const angle=rnd(0,Math.PI), spacing=rnd(4,10);
  const cos=Math.cos(angle+Math.PI/2), sin=Math.sin(angle+Math.PI/2), diag=Math.hypot(w,h);
  for (let d=-diag/2;d<diag/2;d+=spacing) {
    const cx=w/2+cos*d, cy=h/2+sin*d, dx=Math.cos(angle)*diag, dy=Math.sin(angle)*diag;
    ctx.beginPath(); ctx.moveTo(cx-dx/2+rnd(-2,2),cy-dy/2+rnd(-2,2));
    ctx.lineTo(cx+dx/2+rnd(-2,2),cy+dy/2+rnd(-2,2)); ctx.stroke();
  }
}

function boldBlobs(ctx, w, h, pc) {
  for (let i=0;i<rndInt(4,10);i++) {
    ctx.beginPath(); ctx.fillStyle=pc();
    const rx=rnd(w*.05,w*.25), ry=rnd(h*.05,h*.25);
    ctx.ellipse(rnd(rx,w-rx),rnd(ry,h-ry),rx,ry,rnd(0,Math.PI),0,Math.PI*2); ctx.fill();
  }
}

function hatching(ctx, w, h, pc) {
  ctx.strokeStyle=pc(); ctx.lineWidth=6;
  const cx=rnd(.2*w,.8*w), cy=rnd(.2*h,.8*h), bw=rnd(w*.2,w*.6), bh=rnd(h*.2,h*.6);
  const angle=rnd(0,Math.PI), spacing=rnd(3,7), len=Math.hypot(bw,bh);
  const cos=Math.cos(angle+Math.PI/2), sin=Math.sin(angle+Math.PI/2);
  ctx.save(); ctx.beginPath(); ctx.rect(cx-bw/2,cy-bh/2,bw,bh); ctx.clip();
  for (let d=-len/2;d<len/2;d+=spacing) {
    const ox=cos*d+cx, oy=sin*d+cy, dx=Math.cos(angle)*len/2, dy=Math.sin(angle)*len/2;
    ctx.beginPath(); ctx.moveTo(ox-dx,oy-dy); ctx.lineTo(ox+dx,oy+dy); ctx.stroke();
  }
  ctx.restore();
}

function burstLines(ctx, w, h, pc) {
  const cx=rnd(.2*w,.8*w), cy=rnd(.2*h,.8*h);
  for (let i=0;i<rndInt(8,18);i++) {
    const angle=(i/18)*Math.PI*2+rnd(-.2,.2), len=rnd(Math.min(w,h)*.1,Math.min(w,h)*.5);
    ctx.beginPath(); ctx.strokeStyle=pc(); ctx.lineWidth=6;
    ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(angle)*len,cy+Math.sin(angle)*len); ctx.stroke();
  }
}

function makeDrawing(img, slotIndex, cols, rows) {
  const W = 300, H = 300;
  const slotW = img.width/cols, slotH = img.height/rows;
  const col = slotIndex%cols, row = Math.floor(slotIndex/cols);

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  if (localStorage.getItem('schema:show-bg') === 'true') {
    ctx.drawImage(img, col*slotW, row*slotH, slotW, slotH, 0, 0, W, H);
  }

  // Color palette weighted by region content
  const {palette, weights} = extractSlotPalette(img, slotIndex, cols, rows);
  const strokeColors = [], strokeWeights = [];
  palette.forEach((c,i) => { if(c!=='#ffffff'){strokeColors.push(c);strokeWeights.push(weights[i]);} });
  if (!strokeColors.length) { strokeColors.push('#222'); strokeWeights.push(1); }
  const wsum = strokeWeights.reduce((a,b)=>a+b,0);
  strokeWeights.forEach((_,i)=>strokeWeights[i]/=wsum);
  const pc = () => weightedPick(strokeColors, strokeWeights);

  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const techniques = [squiggle, scribbleFill, boldBlobs, hatching, burstLines];
  const chosen = techniques.sort(()=>Math.random()-.5).slice(0, rndInt(2,4));
  for (const fn of chosen) fn(ctx, W, H, pc);

  return canvas.toDataURL('image/png');
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function seedMosaic(emptyCount, onProgress) {
  const image = getImage();
  if (!image?.dataUrl) return;

  const {cols, rows, dataUrl} = image;
  const total = cols * rows;

  const img = await new Promise((res, rej) => {
    const i = new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=dataUrl;
  });

  clearDrawings();
  await new Promise(r => setTimeout(r, 300)); // let clear propagate

  const blank = new Set();
  while (blank.size < Math.min(emptyCount, total)) blank.add(Math.floor(Math.random() * total));

  for (let i = 0; i < total; i++) {
    if (!blank.has(i)) addDrawing(makeDrawing(img, i, cols, rows), i);
    onProgress(i + 1, total);
    await new Promise(r => setTimeout(r, 20));
  }
}
