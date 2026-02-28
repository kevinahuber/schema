import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { networkInterfaces } from 'os';
import { WebSocketServer } from 'ws';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);
const DIST = path.join(__dirname, 'dist');
const DATA = path.join(__dirname, 'drawings.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
};

// ── Persistence ───────────────────────────────────────────────────────────────

let drawings = [];
let referenceImage = null; // { dataUrl, cols, rows } | null

try {
  const raw = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  if (Array.isArray(raw)) {
    drawings = raw; // backward compat with old format
  } else {
    drawings = raw.drawings ?? [];
    referenceImage = raw.image ?? null;
  }
  console.log(`Loaded ${drawings.length} drawing(s).${referenceImage ? ` Grid: ${referenceImage.cols}×${referenceImage.rows}.` : ''}`);
} catch {
  // First run
}

function persist() {
  fs.writeFile(DATA, JSON.stringify({ drawings, image: referenceImage }), err => {
    if (err) console.error('Failed to save:', err.message);
  });
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0].split('#')[0];
  if (url === '/') url = '/index.html';

  const filePath = path.resolve(DIST, '.' + url);
  if (!filePath.startsWith(DIST)) { res.writeHead(403); res.end('Forbidden'); return; }

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(content);
  } catch {
    try {
      const content = fs.readFileSync(path.join(DIST, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
    } catch {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      res.end('Run `npm run build` first, then restart the server.');
    }
  }
});

// ── WebSocket server ──────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 10 * 1024 * 1024 });

function broadcast(msg) {
  const str = JSON.stringify(msg);
  wss.clients.forEach(c => { if (c.readyState === 1) c.send(str); });
}

function filledSlots() {
  return new Set(drawings.filter(d => d.slotIndex != null).map(d => d.slotIndex));
}

wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'init', drawings, image: referenceImage }));

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // ── New drawing ────────────────────────────────────────────────────────────
    if (msg.type === 'drawing' && msg.drawing?.dataUrl) {
      let slotIndex = msg.drawing.slotIndex ?? null;

      // First-wins: strip slot if already filled by a previous drawing
      if (slotIndex != null && filledSlots().has(slotIndex)) {
        slotIndex = null;
      }

      const entry = {
        id:        msg.drawing.id        || crypto.randomUUID(),
        dataUrl:   msg.drawing.dataUrl,
        createdAt: msg.drawing.createdAt || Date.now(),
        slotIndex,
      };
      drawings.push(entry);
      persist();
      broadcast({ type: 'drawing', drawing: entry });
    }

    // ── Request a slot assignment ──────────────────────────────────────────────
    if (msg.type === 'request-slot') {
      if (!referenceImage) {
        ws.send(JSON.stringify({ type: 'slot-assigned', slotIndex: null }));
        return;
      }
      const total = referenceImage.cols * referenceImage.rows;
      const taken = filledSlots();
      const available = [];
      for (let i = 0; i < total; i++) {
        if (!taken.has(i)) available.push(i);
      }
      const slotIndex = available.length > 0
        ? available[Math.floor(Math.random() * available.length)]
        : null;
      ws.send(JSON.stringify({ type: 'slot-assigned', slotIndex }));
    }

    // ── Set reference image ────────────────────────────────────────────────────
    if (msg.type === 'set-image' && msg.image?.dataUrl) {
      referenceImage = {
        dataUrl: msg.image.dataUrl,
        cols:    msg.image.cols,
        rows:    msg.image.rows,
        width:   msg.image.width  ?? null,
        height:  msg.image.height ?? null,
      };
      drawings = [];
      persist();
      broadcast({ type: 'image-set', image: referenceImage });
    }

    // ── Set grid without reference image ───────────────────────────────────────
    if (msg.type === 'set-grid') {
      referenceImage = { dataUrl: null, cols: msg.cols, rows: msg.rows, width: null, height: null };
      drawings = [];
      persist();
      broadcast({ type: 'image-set', image: referenceImage });
    }

    // ── Clear all ──────────────────────────────────────────────────────────────
    if (msg.type === 'clear') {
      drawings = [];
      persist();
      broadcast({ type: 'cleared' });
    }
  });

  ws.on('error', err => console.error('WS client error:', err.message));
});

// ── Start ─────────────────────────────────────────────────────────────────────

server.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter(n => n.family === 'IPv4' && !n.internal)
    .map(n => n.address);

  console.log(`\nqart server running\n`);
  console.log(`  Local:    http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`  Network:  http://${ip}:${PORT}`));
  console.log('\n  Share the Network URL with visitors.\n');
});
