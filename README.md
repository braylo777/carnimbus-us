# carnimbus-com-site

Source of the **live carnimbus.com** — static marketing site + Cloudflare Worker.

- `site/` — static pages (vanilla HTML/JS/CSS; **NPM is banned** in this codebase — no packages, no build step).
  Pages use `<x-import>` design-system placeholders that `site/assets/runtime.js` renders client-side.
- `worker.js` — serves assets (`run_worker_first`) with security headers; `POST /api/waitlist` → D1.
- `migrations/` — D1 schema for the `carnimbus-waitlist` database (id `43d0dc1a-96c1-49dd-98da-e4f865b7a013`).
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

## Toggles
- **Turnstile (bot check)** — server verifies only when the secret exists:
  1. Cloudflare dash → Turnstile → create widget for carnimbus.com → copy sitekey + secret.
  2. `npx wrangler secret put TURNSTILE_SECRET`
  3. In `site/index.html` (2 forms) + `site/waitlist.html`: uncomment the `cf-turnstile` div, paste the
     sitekey, and add `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>` before `</body>`.
- **Cloudflare Web Analytics** — dash → Web Analytics → add site → token; paste the beacon `<script>`
  (staged in comments near `</body>`) and keep `static.cloudflareinsights.com` in the CSP.

## CSP policy (worker.js `SEC`)
Goal is full `'self'`. Allowed third parties and why; remove when the reason disappears:
- `challenges.cloudflare.com` — Turnstile (script/frame/connect).
- `static.cloudflareinsights.com` — Web Analytics beacon (script/connect).

## Rules
- No NPM/packages (2026-06 supply-chain incident). Vanilla only.
- Never commit secrets; Turnstile secret lives in Worker secrets.
- Waitlist PII (email/ip/consent) stays in D1; see `/privacy`.
