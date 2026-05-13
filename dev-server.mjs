/**
 * Minimal static server for web/ (Node built-ins only; no npx/npm).
 * Run: node dev-server.mjs
 */
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, 'web');
const PORT = Number(process.env.PORT) || 5173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};

function isInsideRoot(root, full) {
  const rel = path.relative(root, full);
  return rel !== '' && !rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel);
}

function resolvePath(root, pathname) {
  const decoded = decodeURIComponent((pathname || '/').split('?')[0]);
  let rel = decoded.replace(/^\//, '');
  if (!rel || rel.endsWith('/')) rel = rel ? `${rel}index.html` : 'index.html';
  const full = path.resolve(root, rel);
  return isInsideRoot(root, full) ? full : null;
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }
  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  const filePath = resolvePath(ROOT, url.pathname);
  if (!filePath) {
    res.writeHead(403).end();
    return;
  }
  try {
    let st = await fs.stat(filePath);
    let finalPath = filePath;
    if (st.isDirectory()) {
      finalPath = path.join(filePath, 'index.html');
      st = await fs.stat(finalPath);
    }
    const ext = path.extname(finalPath).toLowerCase();
    const buf = await fs.readFile(finalPath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : buf);
  } catch {
    res.writeHead(404).end('Not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Listening http://127.0.0.1:${PORT}/`);
});
