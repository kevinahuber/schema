export function renderLanding(container) {
  const wrap = document.createElement('div');
  wrap.className = 'page-landing';

  const hero = document.createElement('div');
  hero.className = 'landing-hero';

  const h1 = document.createElement('h1');
  h1.className = 'landing-title';
  h1.textContent = 'schema';
  hero.appendChild(h1);

  const tagline = document.createElement('p');
  tagline.className = 'landing-tagline';
  tagline.textContent = 'Collaborative drawing mosaic. Create a session, share a QR code, and watch your audience paint together in real time.';
  hero.appendChild(tagline);

  wrap.appendChild(hero);

  // ── Create form ───────────────────────────────────────────────────────────

  const form = document.createElement('form');
  form.className = 'landing-form';

  const nameLabel = document.createElement('label');
  nameLabel.className = 'admin-label';
  nameLabel.setAttribute('for', 'session-name');
  nameLabel.textContent = 'Session name (optional)';
  form.appendChild(nameLabel);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.id = 'session-name';
  nameInput.className = 'landing-input';
  nameInput.placeholder = 'e.g. Nashville Meetup';
  nameInput.maxLength = 80;
  form.appendChild(nameInput);

  const gridLabel = document.createElement('span');
  gridLabel.className = 'admin-label';
  gridLabel.textContent = 'Grid size';
  form.appendChild(gridLabel);

  const gridPicker = document.createElement('div');
  gridPicker.className = 'admin-grid-picker';

  const colsInput = document.createElement('input');
  colsInput.type = 'number';
  colsInput.className = 'admin-number';
  colsInput.min = '1'; colsInput.max = '32'; colsInput.value = '8';
  colsInput.setAttribute('aria-label', 'Columns');

  const rowsInput = document.createElement('input');
  rowsInput.type = 'number';
  rowsInput.className = 'admin-number';
  rowsInput.min = '1'; rowsInput.max = '32'; rowsInput.value = '8';
  rowsInput.setAttribute('aria-label', 'Rows');

  const gridTotal = document.createElement('span');
  gridTotal.className = 'admin-grid-total';

  function updateTotal() {
    const c = Math.max(1, parseInt(colsInput.value) || 1);
    const r = Math.max(1, parseInt(rowsInput.value) || 1);
    gridTotal.textContent = `${c * r} slots`;
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

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'btn btn--primary';
  submitBtn.textContent = 'Create session';
  form.appendChild(submitBtn);

  const status = document.createElement('p');
  status.className = 'draw-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  form.appendChild(status);

  form.addEventListener('submit', async e => {
    e.preventDefault();
    submitBtn.disabled = true;
    status.textContent = '';

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameInput.value.trim() || undefined,
          cols: parseInt(colsInput.value) || 8,
          rows: parseInt(rowsInput.value) || 8,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create session');
      }

      const { slug, adminPin } = await res.json();
      localStorage.setItem(`schema:pin:${slug}`, adminPin);
      location.href = `/s/${slug}#admin`;
    } catch (err) {
      status.textContent = err.message;
      submitBtn.disabled = false;
    }
  });

  wrap.appendChild(form);
  container.appendChild(wrap);

  updateTotal();
}
