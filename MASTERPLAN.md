# CarNimbus — Masterplan

> One annotated roadmap fusing the **app-demo-feedback sprint** (12 items, P0–P2) and the
> **Nimbus 10-phase rollout** (event-driven agent platform). Status chips: ✅ shipped · 🟡 in-flight · ⚪ planned.

CarNimbus is a consumer AI car-buying superagent for LAcarGUY dealers, paired with a dealer-side
**Drive Now** dashboard. It runs as a single hand-edited Cloudflare Worker (`worker.js`, ~1164 lines):
no npm, no build step, vanilla HTML/CSS/JS with `x-import` custom elements hydrated by `runtime.js`.
Data lives in D1 (`carnimbus-waitlist`) and Vectorize (`carnimbus-match`, 768-dim bge-base); intelligence
comes from Workers AI (llama-3.3-70b + bge embeddings); a 5-minute cron drives background work.
94 real LAcarGUY certified-used cars are live.

---

## At a glance

| Wave | Theme | Status |
|------|-------|--------|
| A | Demo P0 — viewport, login copy, i18n, calendar | ✅ DONE |
| B | Backend matching table + feed de-filler + SMS hook | ✅ DONE |
| C | Nimbus Phase 0 — event spine + CID stitching + sensor | ✅ DONE |
| D | Canonical repo docs + Beyond.js README | 🟡 in-flight (this set) |
| E | Phase 1 six-agent MVP (Workers-AI-backed) | ⚪ planned |

Everything through **Wave C (the event spine)** is shipped and live. Wave D is these docs.
Wave E and Nimbus Phases 2–10 are the forward roadmap.

---

## Part 1 — App-demo-feedback sprint (12 items, P0→P2)

| # | Item | Priority | Status | Notes |
|---|------|----------|--------|-------|
| 1 | Viewport fill (mobile 100dvh) | P0 | ✅ | signin/matches containers to `100dvh` |
| 2 | Login copy ("Enter your mobile number") | P0 | ✅ | no "no passwords ever" remnants |
| 3 | Profile restructure (hobbies, passes) | P0 | ✅ | `profile-account.js` A3 |
| 4 | Estimate specificity (soft-checked APR band) | P0 | ✅ | `profile-account.js` A4 |
| 5 | i18n sweep (EN→ES parity) | P0 | ✅ | full APPENDIX I key set added |
| 6 | Request-Demo calendar-first | P0 | ✅ | "Book a Live Demo →" primary CTA |
| 7 | Feed reads human (remove agent auto-filler) | P1 | ✅ | server-side auto-reply deleted |
| 8 | Backend matching table (dated, no swiping) | P1 | ✅ | `matches` table + `/api/matches` |
| 9 | SMS follow-up on new match | P1 | ✅ | flagged behind `SMS_MATCH_LIVE` (A2P pending) |
| 10 | Sponsored chip / feed polish | P2 | ✅ | `sponsored` column + subtle chip |
| 11 | README rewrite (Beyond.js) | P2 | 🟡 | Wave D |
| 12 | HTML→JS migration plan | P2 | 🟡 | Wave D — `docs/HTML-TO-JS-MIGRATION.md` |

---

## Part 2 — Nimbus 10-phase rollout

The Nimbus platform turns CarNimbus from a site into a learning agent system. Every phase feeds the
same append-only **event spine** (see `EVENT-TAXONOMY.md`) and the **Buyer Digital Twin**
(see `TWIN-SCHEMA.md`).

