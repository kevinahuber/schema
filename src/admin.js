import { setImage, getImage, getSession, getDrawings, clearDrawings, deleteDrawing, getAdminPin, setAdminPin, getSlug } from './store.js';
import { seedMosaic } from './seed.js';

export function renderAdmin(container) {
  const wrap = document.createElement('div');
  wrap.className = 'page-admin';
  container.appendChild(wrap);

  const slug = getSlug();
  const pin = getAdminPin();

  // ── PIN gate ────────────────────────────────────────────────────────────────

  if (!pin) {
    renderPinGate(wrap, () => {
      container.innerHTML = '';
      renderAdmin(container);
    });
    return () => { container.innerHTML = ''; };
  }

  // ── Admin content ───────────────────────────────────────────────────────────

  const h1 = document.createElement('h1');
  h1.className = 'page-title';
  h1.textContent = 'Setup';
  wrap.appendChild(h1);

  // Session info
  const sessionInfo = document.createElement('div');
  sessionInfo.className = 'admin-session-info';
  function updateSessionInfo() {
    const session = getSession();
    const drawings = getDrawings();
    sessionInfo.innerHTML = '';

    if (session?.name) {
      const name = document.createElement('p');
      name.className = 'admin-session-name';
      name.textContent = session.name;
      sessionInfo.appendChild(name);
    }

    const details = document.createElement('p');
    details.className = 'admin-current';
    const img = getImage();
    details.textContent = img
      ? `${img.cols}\u00d7${img.rows} grid \u00b7 ${img.cols * img.rows} slots \u00b7 ${drawings.length} drawing(s)`
      : `No reference image set. ${drawings.length} drawing(s).`;
    sessionInfo.appendChild(details);
  }
  updateSessionInfo();
  wrap.appendChild(sessionInfo);

  // ── Shareable URLs ──────────────────────────────────────────────────────────

  const linksSection = document.createElement('div');
  linksSection.className = 'admin-links';

  const linksHeading = document.createElement('h2');
  linksHeading.className = 'admin-section-heading';
  linksHeading.textContent = 'Share';
  linksSection.appendChild(linksHeading);

  const baseUrl = `${location.origin}/s/${slug}`;
  const links = [
    { label: 'Draw', url: `${baseUrl}#draw` },
    { label: 'Mosaic', url: `${baseUrl}#mosaic` },
    { label: 'QR Code', url: `${baseUrl}#qr` },
    { label: 'Export PNG', url: `${baseUrl}/mosaic.png` },
  ];

  links.forEach(({ label, url }) => {
    const row = document.createElement('div');
    row.className = 'admin-link-row';

    const a = document.createElement('a');
    a.href = url;
    a.textContent = label;
    a.className = 'admin-link';
    a.target = label === 'Export PNG' ? '_blank' : '_self';
    row.appendChild(a);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn btn--sm btn--ghost';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(url).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
      });
    });
    row.appendChild(copyBtn);

    linksSection.appendChild(row);
  });

  wrap.appendChild(linksSection);

  // ── Image / Grid form ─────────────────────────────────────────────────────

  const form = document.createElement('div');
  form.className = 'admin-form';

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
  timesSpan.textContent = '\u00d7';
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
  bgCheckbox.checked = localStorage.getItem('schema:show-bg') === 'true';
  bgCheckbox.addEventListener('change', () => {
    localStorage.setItem('schema:show-bg', bgCheckbox.checked);
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

  // Current reference image display
  const currentImg = getImage();
  const currentRefWrap = document.createElement('div');
  currentRefWrap.className = 'admin-preview-wrap';
  currentRefWrap.hidden = !currentImg?.dataUrl;

  const currentRefImg = document.createElement('img');
  currentRefImg.className = 'admin-preview';
  currentRefImg.alt = 'Current reference image';
  if (currentImg?.dataUrl) currentRefImg.src = currentImg.dataUrl;
  currentRefWrap.appendChild(currentRefImg);
  form.appendChild(currentRefWrap);

  // Preview canvas with grid overlay (shown after new file is selected)
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

  const formStatus = document.createElement('p');
  formStatus.className = 'draw-status';
  formStatus.setAttribute('role', 'status');
  formStatus.setAttribute('aria-live', 'polite');
  form.appendChild(formStatus);

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
  emptyInput.value = '2';
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

  // ── Drawings moderation ─────────────────────────────────────────────────────

  const drawingsSection = document.createElement('div');
  drawingsSection.className = 'admin-seed-section';

  const drawingsHeading = document.createElement('h2');
  drawingsHeading.className = 'admin-section-heading';
  drawingsHeading.textContent = 'Drawings';
  drawingsSection.appendChild(drawingsHeading);

  const drawingsGrid = document.createElement('div');
  drawingsGrid.className = 'admin-drawings-grid';
  drawingsSection.appendChild(drawingsGrid);

  function renderDrawingsGrid() {
    const drawings = getDrawings();
    drawingsGrid.innerHTML = '';

    if (drawings.length === 0) {
      const emptyMsg = document.createElement('p');
      emptyMsg.className = 'admin-section-desc';
      emptyMsg.textContent = 'No drawings yet.';
      drawingsGrid.appendChild(emptyMsg);
      return;
    }

    drawings.forEach(d => {
      const item = document.createElement('div');
      item.className = 'admin-drawing-item';

      const thumb = document.createElement('img');
      thumb.src = d.url || d.dataUrl;
      thumb.alt = d.slotIndex != null ? `Slot ${d.slotIndex}` : 'Free draw';
      thumb.className = 'admin-drawing-thumb';
      thumb.loading = 'lazy';
      item.appendChild(thumb);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'admin-drawing-delete';
      delBtn.setAttribute('aria-label', `Delete drawing${d.slotIndex != null ? ` from slot ${d.slotIndex}` : ''}`);
      delBtn.textContent = '\u00d7';
      delBtn.addEventListener('click', () => {
        deleteDrawing(d.id);
      });
      item.appendChild(delBtn);

      drawingsGrid.appendChild(item);
    });
  }

  renderDrawingsGrid();
  wrap.appendChild(drawingsSection);

  // ── Clear section ──────────────────────────────────────────────────────────

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

  // ── Preview / form logic ──────────────────────────────────────────────────

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
    currentRefWrap.hidden = true;
    drawPreview();
  });

  submitBtn.addEventListener('click', () => {
    if (!processedDataUrl) return;
    const { cols, rows } = getGrid();
    setImage(processedDataUrl, cols, rows, processedWidth, processedHeight);
    formStatus.textContent = `Set! ${cols}\u00d7${rows} grid, ${cols * rows} slots. All previous drawings cleared.`;
    submitBtn.textContent = 'Update image & reset mosaic';
    seedSection.hidden = false;
  });

  seedBtn.addEventListener('click', async () => {
    if (!getImage()?.dataUrl) return;
    seedBtn.disabled = true;
    seedStatus.textContent = 'Seeding\u2026';
    const emptyCount = Math.max(0, parseInt(emptyInput.value) || 0);
    await seedMosaic(emptyCount, (n, total) => {
      seedStatus.textContent = `Seeding\u2026 ${n} / ${total}`;
    });
    seedStatus.textContent = 'Done!';
    seedBtn.disabled = false;
  });

  // ── Event listeners ─────────────────────────────────────────────────────────

  const onImageSet = () => {
    updateSessionInfo();
    const img = getImage();
    seedSection.hidden = !img?.dataUrl;
    if (img?.dataUrl) {
      currentRefImg.src = img.dataUrl;
      currentRefWrap.hidden = false;
    }
    renderDrawingsGrid();
  };
  const onDrawingUpdate = () => {
    updateSessionInfo();
    renderDrawingsGrid();
  };

  window.addEventListener('schema:image-set', onImageSet);
  window.addEventListener('schema:init', onDrawingUpdate);
  window.addEventListener('schema:new-drawing', onDrawingUpdate);
  window.addEventListener('schema:cleared', onDrawingUpdate);
  window.addEventListener('schema:drawing-deleted', onDrawingUpdate);

  return () => {
    window.removeEventListener('schema:image-set', onImageSet);
    window.removeEventListener('schema:init', onDrawingUpdate);
    window.removeEventListener('schema:new-drawing', onDrawingUpdate);
    window.removeEventListener('schema:cleared', onDrawingUpdate);
    window.removeEventListener('schema:drawing-deleted', onDrawingUpdate);
    container.innerHTML = '';
  };
}

