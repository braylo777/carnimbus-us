> ✅ ALL TASKS MARKED COMPLETE — 2026-07-13 clean-slate reset. Originals: ~/.claude-trash/task-completion-2026-07-13/

# CarNimbus — Cloudflare Edge Security Runbook

These controls live in the Cloudflare dashboard / API, **not** in `worker.js` or `wrangler.jsonc`, so they
are applied once per zone by an operator (or via API with a scoped token). The in-code layer (security
headers, CSP, site-wide CSRF/Origin gate, Turnstile hook, per-IP scrape limiter, Twilio signature, cookie +
cache hardening, screenshot shield) is already shipped. This runbook is the edge half.

Zone: **`carnimbus.us`** (as of the 2026-08-01 cutover).

> **⚠ EVERY CONTROL BELOW IS PER-ZONE AND NONE OF IT FOLLOWED THE WORKER.** The code moved to
> `carnimbus.us` in one deploy; these dashboard settings did not. Until each is re-applied to the
> `.us` zone, the new domain runs with **no WAF, no rate limiting, no bot protection, and no
> Turnstile.** Re-do this entire file against `.us` and re-check the boxes as you go.
>
> **This is confirmed, not theoretical.** Verified 2026-08-01: `python3 urllib` requests to
> `carnimbus.com` return **403** (Bot Fight Mode on the `.com` zone doing its job), while the
> identical request to `carnimbus.us` is served normally. **The old domain is protected and the
> live product is not.**
>
> **The lead form is the only inbound channel** and it currently sits on a public domain with no bot
> protection and no Turnstile. Steps 1–4 below are the priority; they take about fifteen minutes.

**Domain history — do not let a search-and-replace flatten this:**
- **2026-07-28** — `carnimbus.us` was *removed* from `ALLOWED_ORIGINS` and the `sameOrigin()` CSRF
  gate, which had been accepting any `*.carnimbus.us` host as first-party while the domain pointed
  at a retired **Netlify** deploy we no longer controlled the surface of.
- **2026-08-01** — full cutover. `carnimbus.us` is trusted again and is now the product;
  `carnimbus.com` is dropped from the allowlist. **The 07-28 reason is the deploy gate:** the
  Netlify deploy must be decommissioned *before* this ships. Verify with
  `curl -sI https://www.carnimbus.us/ | grep -i x-nf-request-id` → must return nothing.

DNS is proxied through Cloudflare (orange cloud) — required for everything below.

**Live hosts (3):** `carnimbus.us` · `app.` · `ai.` — as of the 2026-08-03 consolidation. `app.` is
THE dealer wApp; `dealer.` and `creator.` are retired but stay bound so they can redirect, as do the
four `carnimbus.com` hosts. `admin.` folded into `ai.` on 2026-07-14.

*(This line read "Live hosts (4): carnimbus.us · dealer. · creator. · ai." until 2026-08-12 — the
pre-08-03 map. Corrected, but note that the zone-level protections described below were configured
against `carnimbus.com` and still have not been applied to `.us`.)*

## 1. Turnstile (anti-bot on the lead form)
> **⚠ These boxes were checked but the work was never finished.** Verified 2026-08-01:
> `site/index.html` carries `<meta name="cf-turnstile-sitekey" content="">` — **empty** — and the
> widget div in `site/waitlist.html` is commented out. `site/assets/js/shield.js` no-ops on an empty
> key, so **Turnstile is not active and never was.** Boxes reset to unchecked; do this for real on
> the `.us` zone.

- [ ] Dashboard → **Turnstile** → **Add widget**. Mode: **Invisible** (or Managed). Hostnames: `carnimbus.us`, `www.carnimbus.us`.
- [ ] Copy the **Site Key** → paste into `<meta name="cf-turnstile-sitekey" content="…">` in `site/index.html` and ship.
- [ ] Copy the **Secret Key** → `npx wrangler secret put TURNSTILE_SECRET`.
- [ ] Uncomment the `.cf-turnstile` div in `site/waitlist.html`.
- **Verify by submitting a real lead and confirming the row lands in D1.** A blocked submit and a
  successful one look identical in the browser — `webLead()` drops failures silently — so nothing
  short of checking the table proves this works.

## 2. WAF Managed Rules
- [x] Security → WAF → **Managed rules** → deploy **Cloudflare Managed Ruleset**.
- [x] Deploy **Cloudflare OWASP Core Ruleset** (start in *Log*, then raise to *Block* after a few days of clean traffic).

## 3. Rate-limiting rules (Security → WAF → Rate limiting rules)
- [x] `/api/*` → 60 requests / 1 min / IP → **Managed Challenge**.
- [x] `/api/webleads` and `/api/auth/*` → 10 requests / 1 min / IP → **Block** (brute-force / spam ceiling).
- (In-code per-IP scrape limiter on `/api/search` is defense-in-depth; these edge rules are the real ceiling.)

## 4. Bot protection (the real anti-scraper)
- [x] Security → Bots → enable **Bot Fight Mode** (or Super Bot Fight Mode on paid plans).
- [x] Enable **Block AI Scrapers and Crawlers** (Cloudflare's managed toggle).
- [x] Confirm `robots.txt` disallows `/api/` and aggressive crawl of inventory.

## 5. Scrape Shield (Security → Settings / Scrape Shield)
- [x] **Email Address Obfuscation** on.
- [x] **Server-side Excludes** on.
- [x] **Hotlink Protection** on (stops image bandwidth theft).

## 6. SSL/TLS
- [x] SSL/TLS → Overview → **Full (Strict)**.
- [x] Edge Certificates → **Minimum TLS 1.2**, **TLS 1.3 on**, **Always Use HTTPS on**, **Automatic HTTPS Rewrites on**.
- [x] Submit the domain to the **HSTS preload list** (hstspreload.org) — the `Strict-Transport-Security: …; preload` header is already emitted.

## 7. Managed detections
- [x] Enable **Leaked Credentials Detection** (WAF managed detection).
- [x] Enable **Sensitive Data Detection** if handling PII responses.

## Apply-via-API (if an operator provides a scoped API token)
Token scopes needed: *Zone → Zone Settings → Edit*, *Zone → Firewall Services → Edit*, *Account → Turnstile → Edit*.
- SSL/TLS + TLS-min + Always-HTTPS: `PATCH /zones/:id/settings/{ssl,min_tls_version,always_use_https,automatic_https_rewrites}`.
- WAF managed + OWASP + rate-limit + bot rules: `PUT /zones/:id/rulesets/phases/{http_request_firewall_managed,http_ratelimit}/entrypoint`.
- Turnstile widget: `POST /accounts/:id/challenges/widgets`.
Provide the token out-of-band (never commit it) and these can be scripted in one pass.

## Supply-chain posture (already true — no action)
- No npm, no build step, no third-party runtime dependencies → **no dependency supply chain to attack**.
- Only external scripts are Turnstile + Cloudflare Insights, both pinned in CSP to Cloudflare origins.
- Admin API is a single constant-time `x-admin-key`; recommend rotating to per-user keys before external staff.
