// One-off seeder: fills empty slots with generated drawings that use each
// slot's extracted color palette and look like actual freehand sketches.
// Usage: node scripts/seed.js <slug> [--clear]

import { createCanvas, loadImage } from 'canvas';
import WebSocket from 'ws';

const slug = process.argv[2];
if (!slug || slug.startsWith('--')) {
  console.error('Usage: node scripts/seed.js <slug> [--clear]');
  process.exit(1);
}

const CLEAR_FIRST = process.argv.includes('--clear');

// ── Color extraction (mirrors src/color-extract.js) ──────────────────────────

function colorDist([r1, g1, b1], [r2, g2, b2]) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function saturation([r, g, b]) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function toHex([r, g, b]) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function pickDistinct(pixels, count) {
  const candidates = pixels
    .filter(([r, g, b]) => { const avg = (r + g + b) / 3; return avg > 15 && avg < 240; })
    .sort((a, b) => saturation(b) - saturation(a));
  if (candidates.length === 0) return pixels.slice(0, count).map(toHex);

  const selected = [candidates[0]];
  for (const p of candidates) {
    if (selected.length >= count) break;
    if (Math.min(...selected.map(s => colorDist(p, s))) >= 28) selected.push(p);
  }
  if (selected.length < count) {
    for (const p of candidates) {
      if (selected.length >= count) break;
      if (!selected.some(s => colorDist(p, s) < 12)) selected.push(p);
    }
  }
  return selected;
}

