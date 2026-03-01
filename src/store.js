// All state lives on the server. This module owns the WebSocket connection
// and re-dispatches server messages as DOM events.

let drawings = [];
let session = null; // { slug, name, cols, rows, imageUrl, imageWidth, imageHeight, createdAt }
let ws = null;
let ready = false;
const queue = [];

let slug = null;

export function initStore(sessionSlug) {
  slug = sessionSlug;
  connect();
}

export function getSlug() { return slug; }

function connect() {
  if (!slug) return;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}/ws/${slug}`);

  ws.addEventListener('open', () => {
    ready = true;
    queue.splice(0).forEach(m => ws.send(JSON.stringify(m)));
    window.dispatchEvent(new CustomEvent('qart:ws-status', { detail: { connected: true } }));
  });

  ws.addEventListener('message', e => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }

    if (msg.type === 'init') {
      drawings = msg.drawings;
      session = msg.session ?? null;
      window.dispatchEvent(new CustomEvent('qart:init'));
    }

    if (msg.type === 'drawing') {
      drawings.push(msg.drawing);
      window.dispatchEvent(new CustomEvent('qart:new-drawing', { detail: msg.drawing }));
    }

    if (msg.type === 'cleared') {
      drawings = [];
      window.dispatchEvent(new CustomEvent('qart:cleared'));
    }

    if (msg.type === 'image-set') {
      session = msg.session;
      drawings = [];
      window.dispatchEvent(new CustomEvent('qart:image-set', { detail: session }));
    }

    if (msg.type === 'slot-assigned') {
      window.dispatchEvent(new CustomEvent('qart:slot-assigned', { detail: msg }));
    }

    if (msg.type === 'drawing-deleted') {
      drawings = drawings.filter(d => d.id !== msg.drawingId);
      window.dispatchEvent(new CustomEvent('qart:drawing-deleted', { detail: msg.drawingId }));
    }
  });

  ws.addEventListener('close', () => {
    ready = false;
    window.dispatchEvent(new CustomEvent('qart:ws-status', { detail: { connected: false } }));
    setTimeout(connect, 2000);
  });

  ws.addEventListener('error', () => ws.close());
}

function send(msg) {
  if (ready) ws.send(JSON.stringify(msg));
  else queue.push(msg);
}

// ── Admin PIN ─────────────────────────────────────────────────────────────────

export function getAdminPin() {
  return slug ? localStorage.getItem(`qart:pin:${slug}`) : null;
}

export function setAdminPin(pin) {
  if (slug) localStorage.setItem(`qart:pin:${slug}`, pin);
}

function sendAdmin(msg) {
  send({ ...msg, pin: getAdminPin() });
}

// ── Exports ───────────────────────────────────────────────────────────────────

export function getDrawings()      { return drawings; }
export function getLatestDrawing() { return drawings[drawings.length - 1] ?? null; }
export function getSession()       { return session; }

// Compat shim — old code calls getImage(), now backed by session
export function getImage() {
  if (!session) return null;
  return {
    dataUrl: session.imageUrl, // URL path, not base64 — but same field name for compat
    cols: session.cols,
    rows: session.rows,
    width: session.imageWidth,
    height: session.imageHeight,
  };
}

export function addDrawing(dataUrl, slotIndex = null) {
  send({
    type: 'drawing',
    drawing: { id: crypto.randomUUID(), dataUrl, createdAt: Date.now(), slotIndex },
  });
}

export function requestSlot() { send({ type: 'request-slot' }); }

export function setImage(dataUrl, cols, rows, width, height) {
  sendAdmin({ type: 'set-image', image: { dataUrl, cols, rows, width, height } });
}

export function setGrid(cols, rows) {
  sendAdmin({ type: 'set-grid', cols, rows });
}

export function clearDrawings() { sendAdmin({ type: 'clear' }); }

export function deleteDrawing(drawingId) {
  sendAdmin({ type: 'delete-drawing', drawingId });
}
