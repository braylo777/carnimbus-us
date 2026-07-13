// env-shim.js — builds a Cloudflare-Worker-compatible `env` from local, sovereign primitives.
// Zero deps. Supplies every binding worker.js reads (18 total). External-service secrets are left
// undefined by default → worker.js already fail-softs on them (SMS/email/Turnstile run "dark").
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { makeD1 } from './d1-sqlite.js';
import { makeVectorize } from './vectorize-sqlite.js';

const here = dirname(fileURLToPath(import.meta.url));
const SITE_DIR = join(here, '..', 'site');
const DB_PATH = join(here, 'nimbus.sqlite');
const KEY_STORE = process.env.NIMBUS_KEYSTORE || '/Volumes/CNMB/00-corp/00E-keys/nimbus-admin';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.map': 'application/json',
};
const ext = (p) => { const i = p.lastIndexOf('.'); return i < 0 ? '' : p.slice(i).toLowerCase(); };

// env.ASSETS — the ONE place Cloudflare's Assets binding is replaced. Serves ./site from the flash.
function makeAssets() {
  return {
    async fetch(request) {
      const url = new URL(request.url);
      let path = decodeURIComponent(url.pathname);
      if (path.endsWith('/')) path += 'index.html';
      // prevent path traversal; resolve within SITE_DIR
      const rel = normalize(path).replace(/^(\.\.[/\\])+/, '');
      let file = join(SITE_DIR, rel);
      try {
        let s = await stat(file).catch(() => null);
        if (s && s.isDirectory()) { file = join(file, 'index.html'); s = await stat(file).catch(() => null); }
        if (!s) {                       // extensionless clean-URL → try .html
          const alt = file + '.html';
          if (existsSync(alt)) file = alt; else throw new Error('miss');
        }
        const buf = await readFile(file);
        return new Response(buf, { status: 200, headers: { 'content-type': MIME[ext(file)] || 'application/octet-stream' } });
      } catch {
        const notFound = join(SITE_DIR, '404.html');
        if (existsSync(notFound)) return new Response(await readFile(notFound), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
        return new Response('Not found', { status: 404 });
      }
    },
  };
}

// Secrets: prefer the drive key store, then nimbus-local/.env.local, else generate ephemeral (dev only).
function loadSecrets() {
  const out = {};
  const jsonPath = join(KEY_STORE, 'secrets.json');
  if (existsSync(jsonPath)) Object.assign(out, JSON.parse(readFileSync(jsonPath, 'utf8')));
  const envLocal = join(here, '.env.local');
  if (existsSync(envLocal)) {
    for (const line of readFileSync(envLocal, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  const rand = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
  for (const k of ['SESSION_SECRET', 'ADMIN_KEY', 'PII_KEY']) {
    if (!out[k]) { out[k] = rand(); out[`_${k}_ephemeral`] = true; }
  }
  return out;
}

export async function makeEnv() {
  const d1 = makeD1(DB_PATH);
  const secrets = loadSecrets();
  const ephemeral = Object.keys(secrets).filter((k) => k.endsWith('_ephemeral'));
  if (ephemeral.length) {
    console.warn(`⚠️  ephemeral secrets generated (not on drive): ${ephemeral.map((k) => k.slice(1, -10)).join(', ')} — set them in ${KEY_STORE}/secrets.json for stable sessions.`);
  }
  return {
    // core sovereign bindings
    DB: d1,
    ASSETS: makeAssets(),
    MATCH_INDEX: makeVectorize(d1._db),
    AI_BACKEND_URL: process.env.NIMBUS_AI_URL || 'http://127.0.0.1:8788',
    AI: undefined,                       // bypassed: AI_BACKEND_URL is set, so worker never calls env.AI
    DEV_MODE: '0',
    // secrets (from drive keystore / .env.local / ephemeral)
    SESSION_SECRET: secrets.SESSION_SECRET,
    ADMIN_KEY: secrets.ADMIN_KEY,
    PII_KEY: secrets.PII_KEY,
    // external services — undefined by default → worker.js fail-softs (runs "dark").
    // Populate via .env.local on the drive to go live: TWILIO_*, RESEND_API_KEY, TURNSTILE_SECRET,
    // STRIPE_WEBHOOK_SECRET, ADMIN_PHONE, SMS_MATCH_LIVE, TWILIO_VERIFY_SID.
    TWILIO_ACCOUNT_SID: secrets.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: secrets.TWILIO_AUTH_TOKEN,
    TWILIO_FROM: secrets.TWILIO_FROM,
    TWILIO_VERIFY_SID: secrets.TWILIO_VERIFY_SID,
    ADMIN_PHONE: secrets.ADMIN_PHONE,
    SMS_MATCH_LIVE: secrets.SMS_MATCH_LIVE,
    RESEND_API_KEY: secrets.RESEND_API_KEY,
    TURNSTILE_SECRET: secrets.TURNSTILE_SECRET,
    STRIPE_WEBHOOK_SECRET: secrets.STRIPE_WEBHOOK_SECRET,
  };
}

export { KEY_STORE };
