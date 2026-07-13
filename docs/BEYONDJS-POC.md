# Beyond.js — POC definition & acceptance (COMPLETE)

**Status:** ✅ Proven. 2026-07-13.
**Thesis:** *Own the runtime, and the site runs anywhere — not only on Cloudflare's edge.* No framework,
no build step, no bundler, no npm — low-level logic projected straight to the internet in one JS pass.

## What "the Beyond.js POC" is
The CarNimbus site **is** the POC. It is not a compiler (the literal Linux.js/Beyond.js compiler is a
separate, external, vision-stage tool owned by Jonathan Blake — out of scope here). The POC is the
running proof that the own-the-runtime discipline works end to end:

| Piece | File | Role |
|---|---|---|
| One-pass server | `worker.js` (~2,084 lines) | routing, rendering, DB, models, security headers — one hand-edited file |
| Hydration runtime | `site/assets/runtime.js` (513 lines) | `<x-import>` custom elements → rendered UI; React-free component library |
| Reactivity | `site/assets/signals.js` | reactive state, no framework |
| Discipline | `LINUX-JS.md` | "what you write is what runs"; no build artifacts |

## Acceptance criteria (definition of done) — all met
1. **No build/npm/bundler** in the serving path — vanilla HTML/CSS/JS is the artifact. ✅ (live on carnimbus.com)
2. **Single readable pass** renders + serves + routes + queries + runs models. ✅ (`worker.js`)
3. **Runtime portability — the new proof:** the exact same `worker.js` runs **off Cloudflare entirely**,
   projected straight from the CNMB flash drive by `nimbus-local/serve.js` using only Node builtins. ✅
   Verified 2026-07-13: homepage + assets + pages + all API routes served from the drive; admin gate intact.
4. **Sovereign inference seam:** every AI call routes through `AI_BACKEND_URL` before Cloudflare AI, so
   NIMBUS can run on owned hardware with a one-var cutover. ✅ (`worker.js` `embed()`/`llm()`)
5. **Sovereign hosting path:** documented + scriptable route to the public internet on owned hardware,
   no Cloudflare/GitHub. ✅ (`nimbus-local/PROJECTION.md`)

## How the portability proof works (no worker.js changes)
`nimbus-local/serve.js` loads `worker.js` as an in-memory ES module and provides a Cloudflare-compatible
`env`: D1 → `node:sqlite`; Vectorize → local cosine store; `ASSETS` → `node:fs` over `site/`; AI → local
model backend. The worker's own logic is untouched — which is the point: because the runtime is ours and
framework-free, re-hosting it is a shim, not a rewrite. See `nimbus-local/README.md`.

## Explicitly out of scope
- The literal Beyond.js/Linux.js **compiler** (JSX→AST→C→WASM) — Jonathan Blake's separate external repo,
  vision/backlog stage; tracked via fellowship sync-561, not built here. Never represent it as shipped.

## Verification (reproduce)
```sh
cd nimbus-local && bash seed-db.sh && node serve.js --port 8787
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8787/            # 200, from the flash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8787/api/admin/stats   # 403 (gate intact)
node nimbus-key.js keygen && node nimbus-key.js login                       # admin hardware-key session
```
