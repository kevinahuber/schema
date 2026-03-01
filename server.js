import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { networkInterfaces } from 'os';
import { WebSocketServer } from 'ws';
import Database from 'better-sqlite3';
import { createCanvas, loadImage } from 'canvas';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);
const DIST = path.join(__dirname, 'dist');
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'qart.db');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
};

// ── Data directory ────────────────────────────────────────────────────────────

fs.mkdirSync(path.join(DATA_DIR, 'sessions'), { recursive: true });

// ── SQLite ────────────────────────────────────────────────────────────────────

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT,
    admin_pin TEXT NOT NULL,
    image_path TEXT,
    cols INTEGER DEFAULT 8,
    rows INTEGER DEFAULT 8,
    image_width INTEGER,
    image_height INTEGER,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS drawings (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    image_path TEXT NOT NULL,
    slot_index INTEGER,
    created_at INTEGER DEFAULT (unixepoch())
  );
`);

const stmts = {
  insertSession:    db.prepare(`INSERT INTO sessions (id, slug, name, admin_pin, cols, rows) VALUES (?, ?, ?, ?, ?, ?)`),
  getSessionBySlug: db.prepare(`SELECT * FROM sessions WHERE slug = ?`),
  getSessionById:   db.prepare(`SELECT * FROM sessions WHERE id = ?`),
  updateSessionImage: db.prepare(`UPDATE sessions SET image_path = ?, image_width = ?, image_height = ?, cols = ?, rows = ? WHERE id = ?`),
  updateSessionGrid:  db.prepare(`UPDATE sessions SET image_path = NULL, image_width = NULL, image_height = NULL, cols = ?, rows = ? WHERE id = ?`),
  insertDrawing:    db.prepare(`INSERT INTO drawings (id, session_id, image_path, slot_index, created_at) VALUES (?, ?, ?, ?, ?)`),
  getDrawings:      db.prepare(`SELECT * FROM drawings WHERE session_id = ? ORDER BY created_at ASC`),
  getDrawingById:   db.prepare(`SELECT * FROM drawings WHERE id = ?`),
  deleteDrawing:    db.prepare(`DELETE FROM drawings WHERE id = ?`),
  deleteDrawingsBySession: db.prepare(`DELETE FROM drawings WHERE session_id = ?`),
  filledSlots:      db.prepare(`SELECT slot_index FROM drawings WHERE session_id = ? AND slot_index IS NOT NULL`),
  slugExists:       db.prepare(`SELECT 1 FROM sessions WHERE slug = ?`),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateSlug() {
  const words = [
    'sun','moon','star','leaf','wave','rain','wind','fire','snow','pine',
    'fern','moss','lake','reed','hawk','fox','deer','owl','bear','hare',
    'cove','glen','vale','peak','arch','dune','rift','bay','cape','isle',
  ];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  for (let i = 0; i < 50; i++) {
    const slug = `${pick()}-${pick()}`;
    if (!stmts.slugExists.get(slug)) return slug;
  }
  // Fallback with random suffix
  return `${pick()}-${Date.now().toString(36)}`;
}

function generatePin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function sessionDir(slug) {
  return path.join(DATA_DIR, 'sessions', slug);
}

function ensureSessionDir(slug) {
  fs.mkdirSync(path.join(sessionDir(slug), 'drawings'), { recursive: true });
}

/** Decode a data URL and write to disk. Returns relative path from DATA_DIR. */
function saveDataUrl(dataUrl, filePath) {
  const match = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (!match) return null;
  const abs = path.join(DATA_DIR, filePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, Buffer.from(match[1], 'base64'));
  return filePath;
}

function deleteFile(relPath) {
  try { fs.unlinkSync(path.join(DATA_DIR, relPath)); } catch {}
}

function sessionToPublic(session) {
  if (!session) return null;
  return {
    slug: session.slug,
    name: session.name,
    cols: session.cols,
    rows: session.rows,
    imageUrl: session.image_path ? `/data/${session.image_path}` : null,
    imageWidth: session.image_width,
    imageHeight: session.image_height,
    createdAt: session.created_at,
  };
}

function drawingToPublic(d) {
  return {
    id: d.id,
    url: `/data/${d.image_path}`,
    slotIndex: d.slot_index,
    createdAt: d.created_at,
  };
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const method = req.method;
  let url = req.url.split('?')[0].split('#')[0];

  // ── JSON API ────────────────────────────────────────────────────────────────

  if (url === '/api/sessions' && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { name, cols, rows } = JSON.parse(body || '{}');
        const id = crypto.randomUUID();
        const slug = generateSlug();
        const adminPin = generatePin();
        const c = Math.max(1, Math.min(32, parseInt(cols) || 8));
        const r = Math.max(1, Math.min(32, parseInt(rows) || 8));
        stmts.insertSession.run(id, slug, name || null, adminPin, c, r);
        ensureSessionDir(slug);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ slug, adminPin }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  const sessionInfoMatch = url.match(/^\/api\/sessions\/([a-z0-9-]+)$/);
  if (sessionInfoMatch && method === 'GET') {
    const session = stmts.getSessionBySlug.get(sessionInfoMatch[1]);
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
      return;
    }
    const drawings = stmts.getDrawings.all(session.id);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ session: sessionToPublic(session), drawingCount: drawings.length }));
    return;
  }

  // ── Mosaic export ───────────────────────────────────────────────────────────

  const mosaicMatch = url.match(/^\/s\/([a-z0-9-]+)\/mosaic\.png$/);
  if (mosaicMatch && method === 'GET') {
    handleMosaicExport(mosaicMatch[1], res);
    return;
  }

  // ── Serve data/ files ───────────────────────────────────────────────────────

  if (url.startsWith('/data/')) {
    const relPath = url.slice(6); // strip "/data/"
    const filePath = path.resolve(DATA_DIR, relPath);
    if (!filePath.startsWith(DATA_DIR)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    try {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      res.end(content);
    } catch {
      res.writeHead(404); res.end('Not found');
    }
    return;
  }

  // ── Static files / SPA fallback ─────────────────────────────────────────────

  if (url === '/' || url.startsWith('/s/')) url = '/index.html';

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

const wss = new WebSocketServer({ noServer: true, maxPayload: 10 * 1024 * 1024 });

// Track clients per session slug
const sessionClients = new Map(); // slug → Set<WebSocket>

function broadcastToSession(slug, msg) {
  const clients = sessionClients.get(slug);
  if (!clients) return;
  const str = JSON.stringify(msg);
  clients.forEach(c => { if (c.readyState === 1) c.send(str); });
}

function filledSlots(sessionId) {
  return new Set(stmts.filledSlots.all(sessionId).map(r => r.slot_index));
}

server.on('upgrade', (req, socket, head) => {
  const urlPath = req.url.split('?')[0];
  const wsMatch = urlPath.match(/^\/ws\/([a-z0-9-]+)$/);

  if (!wsMatch) {
    socket.destroy();
    return;
  }

  const slug = wsMatch[1];
  const session = stmts.getSessionBySlug.get(slug);
  if (!session) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, ws => {
    ws._slug = slug;
    ws._sessionId = session.id;

    if (!sessionClients.has(slug)) sessionClients.set(slug, new Set());
    sessionClients.get(slug).add(ws);

    wss.emit('connection', ws, req);
  });
});

wss.on('connection', ws => {
  const slug = ws._slug;
  const sessionId = ws._sessionId;

  // Send init
  const session = stmts.getSessionById.get(sessionId);
  const drawings = stmts.getDrawings.all(sessionId).map(drawingToPublic);
  ws.send(JSON.stringify({
    type: 'init',
    drawings,
    session: sessionToPublic(session),
  }));

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    const session = stmts.getSessionById.get(sessionId);
    if (!session) return;

    // ── New drawing ──────────────────────────────────────────────────────────
    if (msg.type === 'drawing' && msg.drawing?.dataUrl) {
      let slotIndex = msg.drawing.slotIndex ?? null;

      if (slotIndex != null && filledSlots(sessionId).has(slotIndex)) {
        slotIndex = null;
      }

      const id = msg.drawing.id || crypto.randomUUID();
      const relPath = `sessions/${slug}/drawings/${id}.png`;
      const saved = saveDataUrl(msg.drawing.dataUrl, relPath);
      if (!saved) return;

      const now = Math.floor(Date.now() / 1000);
      stmts.insertDrawing.run(id, sessionId, relPath, slotIndex, now);

      const entry = { id, url: `/data/${relPath}`, slotIndex, createdAt: now };
      broadcastToSession(slug, { type: 'drawing', drawing: entry });
    }

    // ── Request a slot assignment ────────────────────────────────────────────
    if (msg.type === 'request-slot') {
      const total = session.cols * session.rows;
      const taken = filledSlots(sessionId);
      const available = [];
      for (let i = 0; i < total; i++) {
        if (!taken.has(i)) available.push(i);
      }
      const slotIndex = available.length > 0
        ? available[Math.floor(Math.random() * available.length)]
        : null;
      ws.send(JSON.stringify({ type: 'slot-assigned', slotIndex }));
    }

    // ── Set reference image (admin) ──────────────────────────────────────────
    if (msg.type === 'set-image' && msg.image?.dataUrl) {
      if (msg.pin !== session.admin_pin) return;

      const cols = msg.image.cols;
      const rows = msg.image.rows;
      const width = msg.image.width ?? null;
      const height = msg.image.height ?? null;

      const relPath = `sessions/${slug}/reference.jpg`;
      const saved = saveDataUrl(msg.image.dataUrl, relPath);
      if (!saved) return;

      // Delete old drawings
      const oldDrawings = stmts.getDrawings.all(sessionId);
      oldDrawings.forEach(d => deleteFile(d.image_path));
      stmts.deleteDrawingsBySession.run(sessionId);

      stmts.updateSessionImage.run(relPath, width, height, cols, rows, sessionId);
      const updated = stmts.getSessionById.get(sessionId);
      broadcastToSession(slug, { type: 'image-set', session: sessionToPublic(updated) });
    }

    // ── Set grid without reference image (admin) ─────────────────────────────
    if (msg.type === 'set-grid') {
      if (msg.pin !== session.admin_pin) return;

      const oldDrawings = stmts.getDrawings.all(sessionId);
      oldDrawings.forEach(d => deleteFile(d.image_path));
      stmts.deleteDrawingsBySession.run(sessionId);

      // Delete old reference image if any
      if (session.image_path) deleteFile(session.image_path);

      stmts.updateSessionGrid.run(msg.cols, msg.rows, sessionId);
      const updated = stmts.getSessionById.get(sessionId);
      broadcastToSession(slug, { type: 'image-set', session: sessionToPublic(updated) });
    }

    // ── Clear all (admin) ────────────────────────────────────────────────────
    if (msg.type === 'clear') {
      if (msg.pin !== session.admin_pin) return;

      const oldDrawings = stmts.getDrawings.all(sessionId);
      oldDrawings.forEach(d => deleteFile(d.image_path));
      stmts.deleteDrawingsBySession.run(sessionId);
      broadcastToSession(slug, { type: 'cleared' });
    }

    // ── Delete single drawing (admin) ────────────────────────────────────────
    if (msg.type === 'delete-drawing' && msg.drawingId) {
      if (msg.pin !== session.admin_pin) return;

      const drawing = stmts.getDrawingById.get(msg.drawingId);
      if (!drawing || drawing.session_id !== sessionId) return;

      deleteFile(drawing.image_path);
      stmts.deleteDrawing.run(msg.drawingId);
      broadcastToSession(slug, { type: 'drawing-deleted', drawingId: msg.drawingId });
    }
  });

  ws.on('close', () => {
    const clients = sessionClients.get(slug);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) sessionClients.delete(slug);
    }
  });

  ws.on('error', err => console.error('WS client error:', err.message));
});

// ── Mosaic export ─────────────────────────────────────────────────────────────

async function handleMosaicExport(slug, res) {
  try {
    const session = stmts.getSessionBySlug.get(slug);
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Session not found');
      return;
    }

    const { cols, rows } = session;
    const cellSize = 300;
    const canvasW = cols * cellSize;
    const canvasH = rows * cellSize;
    const canvas = createCanvas(canvasW, canvasH);
    const ctx = canvas.getContext('2d');

    // Draw reference image as background
    if (session.image_path) {
      try {
        const refPath = path.join(DATA_DIR, session.image_path);
        const refImg = await loadImage(refPath);
        ctx.drawImage(refImg, 0, 0, canvasW, canvasH);
      } catch {}
    }

    // Composite drawings into grid slots
    const drawings = stmts.getDrawings.all(session.id);
    for (const d of drawings) {
      if (d.slot_index == null) continue;
      try {
        const imgPath = path.join(DATA_DIR, d.image_path);
        const img = await loadImage(imgPath);
        const col = d.slot_index % cols;
        const row = Math.floor(d.slot_index / cols);
        ctx.drawImage(img, col * cellSize, row * cellSize, cellSize, cellSize);
      } catch {}
    }

    const buffer = canvas.toBuffer('image/png');
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': buffer.length,
      'Content-Disposition': `inline; filename="${slug}-mosaic.png"`,
    });
    res.end(buffer);
  } catch (err) {
    console.error('Mosaic export error:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Export failed');
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

server.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter(n => n.family === 'IPv4' && !n.internal)
    .map(n => n.address);

  const sessionCount = db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;
  console.log(`\nqart server running (${sessionCount} session(s))\n`);
  console.log(`  Local:    http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`  Network:  http://${ip}:${PORT}`));
  console.log('\n  Share the Network URL with visitors.\n');
});
