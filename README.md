# carnimbus-com — Beyond.js

Source of the **live carnimbus.com**: a consumer AI car-buying superagent for LAcarGUY dealers, plus a
dealer-side **Drive Now** dashboard. 94 real LAcarGUY certified-used cars are live.

## Philosophy — Beyond.js

Frameworks exist to bridge the gap between how you write and where it runs. CarNimbus removes the gap:
**low-level programming projected straight to the internet in one JS pass.** There is no framework, no
build step, no bundler, no npm. The Worker *is* the app — one hand-edited `worker.js` (~1164 lines) that
routes, renders, talks to the database, runs the models, and serves the site. What you write is what runs.

Pages are vanilla HTML/CSS/JS that use `<x-import>` custom elements, hydrated client-side by
`site/assets/runtime.js`, with `site/assets/signals.js` for reactive state. Every script is a real static
file — the CSP is **enforcing** and forbids inline JS. There is nothing between the source and the edge.

This isn't minimalism for its own sake. It's a bet that a single readable pass — server logic, data, AI,
and markup projected directly onto Cloudflare's edge — is faster to reason about, cheaper to run, and
harder to break than a tower of tooling.

## Stack

- **Cloudflare Workers** — single `worker.js`, `run_worker_first`, serves assets + API + pages.
- **D1** — `carnimbus-waitlist` database (id `43d0dc1a-96c1-49dd-98da-e4f865b7a013`); waitlist, matches,
  events, profiles, test-drives.
- **Vectorize** — `carnimbus-match` index (768-dim bge-base) for inventory similarity.
- **Workers AI** — llama-3.3-70b (chat/reasoning) + bge-base (embeddings). No external model APIs.
- **Cron** — 5-minute schedule drives background work (embedding sync, matching, agent batches).
- **5 subdomains** via path-prefix rewrite: `carnimbus.com`, `app.`, `dealer.`, `admin.`, `ai.`.

## Layout

- `worker.js` — the app: flat `if`-chain router, API routes wrapped `sec(await withUser|withDealer|adminOnly(...))`, render helpers, models, cron.
- `site/` — page-per-file routing; vanilla HTML/JS/CSS. Pages use `<x-import>` placeholders rendered by `site/assets/runtime.js`; `site/assets/signals.js` provides reactive state.
- `migrations/` — D1 schema (`0017_matches`, `0018_events`, `0019_vdp_enrichment`, …).
- `wrangler.jsonc` — Worker config; custom domain `carnimbus.com`.

## Deploy

```sh
npx wrangler d1 migrations apply carnimbus-waitlist --remote   # only when migrations/ changed
npx wrangler deploy
```

Post-deploy spot-check:

```sh
curl -sI https://carnimbus.com | grep -iE 'content-security|strict-transport'   # expect headers
curl -s -o /dev/null -w '%{http_code}\n' https://carnimbus.com/waitlist          # expect 200
```

Deploy **only** when the founder says "ship." Remote D1 migrations apply in order. Admin key via
`$(cat ~/.carnimbus-admin-key)` — never printed. `SESSION_SECRET` must stay set (the Worker fail-closes
without it). No mass remote `DELETE` on D1.

## CSP policy (worker.js `sec()`)

Enforcing. Goal is full `'self'`; every allowed third party is justified and removed when its reason
disappears:

- `challenges.cloudflare.com` — Turnstile (script/frame/connect).
- `static.cloudflareinsights.com` — Web Analytics beacon (script/connect).

No inline `<script>`. New JS = a new static file under `site/assets/`. `connect-src 'self'` already covers
`sendBeacon`/`fetch` to `/api/events` — no CSP change needed for the event spine.

## Toggles

- **Turnstile (bot check)** — server verifies only when the secret exists:
  1. Cloudflare dash → Turnstile → create widget for carnimbus.com → copy sitekey + secret.
  2. `npx wrangler secret put TURNSTILE_SECRET`
  3. In `site/index.html` (2 forms) + `site/waitlist.html`: uncomment the `cf-turnstile` div, paste the
     sitekey, and add `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>` before `</body>`.
- **Cloudflare Web Analytics** — dash → Web Analytics → add site → token; paste the beacon `<script>`
  (staged in comments near `</body>`) and keep `static.cloudflareinsights.com` in the CSP.

## Rules

- **No npm/packages** (2026-06 supply-chain incident). Vanilla only.
- Never commit secrets; Turnstile/session secrets live in Worker secrets.
- Waitlist PII (email/ip/consent) stays in D1; see `/privacy`. Soft-pull FICO is stored **only as a band**,
  never a raw score (see `TWIN-SCHEMA.md`).

## Branching & releases

- `main` is the release branch — Cloudflare auto-deploys from it. Never force-push.
- Feature work happens on branches and merges via reviewed PR. No direct pushes to another branch's work.
- Deploys are gated on explicit sign-off; migrations apply in order before the Worker deploy.

## The Nimbus platform

Beneath the app is **Nimbus** — a behavioral operating system for local vehicle retail. An append-only event
spine captures every interaction, a per-buyer **Digital Twin** turns those signals into matches and predictions,
and a layer of **living agents** (cron-driven, one KPI each, reading and writing the same Brain) does the work:
inventory enrichment, concierge, scheduling, growth analytics, and a resident community presence. Every agent
action is a logged event, so the whole system is auditable — and it compounds: more usage, better predictions.

## Canonical docs

`MASTERPLAN.md` · `EVENT-TAXONOMY.md` · `AGENT-REGISTRY.md` · `LIVING-AGENTS.md` · `TWIN-SCHEMA.md` ·
`MODEL-REGISTRY.md` · `AUTONOMY-POLICY.md` · `docs/HTML-TO-JS-MIGRATION.md`
