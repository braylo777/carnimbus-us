// serve.js — the Beyond.js projection server. Projects carnimbus.com straight from the CNMB flash to
// the network with ZERO dependencies and NO Cloudflare/GitHub in the path. It loads the real, unmodified
// worker.js as ESM in-memory (no repo package.json needed), builds a sovereign `env` (SQLite/local-vector/
// local-AI), and bridges the CNMB hardware-key admin session to the worker's existing x-admin-key gate.
//
// Usage:
//   node serve.js                         # http on 0.0.0.0:8787 (LAN-reachable), cron OFF
//   node serve.js --port 8080
//   node serve.js --tls cert.pem key.pem  # https
//   node serve.js --cron                  # also run worker.scheduled() every 5 min
import http from 'node:http';
import https from 'node:https';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { makeEnv } from './env-shim.js';
import { handleAdminAuth, validSession, cookie } from './admin-auth.js';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const argv = process.argv.slice(2);
const arg = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : null; };
const has = (flag) => argv.includes(flag);
const PORT = +(arg('--port') || process.env.PORT || 8787);

// --- Load the real worker.js as ESM without touching the repo (no package.json). --------------------
// The repo is ESM-by-convention but has no package.json, so Node would treat .js as CJS. We read the
// source, inline its one relative import (match.js) as a data: URL, and import the whole thing as a
// data: module. worker.js is used verbatim — its logic is not modified.
async function loadWorker() {
  const workerSrc = await readFile(join(repo, 'worker.js'), 'utf8');
  const matchSrc = await readFile(join(repo, 'site/assets/match.js'), 'utf8'); // match.js has no imports
  const matchDataUrl = 'data:text/javascript,' + encodeURIComponent(matchSrc);
  const patched = workerSrc.replace(/["']\.\/site\/assets\/match\.js["']/, JSON.stringify(matchDataUrl));
  const mod = await import('data:text/javascript,' + encodeURIComponent(patched));
  return mod.default;
}

const worker = await loadWorker();
const env = await makeEnv();
const ctx = { waitUntil() {}, passThroughOnException() {} };

async function readRaw(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

async function handler(req, res) {
  try {
    const url = `http://${req.headers.host || 'localhost'}${req.url}`;
    const method = req.method || 'GET';
    const body = ['GET', 'HEAD'].includes(method) ? undefined : await readRaw(req);
    let request = new Request(url, { method, headers: req.headers, body });

    // 1) CNMB hardware-key auth endpoints (handled in the projection layer, not worker.js)
    const authResp = await handleAdminAuth(request, env);
    if (authResp) return send(res, authResp);

    // 2) Bridge a valid admin session → worker's existing x-admin-key gate (no worker.js change)
    const path = new URL(url).pathname;
    if (path.startsWith('/api/admin/') && !path.startsWith('/api/admin/auth/')) {
      const token = cookie(request, 'nimbus_admin') || (request.headers.get('authorization') || '').replace(/^Bearer /, '');
      if (await validSession(env, token)) {
        const h = new Headers(request.headers);
        h.set('x-admin-key', env.ADMIN_KEY);          // present the shared gate secret on the session's behalf
        request = new Request(url, { method, headers: h, body });
      }
    }

    // 3) Delegate everything else to the real worker
    const response = await worker.fetch(request, env, ctx);
    return send(res, response);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('projection error: ' + (e?.message || e));
  }
}

async function send(res, response) {
  const headers = {};
  for (const [k, v] of response.headers) headers[k] = v;
  res.writeHead(response.status, headers);
  const buf = Buffer.from(await response.arrayBuffer());
  res.end(buf);
}

// --- TLS / plain ------------------------------------------------------------------------------------
let server;
const certPath = arg('--tls');
if (certPath) {
  const keyPath = argv[argv.indexOf('--tls') + 2];
  server = https.createServer({ cert: await readFile(certPath), key: await readFile(keyPath) }, handler);
} else {
  server = http.createServer(handler);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌩️  NIMBUS projection live — carnimbus.com served from the CNMB flash`);
  console.log(`   ${certPath ? 'https' : 'http'}://0.0.0.0:${PORT}  (LAN-reachable; no Cloudflare, no GitHub in path)`);
  console.log(`   AI backend: ${env.AI_BACKEND_URL}   |   cron: ${has('--cron') ? 'ON (5m)' : 'off'}`);
});

// --- Cron (worker.scheduled) — OFF unless --cron ---------------------------------------------------
if (has('--cron')) {
  const tick = () => worker.scheduled?.({ cron: '*/5 * * * *', scheduledTime: Date.now() }, env, ctx).catch((e) => console.error('cron:', e.message));
  setInterval(tick, 300_000);
  console.log('   cron: worker.scheduled() every 5 min');
}
