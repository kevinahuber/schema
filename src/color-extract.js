// Given a reference image and a slot position, extract a representative
// color palette from that region using greedy farthest-point selection.

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

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
  // Drop near-white and near-black, sort by saturation
  const candidates = pixels
    .filter(([r, g, b]) => { const avg = (r + g + b) / 3; return avg > 15 && avg < 240; })
    .sort((a, b) => saturation(b) - saturation(a));

  if (candidates.length === 0) return pixels.slice(0, count).map(toHex);

  // Greedy farthest-point: maximises perceptual diversity
  const selected = [candidates[0]];
  for (const p of candidates) {
    if (selected.length >= count) break;
    const minDist = Math.min(...selected.map(s => colorDist(p, s)));
    if (minDist >= 28) selected.push(p);
  }

  // Relax threshold if we still need more colors
  if (selected.length < count) {
    for (const p of candidates) {
      if (selected.length >= count) break;
      if (!selected.some(s => colorDist(p, s) < 12)) selected.push(p);
    }
  }

  return selected.map(toHex);
}

// Returns { palette: string[], preview: string (data URL of the slot region) }
export async function extractSlot(imageDataUrl, slotIndex, cols, rows, paletteSize = 5) {
  const img = await loadImage(imageDataUrl);

  const slotW = img.width / cols;
  const slotH = img.height / rows;
  const col = slotIndex % cols;
  const row = Math.floor(slotIndex / cols);

  // Sample at 10×10 for palette extraction
  const sampleRes = 10;
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = sampleRes;
  sampleCanvas.height = sampleRes;
  const sCtx = sampleCanvas.getContext('2d');
  sCtx.drawImage(img, col * slotW, row * slotH, slotW, slotH, 0, 0, sampleRes, sampleRes);

  const { data } = sCtx.getImageData(0, 0, sampleRes, sampleRes);
  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }

  const palette = [...pickDistinct(pixels, paletteSize), '#ffffff'];

  // Render a small preview of the slot region
  const previewSize = 64;
  const previewCanvas = document.createElement('canvas');
  previewCanvas.width = previewSize;
  previewCanvas.height = previewSize;
  previewCanvas.getContext('2d').drawImage(
    img, col * slotW, row * slotH, slotW, slotH, 0, 0, previewSize, previewSize
  );
  const preview = previewCanvas.toDataURL('image/jpeg', 0.8);

  return { palette, preview };
}
