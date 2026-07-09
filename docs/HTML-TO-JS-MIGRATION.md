# HTML → JS Migration Plan

> A staged plan to move the HTML-heavy CarNimbus site to a **JS-component-driven architecture** — without
> adding npm, a bundler, or a build step. We migrate **onto the layer we already have**: `x-import` custom
> elements hydrated by `site/assets/runtime.js`, served by the single Cloudflare Worker.

## Why

Current composition (approx): **HTML 45.5% · JS 40% · CSS 6.5%**. Page markup is duplicated across
`site/app/*.html` — headers, cards, chrome, VDP scaffolding are copy-pasted. That makes changes slow and
error-prone and inflates payloads. The fix is to express pages as **composed components in JS**, keeping the
Worker-serves-vanilla model and the enforcing CSP (no inline scripts — every component is a static file
under `site/assets/`).

## Constraints (non-negotiable)

- **No npm, no build step, no bundler.** Vanilla JS, hand-edited Worker.
- **Stay on Cloudflare Workers** (`run_worker_first`), D1, Vectorize, Workers AI, cron.
- **CSP stays enforcing** — no inline `<script>`; new JS is a new file under `site/assets/`; `connect-src`
  already allows `'self'`.
- **Reuse the existing hydration layer** — `x-import` placeholders + `runtime.js` observer/`applyLang()`,
  `signals.js` for reactive state. Do not introduce a framework.

---

## The 10 phases

| # | Phase | Deliverable | Exit criteria |
|---|-------|-------------|---------------|
| 1 | **Audit & inventory** | Catalog every `site/app/*.html` page, its repeated markup blocks, and its per-page JS. Map duplication. | A component candidate list + a page manifest |
| 2 | **Shared component layer** | Promote repeated blocks (header, footer, car-card, chrome) to `x-import` components rendered by `runtime.js`. | Header/footer served from one component across all pages |
| 3 | **Component contract** | Define the props/slots convention for `x-import` + a `signals.js` state pattern each component uses. | Documented contract; two components conform |
| 4 | **Page-by-page conversion (low-risk)** | Convert static/marginal pages first (about, privacy, waitlist) to composed components. | Converted pages render identically; HTML share drops |
| 5 | **Page-by-page conversion (core)** | Convert high-traffic app pages (`signin`, `profile`, `matches`, `feed`, `car`). | Core flows pass; per-page HTML minimized to a mount point |
| 6 | **VDP componentization** | Turn the VDP (`car.html` / `usedPage`) into a data-driven component; server passes vehicle JSON, component renders. | One VDP component powers all 94 cars |
| 7 | **Inventory integration** | Wire the VDP + card components to live inventory (D1 + Vectorize match) and Wave E enrichment. | Cards/VDP hydrate from live inventory + enrichment |
| 8 | **Image-upload integration** | Component-driven image handling for inventory (upload/display), respecting `img-src 'self' data:` CSP. | Images flow through components; CSP unchanged |
| 9 | **Perf validation** | Measure payload/HTML-share reduction and Core Web Vitals (LCP/INP/CLS) before vs after; trim dead markup/CSS. | Documented improvement; no regression on live pages |
| 10 | **Cutover & cleanup** | Remove duplicated markup, retire per-page one-offs, update asset `?v=` cache-busts, document the component set. | HTML share materially reduced; single source per component |

---

## Sequencing & safety

- **Ship page-by-page**, deploying after each converted page so a regression is isolated and reversible —
  the same wave discipline used across the project.
- **`node --check`** every edited JS before deploy; **bump the asset `?v=`** cache-bust on touched pages.
- **`verifier`** on any change that touches `worker.js` (routing/render helpers like `usedPage`).
- **CSP is a guardrail, not a variable** — if a phase ever seems to need an inline script or a new host,
  stop and redesign; the answer is another static file under `site/assets/`.

## Related docs
`README.md` (Beyond.js philosophy) · `MASTERPLAN.md` (sprint item 12) · `AGENT-REGISTRY.md`
(Inventory Intelligence / Content-SEO feed phases 6–8).
