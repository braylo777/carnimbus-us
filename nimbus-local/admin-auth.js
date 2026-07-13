// admin-auth.js — CNMB-drive hardware-key admin auth (Ed25519 challenge-response), in the projection
// layer so worker.js is never modified. This is the SECURE realization of "CNMB unlocks admin":
//   - the PRIVATE key lives only on the drive (never here, never committed);
//   - this server holds only the PUBLIC key;
//   - login = sign a single-use, 60s nonce; verify against the stored pubkey (constant-time by construction);
//   - success mints a short-lived session; possession alone (no drive/key) fails closed.
// It LAYERS ON TOP of worker's existing x-admin-key/ADMIN_KEY gate — a valid session is bridged to that
// gate by injecting x-admin-key downstream. No hardcoded credentials, no unauthenticated path.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KEY_STORE } from './env-shim.js';

const PUB_PATH = process.env.NIMBUS_ADMIN_PUB || join(KEY_STORE, 'admin.ed25519.pub');
const NONCE_TTL_MS = 60_000;
const SESSION_TTL_MS = 30 * 60_000;         // 30 min
const nonces = new Map();                    // nonce(hex) -> exp (single-use)
const b64 = (buf) => Buffer.from(buf).toString('base64');
const unb64 = (s) => new Uint8Array(Buffer.from(s, 'base64'));

function loadPubKey() {
  if (!existsSync(PUB_PATH)) return null;
  const raw = readFileSync(PUB_PATH);
  // stored as raw SPKI DER (from nimbus-key.js keygen)
  return crypto.subtle.importKey('spki', raw, { name: 'Ed25519' }, false, ['verify']);
}
let pubKeyPromise = loadPubKey();

// HMAC session token (reuses the worker's SESSION_SECRET so it's the same trust root).
async function mintSession(env) {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `admin.${exp}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${payload}.${b64(sig)}`;
}
export async function validSession(env, token) {
  if (!token) return false;
  const m = /^admin\.(\d+)\.(.+)$/.exec(token);
  if (!m) return false;
  const exp = +m[1];
  if (Date.now() > exp) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, unb64(m[2]), new TextEncoder().encode(`admin.${exp}`));
}

const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...extra } });

// Handles POST /api/admin/auth/challenge and /verify. Returns a Response, or null if not an auth route.
export async function handleAdminAuth(request, env) {
  const url = new URL(request.url);
  if (url.pathname === '/api/admin/auth/challenge' && request.method === 'POST') {
    const nonce = b64(crypto.getRandomValues(new Uint8Array(32)));
    nonces.set(nonce, Date.now() + NONCE_TTL_MS);
    return json({ ok: true, user: 'admin', nonce, exp: Date.now() + NONCE_TTL_MS });
  }
  if (url.pathname === '/api/admin/auth/verify' && request.method === 'POST') {
    const pub = await pubKeyPromise;
    if (!pub) return json({ ok: false, error: 'no_admin_pubkey_provisioned' }, 503);
    let body; try { body = await request.json(); } catch { return json({ ok: false, error: 'bad_json' }, 400); }
    const { nonce, sig } = body || {};
    const exp = nonces.get(nonce);
    if (!exp || Date.now() > exp) { nonces.delete(nonce); return json({ ok: false, error: 'nonce_invalid_or_expired' }, 403); }
    nonces.delete(nonce);                                   // single-use, consumed regardless of outcome
    let good = false;
    try { good = await crypto.subtle.verify({ name: 'Ed25519' }, pub, unb64(sig), unb64(nonce)); } catch { good = false; }
    if (!good) return json({ ok: false, error: 'signature_rejected' }, 403);
    const token = await mintSession(env);
    return json({ ok: true, user: 'admin', session: token, expires_in: SESSION_TTL_MS / 1000 },
      200, { 'set-cookie': `nimbus_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}` });
  }
  return null;
}

export function cookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  const m = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}
