# carnimbus-com — Beyond.js

Source of the **live [carnimbus.com](https://carnimbus.com)**: a consumer AI car-buying **superagent**
for LAcarGUY dealers, paired with a dealer-side **Drive Now** dashboard. **94 real LAcarGUY
certified-used cars are live** (verified against production D1: `COUNT(*) WHERE active=1` = 94), with
full specs vision-ingested from **100 LAcarGUY listing PDFs**.

It is not a website with some AI bolted on. It is a **learning agent system** that happens to render a
website — one append-only memory, a model of every buyer, and a small workforce of resident agents, all
projected onto Cloudflare's edge in a single readable pass of JavaScript.

---

## Why CarNimbus is different (the IP)

Most auto-marketplace software is a CRUD app in front of a lead form. CarNimbus is built so that **every
interaction makes the next one smarter** — and so that the intelligence, the data, and the runtime are
things we *own*, not rent. Six ideas carry the moat.

### 1. Beyond.js — the architecture is the philosophy
Frameworks exist to bridge how you write and where it runs. CarNimbus removes the bridge: low-level logic
projected straight to the internet in one JS pass. No framework, no build step, no bundler, no npm. One
hand-edited `worker.js` (**1,677 lines**) routes, renders, queries the database, runs the models, and
serves the site. **What you write is what runs.** Pages are vanilla HTML/CSS/JS using `<x-import>`
custom elements hydrated by `site/assets/runtime.js`, with `site/assets/signals.js` for reactive state.
The CSP is *enforcing* — no inline JS, nothing between source and edge. The bet: one readable pass is
faster to reason about, cheaper to run, and harder to break than a tower of tooling. *(Discipline
documented in `LINUX-JS.md`.)*

### 2. The Event Spine — a data moat that compounds
Underneath everything is **one append-only, immutable event stream** — the single system of record all
intelligence reads from. Seven frozen prefixes, enforced in code (unknown prefixes are dropped at
ingest, not just discouraged in a doc):

> `discovery.*` · `intent.*` · `finance.*` · `action.*` · `social.*` · `ai.*` · `dealer.*`

**Every event is inserted — never updated, never deleted.** A correction is a new row; an identity merge
is a new row. That single rule is what makes the whole system deterministically **replayable and
auditable**, and it is why the product gets better with use: more events → sharper twins → better
matches → more events. Competitors can copy a UI in a weekend; they cannot copy the history.
*(`EVENT-TAXONOMY.md`.)*

### 3. The Buyer Digital Twin — derived, not authored
Each buyer has a **Digital Twin**: a model *projected* from the event stream plus first-party inputs, so
it is always rebuildable from source and never hand-maintained. It tracks the affordability envelope,
preferences, and the **dream car** (the vehicle most returned-to and most liked), and predicts lifecycle
stage: `browsing → engaged → qualified → booked → purchased`. Privacy is a design invariant, not a
footnote — **three data tiers**, and **soft-pull FICO is stored only as a band, never as a raw score**
(the raw number picks the band in memory, then is discarded; no table, log, or event row ever holds it).
*(`TWIN-SCHEMA.md`.)*

### 4. Living Agents — a workforce, not a chatbot
Six Phase-1 agents **live in the codebase** as resident, cron-driven Workers (not request-scoped
handlers): Inventory Intelligence, Qualification, Scheduling, Concierge, Growth Analytics, and
Content/SEO. Each **owns exactly one KPI** and writes its work back as append-only `ai.*` events, so the
workforce is as auditable as everything else. A **Resident Community Agent** is live today, posting at
most one useful bilingual pick every two hours, always labeled "CarNimbus AI." The hard rule: an agent
may feel **proactive and human — but must never impersonate a real buyer.**
*(`LIVING-AGENTS.md`, `AGENT-REGISTRY.md`.)*

### 5. Autonomy is earned, not granted
Agents climb a four-rung ladder — **L0 suggest → L1 approve → L2 act-then-notify → L3 autonomous** —
and graduation is gated on *measured* behavior from the same event stream: **≥95% accuracy, <5%
human-override, over ≥30 days** of supervised volume, with a passing golden-set eval on record.
Irreversible actions (a real purchase, a non-consented SMS) are **capped at L1 regardless of score.**
Trust is a metric here, not a vibe. *(`AUTONOMY-POLICY.md`.)*

### 6. Sovereign Inference — we own the brain
The intelligence runs on **owned, air-gapped, open-weight models** — no external model APIs, no per-seat
frontier billing, non-exfiltrable weights, unmetered internal compute. The target rig runs **GLM-5.2
(~744B-param MoE, MIT-licensed)**, CPU/RAM-offloaded on commodity hardware. Everything is behind a single
`embed()` / `llm()` seam, so cutover from today's stand-in (Workers AI **llama-3.3-70b** + **bge-base**,
768-dim) is one DNS record and one secret — **zero code change**. Nothing ships past the eval gate: *no
model or prompt change ships without passing its golden-set eval.*
*(`MODEL-REGISTRY.md`, `docs/SOVEREIGN-INFERENCE.md`.)*

