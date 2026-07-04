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

## AI backend (today vs. ai.carnimbus.com)
Today every AI call goes through the `embed()` / `llm()` seam in `worker.js`:
Workers AI (`@cf/baai/bge-base-en-v1.5` embeddings, `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
chat) + Cloudflare Vectorize (`carnimbus-match`, 768-dim cosine) for matchmaking.

Future: **ai.carnimbus.com** — a VPS / on-prem appliance ("Nimbus", GLM-5.2) hosting the vector
database, the matchmaking engine, and the scheduling brain that books test-drive appointments.
Cutover when the box exists:
1. Point DNS `ai.carnimbus.com` → the server (one A record).
2. `npx wrangler secret put AI_BACKEND_URL` → `https://ai.carnimbus.com`.
The Worker already branches on `AI_BACKEND_URL` (`/embed` and `/chat` endpoints) — no code change.
Until then, nothing to buy or run.
