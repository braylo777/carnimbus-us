# nimbus-local — project carnimbus.com straight from the CNMB flash

A zero-dependency, zero-Cloudflare, zero-GitHub projection of the live CarNimbus site + NIMBUS AI,
served directly from this USB drive. Pure Node builtins (`node:http`, `node:sqlite`, `node:crypto`,
`node:fs`) — no npm, no build step. This is the Beyond.js thesis proven off-grid: **the runtime is ours,
so it runs anywhere — not only on Cloudflare's edge.**

## What it is
- `serve.js` — loads the real, unmodified `worker.js` as an in-memory ES module and runs it in Node,
  serving the whole site (`../site`) + all 48 API routes from the flash.
- `env-shim.js` — supplies every binding `worker.js` needs from local primitives:
  D1 → `node:sqlite`; Vectorize → local cosine store; `AI` → local model via `AI_BACKEND_URL`;
  `ASSETS` → `node:fs` over `../site`. External services (SMS/email/Turnstile) run "dark" unless keyed.
- `ai-backend.js` — the local NIMBUS inference backend (`/embed` + `/chat`) over Ollama.
- `admin-auth.js` + `nimbus-key.js` — **CNMB drive = hardware key.** Ed25519 challenge-response; the
  private key never leaves the drive; the server holds only the public key; login user is `admin`.

## One-time setup
```sh
# 1. Build the local database from migrations (creates nimbus-local/nimbus.sqlite)
bash seed-db.sh

# 2. Generate the admin hardware key ONTO the drive (private key stays here, never committed)
node nimbus-key.js keygen        # writes /Volumes/CNMB/00-corp/00E-keys/nimbus-admin/admin.ed25519.{key,pub}

# 3. (optional) pin stable secrets so sessions survive restarts — else ephemeral ones are generated:
#    echo '{"SESSION_SECRET":"<hex>","ADMIN_KEY":"<hex>","PII_KEY":"<hex>"}' > \
#      /Volumes/CNMB/00-corp/00E-keys/nimbus-admin/secrets.json
```

## Run it (one command)
```sh
node ai-backend.js &     # local NIMBUS model backend on :8788  (needs `ollama serve` running)
node serve.js            # site live on http://<your-lan-ip>:8787  — projected from the flash
# add --cron to run the worker's scheduled() every 5 min; --tls cert.pem key.pem for HTTPS
```
Open `http://<lan-ip>:8787` from any device on your network. No Cloudflare, no GitHub in the path.

## Admin (CNMB-as-key)
```sh
node nimbus-key.js login          # with CNMB mounted → prints a short-lived admin session
# eject the drive → login fails closed; the site keeps serving (read-only/static behavior)
```
Use the session: `curl -H "Authorization: Bearer <session>" http://<lan-ip>:8787/api/admin/stats`.

## Going public (own hardware, still no Cloudflare)
See `PROJECTION.md` for the sovereignty runbook: owned box with a public IP → DNS A record for
`ai.carnimbus.com` → Let's Encrypt TLS. Cutover of NIMBUS to the GLM-5.2 rig = point `AI_BACKEND_URL`
at the rig; zero code change.

## Notes
- `nimbus.sqlite` starts with schema only (94-car inventory lives in the remote D1); exporting that data
  without Cloudflare needs a one-time dump you drop into the seed. The projection + APIs work either way.
- `worker.js` is **never modified** — the admin hardware-key gate lives in this projection layer and is
  bridged to the worker's existing `x-admin-key`/`ADMIN_KEY` check. Prod (Cloudflare) is unaffected.