---

## The commercial thesis

CarNimbus sells a flat monthly subscription per dealer rooftop that **undercuts every major listing
incumbent** (Cars.com, CarGurus, AutoTrader, TrueCar) while doing far more than a listing slot — it's a
buyer's-side superagent, not an ad placement. The same own-the-stack, framework-free discipline that
shapes the code shapes the business: **built to reach market on a fraction of the capital incumbents
raised.** Beachhead is the **283 franchised dealers in Los Angeles**, a concrete year-one serviceable
target of **42 rooftops** — not a hand-wavy TAM slide.

> Pricing, unit economics (CAC/LTV), infra cost, and capital plan are **intentionally kept out of this
> README** and live in internal-only docs: `docs/UNIT-ECONOMICS.md`, `docs/PRICING-BOARD.md`. (Broader US
> TAM is omitted until `docs/SOM-RECONCILIATION.md` is fully sourced — we cite only what we can defend.)

---

## Stack

- **Cloudflare Workers** — single `worker.js`, `run_worker_first`, serves assets + API + pages.
- **D1** — `carnimbus-waitlist` (id `43d0dc1a-96c1-49dd-98da-e4f865b7a013`): waitlist, matches, events,
  profiles, test-drives. **29 migrations**, latest `0030_private_replies`.
- **Vectorize** — `carnimbus-match` (768-dim bge-base) for inventory similarity.
- **Workers AI** — llama-3.3-70b (chat/reasoning) + bge-base (embeddings). No external model APIs.
- **Cron** — 5-minute schedule drives embedding sync, matching, and agent batches.
- **5 surfaces** via path-prefix rewrite: `carnimbus.com`, `app.`, `dealer.`, `admin.`, `ai.` — **46**
  routed endpoints.

## Layout

- `worker.js` — the app: flat `if`-chain router, API routes wrapped
  `sec(await withUser|withDealer|adminOnly(...))`, render helpers, models, cron.
- `site/` — page-per-file routing; vanilla HTML/JS/CSS; `<x-import>` placeholders via
  `site/assets/runtime.js`; reactive state via `site/assets/signals.js`.
- `migrations/` — D1 schema (through `0030_private_replies`).
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

Deploy **only** when the founder says "ship." Remote D1 migrations apply in order. Admin key is compared
in **constant time**; `SESSION_SECRET` must stay set (the Worker fail-closes without it). No mass remote
`DELETE` on D1.

## CSP policy (worker.js `sec()`)

Enforcing. Goal is full `'self'`; every allowed third party is justified and removed when its reason
disappears:

- `challenges.cloudflare.com` — Turnstile (script/frame/connect).
- `static.cloudflareinsights.com` — Web Analytics beacon (script/connect).

No inline `<script>`. New JS = a new static file under `site/assets/`. `connect-src 'self'` already
covers `sendBeacon`/`fetch` to `/api/events`.

## Toggles

- **Turnstile (bot check)** — server verifies only when `TURNSTILE_SECRET` exists; until then forms still
  work. (Widget setup steps unchanged — see `docs/`.)
- **Cloudflare Web Analytics** — dash → add site → token; paste the staged beacon `<script>` and keep
  `static.cloudflareinsights.com` in the CSP.

## Rules

- **No npm/packages** (2026-06 supply-chain incident). Vanilla only.
- Never commit secrets; Turnstile/session/admin secrets live in Worker secrets.
- Waitlist PII (email/ip/consent) stays in D1; see `/privacy`. Soft-pull FICO stored **only as a band**
  (see `TWIN-SCHEMA.md`).

## Branching & releases

- `main` is the release branch — Cloudflare auto-deploys from it. Never force-push.
- Feature work happens on branches; merges via reviewed PR.
- Deploys gated on explicit sign-off; migrations apply in order before the Worker deploy.

## The Nimbus platform, in one line

An append-only **event spine** captures every interaction; a per-buyer **Digital Twin** turns those
signals into matches and predictions; a layer of **living agents** — cron-driven, one KPI each, reading
and writing the same Brain — does the work. Every action is a logged event, so the system is auditable
and it compounds: more usage, better predictions.

## Canonical docs

`MASTERPLAN.md` · `EVENT-TAXONOMY.md` · `AGENT-REGISTRY.md` · `LIVING-AGENTS.md` · `TWIN-SCHEMA.md` ·
`AUTONOMY-POLICY.md` · `MODEL-REGISTRY.md` · `docs/SOVEREIGN-INFERENCE.md` · `docs/UNIT-ECONOMICS.md` ·
`docs/PRICING-BOARD.md` · `LINUX-JS.md` · `docs/HTML-TO-JS-MIGRATION.md`
