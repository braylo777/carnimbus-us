# Routing Map (ROUTE-01 + INFRA-02) — one Worker, four doors

## Host → path-prefix → file resolution
The Worker rewrites by hostname at the top of `route()` (worker.js, `PREFIX` map), then Cloudflare
static assets resolve the file. APIs (`/api/*`), assets (`/assets/*`), pass links (`/pass/*`),
SEO car pages (`/used/*`) and creator tracked links (`/c/*`) are host-agnostic — they work on every door.

| Host | Prefix | `/` resolves to | Surface |
|---|---|---|---|
| carnimbus.us | — | site/index.html | Marketing + public car pages (`/used/*`, `/browse`) |
| dealer.carnimbus.us | /dealer | site/dealer/signin.html | Dealer console — upload a VIN, work leads |
| creator.carnimbus.us | /creator | site/creator/index.html | **Creator Network** — one page, two tabs, claim drops, post, get paid |
| ai.carnimbus.us | /ai | site/ai/index.html | NIMBUS — the control tower over all three |

**Four hosts, as of 2026-07-28.** `app.` (the buyer app) and `admin.` (folded into `ai.`) were detached
from the Worker in `wrangler.jsonc`. Their in-Worker 301s at worker.js:69/72 remain as bookmark safety
nets, and legacy `/app/*` paths on the apex 301 to `/browse`.

⚠ **The `/admin` PATH prefix is NOT retired** — only the `admin.` HOST is. `ai.carnimbus.us/<page>`
still resolves to `site/admin/<page>` (worker.js). Don't conflate the two.

Repo visibility ≠ routing visibility: all surfaces are raw files in one repo; the Worker is the only
router. That's a simplicity property, **not** a security property — see below.

## ROUTE-03 — ai. security is real auth, not obscurity
Every admin API call requires the `x-admin-key` header, verified server-side against the `ADMIN_KEY`
Worker secret on each request (`adminOnly()`, constant-time). An unlinked URL grants nothing; the pages
render but every data call 403s without the key. Key custody: `~/.carnimbus-admin-key` (operator,
chmod 600) + the CNMB flash-key file picker.

The creator surface has its own session (`cn_crt`, `withCreator()`), modelled on the dealer's `cn_dlr`.
Creator sign-up is self-serve and **auto-approves above a declared follower threshold** — that number is
unverifiable, so the real gates downstream are Stripe's KYC (`payouts_enabled`) and the confirm-gated
`creator_payout` action.

## ROUTE-04 — NIMBUS decides on dealer. AND creator.
One brain, not two. The same machinery serves both surfaces:
- **Deterministic policy core**, each function shipping a `why` whose factors sum to the number:
  `bandForCar`/`closeProb`/`leadHeat` on dealer; `rateForDrop`/`creatorScore`/`dropFit`/`postVerdict`
  on creator.
- **`NIMBUS_ACTIONS`** — one allowlist object serving three roles: the vocabulary in the LLM's system
  prompt, the proposal filter, and the execution gate in `aiAct`. Creator actions live in the same object.
- **`confirm:true` required** for every mutation. `creator_payout` is the only irreversible action in the
  set and is therefore capped at **L1 forever** per `AUTONOMY-POLICY.md` — NIMBUS proposes, a human confirms.
- **`aiPulse` / `aiTrends` / `aiGraph`** all carry creator terms, so NIMBUS is not blind on half its
  territory. `dealerConsole` reaches back the other way: each listing carries its drop's rate, claims,
  posts, and attributed leads.

## INFRA-02 — the model seam
There is exactly one seam: `embed()` / `llm()` in worker.js.
- **Today:** the seam calls Cloudflare Workers AI (white-labeled as Nimbus).
- **Stopgap serving (Ollama on any box):** expose `/embed` and `/chat` over HTTPS, set `AI_BACKEND_URL`
  → the Worker routes every AI call there. No code change.
- **Target (GLM-5.2 rig):** identical cutover — 1 DNS record + 1 secret.

Note the seam produces **prose and extractions only**. No LLM generates a figure a dealer or creator acts
on; those all come from the deterministic core above (`MODEL-REGISTRY.md` §4 makes that a hard eval gate).

## TLS
HSTS is served by the Worker on all hosts (`max-age=31536000; includeSubDomains; preload`).
Remaining dashboard item (SEC-02): Cloudflare zone SSL/TLS mode → **Full (strict)**.
