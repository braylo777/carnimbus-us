# CarNimbus × Linux JS

CarNimbus.com is a **framework-free** web app: no React, no Next.js, no virtual DOM, no npm, no
build step. It runs as a Cloudflare Worker (`worker.js`) that serves a vanilla HTML/JS/CSS site
(`site/`) and the app APIs (waitlist, SMS, phone-OTP auth, profile match, car-chat).

That already delivers the core **Linux JS** pitch — a React/Next-like developer experience with a
dramatically smaller runtime, simpler tooling, and direct DOM updates at near-native cost.

> Status: this repo adopts Linux JS **conventions and philosophy**. The literal Linux JS toolchain
> (`linux create`, a JSX→AST→C→WebAssembly compiler, `linux.fs`/`linux.http` runtimes) is not yet a
> real installable tool, so nothing here is "compiled" — the vanilla output *is* the artifact. The
> structure below is deliberately compiler-ready for the day that toolchain exists.

## Project structure (`linux.config.js`)
| Route          | File (today)            | Linux JS convention          |
|----------------|-------------------------|------------------------------|
| `/`            | `site/index.html`       | `src/app/page.jsx`           |
| `/browse`      | `site/browse.html`      | `src/app/browse/page.jsx`    |
| `/waitlist`    | `site/waitlist.html`    | `src/app/waitlist/page.jsx`  |
| `/about`       | `site/about.html`       | `src/app/about/page.jsx`     |
| `/contact`     | `site/contact.html`     | `src/app/contact/page.jsx`   |
| `/app/profile` | `site/app/profile.html` | `src/app/app/profile/page.jsx` |

- `site/` — `appDir` (page-per-file routing).
- `site/assets/signals.js` — reactive state primitive.
- `site/assets/runtime.js` — client renderer for `<x-import>` components + all wiring.
- `site/assets/styles.css` — vanilla CSS, passed through unchanged (Tailwind/Bootstrap would drop in identically).
- `worker.js` — the runtime host (static assets + APIs); `wrangler.jsonc` — Worker/domain config.

## State = signals (not React hooks)
`signals.js` exposes three functions on `window`:
- `signal(v)` — a getter/setter holder; calling `s()` reads (and subscribes the running effect),
  `s(next)` writes and notifies subscribers.
- `effect(fn)` — runs `fn` immediately and re-runs it whenever a signal it read changes.
- `computed(fn)` — a derived read-only signal.

Worked example (live): the EN/ES language toggle in `runtime.js` is a `langS = signal("en")`. An
`effect` re-runs `applyLang(langS())` on every change, patching only the affected text/placeholder
nodes and the segmented-control buttons — no component re-render, no vDOM diff.

## Styling
Class attributes pass through unchanged, so any CSS system works. We ship hand-written vanilla CSS.

## Deploy (GitHub → Cloudflare → carnimbus.com)
Auto-deploy via **Cloudflare Workers Git integration**:
Cloudflare dash → Workers & Pages → `carnimbus-com` → Settings → Build → **Connect to Git** →
repo `braylo777/carnimbus-com`, branch `main`, deploy command `npx wrangler deploy`. Every push to
`main` deploys to carnimbus.com.

**D1 migrations are manual and deliberate** — never auto-run on push:
`npx wrangler d1 migrations apply carnimbus-waitlist --remote` (only when `migrations/` changed).

## Migration path (if a real JSX→WASM compiler lands)
`site/*.html` → `src/app/*/page.jsx`; `runtime.js` renderers → components; state already uses
signals; `worker.js` stays the runtime host. Nothing else moves.

## AI architecture — three layers, never conflated
The "Nimbus brain" is three distinct layers. Keep them separate in every doc and diagram:

1. **Inference runtime** — GLM-5.2 (~750B-param MoE) running **CPU/RAM-offloaded on 1TB DDR5**
   on the Ben rig. It is NOT VRAM-resident — any "96GB VRAM" framing is wrong; the MoE's active
   experts stream through system RAM. Today's stand-in: Workers AI
   `@cf/meta/llama-3.3-70b-instruct-fp8-fast` behind the `llm()` seam in worker.js.
2. **Vector store** — a dedicated vector database for matchmaking embeddings (buyer profiles ↔
   dealer VDPs). Today: Cloudflare Vectorize `carnimbus-match` (768-dim, cosine) fed by
   `@cf/baai/bge-base-en-v1.5` via the `embed()` seam. SQLite is the relational store, not the
   vector store — do not conflate the two.
3. **Relational store** — SQLite (Cloudflare D1 today): users, profiles, vdps, test_drives,
   dealer_leads, comments, sms queue.

**Matchmaking pipeline (live):** cron `syncEmbeddings()` embeds new profiles + VDPs into the
vector store; `/api/feed` queries it and ranks cars per buyer.

**Projection into app./dealer. (the real mechanism, not the metaphor):** the Worker calls
`AI_BACKEND_URL/embed` and `AI_BACKEND_URL/chat` over HTTPS; results land in D1 + the vector
store; `/api/feed` (buyer app) and `/api/dealer/console` (dealer dashboard) read them. That is
how ai. "surfaces results" into the other subdomains — plain request/response through one seam.

**Cutover to ai.carnimbus.com** (when the box exists): 1 DNS A record +
`npx wrangler secret put AI_BACKEND_URL` → `https://ai.carnimbus.com`. The Worker already
branches on `AI_BACKEND_URL` (`/embed` and `/chat` endpoints) — no code change. Until then,
nothing to buy or run.
