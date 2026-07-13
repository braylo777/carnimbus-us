// nimbus-key.js — the CNMB drive-side hardware key CLI. The PRIVATE key lives ONLY on the drive and
// never leaves it; this tool uses it to sign the server's challenge. Zero deps (WebCrypto Ed25519).
//
//   node nimbus-key.js keygen          # one-time: generate the Ed25519 keypair onto the drive + print pub path
//   node nimbus-key.js login [url]     # challenge → sign with drive key → verify → print the admin session
//   node nimbus-key.js pub             # print the public key path/bytes (to place in the server key store)
//
// Security: possession of this repo is NOT enough — without the private key file on the mounted CNMB
// drive, `login` fails closed. The server only ever holds the PUBLIC key.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const KEY_STORE = process.env.NIMBUS_KEYSTORE || '/Volumes/CNMB/00-corp/00E-keys/nimbus-admin';
const PRIV = join(KEY_STORE, 'admin.ed25519.key');   // PKCS8 DER — stays on the drive
const PUB = join(KEY_STORE, 'admin.ed25519.pub');    // SPKI DER — copied to the server key store
const cmd = process.argv[2];
const b = (u8) => Buffer.from(u8);

async function keygen() {
  if (existsSync(PRIV)) { console.error(`refusing to overwrite existing key at ${PRIV} (rotate manually)`); process.exit(1); }
  mkdirSync(KEY_STORE, { recursive: true });
  const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const priv = new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey));
  const pub = new Uint8Array(await crypto.subtle.exportKey('spki', kp.publicKey));
  writeFileSync(PRIV, b(priv), { mode: 0o600 });
  writeFileSync(PUB, b(pub), { mode: 0o644 });
  console.log(`✅ keypair written to the drive:\n   private: ${PRIV} (mode 600 — never leaves the drive)\n   public:  ${PUB}`);
  console.log(`Place the PUBLIC key where the server reads it (default: same path, ${PUB}).`);
}

async function loadPriv() {
  if (!existsSync(PRIV)) { console.error(`❌ no private key at ${PRIV} — is the CNMB drive mounted? (fail closed)`); process.exit(2); }
  const der = new Uint8Array(readFileSync(PRIV));
  return crypto.subtle.importKey('pkcs8', der, { name: 'Ed25519' }, false, ['sign']);
}

async function login(url) {
  const base = url || process.env.NIMBUS_URL || 'http://127.0.0.1:8787';
  const priv = await loadPriv();
  const ch = await (await fetch(`${base}/api/admin/auth/challenge`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'admin' }),
  })).json();
  if (!ch.nonce) { console.error('challenge failed:', ch); process.exit(3); }
  const nonceBytes = new Uint8Array(Buffer.from(ch.nonce, 'base64'));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, priv, nonceBytes));
  const vr = await (await fetch(`${base}/api/admin/auth/verify`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ user: 'admin', nonce: ch.nonce, sig: b(sig).toString('base64') }),
  })).json();
  if (!vr.ok) { console.error('❌ login rejected:', vr); process.exit(4); }
  console.log(`✅ admin session (expires in ${vr.expires_in}s):\n${vr.session}`);
  console.log(`\nUse it:  curl -H "Authorization: Bearer ${vr.session}" ${base}/api/admin/stats`);
}

(async () => {
  if (cmd === 'keygen') return keygen();
  if (cmd === 'login') return login(process.argv[3]);
  if (cmd === 'pub') { console.log(existsSync(PUB) ? PUB : '(no public key yet — run keygen)'); return; }
  console.log('usage: node nimbus-key.js <keygen|login [url]|pub>');
})();
