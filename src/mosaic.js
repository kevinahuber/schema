import { getDrawings, getImage } from './store.js';

export function renderMosaic(container) {
  const wrap = document.createElement('div');
  wrap.className = 'page-mosaic';

  document.body.classList.add('mosaic-active');

  const empty = document.createElement('p');
  empty.className = 'mosaic-empty';
  empty.textContent = 'No drawings yet. Go draw something!';
  wrap.appendChild(empty);

  const grid = document.createElement('div');
  grid.setAttribute('role', 'list');
  wrap.appendChild(grid);

  const overflowGrid = document.createElement('div');
  overflowGrid.className = 'mosaic-grid mosaic-overflow';
  overflowGrid.setAttribute('role', 'list');
  overflowGrid.hidden = true;
  wrap.appendChild(overflowGrid);

  // ── Slider ──────────────────────────────────────────────────────────────────

  const sliderBar = document.createElement('div');
  sliderBar.className = 'mosaic-slider-bar';
  sliderBar.hidden = true;

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = '0';
  slider.value = '0';
  slider.className = 'mosaic-slider';
  slider.setAttribute('aria-label', 'Number of visible drawings');

  const sliderLabel = document.createElement('span');
  sliderLabel.className = 'mosaic-slider-label';
  sliderLabel.setAttribute('aria-live', 'polite');

  sliderBar.appendChild(slider);
  sliderBar.appendChild(sliderLabel);

  // Stable random reveal order — persists across re-renders so the sequence
  // doesn't reshuffle when a new drawing arrives.
  let shuffleOrder = [];
  let drawingImgMap = new Map(); // slotIndex → <img>
  let storeReady = false;
  let autoPlay = null;

  function applySlider() {
    const count = Number(slider.value);
    const visible = new Set(shuffleOrder.slice(0, count));
    drawingImgMap.forEach((img, slotIndex) => {
      img.classList.toggle('mosaic-drawing-hidden', !visible.has(slotIndex));
    });
    sliderLabel.textContent = `${count} / ${shuffleOrder.length}`;
  }

  slider.addEventListener('input', applySlider);

  function startAutoPlay() {
    if (autoPlay) return;
    const tick = () => {
      const val = Number(slider.value);
      const max = Number(slider.max);
      if (val >= max) { clearInterval(autoPlay); autoPlay = null; return; }
      // Target ~5s to reveal all drawings
      const batch = Math.max(1, Math.ceil(max / 83));
      slider.value = String(Math.min(val + batch, max));
      applySlider();
    };
    autoPlay = setInterval(tick, 60);
  }

  // ── Grid render ─────────────────────────────────────────────────────────────

  function renderGrid() {
    grid.innerHTML = '';
    overflowGrid.innerHTML = '';
    overflowGrid.hidden = true;
    drawingImgMap = new Map();

    const drawings = getDrawings();
    const img = getImage();

    // ── Reference image / grid mode ───────────────────────────────────────────
    if (img) {
      const { cols, rows } = img;
      grid.className = 'mosaic-grid mosaic-grid--fixed';
      grid.style.setProperty('--cols', cols);

      const slotMap = new Map();
      const overflow = [];
      drawings.forEach(d => {
        if (d.slotIndex != null) slotMap.set(d.slotIndex, d);
        else overflow.push(d);
      });

      const total = cols * rows;
      empty.hidden = !storeReady || total > 0 || drawings.length > 0;

      const slotAR = img.width && img.height
        ? (img.width / cols) / (img.height / rows)
        : 1;

      const availH = wrap.clientHeight || window.innerHeight;
      const cellW = (wrap.clientWidth || window.innerWidth) / cols;
      const totalH = (cellW / slotAR) * rows;
      grid.style.width = totalH > availH ? `${(availH / totalH) * 100}%` : '100%';

      for (let i = 0; i < total; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const drawing = slotMap.get(i);

        const cell = document.createElement('div');
        cell.className = 'mosaic-slot';
        cell.style.aspectRatio = slotAR;
        cell.setAttribute('role', 'listitem');

        if (drawing) {
          const drawingImg = document.createElement('img');
          drawingImg.className = 'mosaic-slot-drawing mosaic-drawing-hidden';
          drawingImg.src = drawing.dataUrl;
          drawingImg.alt = `Drawing for slot ${col + 1},${row + 1}`;
          drawingImg.loading = 'lazy';
          drawingImg.style.transitionDuration = `${0.6 + Math.random() * 1.8}s`;
          cell.appendChild(drawingImg);
          drawingImgMap.set(i, drawingImg);
        }

        grid.appendChild(cell);
      }

      // Update shuffle order: preserve existing sequence, insert new slots randomly
      const currentFilled = new Set(slotMap.keys());
      shuffleOrder = shuffleOrder.filter(s => currentFilled.has(s));
      const inShuffle = new Set(shuffleOrder);
      for (const s of currentFilled) {
        if (!inShuffle.has(s)) {
          const pos = Math.floor(Math.random() * (shuffleOrder.length + 1));
          shuffleOrder.splice(pos, 0, s);
        }
      }

      const prevMax = Number(slider.max);
      slider.max = String(shuffleOrder.length);
      // If auto-play finished, reveal any newly arrived drawings immediately
      if (prevMax > 0 && Number(slider.value) >= prevMax) {
        slider.value = slider.max;
      }
      sliderBar.hidden = shuffleOrder.length === 0;
      applySlider();

      // Overflow drawings
      if (overflow.length > 0) {
        overflow.slice().reverse().forEach(({ dataUrl: dUrl, createdAt }) => {
          const item = document.createElement('div');
          item.className = 'mosaic-item';
          item.setAttribute('role', 'listitem');
          const img2 = document.createElement('img');
          img2.src = dUrl;
          img2.alt = `Drawing from ${new Date(createdAt).toLocaleTimeString()}`;
          img2.loading = 'lazy';
          img2.className = 'mosaic-img';
          item.appendChild(img2);
          overflowGrid.appendChild(item);
        });
        overflowGrid.hidden = false;
      }

    // ── Free mode ─────────────────────────────────────────────────────────────
    } else {
      grid.className = 'mosaic-grid';
      grid.style.removeProperty('--cols');
      grid.style.removeProperty('width');
      empty.hidden = !storeReady || drawings.length > 0;
      sliderBar.hidden = true;
      shuffleOrder = [];

      drawings.slice().reverse().forEach(({ dataUrl, createdAt }) => {
        const item = document.createElement('div');
        item.className = 'mosaic-item';
        item.setAttribute('role', 'listitem');
        const img2 = document.createElement('img');
        img2.src = dataUrl;
        img2.alt = `Drawing from ${new Date(createdAt).toLocaleTimeString()}`;
        img2.loading = 'lazy';
        img2.className = 'mosaic-img';
        item.appendChild(img2);
        grid.appendChild(item);
      });
    }
  }

  container.appendChild(wrap);

  // Inject slider into fixed nav menu
  const navSliderSlot = document.getElementById('nav-slider-slot');
  navSliderSlot.appendChild(sliderBar);

  // Click anywhere on mosaic to navigate to the draw page
  wrap.addEventListener('click', () => { location.hash = '#draw'; });

  // Defer initial render so wrap has been laid out and clientHeight is valid
  requestAnimationFrame(renderGrid);

  const onInit = () => {
    storeReady = true;
    slider.value = '0'; // start from black, auto-play will reveal
    renderGrid();
    startAutoPlay();
  };
  const onUpdate = () => renderGrid();
  window.addEventListener('qart:init', onInit);
  window.addEventListener('qart:new-drawing', onUpdate);
  window.addEventListener('qart:cleared', onUpdate);
  window.addEventListener('qart:image-set', onUpdate);

  // Re-layout on resize so the grid always fills the viewport correctly
  const ro = new ResizeObserver(renderGrid);
  ro.observe(wrap);

  return () => {
    ro.disconnect();
    if (autoPlay) { clearInterval(autoPlay); autoPlay = null; }
    document.body.classList.remove('mosaic-active');
    window.removeEventListener('qart:init', onInit);
    window.removeEventListener('qart:new-drawing', onUpdate);
    window.removeEventListener('qart:cleared', onUpdate);
    window.removeEventListener('qart:image-set', onUpdate);
    const slot = document.getElementById('nav-slider-slot');
    if (slot && slot.contains(sliderBar)) slot.removeChild(sliderBar);
    container.innerHTML = '';
  };
}