async function extractSlotPalette(img, slotIndex, cols, rows, paletteSize = 5) {
  const slotW = img.width / cols;
  const slotH = img.height / rows;
  const col = slotIndex % cols;
  const row = Math.floor(slotIndex / cols);

  const sampleRes = 16;
  const sc = createCanvas(sampleRes, sampleRes);
  sc.getContext('2d').drawImage(img, col * slotW, row * slotH, slotW, slotH, 0, 0, sampleRes, sampleRes);
  const { data } = sc.getContext('2d').getImageData(0, 0, sampleRes, sampleRes);
  const pixels = [];
  for (let i = 0; i < data.length; i += 4) pixels.push([data[i], data[i + 1], data[i + 2]]);

  const selected = pickDistinct(pixels, paletteSize);

  const counts = new Array(selected.length).fill(0);
  for (const px of pixels) {
    let best = 0, bestDist = Infinity;
    for (let i = 0; i < selected.length; i++) {
      const d = colorDist(px, selected[i]);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    counts[best]++;
  }

  const total = pixels.length || 1;
  const weights = counts.map(c => c / total);
  const palette = [...selected.map(toHex), '#ffffff'];
  weights.push(0.02);
  const wsum = weights.reduce((a, b) => a + b, 0);
  return { palette, weights: weights.map(w => w / wsum) };
}

// ── Drawing generator ─────────────────────────────────────────────────────────

function rnd(min, max) { return min + Math.random() * (max - min); }
function rndInt(min, max) { return Math.floor(rnd(min, max + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function weightedPick(arr, weights) {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < arr.length; i++) {
    acc += weights[i];
    if (r <= acc) return arr[i];
  }
  return arr[arr.length - 1];
}

async function makeDrawingAsync(w, h, palette, weights) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');

  const strokeColors = [], strokeWeights = [];
  palette.forEach((c, i) => {
    if (c !== '#ffffff') { strokeColors.push(c); strokeWeights.push(weights?.[i] ?? 1); }
  });
  if (strokeColors.length === 0) { strokeColors.push('#222222'); strokeWeights.push(1); }
  const wsum = strokeWeights.reduce((a, b) => a + b, 0);
  strokeWeights.forEach((_, i) => strokeWeights[i] /= wsum);

  const colors = strokeColors;
  const pickColor = () => weights ? weightedPick(strokeColors, strokeWeights) : pick(colors);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const techniques = [squiggle, scribbleFill, boldBlobs, hatching, burstLines];
  const chosen = techniques.sort(() => Math.random() - 0.5).slice(0, rndInt(2, 4));
  for (const fn of chosen) fn(ctx, w, h, pickColor);

  return canvas.toDataURL('image/png');
}

function squiggle(ctx, w, h, pickColor) {
  const passes = rndInt(3, 7);
  for (let p = 0; p < passes; p++) {
    ctx.beginPath();
    ctx.strokeStyle = pickColor();
    ctx.lineWidth = 6;
    let x = rnd(0, w), y = rnd(0, h);
    ctx.moveTo(x, y);
    const steps = rndInt(8, 20);
    for (let i = 0; i < steps; i++) {
      const cx1 = x + rnd(-w * 0.35, w * 0.35);
      const cy1 = y + rnd(-h * 0.35, h * 0.35);
      x = rnd(0.05 * w, 0.95 * w);
      y = rnd(0.05 * h, 0.95 * h);
      ctx.quadraticCurveTo(cx1, cy1, x, y);
    }
    ctx.stroke();
  }
}

function scribbleFill(ctx, w, h, pickColor) {
  ctx.strokeStyle = pickColor();
  ctx.lineWidth = 6;
  const angle = rnd(0, Math.PI);
  const spacing = rnd(4, 10);
  const cos = Math.cos(angle + Math.PI / 2);
  const sin = Math.sin(angle + Math.PI / 2);
  const diag = Math.hypot(w, h);
  for (let d = -diag / 2; d < diag / 2; d += spacing) {
    const cx = w / 2 + cos * d, cy = h / 2 + sin * d;
    const dx = Math.cos(angle) * diag, dy = Math.sin(angle) * diag;
    ctx.beginPath();
    ctx.moveTo(cx - dx / 2 + rnd(-2, 2), cy - dy / 2 + rnd(-2, 2));
    ctx.lineTo(cx + dx / 2 + rnd(-2, 2), cy + dy / 2 + rnd(-2, 2));
    ctx.stroke();
  }
}

function boldBlobs(ctx, w, h, pickColor) {
  const count = rndInt(4, 10);
  for (let i = 0; i < count; i++) {
    ctx.beginPath();
    ctx.fillStyle = pickColor();
    const rx = rnd(w * 0.05, w * 0.25), ry = rnd(h * 0.05, h * 0.25);
    ctx.ellipse(rnd(rx, w - rx), rnd(ry, h - ry), rx, ry, rnd(0, Math.PI), 0, Math.PI * 2);
    ctx.fill();
  }
}

function hatching(ctx, w, h, pickColor) {
  ctx.strokeStyle = pickColor();
  ctx.lineWidth = 6;
  const cx = rnd(0.2 * w, 0.8 * w), cy = rnd(0.2 * h, 0.8 * h);
  const bw = rnd(w * 0.2, w * 0.6), bh = rnd(h * 0.2, h * 0.6);
  const angle = rnd(0, Math.PI);
  const spacing = rnd(3, 7);
  const len = Math.hypot(bw, bh);
  const cos = Math.cos(angle + Math.PI / 2), sin = Math.sin(angle + Math.PI / 2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - bw / 2, cy - bh / 2, bw, bh);
  ctx.clip();
  for (let d = -len / 2; d < len / 2; d += spacing) {
    const ox = cos * d + cx, oy = sin * d + cy;
    const dx = Math.cos(angle) * len / 2, dy = Math.sin(angle) * len / 2;
    ctx.beginPath();
    ctx.moveTo(ox - dx, oy - dy);
    ctx.lineTo(ox + dx, oy + dy);
    ctx.stroke();
  }
  ctx.restore();
}

function burstLines(ctx, w, h, pickColor) {
  const cx = rnd(0.2 * w, 0.8 * w), cy = rnd(0.2 * h, 0.8 * h);
  const count = rndInt(8, 18);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rnd(-0.2, 0.2);
    const len = rnd(Math.min(w, h) * 0.1, Math.min(w, h) * 0.5);
    ctx.beginPath();
    ctx.strokeStyle = pickColor();
    ctx.lineWidth = 6;
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
    ctx.stroke();
  }
}

// ── WebSocket client ──────────────────────────────────────────────────────────

const ws = new WebSocket(`ws://localhost:3000/ws/${slug}`);
ws.on('open', () => console.log(`connected to session: ${slug}`));

ws.on('message', async raw => {
  const msg = JSON.parse(raw);
  if (msg.type !== 'init') return;

  const { session, drawings } = msg;
  const cols = session.cols;
  const rows = session.rows;
  console.log(`init: ${cols}x${rows} grid, ${drawings.length} existing drawing(s)`);

  // Load reference image if available
  let refImg = null;
  if (session.imageUrl) {
    refImg = await loadImage(`http://localhost:3000${session.imageUrl}`);
    console.log(`loaded reference image: ${refImg.width}x${refImg.height}`);
  }

  if (CLEAR_FIRST) {
    // Note: clear requires admin PIN which the seed script doesn't have.
    // The seed script adds drawings to existing state without clearing.
    console.log('Warning: --clear requires admin PIN, skipping clear');
  }

  const W = 300, H = 300;
  const total = cols * rows;
  const existingSlots = new Set(drawings.filter(d => d.slotIndex != null).map(d => d.slotIndex));
  console.log(`filling empty slots (${total - existingSlots.size} available)`);

  const blank = new Set();
  while (blank.size < 5) {
    const s = Math.floor(Math.random() * total);
    if (!existingSlots.has(s)) blank.add(s);
    if (blank.size + existingSlots.size >= total) break;
  }

  for (let i = 0; i < total; i++) {
    if (existingSlots.has(i) || blank.has(i)) {
      process.stdout.write(`\r  ${i + 1}/${total}`);
      continue;
    }

    let palette = ['#e05050', '#50a050', '#5070e0', '#e0a030', '#ffffff'];
    let weights = null;

    if (refImg) {
      ({ palette, weights } = await extractSlotPalette(refImg, i, cols, rows));
    }

    const dataUrl = await makeDrawingAsync(W, H, palette, weights);
    ws.send(JSON.stringify({
      type: 'drawing',
      drawing: { id: crypto.randomUUID(), dataUrl, createdAt: Date.now(), slotIndex: i },
    }));

    process.stdout.write(`\r  ${i + 1}/${total}`);
    await new Promise(r => setTimeout(r, 25));
  }

  console.log('\ndone');
  setTimeout(() => ws.close(), 300);
});

ws.on('error', e => { console.error(e.message); process.exit(1); });