// ── PIN gate component ────────────────────────────────────────────────────────

function renderPinGate(container, onSuccess) {
  const h1 = document.createElement('h1');
  h1.className = 'page-title';
  h1.textContent = 'Admin PIN';
  container.appendChild(h1);

  const desc = document.createElement('p');
  desc.className = 'admin-current';
  desc.textContent = 'Enter the admin PIN to access session settings.';
  container.appendChild(desc);

  const form = document.createElement('form');
  form.className = 'admin-form';

  const pinInput = document.createElement('input');
  pinInput.type = 'text';
  pinInput.inputMode = 'numeric';
  pinInput.pattern = '[0-9]*';
  pinInput.maxLength = 4;
  pinInput.className = 'landing-input';
  pinInput.placeholder = '4-digit PIN';
  pinInput.setAttribute('aria-label', 'Admin PIN');
  pinInput.autocomplete = 'off';
  form.appendChild(pinInput);

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'btn btn--primary';
  submitBtn.textContent = 'Enter';
  form.appendChild(submitBtn);

  const status = document.createElement('p');
  status.className = 'draw-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  form.appendChild(status);

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const val = pinInput.value.trim();
    if (!val) return;

    // Validate by trying to get session info — the PIN is validated server-side
    // on actual admin actions. For the gate, just store it and proceed.
    setAdminPin(val);
    onSuccess();
  });

  container.appendChild(form);
  pinInput.focus();
}

// ── Image resize helper ──────────────────────────────────────────────────────

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
