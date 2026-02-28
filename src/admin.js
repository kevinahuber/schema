import { setImage, getImage, clearDrawings } from './store.js';
import { seedMosaic } from './seed.js';

export function renderAdmin(container) {
  const wrap = document.createElement('div');
  wrap.className = 'page-admin';

  const h1 = document.createElement('h1');
  h1.className = 'page-title';
  h1.textContent = 'Setup';
  wrap.appendChild(h1);

  // Current image status
  const currentImg = getImage();
  const currentInfo = document.createElement('p');
  currentInfo.className = 'admin-current';
  currentInfo.textContent = currentImg
    ? `Active: ${currentImg.cols}×${currentImg.rows} grid · ${currentImg.cols * currentImg.rows} slots`
    : 'No reference image set. Visitors get random palettes.';
  wrap.appendChild(currentInfo);

  const form = document.createElement('div');
  form.className = 'admin-form';

  // Grid size
  const gridLabel = document.createElement('span');
  gridLabel.className = 'admin-label';
  gridLabel.textContent = 'Grid size';
  form.appendChild(gridLabel);

  const gridPicker = document.createElement('div');
  gridPicker.className = 'admin-grid-picker';

  const colsInput = document.createElement('input');
  colsInput.type = 'number';
  colsInput.id = 'grid-cols';
  colsInput.className = 'admin-number';
  colsInput.min = '1'; colsInput.max = '32'; colsInput.value = '8';
  colsInput.setAttribute('aria-label', 'Columns');

  const rowsInput = document.createElement('input');
  rowsInput.type = 'number';
  rowsInput.id = 'grid-rows';
  rowsInput.className = 'admin-number';
  rowsInput.min = '1'; rowsInput.max = '32'; rowsInput.value = '8';
  rowsInput.setAttribute('aria-label', 'Rows');

  const gridTotal = document.createElement('span');
  gridTotal.className = 'admin-grid-total';

  function updateTotal() {
    const c = Math.max(1, parseInt(colsInput.value) || 1);
    const r = Math.max(1, parseInt(rowsInput.value) || 1);
    gridTotal.textContent = `${c * r} slots`;
    drawPreview();
  }

  colsInput.addEventListener('input', updateTotal);
  rowsInput.addEventListener('input', updateTotal);

  const timesSpan = document.createElement('span');
  timesSpan.className = 'admin-grid-sep';
  timesSpan.textContent = '×';
  const eqSpan = document.createElement('span');
  eqSpan.className = 'admin-grid-sep';
  eqSpan.textContent = '=';

  gridPicker.appendChild(colsInput);
  gridPicker.appendChild(timesSpan);
  gridPicker.appendChild(rowsInput);
  gridPicker.appendChild(eqSpan);
  gridPicker.appendChild(gridTotal);
  form.appendChild(gridPicker);

  // Show reference toggle
  const bgToggleLabel = document.createElement('label');
  bgToggleLabel.className = 'admin-toggle';
  const bgCheckbox = document.createElement('input');
  bgCheckbox.type = 'checkbox';
  bgCheckbox.checked = localStorage.getItem('qart:show-bg') === 'true';
  bgCheckbox.addEventListener('change', () => {
    localStorage.setItem('qart:show-bg', bgCheckbox.checked);
  });
  const bgToggleSpan = document.createElement('span');
  bgToggleSpan.textContent = 'Show reference image on draw page';
  bgToggleLabel.appendChild(bgCheckbox);
  bgToggleLabel.appendChild(bgToggleSpan);
  form.appendChild(bgToggleLabel);

  // File input
  const fileLabel = document.createElement('label');
  fileLabel.className = 'admin-label';
  fileLabel.setAttribute('for', 'image-input');
  fileLabel.textContent = 'Reference image';
  form.appendChild(fileLabel);

  const fileInput = document.createElement('input');
  fileInput.id = 'image-input';
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.className = 'admin-file';
  form.appendChild(fileInput);

  // Preview canvas with grid overlay
  const previewWrap = document.createElement('div');
  previewWrap.className = 'admin-preview-wrap';
  previewWrap.hidden = true;

  const previewCanvas = document.createElement('canvas');
  previewCanvas.className = 'admin-preview';
  previewCanvas.setAttribute('aria-label', 'Image preview with grid overlay');
  previewWrap.appendChild(previewCanvas);
  form.appendChild(previewWrap);

  // Submit
  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.className = 'btn btn--primary';
  submitBtn.textContent = 'Set image & start fresh';
  submitBtn.disabled = true;
  form.appendChild(submitBtn);

  const status = document.createElement('p');
  status.className = 'draw-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  form.appendChild(status);

  wrap.appendChild(form);

  // ── Seed section ────────────────────────────────────────────────────────────

  const seedSection = document.createElement('div');
  seedSection.className = 'admin-seed-section';
  seedSection.hidden = !getImage()?.dataUrl;

  const seedHeading = document.createElement('h2');
  seedHeading.className = 'admin-section-heading';
  seedHeading.textContent = 'Seed';
  seedSection.appendChild(seedHeading);

  const seedDesc = document.createElement('p');
  seedDesc.className = 'admin-section-desc';
  seedDesc.textContent = 'Fill empty slots with generated drawings using each slot\'s color palette.';
  seedSection.appendChild(seedDesc);

  const emptyLabel = document.createElement('span');
  emptyLabel.className = 'admin-label';
  emptyLabel.textContent = 'Empty slots';
  seedSection.appendChild(emptyLabel);

  const emptyInput = document.createElement('input');
  emptyInput.type = 'number';
  emptyInput.className = 'admin-number';
  emptyInput.min = '0';
  emptyInput.max = '999';
  emptyInput.value = '5';
  emptyInput.setAttribute('aria-label', 'Number of slots to leave empty');
  seedSection.appendChild(emptyInput);

  const seedBtn = document.createElement('button');
  seedBtn.type = 'button';
  seedBtn.className = 'btn btn--primary';
  seedBtn.textContent = 'Seed mosaic';
  seedSection.appendChild(seedBtn);

  const seedStatus = document.createElement('p');
  seedStatus.className = 'draw-status';
  seedStatus.setAttribute('role', 'status');
  seedStatus.setAttribute('aria-live', 'polite');
  seedSection.appendChild(seedStatus);

  wrap.appendChild(seedSection);

  // ── Clear section ────────────────────────────────────────────────────────────

  const clearSection = document.createElement('div');
  clearSection.className = 'admin-seed-section';

  const clearHeading = document.createElement('h2');
  clearHeading.className = 'admin-section-heading';
  clearHeading.textContent = 'Clear';
  clearSection.appendChild(clearHeading);

  const clearDesc = document.createElement('p');
  clearDesc.className = 'admin-section-desc';
  clearDesc.textContent = 'Remove all drawings from the mosaic. This cannot be undone.';
  clearSection.appendChild(clearDesc);

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'btn';
  clearBtn.textContent = 'Clear all drawings';
  clearBtn.addEventListener('click', () => {
    if (confirm('Clear all drawings? This cannot be undone.')) clearDrawings();
  });
  clearSection.appendChild(clearBtn);

  wrap.appendChild(clearSection);
  container.appendChild(wrap);

  let processedDataUrl = null;
  let processedWidth = 0;
  let processedHeight = 0;

  updateTotal();

  function getGrid() {
    return {
      cols: Math.max(1, parseInt(colsInput.value) || 1),
      rows: Math.max(1, parseInt(rowsInput.value) || 1),
    };
  }

  function drawPreview() {
    if (!processedDataUrl) return;
    const { cols, rows } = getGrid();
    const img = new Image();
    img.onload = () => {
      const maxW = Math.min(520, container.clientWidth - 32);
      const scale = Math.min(1, maxW / img.width);
      previewCanvas.width = Math.round(img.width * scale);
      previewCanvas.height = Math.round(img.height * scale);

      const ctx = previewCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0, previewCanvas.width, previewCanvas.height);

      // Grid overlay
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1;
      const cw = previewCanvas.width / cols;
      const ch = previewCanvas.height / rows;
      for (let c = 1; c < cols; c++) {
        ctx.beginPath(); ctx.moveTo(c * cw, 0); ctx.lineTo(c * cw, previewCanvas.height); ctx.stroke();
      }
      for (let r = 1; r < rows; r++) {
        ctx.beginPath(); ctx.moveTo(0, r * ch); ctx.lineTo(previewCanvas.width, r * ch); ctx.stroke();
      }
      previewWrap.hidden = false;
    };
    img.src = processedDataUrl;
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    ({ dataUrl: processedDataUrl, width: processedWidth, height: processedHeight } = await resizeImage(file, 800));
    submitBtn.disabled = false;
    drawPreview();
  });

  submitBtn.addEventListener('click', () => {
    if (!processedDataUrl) return;
    const { cols, rows } = getGrid();
    setImage(processedDataUrl, cols, rows, processedWidth, processedHeight);
    status.textContent = `Set! ${cols}×${rows} grid, ${cols * rows} slots. All previous drawings cleared.`;
    currentInfo.textContent = `Active: ${cols}×${rows} grid · ${cols * rows} slots`;
    submitBtn.textContent = 'Update image & reset mosaic';
    seedSection.hidden = false;
  });

  seedBtn.addEventListener('click', async () => {
    if (!getImage()?.dataUrl) return;
    seedBtn.disabled = true;
    seedStatus.textContent = 'Seeding…';
    const emptyCount = Math.max(0, parseInt(emptyInput.value) || 0);
    await seedMosaic(emptyCount, (n, total) => {
      seedStatus.textContent = `Seeding… ${n} / ${total}`;
    });
    seedStatus.textContent = 'Done!';
    seedBtn.disabled = false;
  });

  // Refresh current info if another client sets an image
  const onImageSet = () => {
    const img = getImage();
    currentInfo.textContent = img
      ? `Active: ${img.cols}×${img.rows} grid · ${img.cols * img.rows} slots`
      : 'No reference image set.';
    seedSection.hidden = !img?.dataUrl;
  };
  window.addEventListener('qart:image-set', onImageSet);

  return () => {
    window.removeEventListener('qart:image-set', onImageSet);
    container.innerHTML = '';
  };
}

function resizeImage(file, maxDim) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve({ dataUrl: c.toDataURL('image/jpeg', 0.85), width: w, height: h });
    };
    img.src = url;
  });
}
