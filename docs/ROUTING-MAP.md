# Routing Map (ROUTE-01 + INFRA-02) — one Worker, five doors

## Host → path-prefix → file resolution
The Worker rewrites by hostname at the top of `fetch` (worker.js, PREFIX map), then Cloudflare
static assets resolve the file. APIs (`/api/*`), assets (`/assets/*`), and pass links
(`/pass/*`) are host-agnostic — they work on every door.

| Host | Prefix | `/` resolves to | Surface |
|---|---|---|---|
| carnimbus.com | — | site/index.html | Marketing |
| app.carnimbus.com | /app | site/app/discover.html | Buyer app (5 tabs) |
| dealer.carnimbus.com | /dealer | site/dealer/index.html | Dealer console |
| admin.carnimbus.com | /admin | site/admin/index.html | Internal ops (+ /wall.html) |
| ai.carnimbus.com | /ai | site/ai/index.html | Nimbus visual |

Repo visibility ≠ routing visibility: all five surfaces are raw files in one repo; the Worker
is the only router. That's a simplicity property, **not** a security property — see below.

## ROUTE-03 — admin. security is real auth, not obscurity
Every admin API call requires the `x-admin-key` header, verified server-side against the
`ADMIN_KEY` Worker secret on each request (`adminOnly()` in worker.js). An unlinked URL grants
nothing; the pages render but every data call 403s without the key. Key custody:
`~/.carnimbus-admin-key` (operator, chmod 600) + browser localStorage `cn_admin`.

## INFRA-02 — the Dove → Nimbus projection path
There is exactly one seam: `embed()` / `llm()` in worker.js.
- **Today:** the seam calls Cloudflare Workers AI (white-labeled as Nimbus everywhere users
  look, including ai.carnimbus.com's live counters).
- **Stopgap serving (Ollama on Dove or any box):** expose `/embed` and `/chat` over HTTPS,
  set `AI_BACKEND_URL` → the Worker routes every AI call there. No code change.
- **Target (GLM-5.2 rig):** identical cutover — 1 DNS A record for ai.carnimbus.com + 1
  secret. The "hardware cutover" the Nimbus dashboard footer references is exactly this.

## TLS
HSTS is served by the Worker on all hosts (`max-age=31536000; includeSubDomains; preload`).
Remaining dashboard item (SEC-02): Cloudflare zone SSL/TLS mode → **Full (strict)**.
