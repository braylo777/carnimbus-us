# SEO Execution Status — Layer 2 (technical) · 2026-07-05

Legend: ✅ shipped this pass · ⏩ already live pre-pass · 🔶 HANDOFF (Brandon, dashboard) ·
⏸ deferred (reason) · ❌ dropped (reason)

| Task | Status | Note |
|---|---|---|
| CN-ROBOTS-1 robots.txt + AI crawlers | ✅ | Worker route, host-aware: apex allows GPTBot/OAI-SearchBot/ChatGPT-User/ClaudeBot/Claude-SearchBot/PerplexityBot/Google-Extended; app./dealer./admin./ai. serve Disallow-all |
| CN-REDIR-1 canonicalization + sold 301s | ✅ | lowercase 301 (excl. /pass/ + /api/ — case-sensitive tokens); sold VDP → 301 /browse; stale slug → 301 canonical |
| CN-HEAD-1 dynamic head | ✅ (VDP) / ⏩ (marketing) | /used/ pages emit title≤60/desc≤155/canonical/OG/Twitter/preload; marketing pages already carry canonical+OG; admin/app/dealer/ai get X-Robots-Tag noindex |
| CN-SCHEMA-1 Organization+WebSite | ✅ | index JSON-LD array; slogan + sameAs; no SearchAction (no-search product) |
| CN-SCHEMA-2 Vehicle/Product/Offer | ✅ | every /used/ page, per-car personality copy as description |
| CN-SCHEMA-3 AutoDealer/NAP | ⏸ | no public street address/GBP yet — do NOT invent NAP; activate with Westside address |
| CN-SCHEMA-4 FAQPage | ✅ | home (6 visible FAQs, verbatim) + every VDP (4 visible Q&As) |
| CN-SCHEMA-5 Breadcrumb + SoftwareApplication | ✅ / ⏸ | BreadcrumbList on VDPs; SoftwareApplication when a public dealer marketing page exists (dealer. is a gated console, noindex) |
| CN-SITEMAP-1 segmented sitemaps | ✅ | /sitemap.xml → inventory (live VINs, lastmod, image:image, 15-min cache) + content; daily-fresh by being dynamic (no cron purge needed) |
| CN-CRAWL-1 faceted canonicalization | ⏩/N-A | no server-side facet URLs exist; robots disallows /api/, app noindexed |
| CN-SEC-1 security headers | ⏩ | HSTS(preload)/nosniff/DENY/Referrer/Permissions/CSP already ENFORCING. Deviation: kept enforcing CSP (sheet's report-only would be a regression); kept camera=(self) (sheet's snippet would re-break dealer QR scanner) |
| CN-CWV-1 AVIF/WebP edge images | 🔶 | Cloudflare Images/Resizing = zone feature (paid toggle) |
| CN-CWV-2 responsive imgs + dims | ✅ partial | width/height + lazy on feed cards + VDP hero fetchpriority=high; full srcset pass when CF Images lands |
| CN-CWV-3 hero preload | ✅ | /used/ pages |
| CN-CWV-4/5 caching | ✅ partial | VDP s-maxage=900, sitemaps cached; static assets on CF assets defaults |
| CN-CWV-6 defer 3P JS | ⏩ | zero third-party JS on the site (analytics beacon still commented out) |
| CN-CONTENT-1 personality copy | ⏩ v1 | per-car descriptions exist; LLM-generated long-form w/ <30% similarity = next content layer |
| CN-CONTENT-2 H1/semantics | ✅ (VDP) | one H1, article/nav landmarks, alt text |
| CN-CONTENT-3 internal links | ✅ v1 | /browse cards → /used/ pages → app CTA; home→browse→VDP ≤3 clicks |
| CN-INFRA-1 HTTP/3, 0-RTT, Brotli, Full(strict) | 🔶 | dashboard toggles — Speed→Optimization, Network, SSL/TLS |
| CN-INFRA-2 GSC/Bing/GA4/GBP | 🔶 | GSC Domain property via DNS TXT; submit /sitemap.xml; GA4 AI-Referral channel regex `chatgpt\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com`; GBP category "Used Car Dealer" |
| CN-MON-1 Logpush | 🔶 | zone feature → R2 |
| CN-MON-2 scheduled PSI/link checks | ⏸ | after GSC live; candidate for cron Worker later |
| CN-OG-1 dynamic OG images | ✅ v1 | VDP og:image = hero photo passthrough; composited cards later |
| CN-LOCAL-1 review SMS loop | ⏸ | blocked on Twilio number |
| CN-CONTENT-4 pillar content | ⏸ | next content layer (CLEO) |
| CN-INTL-1 Spanish hreflang | ⏸ | per sheet — after LA-English liquidity (site UI already bilingual) |
| Vehicle Listing feed program | ❌ | deprecated by Google June 2025 — deliberately not built |
