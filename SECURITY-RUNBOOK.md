# CarNimbus — Cloudflare Edge Security Runbook

These controls live in the Cloudflare dashboard / API, **not** in `worker.js` or `wrangler.jsonc`, so they
are applied once per zone by an operator (or via API with a scoped token). The in-code layer (security
headers, CSP, site-wide CSRF/Origin gate, Turnstile hook, per-IP scrape limiter, Twilio signature, cookie +
cache hardening, screenshot shield) is already shipped. This runbook is the edge half.

Zone: `carnimbus.com` (also carnimbus.us). DNS is proxied through Cloudflare (orange cloud) — required for
everything below.

## 1. Turnstile (anti-bot on the lead form)
- [ ] Dashboard → **Turnstile** → **Add widget**. Mode: **Invisible** (or Managed). Hostnames: carnimbus.com, www.carnimbus.com.
- [ ] Copy the **Site Key** → paste into `<meta name="cf-turnstile-sitekey" content="…">` in `site/index.html` and ship.
- [ ] Copy the **Secret Key** → `npx wrangler secret put TURNSTILE_SECRET`.
- Verified once both set: bot lead submits are silently dropped (`webLead()` gate, secret-gated so nothing breaks pre-config).

## 2. WAF Managed Rules
- [ ] Security → WAF → **Managed rules** → deploy **Cloudflare Managed Ruleset**.
- [ ] Deploy **Cloudflare OWASP Core Ruleset** (start in *Log*, then raise to *Block* after a few days of clean traffic).

## 3. Rate-limiting rules (Security → WAF → Rate limiting rules)
- [ ] `/api/*` → 60 requests / 1 min / IP → **Managed Challenge**.
- [ ] `/api/webleads` and `/api/auth/*` → 10 requests / 1 min / IP → **Block** (brute-force / spam ceiling).
- (In-code per-IP scrape limiter on `/api/search` is defense-in-depth; these edge rules are the real ceiling.)

## 4. Bot protection (the real anti-scraper)
- [ ] Security → Bots → enable **Bot Fight Mode** (or Super Bot Fight Mode on paid plans).
- [ ] Enable **Block AI Scrapers and Crawlers** (Cloudflare's managed toggle).
- [ ] Confirm `robots.txt` disallows `/api/` and aggressive crawl of inventory.

## 5. Scrape Shield (Security → Settings / Scrape Shield)
- [ ] **Email Address Obfuscation** on.
- [ ] **Server-side Excludes** on.
- [ ] **Hotlink Protection** on (stops image bandwidth theft).

## 6. SSL/TLS
- [ ] SSL/TLS → Overview → **Full (Strict)**.
- [ ] Edge Certificates → **Minimum TLS 1.2**, **TLS 1.3 on**, **Always Use HTTPS on**, **Automatic HTTPS Rewrites on**.
- [ ] Submit the domain to the **HSTS preload list** (hstspreload.org) — the `Strict-Transport-Security: …; preload` header is already emitted.

## 7. Managed detections
- [ ] Enable **Leaked Credentials Detection** (WAF managed detection).
- [ ] Enable **Sensitive Data Detection** if handling PII responses.

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