| Phase | Name | What it delivers | Status |
|-------|------|------------------|--------|
| 0 | **Event spine** | `events` table, `/api/events` beacon, `nimbus-sensor.js`, anon→CID stitching, admin tail | ✅ DONE (Wave C) |
| 1 | **Six-agent MVP** | Inventory Intelligence, Qualification, Scheduling, Concierge, Growth Analytics, Content/SEO | ⚪ planned (Wave E) |
| 2 | **Buyer Digital Twin** | Persist per-buyer twin from event stream (identity, financial band, preferences, dream car) | ⚪ planned |
| 3 | **Autonomy graduation** | L0→L3 ladder live; agents earn autonomy on measured accuracy + low override rate | ⚪ planned |
| 4 | **Model registry + eval gates** | DOV-named models/prompts; no change ships without a golden-set eval pass | ⚪ planned |
| 5 | **Dealer intelligence loop** | `dealer.*` events → lead scoring, contact/convert attribution back to Drive Now | ⚪ planned |
| 6 | **Proactive concierge** | Cross-session recall + price-drop/new-match openers, outbound-safe SMS/notifications | ⚪ planned |
| 7 | **Content/SEO engine** | Auto-generated `/cars/<slug>` VDP pages w/ schema.org, sitemap, canonicalization | ⚪ planned |
| 8 | **Growth analytics** | Weekly funnel roll-ups (events→drives→sales), cohort retention, LTV bands | ⚪ planned |
| 9 | **Multi-store scale-out** | Beyond first LAcarGUY store; per-store inventory + twin isolation | ⚪ planned |
| 10 | **Closed-loop optimization** | Twin + events + evals feed model/prompt tuning; agents self-improve within gates | ⚪ planned |

---

## Part 3 — Shipped foundation (do not redo)

Already live before the sprint, verified in source:
- ✅ **Inventory** — 94 real LAcarGUY certified-used cars, VDP rendering, schema.org markup.
- ✅ **Matches routing** — Talk → `/talk/<slug>`; Vectorize similarity (`carnimbus-match`).
- ✅ **Affordability truth-core** — `monthlyFor(price, down, aprPct, term=72)`, `aprFor(fico)`.
- ✅ **Community feed** — `/api/feed` union matcher, comments.
- ✅ **Auth** — OTP (mobile → SMS code), session cookies, fail-closed on missing `SESSION_SECRET`.
- ✅ **CSP enforcing** — no inline JS; every script is a static file under `site/assets/`.
- ✅ **5 subdomains** — `carnimbus.com`, `app.`, `dealer.`, `admin.`, `ai.` via path-prefix rewrite.

---

## Part 4 — Wave E (next up): Phase 1 six-agent MVP

Each agent emits `ai.*` events into the Wave C stream. See `AGENT-REGISTRY.md` for the full table.

- ⚪ **E1 Inventory Intelligence** — cron enriches each active VDP (summary/pros/cons/ideal-buyer) via `llm()`; renders on `car.html`. Emits `ai.recommendation_shown`.
- ⚪ **E2 Content/SEO** — server-render `/cars/<slug>` mirroring `/talk/<slug>`; schema.org Vehicle + FAQ; extend sitemap; one canonical host.
- ⚪ **E3 Concierge v1** — cross-session recall + proactive price-drop/new-match opener. Emits `ai.conversation_turn`.
- ⚪ **E4 Qualification / Scheduling / Growth Analytics** — Qualification (OTP→profile→CID, exists), Scheduling (booking L1, exists), Growth cron writes weekly funnel roll-up + `ai.*` event.

---

## Discipline & gates

- Waves ship **A → B → C → D → E**, deployed + committed + pushed the moment each is green.
- `node --check` on every edited JS before deploy.
- `verifier` subagent reviews the `worker.js` diff before B, C, E ship.
- Remote D1 migrations applied in order: `0017_matches`, `0018_events`, `0019_vdp_enrichment`.
- **Deploy only on the founder saying "ship."** No mass remote `DELETE` on D1. Secrets never printed.

## Related docs
`EVENT-TAXONOMY.md` · `AGENT-REGISTRY.md` · `TWIN-SCHEMA.md` · `MODEL-REGISTRY.md` ·
`AUTONOMY-POLICY.md` · `docs/HTML-TO-JS-MIGRATION.md` · `README.md`
