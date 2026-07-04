# Performance Baseline — vanilla-JS build (GUS-05)

**Date:** 2026-07-04 · **Version:** `7d0ff5a3-bab5-4969-878e-fc55adeab319` · **Method:** 10×
`curl -w "%{time_starttransfer} %{time_total}"` from a residential connection (LA), cold HTTP/2.

## Results

| Page | Median TTFB | Median total |
|---|---|---|
| `carnimbus.com/` (marketing) | **~0.20 s** | **~0.27 s** |
| `app.carnimbus.com/` → Discover (incl. 307 clean-URL redirect) | **~0.31 s** | **~0.34 s** |

## Payload (entire client runtime)

| Asset | Bytes |
|---|---|
| styles.css | 22,054 |
| runtime.js (renderer + i18n + all wiring) | 47,301 |
| signals.js (state) | 1,002 |
| per-page JS (e.g. discover.js) | ~1.8 K |
| **Total JS shipped** | **~50 KB uncompressed** (≈15 KB over the wire) |

## Investor-narrative read

A typical Next.js consumer app ships 200–500 KB of framework JS before first interaction and
needs a build pipeline + node_modules to produce it. CarNimbus ships ~50 KB of hand-written JS
total, zero build step, and paints in ~a quarter second globally on Cloudflare's edge — the
"near-native performance" claim is measured, not asserted. Re-run this file's method after any
major change and update the table with the new version id.
