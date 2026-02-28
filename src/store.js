// All state lives on the server. This module owns the WebSocket connection
// and re-dispatches server messages as DOM events.

let drawings = [];
let image = null; // { dataUrl, cols, rows, width, height } | null
let ws = null;
let ready = false;
const queue = [];

function connect() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}/ws`);

  ws.addEventListener('open', () => {
    ready = true;
    queue.splice(0).forEach(m => ws.send(JSON.stringify(m)));
    window.dispatchEvent(new CustomEvent('qart:ws-status', { detail: { connected: true } }));
  });

  ws.addEventListener('message', e => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }

    // Full state on connect — one event covers both drawings and image.
    if (msg.type === 'init') {
      drawings = msg.drawings;
      image = msg.image ?? null;
      window.dispatchEvent(new CustomEvent('qart:init'));
    }

    // A new drawing arrived.
    if (msg.type === 'drawing') {
      drawings.push(msg.drawing);
      window.dispatchEvent(new CustomEvent('qart:new-drawing', { detail: msg.drawing }));
    }

    // All drawings were cleared (reference image unchanged).
    if (msg.type === 'cleared') {
      drawings = [];
      window.dispatchEvent(new CustomEvent('qart:cleared'));
    }

    // New reference image set — drawings are already cleared on the server.
    if (msg.type === 'image-set') {
      image = msg.image;
      drawings = [];
      window.dispatchEvent(new CustomEvent('qart:image-set', { detail: image }));
    }

    if (msg.type === 'slot-assigned') {
      window.dispatchEvent(new CustomEvent('qart:slot-assigned', { detail: msg }));
    }
  });

  ws.addEventListener('close', () => {
    ready = false;
    window.dispatchEvent(new CustomEvent('qart:ws-status', { detail: { connected: false } }));
    setTimeout(connect, 2000);
  });

  ws.addEventListener('error', () => ws.close());
}

connect();

function send(msg) {
  if (ready) ws.send(JSON.stringify(msg));
  else queue.push(msg);
}

export function getDrawings()      { return drawings; }
export function getLatestDrawing() { return drawings[drawings.length - 1] ?? null; }
export function getImage()         { return image; }

export function addDrawing(dataUrl, slotIndex = null) {
  send({
    type: 'drawing',
    drawing: { id: crypto.randomUUID(), dataUrl, createdAt: Date.now(), slotIndex },
  });
}

export function requestSlot() { send({ type: 'request-slot' }); }

export function setImage(dataUrl, cols, rows, width, height) {
  send({ type: 'set-image', image: { dataUrl, cols, rows, width, height } });
}

export function setGrid(cols, rows) {
  send({ type: 'set-grid', cols, rows });
}

export function clearDrawings() { send({ type: 'clear' }); }
