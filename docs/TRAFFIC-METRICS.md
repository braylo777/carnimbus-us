# Traffic Metrics — reporting rules (DATA-01/02/03)

## The rule
Report **visits and page views. Never requests.**

## Why (2026-07-04 snapshot)
Cloudflare last-24h: **7.91k requests** but only **287 visits / 386 page views**. 4.39k of
those requests originate from the Netherlands (more than the US's 2.09k) with a thin global
tail (SG/FI/HK/LT) — a datacenter/bot-crawler signature, not demand.

- ❌ **Do not carry "7,900 users" forward.** It was requests, bot-heavy.
- ✅ Honest current figure: **~287 visits/24h, US-weighted** — earned at $0 spend.
- ✅ Cumulative honest framing: "~1,800 visitors, $0 spend" is fine ONLY if computed from
  visits, not requests — re-derive before using.

## Correction to the 2026-07-04 Jono manifest
"Clicks/signups disabled sitewide" is out of date: phone capture (waitlist + OTP sign-in) has
been live since the web-app ship. LEAD-02/03/04 are done (Worker routes + D1); LEAD-01's
remaining piece is purchasing the Twilio number so codes/notifications send as SMS.

## DATA-03 — investor-visible dashboard
Until a filtered dashboard exists, screenshot Cloudflare **Visits** (not Requests) with the
country table visible. Bot-filtering setup (dash → Security → Bots) is a Brandon toggle.
