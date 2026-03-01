import { randomPalette } from './colors.js';
import { addDrawing, requestSlot, getImage } from './store.js';
import { extractSlot } from './color-extract.js';

function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

export function renderDraw(container) {
  const wrap = document.createElement('div');
  wrap.className = 'page-draw';

  const h1 = document.createElement('h1');
  h1.className = 'page-title';
  h1.textContent = 'Draw';
  wrap.appendChild(h1);

  // Slot hint — shown when a reference image is active
  const hint = document.createElement('div');
  hint.className = 'slot-hint';
  hint.hidden = true;
  const hintImg = document.createElement('img');
  hintImg.className = 'slot-hint-img';
  hintImg.alt = 'Your target region';
  const hintLabel = document.createElement('span');
  hintLabel.className = 'slot-hint-label';
  hint.appendChild(hintImg);
  hint.appendChild(hintLabel);
  wrap.appendChild(hint);

  const canvasWrapper = document.createElement('div');
  canvasWrapper.className = 'draw-canvas-wrapper';

  const canvas = document.createElement('canvas');
  canvas.className = 'draw-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Drawing canvas');

  const refImg = getImage();
  if (refImg?.width && refImg?.height) {
    const slotAR = (refImg.width / refImg.cols) / (refImg.height / refImg.rows);
    if (slotAR >= 1) {
      canvas.width  = 300;
      canvas.height = Math.round(300 / slotAR);
    } else {
      canvas.height = 300;
      canvas.width  = Math.round(300 * slotAR);
    }
  } else {
    canvas.width  = 300;
    canvas.height = 300;
  }
  canvas.style.aspectRatio = `${canvas.width} / ${canvas.height}`;
  canvasWrapper.appendChild(canvas);
  wrap.appendChild(canvasWrapper);

  const ctx = canvas.getContext('2d');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6;

  // ── Palette (below canvas) ─────────────────────────────────────────────────

  const palette = document.createElement('div');
  palette.className = 'draw-palette';
  palette.setAttribute('role', 'group');
  palette.setAttribute('aria-label', 'Color palette');
  wrap.appendChild(palette);

  let currentColor = '#000000';
  let paletteColors = [];
  const vialMap = new Map(); // color -> { vial, fill }

  function buildPalette(colors) {
    palette.innerHTML = '';
    vialMap.clear();
    paletteColors = colors;
    currentColor = colors[0];
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = 6;

    colors.forEach((color, i) => {
      const isEraser = color === '#ffffff';
      const vial = document.createElement('button');
      vial.type = 'button';
      vial.className = 'palette-vial' + (isEraser ? ' palette-vial--eraser' : '') + (i === 0 ? ' active' : '');
      if (!isEraser) vial.style.setProperty('--vial-color', color);
      vial.setAttribute('aria-label', isEraser ? 'Eraser' : `Color ${color}, full`);

      const fill = document.createElement('div');
      fill.className = 'palette-vial-fill';
      vial.appendChild(fill);

      if (isEraser) {
        const icon = document.createElement('span');
        icon.className = 'palette-vial-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '\u2715';
        vial.appendChild(icon);
      }

      vial.addEventListener('click', () => {
        palette.querySelectorAll('.palette-vial').forEach(s => s.classList.remove('active'));
        vial.classList.add('active');
        currentColor = color;
        ctx.lineWidth = isEraser ? 32 : 6;
      });

      palette.appendChild(vial);
      vialMap.set(color, { vial, fill });
    });
  }

  // Sample the canvas after each stroke and update vial fill levels
  function sampleCanvas() {
    const colors = paletteColors.filter(c => c !== '#ffffff');
    if (!colors.length) return;

    const budget = canvas.width * canvas.height * 0.12;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const rgbs = colors.map(hexToRgb);
    const counts = new Array(colors.length).fill(0);

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 20) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      let best = -1, bestD = 80;
      for (let j = 0; j < rgbs.length; j++) {
        const d = Math.abs(r - rgbs[j][0]) + Math.abs(g - rgbs[j][1]) + Math.abs(b - rgbs[j][2]);
        if (d < bestD) { bestD = d; best = j; }
      }
      if (best >= 0) counts[best]++;
    }

    colors.forEach((color, j) => {
      const remaining = Math.max(0, 1 - counts[j] / budget);
      const item = vialMap.get(color);
      if (!item) return;
      item.fill.style.setProperty('--fill', `${Math.round(remaining * 100)}%`);
      item.vial.setAttribute('aria-label', `Color ${color}, ${Math.round(remaining * 100)}% remaining`);
    });
  }

  function resetFills() {
    for (const [color, item] of vialMap) {
      if (color === '#ffffff') continue;
      item.fill.style.removeProperty('--fill');
      item.vial.setAttribute('aria-label', `Color ${color}, full`);
    }
  }

  // ── Controls ───────────────────────────────────────────────────────────────

  const controls = document.createElement('div');
  controls.className = 'draw-controls';

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'btn';
  clearBtn.textContent = 'Clear';
  clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = currentColor === '#ffffff' ? 32 : 6;
    resetFills();
  });
  controls.appendChild(clearBtn);

  const postBtn = document.createElement('button');
  postBtn.type = 'button';
  postBtn.className = 'btn btn--primary';
  postBtn.textContent = 'Post it';
  controls.appendChild(postBtn);

  if (navigator.canShare) {
    const shareBtn = document.createElement('button');
    shareBtn.type = 'button';
    shareBtn.className = 'btn';
    shareBtn.textContent = 'Share';
    shareBtn.addEventListener('click', () => {
      canvas.toBlob(async blob => {
        const file = new File([blob], 'drawing.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'My drawing' });
        }
      }, 'image/png');
    });
    controls.appendChild(shareBtn);
  }

  const status = document.createElement('p');
  status.className = 'draw-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  controls.appendChild(status);

  wrap.appendChild(controls);
  container.appendChild(wrap);

  // ── Slot + palette setup ───────────────────────────────────────────────────

  let assignedSlot = null;

  function applySlotBackground() {
    const img = getImage();
    if (localStorage.getItem('qart:show-bg') !== 'true' || !img?.dataUrl || assignedSlot == null) {
      canvas.style.backgroundImage = '';
      canvas.style.backgroundSize = '';
      canvas.style.backgroundPositionX = '';
      canvas.style.backgroundPositionY = '';
      return;
    }
    const col = assignedSlot % img.cols;
    const row = Math.floor(assignedSlot / img.cols);
    canvas.style.backgroundImage = `url("${img.dataUrl}")`;
    canvas.style.backgroundSize = `${img.cols * 100}% ${img.rows * 100}%`;
    canvas.style.backgroundPositionX = img.cols > 1 ? `${(col / (img.cols - 1)) * 100}%` : '0%';
    canvas.style.backgroundPositionY = img.rows > 1 ? `${(row / (img.rows - 1)) * 100}%` : '0%';
  }


  async function initPalette() {
    const img = getImage();
    if (!img) {
      buildPalette(randomPalette(6));
      return;
    }

    buildPalette(['#cccccc', '#aaaaaa', '#888888', '#555555', '#222222', '#ffffff']);
    status.textContent = 'Getting your palette\u2026';
    requestSlot();
  }

  const onSlotAssigned = async e => {
    window.removeEventListener('qart:slot-assigned', onSlotAssigned);
    assignedSlot = e.detail.slotIndex;

    const img = getImage();
    if (!img || assignedSlot == null) {
      buildPalette(randomPalette(6));
      status.textContent = assignedSlot == null ? 'All slots filled \u2014 free draw!' : '';
      return;
    }

    try {
      const { palette: colors, preview } = await extractSlot(
        img.dataUrl, assignedSlot, img.cols, img.rows
      );
      buildPalette(colors);
      hintImg.src = preview;
      const col = assignedSlot % img.cols;
      const row = Math.floor(assignedSlot / img.cols);
      hintLabel.textContent = `Square ${col + 1},${row + 1}`;
      hint.hidden = false;
      status.textContent = '';
      applySlotBackground();
    } catch {
      buildPalette(randomPalette(6));
      status.textContent = '';
    }
  };

  window.addEventListener('qart:slot-assigned', onSlotAssigned);
  initPalette();

  // ── Post handler ───────────────────────────────────────────────────────────

  postBtn.addEventListener('click', () => {
    const dataUrl = canvas.toDataURL('image/png');
    postBtn.disabled = true;
    postBtn.textContent = 'Posting...';

    addDrawing(dataUrl, assignedSlot);
    assignedSlot = null;
    hint.hidden = true;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    postBtn.disabled = false;
    postBtn.textContent = 'Posted!';
    status.textContent = 'Added to the mosaic.';

    setTimeout(() => {
      postBtn.textContent = 'Post it';
      status.textContent = '';
      initPalette();
      window.addEventListener('qart:slot-assigned', onSlotAssigned);
    }, 2000);
  });

  // ── Draw events ────────────────────────────────────────────────────────────

  let drawing = false;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }

  function startDraw(e) {
    drawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = currentColor;
  }

  function continueDraw(e) {
    if (!drawing) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function stopDraw() {
    if (drawing) sampleCanvas();
    drawing = false;
  }

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', continueDraw);
  canvas.addEventListener('mouseup', stopDraw);
  canvas.addEventListener('mouseleave', stopDraw);
  canvas.addEventListener('touchstart', e => { e.preventDefault(); startDraw(e); }, { passive: false });
  canvas.addEventListener('touchmove', e => { e.preventDefault(); continueDraw(e); }, { passive: false });
  canvas.addEventListener('touchend', stopDraw);

  return () => {
    window.removeEventListener('qart:slot-assigned', onSlotAssigned);
    container.innerHTML = '';
  };
}
