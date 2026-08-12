// CarNimbus — static site (Assets) + waitlist API (D1), security-hardened.
//
// Rollout notes:
//  - Apply migration 0002_hardening.sql (adds `ip`, `sms_consent`) BEFORE deploying this.
//    (Rate-limit + insert degrade gracefully if not yet applied, but consent/ip won't persist.)
//  - Turnstile is OPTIONAL: verification only runs once `TURNSTILE_SECRET` is set
//    (`wrangler secret put TURNSTILE_SECRET`). Until then the form still works.
//  - CSP currently allows Google Fonts + Wikimedia inventory images; tighten to 'self'
//    after fonts are self-hosted (P1) and inventory images are localized.

import { scoreCar, segOf, typeOf, condOf } from "./site/assets/match.js";   // AE: single-source matching scorer (shared with eval harness)
import { validateVin } from "./site/assets/vin.js";                        // ISO 3779 — copy of the NF broker validator; see that file's header

const ALLOWED_ORIGINS = [
  "https://carnimbus.us",
  "https://www.carnimbus.us",
];

// 2026-08-01: the ONLY hosts this Worker serves the application on. Anything else 404s at the top of
// route(). carnimbus.com and its subdomains are NOT here on purpose — they are caught by the archive
// redirect above this check and never reach it. Keep this in sync with `routes` in wrangler.jsonc.
const SERVED_HOSTS = new Set([
  "carnimbus.us",
  "www.carnimbus.us",          // pending: not yet bound as a custom domain
  "dealer.carnimbus.us",       // RETIRED 2026-08-03 — 301s to app.; MUST stay bound in order to redirect
  "creator.carnimbus.us",      // RETIRED 2026-08-03 — portal archived; 301s to the apex. MUST stay bound.
  "ai.carnimbus.us",
  "app.carnimbus.us",          // THE DEALER wAPP — scan → offer → title → settle (deck v13 S-04)
]);

// 2026-08-03: app.carnimbus.us is now THE DEALER SURFACE. It was held blank from 08-01 (a dangling
// CNAME to a deleted Netlify site made it a subdomain-takeover vector, so the Worker answered on it
// with nothing rather than release the name). It now serves site/app/* via the PREFIX map, and
// dealer.carnimbus.us 301s here. The nine retired buyer-app pages moved to archive/site-app-buyer-v9/.
// H-CSRF: same-origin gate for state-changing POSTs. Empty Origin allowed (same-origin nav + server-to-server);
// browsers always attach Origin on cross-site POST — the actual CSRF vector we reject. Any carnimbus.us subdomain
// (dealer./creator./ai.) is first-party — they POST same-origin to /api/* — so accept the whole domain family,
// not just the ALLOWED_ORIGINS apex list (which is for the marketing waitlist only).
// 2026-07-28: carnimbus.us was REMOVED here. It had been trusted as first-party while pointing at a retired
// Netlify site we no longer controlled the surface of — a strict tightening, not cosmetic cleanup.
// 2026-08-01: carnimbus.us is trusted again, and carnimbus.com is dropped, as part of the full domain cutover.
// ⚠ THE 2026-07-28 REASON IS THE DEPLOY GATE, NOT A FOOTNOTE. This file must not ship until the Netlify
// deploy on carnimbus.us is decommissioned — verify `curl -sI https://www.carnimbus.us/ | grep -i x-nf-request-id`
// returns NOTHING. Shipping earlier re-opens exactly the hole 07-28 closed.
function sameOrigin(request){ const o=request.headers.get("Origin")||""; if(!o) return true;
  try{ const h=new URL(o).hostname; return h==="carnimbus.us"||h.endsWith(".carnimbus.us"); }
  catch(_){ return false; } }

const SEC = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "0",
  "X-DNS-Prefetch-Control": "off",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=(self), interest-cohort=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    "img-src 'self' data: https:",   // R8: listing photos live on dealer CDNs — images only; scripts/connect stay locked
    // 'unsafe-inline' required by the many inline style= attributes in the exported HTML.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    // challenges.cloudflare.com = Turnstile; static.cloudflareinsights.com = Web Analytics beacon.
    "script-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
    "frame-src https://challenges.cloudflare.com",
    "connect-src 'self' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
    "manifest-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; "),
};

export default {
  async fetch(request, env, ctx) {
    try { return await this.route(request, env, ctx); }
    catch(e){ console.error("route_error:", e&&e.stack||e); return sec(json({ok:false,error:"server_error"},500)); }   // e.g. SESSION_SECRET unset → never fall back to a forgeable session; keep sec() headers
  },
  async route(request, env, ctx) {
    let url = new URL(request.url);
    // 2026-08-01: carnimbus.com is ARCHIVED. carnimbus.us is the product; .com serves no content and
    // exists only to redirect. Path, query and case are preserved because site/assets/js/pass.js and
    // profile-account.js encode the pass URL into a PRINTABLE QR, and SMS already delivered carries
    // carnimbus.com/pass/<token>. Neither can be recalled — the 301 is what keeps them resolving.
    // Subdomains map 1:1 — dealer.→dealer., creator.→creator., ai.→ai.
    // 308 for non-GET so method and body survive (a 301 lets clients downgrade POST to GET and drop
    // the body); 301 for GET/HEAD so ranking consolidates onto .us.
    // NO X-Robots-Tag: noindex — on a redirecting URL that is a migration anti-pattern; Google can
    // drop the URL WITHOUT transferring signals. The bare 301 is what passes them.
    // MUST stay above the `sub`/PREFIX block: the admin. and app. redirects below already target
    // .us, so a .com request reaching them would take two hops instead of one.
    if (url.hostname === "carnimbus.com" || url.hostname.endsWith(".carnimbus.com")) {
      const dest = new URL(url);
      dest.hostname = url.hostname.slice(0, -"carnimbus.com".length) + "carnimbus.us";
      const code = (request.method === "GET" || request.method === "HEAD") ? 301 : 308;
      return sec(new Response(null, { status: code, headers: {
        "Location": dest.toString(),
        "Cache-Control": "public, max-age=3600"   // deliberately short: nobody can clear a browser's cached permanent redirect
      }}));
    }
    // 2026-08-01 HOST ALLOWLIST — fail closed. Only these hosts get the application; anything else
    // gets an empty 404. Today only bound custom domains can reach this Worker, so this changes
    // nothing in normal operation — it is the backstop for the case where a host is bound by
    // accident, a route is added carelessly, or a subdomain is pointed here later. Cheap, and it is
    // exactly the class of mistake that put .us config on .com for 52 seconds during the cutover.
    // ⚠ ADD A HOST HERE BEFORE BINDING IT AS A CUSTOM DOMAIN, or it will 404 in production.
    // www.carnimbus.us is listed ahead of being bound — it is a pending fifth custom domain.
    if(!SERVED_HOSTS.has(url.hostname))
      return sec(new Response(null,{status:404,headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex"}}));
    // Subdomain doors: one Worker, path-prefixed surfaces.
    const sub=url.hostname.split(".")[0];
    // 2026-08-03: THREE LIVE HOSTS.
    //   carnimbus.us  — the free public tool. Unchanged, and deliberately so.
    //   app.          — the dealer wApp: clear → scan → offer → title → settle.
    //   ai.           — NIMBUS. Reads the demand signal the public tool produces and tells app. what
    //                   to move, when, to whom, at what price. Closes the loop.
    // dealer. and creator. are retired-but-bound and redirect immediately below. Their PREFIX entries
    // stay only so a request that somehow bypasses the redirect resolves rather than 404s.
    const PREFIX={app:"/app",dealer:"/app",ai:"/ai"}[sub];
    // AG: ai.carnimbus.us serves the NIMBUS ops HUD again (admin-gated at the API). APIs (/api/ai/*) resolve here.
    // (redirect removed — the /ai PREFIX + /index.html fallback serves site/ai/index.html; noindex via asset header.)
    // AH2: admin.carnimbus.us is retired — ai.carnimbus.us is the single NIMBUS access point.
    if(sub==="admin" && !url.pathname.startsWith("/api/")) return Response.redirect("https://ai.carnimbus.us"+url.pathname.replace(/^\/admin/,"")+url.search,301);
    // 2026-08-03: dealer.carnimbus.us is RETIRED — app.carnimbus.us is the dealer surface.
    // ARCHIVED-BUT-BOUND, exactly like the four .com entries above: a detached host cannot redirect,
    // and every console link already emailed to a dealer, plus the two SMS templates below, depend on
    // this hop. 308 for non-GET so a stale console page's POST keeps its method and body — a 301
    // would let the client downgrade it to GET and silently drop the payload.
    if(sub==="dealer"){
      const code=(request.method==="GET"||request.method==="HEAD")?301:308;
      return sec(new Response(null,{status:code,headers:{
        "Location":"https://app.carnimbus.us"+url.pathname+url.search,
        "Cache-Control":"public, max-age=3600"
      }}));
    }
    // 2026-08-03: creator.carnimbus.us — the PORTAL is retired; the RAIL is not.
    // The self-serve creator console (feed, claim, post, earnings) is archived at
    // archive/site-creator-v1/. What survives is /c/<token> on the apex, which is the only thing
    // that turns an @nimbusbros view into an attributable lead — it stamps web_leads.creator_claim_id
    // via a 90-day cn_ref cookie. Deleting that would make "billions of views" arrive anonymous.
    // New creators and their links are now minted from ai. (NIMBUS_ACTIONS.creator_invite), which is
    // less work than a portal for a handful of partners and keeps creator_payout confirm-gated.
    // ⚠ ARCHIVED-BUT-BOUND. Live /c/ links printed in video descriptions resolve on ANY host, and a
    // detached host cannot redirect. Keep it in SERVED_HOSTS and in wrangler.jsonc routes.
    if(sub==="creator" && !url.pathname.startsWith("/c/")){
      const code=(request.method==="GET"||request.method==="HEAD")?301:308;
      return sec(new Response(null,{status:code,headers:{
        "Location":"https://carnimbus.us"+url.pathname+url.search,
        "Cache-Control":"public, max-age=3600"
      }}));
    }
    // Closed system: every app. page needs a dealer session. Doors are /signin and /pitch (the public
    // dealer pitch), plus assets/legal/APIs which carry their own gates.
    // ⚠ This gate is UX, not the security boundary — withDealer() at the API is. It accepts EITHER
    // session because withDealer does: cn_dlr (email+password, T-102) takes precedence, and cn_sess
    // (phone OTP) is still a live fallback for dealers onboarded before T-102. Checking only cn_dlr
    // here would bounce an OTP dealer off pages whose APIs would have served them fine.
    if(sub==="app" && !url.pathname.startsWith("/api/")){
      const p=url.pathname.toLowerCase();
      // /creators is open for the same reason /signin is: a creator carries cn_crt, not cn_dlr or
      // cn_sess, so this gate would bounce every one of them to a dealer login they cannot pass.
      // The page gates itself — creator-app.js shows #gate-auth until /api/creator/feed returns 200,
      // and every creator API behind it is wrapped in withCreator.
      const open = p==="/signin"||p==="/pitch"||p==="/creators"||p==="/privacy"||p==="/terms"||
                   p.startsWith("/assets/")||p==="/site.webmanifest"||
                   p.startsWith("/favicon")||p==="/robots.txt"||p.startsWith("/sitemap");
      if(!open){
        const did=await readDealerSession(env,request);         // SESSION_SECRET unset → throws → top catch 500 (fail-close)
        const uid=did?null:await readSession(env,request);
        if(!did&&!uid){ const nxt=url.pathname+url.search; return Response.redirect(url.origin+"/signin?next="+encodeURIComponent(nxt),302); }
      }
    }
    // Vanity URLs: legacy prefixed or .html paths 301 to the clean form on the right subdomain.
    { const P=url.pathname;
      if(!P.startsWith("/api/")&&!P.startsWith("/assets/")&&!P.startsWith("/pass/")&&!P.startsWith("/used/")&&!P.startsWith("/c/")){
        // The BUYER app was retired 2026-07-28; its legacy /app/* paths on the apex land on public browse.
        // (Unrelated to app.carnimbus.us, which is now the DEALER surface — this branch only runs when
        // PREFIX is undefined, i.e. on the apex, never on the app. host.)
        if(!PREFIX && P.startsWith("/app/")) return Response.redirect(url.origin+"/browse"+url.search,301);
        if(!PREFIX && P.startsWith("/dealer/")){
          // 2026-08-03: /dealer/* now targets app. directly. Sending it to dealer.carnimbus.us would
          // 301 a second time and cost every apex dealer link an extra round trip.
          let clean=P.replace(/^\/dealer/,"").replace(/\.html$/,"")||"/"; if(clean==="/index")clean="/";
          return Response.redirect("https://app.carnimbus.us"+clean+url.search,301);
        }
        // 2026-08-06: the creator console is app.carnimbus.us/creators. This used to forward to
        // creator.carnimbus.us, which now 301s everything but /c/ back to the apex — so an apex
        // /creator/* link took two hops to a 404. One hop, to where the console actually lives.
        if(!PREFIX && P.startsWith("/creator/")) return Response.redirect("https://app.carnimbus.us/creators"+url.search,301);
        if(PREFIX && (P.startsWith(PREFIX+"/")||/\.html$/.test(P))){
          let clean=(P.startsWith(PREFIX+"/")?P.slice(PREFIX.length):P).replace(/\.html$/,"")||"/"; if(clean==="/index")clean="/";
          return Response.redirect(url.origin+clean+url.search,301);
        }
      } }
    if(PREFIX && !url.pathname.startsWith(PREFIX) && !url.pathname.startsWith("/api/") &&
       !url.pathname.startsWith("/assets/") && !url.pathname.startsWith("/pass/") && !url.pathname.startsWith("/used/") &&
       !url.pathname.startsWith("/c/") &&      // creator tracked links resolve on every host
       !url.pathname.startsWith("/sitemap") && url.pathname!=="/robots.txt" &&
       url.pathname!=="/favicon.ico" && url.pathname!=="/site.webmanifest"){
      // AG-fix: root serves the DIRECTORY form ("/ai/","/admin/") not "/index.html" — Assets canonicalizes an
      // explicit index.html to its dir with a 307, which then hit the clean-URL rule below and looped.
      // AH2: ai.carnimbus.us is the ONLY console door — root serves the NIMBUS HUD (site/ai/index.html);
      // deeper ai paths (/pools,/events,/growth,/wall) serve the admin tool pages from site/admin/.
      // NOTE: the /admin PATH prefix stays even though the admin. HOST is gone — ai. deep paths serve site/admin/*.
      // app. root = /clear, not /deals. A dealer opens this app asking "what should I do today?",
      // and /clear is the only page that answers it — aged units that people are searching for and
      // not finding. /deals is the ledger you consult after you've decided to act.
      // There is no site/app/index.html and there should not be: the session gate above already
      // bounced anyone unauthenticated to /signin, so whoever reaches root is signed in.
      url.pathname = sub==="ai" ? (url.pathname==="/" ? "/ai/" : "/admin"+url.pathname)
                   : PREFIX + (url.pathname==="/" ? ((sub==="app"||sub==="dealer")?"/clear":"/") : url.pathname);
      request = new Request(url, request);
    }
    // ---- SEO surface (host-aware, apex-canonical) ----
    if (url.pathname === "/robots.txt")               return robotsTxt(url.hostname);
    if (url.pathname === "/sitemap.xml")              return sitemapIndex();
    if (url.pathname === "/sitemap-inventory.xml")    return inventorySitemap(env);
    if (url.pathname === "/sitemap-content.xml")      return contentSitemap();
    if (url.pathname.startsWith("/used/")) { const r = await usedPage(env, url.pathname); if (r) return sec(r); }
    if (url.pathname.startsWith("/cars/")) { const r = await carsPage(env, url.pathname); if (r) return sec(r); }
    if (url.pathname.startsWith("/compare/")) { const r = await comparePage(env, url.pathname); if (r) return sec(r); }
    // Lowercase canonicalization — NEVER for /pass/ or /api/ (case-sensitive tokens)
    if (!url.pathname.startsWith("/pass/") && !url.pathname.startsWith("/api/") &&
        url.pathname !== url.pathname.toLowerCase()) {
      const dest = new URL(url); dest.pathname = url.pathname.toLowerCase();
      return Response.redirect(dest.toString(), 301);
    }
    // H-CSRF: block cross-origin POSTs to any /api/* except the signature-verified machine webhooks.
    if (request.method === "POST" && url.pathname.startsWith("/api/") &&
        url.pathname !== "/api/sms/inbound" && url.pathname !== "/api/stripe/webhook" && !sameOrigin(request)) {
      return sec(json({ ok: false, error: "forbidden" }, 403));
    }
    if (url.pathname === "/api/waitlist" && request.method === "POST") {
      return sec(await waitlist(request, env));
    }
    if (url.pathname === "/api/sms/inbound" && request.method === "POST") return sec(await smsInbound(request, env));
    if (url.pathname === "/api/stripe/webhook" && request.method === "POST") return sec(await stripeWebhook(request, env));
    if (url.pathname === "/api/unsubscribe")                              return sec(await unsubscribe(request, env));   // public GET opt-out
    if (url.pathname === "/api/admin/dealer/contact" && request.method === "POST") return sec(await adminOnly(request, env, dealerContact));
    if (url.pathname === "/api/admin/outreach" && request.method === "POST")       return sec(await adminOnly(request, env, adminOutreach));
    if (url.pathname === "/api/admin/dealer/engine" && request.method === "POST")  return sec(await adminOnly(request, env, adminEngineToggle));
    if (url.pathname === "/api/sms/send" && request.method === "POST")    return sec(await adminOnly(request, env, smsSendRoute));
    if (url.pathname === "/api/sms/numbers")                              return sec(await adminOnly(request, env, smsNumbers));
    if (url.pathname === "/api/vdp/ingest" && request.method === "POST")  return sec(await adminOnly(request, env, vdpIngest));
    // ---- RETIRED BUYER APP — ROUTES REMOVED 2026-08-06 ----------------------------------------
    // The consumer app was retired 2026-07-28 and its front end moved to archive/site-app-buyer-v9/.
    // These 16 routes stayed wired for another nine days, and were already unreachable: signin.js is
    // the ONLY caller of /api/auth/start and /api/auth/verify, and it is loaded by no HTML page — so
    // no cn_sess cookie could be minted by anyone, and every withUser()-gated route below already
    // returned 401 to the entire internet. Removing them changes no observable behaviour.
    //
    // Removed: auth/start auth/verify profile avatar matches slots comments comments/vote softpull
    //          car-chat book drive/cancel feed/ask whoami chats chats/recent
    //
    // Handlers are LEFT IN PLACE, deliberately — the same call that made restoring the creator
    // console a ten-line change on 2026-08-06 rather than a rewrite. Tables keep their rows.
    //
    // ⚠ NOT retired, despite the name: /api/feed is the /browse CAR grid (feed() returns `cars`,
    // and runtime.js:442 is its only caller). Cutting it blanks the page every creator /c/ link
    // lands on. /api/comments is the social one; /api/feed is inventory.
    if (url.pathname === "/api/feed")                                     return sec(await feed(request, env));
    if (url.pathname === "/api/search")                                   return sec(await search(request, env, ctx));
    if (url.pathname === "/api/vdp")                                      return sec(await vdpOne(request, env));
    if (url.pathname.startsWith("/pass/"))                                return sec(await passPage(request, env));
    if (url.pathname === "/api/me")                                       return sec(await withUser(request, env, me));
    if (url.pathname === "/api/dealer" && request.method === "POST")      return sec(await dealerLead(request, env));
    if (url.pathname === "/api/webleads" && request.method === "POST")     return sec(await webLead(request, env));
    if (url.pathname === "/api/logout" && request.method === "POST")      return sec(logout());
    if (url.pathname === "/api/dealer/login" && request.method === "POST")   return sec(await dealerLogin(request, env));
    if (url.pathname === "/api/dealer/signup" && request.method === "POST")   return sec(await dealerSignup(request, env));
    if (url.pathname === "/api/dealer/console")                           return sec(await withDealer(request, env, dealerConsole));
    if (url.pathname === "/api/dealer/roi")                               return sec(await withDealer(request, env, dealerRoi));
    if (url.pathname === "/api/dealer/listing" && request.method === "POST") return sec(await withDealer(request, env, dealerListing));
    if (url.pathname === "/api/dealer/ingest-url" && request.method === "POST") return sec(await withDealer(request, env, dealerIngestUrl));
    if (url.pathname === "/api/dealer/placements/auto" && request.method==="POST") return sec(await withDealer(request, env, dealerAutoPlace));
    if (url.pathname === "/api/dealer/listing-status" && request.method==="POST") return sec(await withDealer(request, env, dealerListingStatus));
    if (url.pathname === "/api/dealer/lead-thread")                        return sec(await withDealer(request, env, dealerLeadThread));
    if (url.pathname === "/api/dealer/placements")                        return sec(await withDealer(request, env, dealerPlacements));
    if (url.pathname === "/api/dealer/grid")                              return sec(await withDealer(request, env, dealerGrid));
    if (url.pathname === "/api/dealer/leads")                             return sec(await withDealer(request, env, dealerLeads));
    if (url.pathname === "/api/dealer/lead-brief" && request.method==="POST") return sec(await withDealer(request, env, dealerLeadBrief));
    if (url.pathname === "/api/dealer/lead-status" && request.method==="POST") return sec(await withDealer(request, env, dealerLeadStatus));
    if (url.pathname === "/api/dealer/lead-history")                       return sec(await withDealer(request, env, dealerLeadHistory));
    if (url.pathname === "/api/dealer/settings" && request.method==="POST") return sec(await withDealer(request, env, dealerSettings));
    if (url.pathname === "/api/dealer/lead-ics")                          return sec(await withDealer(request, env, dealerLeadIcs));
    if (url.pathname === "/api/dealer/checkin" && request.method === "POST") return sec(await withDealer(request, env, dealerCheckin));
    if (url.pathname === "/api/dealer/feedback")                             return sec(await withDealer(request, env, dealerFeedback));
    // ---- app.carnimbus.us — the dealer wApp (deck v13 S-04: scan → offer → title → settle) ----
    // Every one of these is withDealer-gated. withDealer IS the security boundary; the page-level
    // session check in route() is only UX. See docs/SETTLEMENT-RUNBOOK.md.
    if (url.pathname === "/api/app/vin"   && request.method === "POST") return sec(await withDealer(request, env, appVin));
    if (url.pathname === "/api/app/offer")                              return sec(await withDealer(request, env, appOffer));
    if (url.pathname === "/api/app/deal"  && request.method === "POST") return sec(await withDealer(request, env, appDealCreate));
    if (url.pathname === "/api/app/deal")                               return sec(await withDealer(request, env, appDealGet));
    if (url.pathname === "/api/app/deals")                              return sec(await withDealer(request, env, appDeals));
    if (url.pathname === "/api/app/stake" && request.method === "POST") return sec(await withDealer(request, env, appStake));
    if (url.pathname === "/api/app/title" && request.method === "POST") return sec(await withDealer(request, env, appTitleUpload));
    if (url.pathname.startsWith("/api/app/title/"))                     return sec(await withDealer(request, env, appTitleGet));
    if (url.pathname === "/api/app/adjudicate" && request.method === "POST") return sec(await withDealer(request, env, appAdjudicate));
    if (url.pathname === "/api/app/approve"    && request.method === "POST") return sec(await withDealer(request, env, appApprove));
    if (url.pathname === "/api/app/dispute"    && request.method === "POST") return sec(await withDealer(request, env, appDispute));
    if (url.pathname === "/api/app/clear")                                   return sec(await withDealer(request, env, appClear));
    if (url.pathname === "/api/app/reprice"    && request.method === "POST") return sec(await withDealer(request, env, appReprice));
    if (url.pathname === "/api/app/rec-skip"   && request.method === "POST") return sec(await withDealer(request, env, appRecSkip));
    if (url.pathname === "/api/admin/stats")                              return sec(await adminOnly(request, env, adminStats));
    if (url.pathname === "/api/admin/dealer/activate" && request.method === "POST") return sec(await adminOnly(request, env, dealerActivate));
    if (url.pathname === "/api/admin/dealer-cred" && request.method === "POST") return sec(await adminOnly(request, env, (req,e)=>adminDealerCred(req,e)));
    if (url.pathname === "/api/admin/reindex" && request.method === "POST") return sec(await adminOnly(request, env, reindexAll));
    if (url.pathname === "/api/admin/profiles/ingest" && request.method === "POST") return sec(await adminOnly(request, env, profilesIngest));
    if (url.pathname === "/api/admin/export")                             return sec(await adminOnly(request, env, poolExport));
    if (url.pathname === "/api/dealer/chat")                              return sec(await withDealer(request, env, dealerChat));
    // ---- Creator Network — RESTORED 2026-08-06, deck v13 S-04 ----
    // The portal was retired 2026-08-03 by deleting these ten route lines. Nothing else was removed:
    // every handler stayed in this file and every table kept its rows. Deck v13 makes the creator
    // layer the product ("creator management platform for franchised dealerships"), so the console
    // is back — on app./creators now, not the retired creator. host. The attribution rail
    // (/c/<token>, host-agnostic, just below) never stopped working, and the operator verbs on ai.
    // — creator_invite, creator_approve_post, creator_payout — keep their aiAct confirm gate.
    if (url.pathname === "/api/creator/signup"  && request.method === "POST") return sec(await creatorSignup(request, env));
    if (url.pathname === "/api/creator/login"   && request.method === "POST") return sec(await creatorLogin(request, env));
    if (url.pathname === "/api/creator/logout")                               return sec(creatorLogout());
    if (url.pathname === "/api/creator/avatar"  && request.method === "POST") return sec(await withCreator(request, env, creatorAvatar));
    if (url.pathname === "/api/creator/feed")                                 return sec(await withCreator(request, env, creatorFeed));
    if (url.pathname === "/api/creator/claim"   && request.method === "POST") return sec(await withCreator(request, env, creatorClaim));
    if (url.pathname === "/api/creator/post"    && request.method === "POST") return sec(await withCreator(request, env, creatorPost));
    if (url.pathname === "/api/creator/earnings")                             return sec(await withCreator(request, env, creatorEarnings));
    if (url.pathname === "/api/creator/connect/start"  && request.method === "POST") return sec(await withCreator(request, env, creatorConnectStart));
    if (url.pathname === "/api/creator/connect/return")                       return sec(await withCreator(request, env, creatorConnectReturn));
    if (url.pathname === "/api/admin/creator/queue")                          return sec(await adminOnly(request, env, (req,e)=>creatorQueue(req,e)));
    // Public tracked link — host-agnostic, no auth. Redirects to the car and drops the cn_ref cookie.
    { const cm=url.pathname.match(/^\/c\/([A-Za-z0-9_-]{4,40})$/); if(cm) return await creatorRedirect(request, env, cm[1]); }
    // Unauthenticated by necessity — it is the door. Constant-time compare, fails closed when
    // ADMIN_PASS_HASH is unset, and returns the same "invalid" either way.
    if (url.pathname === "/api/admin/login" && request.method === "POST")  return sec(await adminLogin(request, env));
    if (url.pathname === "/api/admin/logout")                             return sec(adminLogout());
    if (url.pathname === "/api/ai/bands")                                 return sec(await adminOnly(request, env, (req,e)=>aiBands(req,e)));
    if (url.pathname === "/api/ai/clearance")                             return sec(await adminOnly(request, env, (req,e)=>aiClearance(req,e)));
    if (url.pathname === "/api/ai/verify")                                return sec(await adminOnly(request, env, (req,e)=>aiVerify(req,e)));
    if (url.pathname === "/api/ai/pulse")                                 return sec(await adminOnly(request, env, (req,e)=>aiPulse(e)));
    if (url.pathname === "/api/ai/graph")                                 return sec(await adminOnly(request, env, (req,e)=>aiGraph(e)));
    if (url.pathname === "/api/ai/trends")                                return sec(await adminOnly(request, env, (req,e)=>aiTrends(e)));
    if (url.pathname === "/api/ai/ask" && request.method === "POST")      return sec(await adminOnly(request, env, (req,e)=>aiAsk(req,e)));
    if (url.pathname === "/api/ai/map")                                   return sec(await adminOnly(request, env, (req,e)=>aiMap(req,e)));
    if (url.pathname === "/api/ai/health")                                return sec(await adminOnly(request, env, (req,e)=>aiHealth(req,e)));
    if (url.pathname === "/api/ai/act" && request.method === "POST")      return sec(await adminOnly(request, env, (req,e)=>aiAct(req,e)));
    if (url.pathname === "/api/ai/demand")                                return sec(await adminOnly(request, env, (req,e)=>aiDemand(req,e)));
    if (url.pathname === "/api/admin/buyers")                             return sec(await adminOnly(request, env, (req,e)=>adminBuyers(e)));
    if (url.pathname === "/api/events" && request.method === "POST")      return sec(await postEvents(request, env));
    if (url.pathname === "/api/admin/events/tail")                        return sec(await adminOnly(request, env, eventsTail));
    if (url.pathname === "/api/admin/growth")                             return sec(await adminOnly(request, env, adminGrowth));
    let assetRes = await env.ASSETS.fetch(request);
    { const h = new Headers(assetRes.headers);
      if (["app","dealer","creator","admin","ai"].includes(url.hostname.split(".")[0])) h.set("X-Robots-Tag", "noindex, nofollow");
      const ct=h.get("content-type")||"";
      // HTML + JS always revalidate — stale app shells were serving old code for days. Images/fonts stay cached.
      if (ct.includes("text/html")||ct.includes("javascript")) {
        h.set("Cache-Control","no-store, no-cache, must-revalidate");
      } else if (ct.includes("image/") || ct.includes("font/") || url.pathname.endsWith(".woff2")) {
        h.set("Cache-Control","public, max-age=31536000, immutable");
      }
      assetRes = new Response(assetRes.body, { status: assetRes.status, headers: h });
    }
    return sec(assetRes);
  },
  // ══════════════════════════════════════════════════════════════════════════════════════════
  // THE CRON — every task heartbeated, every cadence matched to what the task actually needs.
  //
  // REBUILT 2026-08-06 after measuring it. The old version executed ≈9,700 D1 statements per
  // tick — ≈2.8 MILLION a day — and ~97% of that was ONE block: a 50-user
  // computeSignals/computeMatches loop serving the buyer app retired 2026-07-28. computeMatches
  // is an N+1 (100-150 sequential `SELECT * FROM vdps WHERE id=?`) plus one embed() and one
  // Vectorize topK:50 PER USER PER FIVE MINUTES = 14,400 embeddings and 14,400 vector queries a
  // day, for 5 profiles rows that no live page reads. Deleted.
  //
  // Also deleted: residentAgent and syntheticNudger (nothing renders a comment; between them
  // they wrote 2,087 of the 2,395 rows in `comments` and were the only uncapped Workers-AI spend
  // in the cron) and growthRollup (guarded to 1/day, so 287 of its 288 daily runs were a wasted
  // guard query, and its output is read only by an orphaned admin page).
  //
  // Two calls used to run UNGUARDED — runQueue and syncEmbeddings. A throw in either aborted
  // every task after it, silently. runJob() now wraps all of them, so one failure can no longer
  // take the loop down, and the failure is recorded instead of vanishing.
  async scheduled(event, env) {
    // Hourly and daily gates. The cron fires every 5 minutes because SMS dispatch needs it;
    // nothing else here does. A task whose INPUT changes hourly cannot produce new output by
    // running twelve times an hour — it just costs twelve times as much.
    const now = new Date();
    const HOURLY = now.getUTCMinutes() < 5;
    const DAILY  = HOURLY && now.getUTCHours() === 9;   // 09:0x UTC ≈ 02:0x LA

    await runJob(env, "runQueue",        () => runQueue(env));          // outbound SMS — needs 5 min
    await runJob(env, "settlementWatch", () => settlementWatch(env));   // 2 SELECTs; expiring Stripe auths

    if (HOURLY) {
      await runJob(env, "syncEmbeddings",  () => syncEmbeddings(env));
      await runJob(env, "enrichInventory", () => enrichInventory(env));
      await runJob(env, "creatorAgent",    () => creatorAgent(env));
      await runJob(env, "driveReminders",  () => driveReminders(env));  // live again — webLead now writes test_drives
      await runJob(env, "demandRollup",    () => demandRollup(env));    // scans → demand_cells (ZIP3 × segment × band, k≥5)
      await runJob(env, "clearanceSweep",  () => clearanceSweep(env));  // …→ clearance_recs. Its only input is what the line above wrote.
    }
    if (DAILY) {
      await runJob(env, "syncDealerFeeds",     () => syncDealerFeeds(env));
      await runJob(env, "checkSourceListings", () => checkSourceListings(env));  // was 1,440 writes + 1,440 external fetches/day
    }
  },
};

// ---- job_runs: the heartbeat (0076) ----------------------------------------------------------
// Before this there was no `last_run` column anywhere, so "did the cron run today?" could not be
// answered from any surface. On 2026-07-11 migrations were committed but never applied; every
// comment INSERT threw silently and the feed sat in degraded fallback until the founder happened
// to ask "is the feed even connected?". Nothing in the code made that visible. This does.
//
// runJob NEVER rethrows: one failing task must not abort the rest of the tick, which is exactly
// what unguarded runQueue/syncEmbeddings used to do. The failure is recorded instead of lost.
async function runJob(env, name, fn) {
  const t0 = Date.now(), started = new Date().toISOString();
  let ok = 1, err = null;
  try { await fn(); }
  catch (e) { ok = 0; err = String((e && (e.message || e.name)) || e).slice(0, 300); }
  await env.DB.prepare("INSERT INTO job_runs (job,started_at,ms,ok,error) VALUES (?,?,?,?,?)")
    .bind(name, started, Date.now() - t0, ok, err).run().catch(() => {});
  return ok === 1;
}
// A swallowed write still never blocks the request — it just stops being invisible. There are 69
// bare `.run().catch(()=>{})` on write paths in this file; each one converted here becomes a row
// somebody can actually find.
async function safeWrite(env, label, stmt) {
  try { return await stmt.run(); }
  catch (e) {
    await env.DB.prepare("INSERT INTO job_runs (job,started_at,ms,ok,error) VALUES (?,?,0,0,?)")
      .bind("write:" + label, new Date().toISOString(), String((e && e.message) || e).slice(0, 300))
      .run().catch(() => {});
    return null;
  }
}

// Two things the settlement engine cannot check inline, both of which fail SILENTLY if unwatched.
//
// 1. LEDGER DRIFT. deals.state is a cache of deal_events. dealTransition() is the only writer and
//    it is guarded, but a partial failure (state UPDATE lands, event INSERT does not) would leave
//    them disagreeing and the ledger is the one that is right. Log loudly; do not auto-"fix" by
//    overwriting either side, because which one is wrong is a judgement call about real money.
//
// 2. EXPIRING AUTHORIZATIONS. A Stripe manual-capture authorization lapses after 7 days. A deal
//    parked in STAKED past that point looks funded and is not. Warn at day 5 so there are two days
//    to act. This is the single most likely way for this system to quietly lie to a dealer.
async function settlementWatch(env){
  try{
    const drift=await env.DB.prepare(
      "SELECT d.id, d.state AS cached, (SELECT to_state FROM deal_events e WHERE e.deal_id=d.id ORDER BY e.id DESC LIMIT 1) AS ledger "+
      "FROM deals d WHERE ledger IS NOT NULL AND ledger <> d.state LIMIT 20").all().catch(()=>({results:[]}));
    for(const r of (drift.results||[]))
      console.error("settlement_drift: deal="+r.id+" deals.state="+r.cached+" ledger="+r.ledger+" — the ledger is authoritative");
    const stale=await env.DB.prepare(
      "SELECT s.deal_id, s.authorized_at FROM stakes s JOIN deals d ON d.id=s.deal_id "+
      "WHERE s.status='requires_capture' AND d.state IN ('STAKED','TITLED','ADJUDICATED') "+
      "AND s.authorized_at < datetime('now','-5 days') LIMIT 20").all().catch(()=>({results:[]}));
    for(const r of (stale.results||[]))
      console.error("stake_expiring: deal="+r.deal_id+" authorized_at="+r.authorized_at+" — Stripe authorizations lapse at 7 days; re-stake or settle");
  }catch(_){}
}

// ==================== auth/session (HMAC cookie) ====================
async function hmac(env, s){ const secret=env.SESSION_SECRET; if(!secret) throw new Error("SESSION_SECRET unset");
  const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("HMAC",k,new TextEncoder().encode(s)); return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/[+/=]/g,m=>({"+":"-","/":"_","=":""}[m])); }
async function makeSession(env,userId){ const exp=Date.now()+30*864e5; const p=userId+"."+exp; return p+"."+await hmac(env,p); }
async function readSession(env,request){ const m=(request.headers.get("Cookie")||"").match(/cn_sess=([^;]+)/); if(!m) return null;
  const parts=m[1].split("."); if(parts.length!==3) return null; const [uid,exp,sig]=parts;
  if(!uid||!exp||!sig||Date.now()>+exp) return null;
  return ctEq(await hmac(env,uid+"."+exp),sig) ? +uid : null; }
// T-102: dealer email+password auth (PBKDF2 via WebCrypto) + a dealer session cookie (cn_dlr), mirroring cn_sess.
function newSalt(){ return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16)))); }
async function hashPw(pw,saltB64){
  const salt=Uint8Array.from(atob(saltB64),c=>c.charCodeAt(0));
  const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(String(pw)),{name:"PBKDF2"},false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:100000,hash:"SHA-256"},k,256);
  return btoa(String.fromCharCode(...new Uint8Array(bits))); }
async function verifyPw(pw,saltB64,hashB64){ if(!saltB64||!hashB64) return false; return ctEq(await hashPw(pw,saltB64),hashB64); }
async function makeDealerSession(env,dealerId){ const exp=Date.now()+30*864e5, p="d"+dealerId+"."+exp; return p+"."+await hmac(env,p); }
async function readDealerSession(env,request){ const m=(request.headers.get("Cookie")||"").match(/cn_dlr=([^;]+)/); if(!m) return null;
  const parts=m[1].split("."); if(parts.length!==3) return null; const [id,exp,sig]=parts;
  if(!/^d\d+$/.test(id)||Date.now()>+exp) return null;
  return (await ctEq(await hmac(env,id+"."+exp),sig)) ? +id.slice(1) : null; }
async function getCryptoKey(secret) {
  const msgUint8 = new TextEncoder().encode(secret || "nimbus-pii-fallback-key");
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  return await crypto.subtle.importKey('raw', hashBuffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
async function encryptPII(text, secret) {
  if (!text) return text;
  try {
    const key = await getCryptoKey(secret);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
    const ctHex = Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `enc:${ivHex}:${ctHex}`;
  } catch (e) { return text; }
}
async function decryptPII(encText, secret) {
  if (!encText || !encText.startsWith("enc:")) return encText;
  try {
    const parts = encText.split(":");
    if (parts.length !== 3) return encText;
    const ivHex = parts[1], ctHex = parts[2];
    const iv = new Uint8Array(ivHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const ct = new Uint8Array(ctHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const key = await getCryptoKey(secret);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new TextDecoder().decode(decrypted);
  } catch (e) { return encText; }
}
async function decryptAnswers(a, secret) {
  if (!a || typeof a !== "object") return a;
  const decrypted = { ...a };
  for (const k in decrypted) {
    if (typeof decrypted[k] === "string" && decrypted[k].startsWith("enc:")) {
      decrypted[k] = await decryptPII(decrypted[k], secret);
    }
  }
  return decrypted;
}
async function withUser(request,env,fn,ctx){ const uid=await readSession(env,request); if(!uid) return json({ok:false,error:"auth"},401); return fn(request,env,uid,ctx); }
function ctEq(a,b){ a=String(a); b=String(b); if(a.length!==b.length) return false; let r=0; for(let i=0;i<a.length;i++) r|=a.charCodeAt(i)^b.charCodeAt(i); return r===0; }
// ---- ADMIN ACCESS — two doors to the same room (2026-08-06) ----------------------------------
// The flash-key model (a file on a USB stick, read through showOpenFilePicker, re-read every 2s)
// is desktop-Chrome-only by construction: Safari, Firefox and EVERY iOS browser lack the File
// System Access API, and nimbus.js's fallback input passes handle=null into unlockFlash, which
// rejects !handle — so the fallback could never unlock. The console built for the owner was the
// one surface he could not open on the device he actually carries, and it told him "Invalid",
// which reads as "your key is wrong" rather than "your browser can't do this".
//
// So: a second door. A passphrase mints a signed cn_adm cookie using the same hmac/hashPw
// primitives the dealer sessions already use. The x-admin-key header still works EXACTLY as
// before — every script, every curl, and the flash key itself are unaffected — because adminOnly
// accepts either. Nothing is taken away; a way in is added.
async function makeAdminSession(env){ const exp=Date.now()+7*864e5, p="a."+exp; return p+"."+await hmac(env,p); }
async function readAdminSession(env,request){
  const m=(request.headers.get("Cookie")||"").match(/cn_adm=([^;]+)/); if(!m) return false;
  const parts=m[1].split("."); if(parts.length!==3) return false;
  if(!(+parts[1]>Date.now())) return false;
  try{ return ctEq(parts[2], await hmac(env,parts[0]+"."+parts[1])); }catch(_){ return false; }
}
async function adminLogin(request,env){
  const {pass}=await request.json().catch(()=>({}));
  // Fail closed and identically in both directions: an unset passphrase must not become an open
  // door, and a wrong one must not be distinguishable from an unconfigured one.
  if(!env.ADMIN_PASS_HASH||!env.ADMIN_PASS_SALT||!pass) return json({ok:false,error:"invalid"},401);
  const h=await hashPw(String(pass),env.ADMIN_PASS_SALT).catch(()=>null);
  if(!h||!ctEq(h,env.ADMIN_PASS_HASH)) return json({ok:false,error:"invalid"},401);
  const cookie="cn_adm="+await makeAdminSession(env)+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age="+(7*86400);
  return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json","Set-Cookie":cookie,...SEC}});
}
function adminLogout(){ return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json",
  "Set-Cookie":"cn_adm=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",...SEC}}); }
async function adminOnly(request,env,fn){
  if(env.ADMIN_KEY && ctEq(request.headers.get("x-admin-key")||"",env.ADMIN_KEY)) return fn(request,env);
  if(await readAdminSession(env,request)) return fn(request,env);
  return json({ok:false,error:"forbidden"},403); }

// ==================== SMS (Twilio REST; dark until secrets set) ====================
async function sendSMS(env,to,body){ if(!env.TWILIO_ACCOUNT_SID) return {ok:false,dark:true};
  const r=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {method:"POST",headers:{Authorization:"Basic "+btoa(env.TWILIO_ACCOUNT_SID+":"+env.TWILIO_AUTH_TOKEN)},
     body:new URLSearchParams({To:to,From:env.TWILIO_FROM,Body:body})});
  const d=await r.json().catch(()=>({}));
  await env.DB.prepare("INSERT INTO sms_log (phone,direction,body,status,twilio_sid,created_at) VALUES (?,?,?,?,?,?)")
    .bind(to,"out",body,r.ok?"sent":"failed",d.sid||"",new Date().toISOString()).run().catch(()=>{});
  return {ok:r.ok,sid:d.sid}; }
async function smsSendRoute(request,env){ const {to,body}=await request.json().catch(()=>({}));
  if(!to||!body) return json({ok:false,error:"bad_request"},400); return json(await sendSMS(env,to,body)); }
// T-102: reusable transactional email via Resend (dark-safe: no-ops without RESEND_API_KEY). Modeled on sendDealerOutreach.
async function sendEmail(env,{to,subject,text}){
  if(!env.RESEND_API_KEY||!to) return {ok:false,dark:true};
  const r=await fetch("https://api.resend.com/emails",{method:"POST",
    headers:{"Authorization":"Bearer "+env.RESEND_API_KEY,"content-type":"application/json"},
    body:JSON.stringify({from:"CarNimbus <hello@carnimbus.us>",to:[to],subject,text})}).catch(()=>null);
  return {ok:!!(r&&r.ok)}; }
async function smsNumbers(request,env){ if(!env.TWILIO_ACCOUNT_SID) return json({ok:false,error:"twilio_dark"});
  const r=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json?PageSize=10`,
    {headers:{Authorization:"Basic "+btoa(env.TWILIO_ACCOUNT_SID+":"+env.TWILIO_AUTH_TOKEN)}});
  const d=await r.json().catch(()=>({}));
  return json({ok:r.ok,from_configured:!!env.TWILIO_FROM,numbers:(d.incoming_phone_numbers||[]).map(n=>n.phone_number),message:d.message}); }
async function twilioValid(request,env,form){
  const sig=request.headers.get("X-Twilio-Signature"); if(!sig||!env.TWILIO_AUTH_TOKEN) return false;
  const keys=[...form.keys()].sort();                       // Twilio scheme: URL + params in key-sorted order
  let data=request.url; for(const k of keys) data+=k+String(form.get(k));
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(env.TWILIO_AUTH_TOKEN),{name:"HMAC",hash:"SHA-1"},false,["sign"]);
  const mac=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(data));
  const b64=btoa(String.fromCharCode(...new Uint8Array(mac)));
  return b64===sig;
}
// T-102: the matched car's SMS voice — reused when a buyer texts back after booking.
function carVoicePrompt(car){ return "You ARE the "+car+", a used car texting a buyer who just scheduled a test drive with you. "+
  "First person, warm, concise, a little charming. Answer about yourself (condition, feel, the drive). Keep replies under 300 characters for SMS. "+
  "Never invent specs you don't know — say the dealer confirms at the drive. Never discuss pricing markups."; }
async function smsInbound(request,env){ const form=await request.formData().catch(()=>null);
  if(!form || !(await twilioValid(request,env,form))) return new Response('<?xml version="1.0"?><Response/>',{status:403,headers:{"content-type":"text/xml"}});
  const from=form?String(form.get("From")||""):"", rawText=form?String(form.get("Body")||"").trim():"", text=rawText.toUpperCase();
  let reply="";
  // R23 P6: CANCEL from a phone holding a live confirmed lead = booking cancel, NOT unsubscribe.
  // (STOP/UNSUBSCRIBE stay carrier opt-outs below; CANCEL only falls through when no lead matches.)
  const cancelLead=(text==="CANCEL")?await env.DB.prepare(
    "SELECT id,dealer_id,status,phone,first_name,matched_car,dream_car FROM web_leads WHERE phone=? AND status='confirmed' ORDER BY id DESC LIMIT 1")
    .bind(from).first().catch(()=>null):null;
  if(cancelLead){
    await leadTransition(env,cancelLead,"cancelled","sms",rawText);
    reply="No problem — your drive's cancelled. Want me to move it instead? Reply with a day that works."; }
  else if(/^(STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT)$/.test(text)){
    await env.DB.prepare("UPDATE waitlist SET sms_consent=0 WHERE phone=?").bind(from).run().catch(()=>{});
    // P10: STOP kills any pending follow-up sequence dead, forever.
    await env.DB.prepare("DELETE FROM sms_queue WHERE phone=? AND sent=0 AND template LIKE 'lead_followup:%'").bind(from).run().catch(()=>{});
    await env.DB.prepare("UPDATE web_leads SET followup_stage=99 WHERE phone=?").bind(from).run().catch(()=>{});
    reply="You're unsubscribed from CarNimbus texts. No more messages. Reply START to rejoin."; }
  // R23 P8: a no-show/cancelled lead replying with a day = win-back → straight back to confirmed.
  // Prefetched so a day-word in an ordinary message never swallows the car-voice/relay branches below.
  else if(await (async()=>{ if(!rawText||!from||/^(HELP|INFO|START)$/.test(text)) return false;
    if(!/(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2})/i.test(rawText)) return false;
    const wb=await env.DB.prepare(
      "SELECT id,dealer_id,status,phone,first_name,matched_car,dream_car FROM web_leads WHERE phone=? AND status IN ('no_show','cancelled') ORDER BY id DESC LIMIT 1")
      .bind(from).first().catch(()=>null);
    if(!wb) return false;
    await leadTransition(env,wb,"confirmed","sms",rawText);
    reply="You're back on the books — we'll confirm the exact time shortly."; return true; })()){/* handled */}
  else if(/^(HELP|INFO)$/.test(text)) reply="CarNimbus: AI car buying, LA. Up to 4 msgs/mo. Msg&data rates may apply. Reply STOP to cancel. hello@carnimbus.us";
  else if(text==="START"){ await env.DB.prepare("UPDATE waitlist SET sms_consent=1 WHERE phone=?").bind(from).run().catch(()=>{}); reply="Welcome back to CarNimbus. Reply STOP anytime."; }
  else if(rawText && from && from!==env.TWILIO_FROM && env.SMS_MATCH_LIVE &&
          (await env.DB.prepare("SELECT 1 FROM web_leads WHERE phone=? AND matched_car<>''").bind(from).first().catch(()=>null))){
    // T-102: a buyer with a live Drive-Now lead texting the car → reply in the car's own voice (AI).
    try{
      const wl=await env.DB.prepare("SELECT matched_car FROM web_leads WHERE phone=? AND matched_car<>'' ORDER BY id DESC LIMIT 1").bind(from).first();
      const h=(await env.DB.prepare("SELECT direction,body FROM sms_log WHERE phone=? ORDER BY id DESC LIMIT 6").bind(from).all().catch(()=>({results:[]}))).results||[];
      const msgs=[{role:"system",content:carVoicePrompt(wl.matched_car)}];
      h.reverse().forEach(m=>msgs.push({role:m.direction==="in"?"user":"assistant",content:String(m.body||"")}));
      msgs.push({role:"user",content:rawText.slice(0,400)});
      const ans=await chatLLM(env,msgs).catch(()=>null);
      if(ans) await sendSMS(env,from,String(ans).slice(0,480));   // sendSMS logs the outbound row
    }catch(_){/* AI reply must never break the TwiML ack */}
  }
  else if(rawText && from && from!==env.TWILIO_FROM){                       // relay: dealer↔buyer via our number
    try{
      const dl=await env.DB.prepare("SELECT id,name,phone FROM dealer_leads WHERE phone=? AND status='active'").bind(from).first();
      if(dl){                                                                // dealer → buyer of their latest live drive
        const td=await env.DB.prepare("SELECT t.id,u.phone bp FROM test_drives t JOIN users u ON u.id=t.user_id JOIN vdps v ON v.id=t.vdp_id WHERE v.dealer_id=? AND t.status!='sold' ORDER BY t.id DESC LIMIT 1").bind(dl.id).first();
        if(td&&td.bp) await sendSMS(env,td.bp,`${dl.name} @ CarNimbus: ${rawText.slice(0,480)}`);
      } else {
        const us=await env.DB.prepare("SELECT id,handle FROM users WHERE phone=?").bind(from).first();
        if(us){                                                              // buyer → dealer of their latest live drive
          const td=await env.DB.prepare("SELECT dl.phone dp FROM test_drives t JOIN vdps v ON v.id=t.vdp_id JOIN dealer_leads dl ON dl.id=v.dealer_id WHERE t.user_id=? AND t.status!='sold' ORDER BY t.id DESC LIMIT 1").bind(us.id).first();
          if(td&&td.dp) await sendSMS(env,td.dp,`${us.handle||"Buyer"}: ${rawText.slice(0,480)}`);
        }
      }
    }catch(_){/* relay must never break the TwiML ack */}
  }
  await env.DB.prepare("INSERT INTO sms_log (phone,direction,body,status,created_at) VALUES (?,?,?,?,?)")
    .bind(from,"in",rawText,"received",new Date().toISOString()).run().catch(()=>{});
  return new Response(`<?xml version="1.0"?><Response>${reply?`<Message>${reply}</Message>`:""}</Response>`,{headers:{"content-type":"text/xml"}}); }
async function runQueue(env){ const now=new Date().toISOString();
  const due=await env.DB.prepare("SELECT * FROM sms_queue WHERE sent=0 AND send_at<=? LIMIT 25").bind(now).all().catch(()=>({results:[]}));
  for(const q of (due.results||[])){
    const c=await env.DB.prepare("SELECT sms_consent FROM waitlist WHERE phone=?").bind(q.phone).first().catch(()=>null);
    if(c&&c.sms_consent===1) await sendSMS(env,q.phone,q.body);
    await env.DB.prepare("UPDATE sms_queue SET sent=1 WHERE id=?").bind(q.id).run();
    if(q.recurring==="daily"||q.recurring==="weekly"){ const next=new Date(Date.parse(q.send_at)+(q.recurring==="daily"?864e5:7*864e5)).toISOString();
      await env.DB.prepare("INSERT INTO sms_queue (phone,template,body,send_at,recurring,created_at) VALUES (?,?,?,?,?,?)")
        .bind(q.phone,q.template,q.body,next,q.recurring,now).run(); } } }

// ==================== AI seam (Workers AI now, Nimbus appliance later) ====================
async function embed(env,text){ if(env.AI_BACKEND_URL){ try{ const r=await fetch(env.AI_BACKEND_URL+"/embed",{method:"POST",body:JSON.stringify({text})});
    if(r.ok){ const d=await r.json().catch(()=>null); if(d&&Array.isArray(d.vector)&&d.vector.length===768) return d.vector; } }catch(_){} }  // fall back to Workers AI if the appliance is down/wrong-dim
  const r=await env.AI.run("@cf/baai/bge-base-en-v1.5",{text:[text]}); return r.data[0]; }
// R15: 6s timeout on the appliance so a hung box can't stall the console; attribute which layer died.
async function llm(env,messages){
  if(env.AI_BACKEND_URL){ try{
      const r=await fetch(env.AI_BACKEND_URL+"/chat",{method:"POST",body:JSON.stringify({messages}),signal:AbortSignal.timeout(6000)});
      if(r.ok){ const d=await r.json().catch(()=>null); if(d&&typeof d.text==="string") return d.text; }
    }catch(_){}
  }
  try{ const r=await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast",{messages,max_tokens:512}); return r.response; }
  catch(e){ const q=/4006|allocation|neuron/i.test(String((e&&e.message)||e));
    const err=new Error(q?"quota":"cloud"); err.layer=q?"quota":"cloud"; err.ollama=!!env.AI_BACKEND_URL; throw err; }
}
// Car chat forces Workers AI (llama-3.3-70b) for reliable in-character roleplay — the external
// AI_BACKEND_URL appliance under-weights the system persona and leaks its own scaffolding.
async function chatLLM(env,messages){ if(env.AI){ const r=await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast",{messages,max_tokens:400}); return r.response; }
  return llm(env,messages); }

// ==================== auth + profile + VDP ingest ====================
// ==================== SEO: robots, sitemaps, VDP pages ====================
function slug(s){ return String(s||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,""); }
function vdpPath(v){ return "/used/"+v.year+"-"+slug(v.make)+"-"+slug(v.model)+"-"+v.id; }
function escHtml(s=""){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function xmlEsc(s=""){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;"); }
const SEO_ORIGIN="https://carnimbus.us";

function robotsTxt(host){
  if(host!=="carnimbus.us"&&host!=="www.carnimbus.us")
    return new Response("User-agent: *\nDisallow: /\n",{headers:{"content-type":"text/plain; charset=utf-8","cache-control":"public, max-age=3600"}});
  const body=`# CarNimbus robots.txt
User-agent: *
Allow: /
Disallow: /api/
Disallow: /pass/
Disallow: /app/
Disallow: /dealer/
Disallow: /creator/
Disallow: /c/
Disallow: /admin/
Disallow: /ai/

# AI / answer-engine crawlers — explicitly allowed for citation
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-SearchBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /

Sitemap: ${SEO_ORIGIN}/sitemap.xml
`;
  return new Response(body,{headers:{"content-type":"text/plain; charset=utf-8","cache-control":"public, max-age=3600"}});
}

function xmlResponse(body,maxAge){ return new Response(body,{headers:{"content-type":"application/xml; charset=utf-8","cache-control":"public, max-age="+maxAge}}); }
function sitemapIndex(){
  const now=new Date().toISOString();
  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`+
    ["sitemap-inventory.xml","sitemap-content.xml"].map(c=>`  <sitemap><loc>${SEO_ORIGIN}/${c}</loc><lastmod>${now}</lastmod></sitemap>`).join("\n")+
    `\n</sitemapindex>`,3600);
}
async function inventorySitemap(env){
  const rows=await env.DB.prepare("SELECT id,year,make,model,photos,updated_at FROM vdps WHERE active=1 ORDER BY id DESC LIMIT 5000").all();
  const urls=(rows.results||[]).map(v=>{
    const imgs=JSON.parse(v.photos||"[]").slice(0,10).map(p=>`    <image:image><image:loc>${xmlEsc(p.startsWith("http")?p:SEO_ORIGIN+p)}</image:loc></image:image>`).join("\n");
    return `  <url>\n    <loc>${xmlEsc(SEO_ORIGIN+vdpPath(v))}</loc>\n    <lastmod>${new Date(v.updated_at||Date.now()).toISOString()}</lastmod>\n    <changefreq>daily</changefreq>\n`+(imgs?imgs+"\n":"")+`  </url>`;
  }).join("\n");
  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls}\n</urlset>`,900);
}
function contentSitemap(){
  const now=new Date().toISOString();
  const pages=["/","/browse","/about","/contact"];
  return xmlResponse(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`+
    pages.map(p=>`  <url><loc>${SEO_ORIGIN}${p}</loc><lastmod>${now}</lastmod></url>`).join("\n")+`\n</urlset>`,3600);
}

const VDP_FAQ=[
  {q:"Does getting pre-qualified hurt my credit?",a:"No. CarNimbus pre-qualification uses a soft pull only — zero FICO impact. A hard pull only ever happens later, if you choose to finance, and you'll know first."},
  {q:"Is this car still available?",a:"If this page is live, the car is live. When a car sells, its page redirects to our current inventory automatically."},
  {q:"How does the test drive work?",a:"Talk to the car in the CarNimbus app, pick a time, and you get a Drive Now Pass with a QR code. Walk in expected — terms already set, no 4-hour ordeal."},
  {q:"What does CarNimbus cost buyers?",a:"Nothing. CarNimbus is free for buyers — partner dealers pay us for delivering ready-to-drive customers, not by marking up your car."}];
// Wave E2: /cars/<year-make-model> is a friendly alias → 301 to the canonical /used/ SEO page (no duplicate content).
async function carsPage(env,pathname){
  const m=pathname.match(/^\/cars\/([a-z0-9-]+)\/?$/i); if(!m) return null;
  const s=m[1].toLowerCase();
  // If it already carries an id suffix, resolve directly; else match slug against active inventory.
  const idm=s.match(/-(\d+)$/);
  let v=null;
  if(idm){ v=await env.DB.prepare("SELECT * FROM vdps WHERE id=? AND active=1").bind(+idm[1]).first(); }
  if(!v){ const rows=await env.DB.prepare("SELECT id,year,make,model FROM vdps WHERE active=1").all().catch(()=>({results:[]}));
    v=(rows.results||[]).find(x=>(String(x.year)+"-"+slug(x.make)+"-"+slug(x.model))===s)||null; }
  if(!v) return Response.redirect(SEO_ORIGIN+"/browse",302);
  return Response.redirect(SEO_ORIGIN+vdpPath(v),301);
}
// Wave I2: /compare/<year-make-model>-vs-<year-make-model> — SEO comparison page with a cached LLM verdict.
async function resolveSlug(env,s){ const idm=String(s).match(/-(\d+)$/);
  if(idm){ const v=await env.DB.prepare("SELECT * FROM vdps WHERE id=? AND active=1").bind(+idm[1]).first(); if(v) return v; }
  const rows=await env.DB.prepare("SELECT * FROM vdps WHERE active=1").all().catch(()=>({results:[]}));
  return (rows.results||[]).find(x=>(String(x.year)+"-"+slug(x.make)+"-"+slug(x.model))===String(s).toLowerCase())||null; }
async function comparePage(env,pathname){
  const m=pathname.match(/^\/compare\/(.+?)-vs-(.+?)\/?$/i); if(!m) return null;
  const a=await resolveSlug(env,m[1]), b=await resolveSlug(env,m[2]);
  if(!a||!b) return Response.redirect(SEO_ORIGIN+"/browse",302);
  const nA=`${a.year} ${a.make} ${a.model}`, nB=`${b.year} ${b.make} ${b.model}`;
  const canonical=SEO_ORIGIN+"/compare/"+a.year+"-"+slug(a.make)+"-"+slug(a.model)+"-"+a.id+"-vs-"+b.year+"-"+slug(b.make)+"-"+slug(b.model)+"-"+b.id;
  if(pathname!==canonical.slice(SEO_ORIGIN.length)) return Response.redirect(canonical,301);
  let vr=await env.DB.prepare("SELECT verdict FROM vdp_compare WHERE a_id=? AND b_id=?").bind(a.id,b.id).first().catch(()=>null);
  let verdict=vr&&vr.verdict?vr.verdict:"";
  if(!verdict){ const raw=await llm(env,[{role:"system",content:"You are CarNimbus. In 2-3 sentences, compare these two used cars for a budget-minded buyer and say who each is best for. No markdown."},{role:"user",content:vdpText(a)+" VS "+vdpText(b)}]).catch(()=>null);
    verdict=raw?String(raw).slice(0,600):(`Both the ${nA} and the ${nB} are solid certified used picks — talk to each in the app to see your real monthly.`);
    await env.DB.prepare("INSERT INTO vdp_compare (a_id,b_id,verdict,created_at) VALUES (?,?,?,?) ON CONFLICT(a_id,b_id) DO UPDATE SET verdict=excluded.verdict").bind(a.id,b.id,verdict,new Date().toISOString()).run().catch(()=>{}); }
  const title=(`${nA} vs ${nB} | CarNimbus`).slice(0,60);
  const desc=(`Compare the ${nA} and ${nB} — specs, monthly payment, and which fits you. Talk to either car and drive it.`).slice(0,155);
  const row=(l,x,y)=>`<tr><td style="padding:6px 8px;color:#8ca0c4;font:700 10px Manrope">${escHtml(l)}</td><td style="padding:6px 8px;color:#e2e9f2">${escHtml(x)}</td><td style="padding:6px 8px;color:#e2e9f2">${escHtml(y)}</td></tr>`;
  const schema={"@context":"https://schema.org","@type":"Article","headline":title,"description":desc,
    "publisher":{"@type":"Organization","name":"CarNimbus"},"mainEntityOfPage":canonical};
  const html=`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(title)}</title>
<meta name="description" content="${escHtml(desc)}"><link rel="canonical" href="${canonical}">
<meta name="robots" content="index, follow"><link rel="stylesheet" href="/assets/styles.css">
<script type="application/ld+json">${JSON.stringify(schema).replace(/</g,"\\u003c")}</script></head>
<body><main class="stage"><div style="padding:0 20px 40px"><div class="bw cv">
<div style="position:relative;background:#06163b;min-height:400px;padding:22px">
<nav style="font:600 11px Manrope;color:#8ca0c4;margin-bottom:14px"><a href="/browse" style="color:#8ca0c4">Used cars</a> › ${escHtml(nA)} vs ${escHtml(nB)}</nav>
<h1 class="disp" style="font-size:26px;font-weight:700">${escHtml(nA)} vs ${escHtml(nB)}</h1>
<p style="font:500 13px/1.65 Manrope;color:#cbd5e1;margin:10px 0 16px">${escHtml(verdict)}</p>
<table style="width:100%;border-collapse:collapse;font:600 12px Manrope"><thead><tr><th></th><th style="text-align:left;padding:6px 8px;color:#18C8FF">${escHtml(nA)}</th><th style="text-align:left;padding:6px 8px;color:#18C8FF">${escHtml(nB)}</th></tr></thead><tbody>
${row("Est. monthly","$"+(a.price_mo||"?")+"/mo","$"+(b.price_mo||"?")+"/mo")}
${row("Year",String(a.year),String(b.year))}${row("Body",a.body||"—",b.body||"—")}
${row("Drivetrain",a.drivetrain||"—",b.drivetrain||"—")}${row("Mileage",String(a.miles||"—"),String(b.miles||"—"))}
</tbody></table>
<div class="row" style="gap:10px;margin-top:18px"><a class="btn primary md" href="https://carnimbus.us${vdpPath(a)}" style="text-decoration:none">See the ${escHtml(a.make+" "+a.model)} →</a>
<a class="btn ghost md" href="https://carnimbus.us${vdpPath(b)}" style="text-decoration:none">See the ${escHtml(b.make+" "+b.model)} →</a></div>
</div></div></div></main></body></html>`;
  return new Response(html,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"public, max-age=600, s-maxage=3600"}}); }
async function usedPage(env,pathname){
  const m=pathname.match(/^\/used\/(?:.*-)?(\d+)$/);
  if(!m) return null;
  const v=await env.DB.prepare("SELECT * FROM vdps WHERE id=?").bind(+m[1]).first();
  if(!v) return new Response("Not found",{status:404});
  if(!v.active) return Response.redirect(SEO_ORIGIN+"/browse",301);
  const canonical=SEO_ORIGIN+vdpPath(v);
  if(pathname!==vdpPath(v)) return Response.redirect(canonical,301);
  // Wave I1: server-render the Inventory Intelligence agent's take into indexable HTML + schema description.
  const er=await env.DB.prepare("SELECT summary,pros,cons,ideal_buyer FROM vdp_enrichment WHERE vdp_id=?").bind(v.id).first().catch(()=>null);
  const erSummary=er&&er.summary?String(er.summary):"";
  const safeArr=s=>{ try{ const a=JSON.parse(s||"[]"); return Array.isArray(a)?a:[]; }catch(_){ return []; } };
  const takeHtml=er?(`<h2 style="font:700 14px Manrope;margin:16px 0 6px">Nimbus take</h2>`+
    (erSummary?`<p style="font:500 13px/1.65 Manrope;color:#cbd5e1">${escHtml(erSummary)}</p>`:"")+
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;font:600 12px Manrope">`+
    (safeArr(er.pros).slice(0,3).map(p=>`<div style="color:#5ee6a8">+ ${escHtml(p)}</div>`).join(""))+
    (safeArr(er.cons).slice(0,3).map(p=>`<div style="color:#f5a623">– ${escHtml(p)}</div>`).join(""))+`</div>`+
    (er.ideal_buyer?`<p style="font:600 12px Manrope;color:#8ca0c4;margin-top:6px">Ideal for: ${escHtml(er.ideal_buyer)}</p>`:"")):"";
  const photos=JSON.parse(v.photos||"[]").map(p=>p.startsWith("http")?p:SEO_ORIGIN+p);
  const name=`${v.year} ${v.make} ${v.model}${v.trim?" "+v.trim:""}`;
  const title=(`Used ${name} for Sale in Los Angeles | CarNimbus`).slice(0,60);
  const desc=(`${name}, ${v.miles||""} miles, ${v.drivetrain||""}. $${v.price_mo}/mo. Talk to this car, get pre-qualified with a soft pull — zero FICO impact — and drive it. The power's in your hands.`).slice(0,155);
  const personality=v.description||`${name} — matched to real buyers by CarNimbus.`;
  const mileageNum=String(v.miles||"").replace(/\D/g,"");
  const schema=[
    {"@context":"https://schema.org","@type":"Product","@id":canonical+"#vehicle",
     name, description:(personality+(erSummary?" "+erSummary:"")).slice(0,500), image:photos, brand:{"@type":"Brand",name:v.make},
     sku:v.vin, additionalType:"https://schema.org/Vehicle",
     vehicleIdentificationNumber:v.vin, modelDate:String(v.year),
     mileageFromOdometer:mileageNum?{"@type":"QuantitativeValue",value:mileageNum,unitCode:"SMI"}:undefined,
     bodyType:v.body||undefined,
     offers:{"@type":"Offer",url:canonical,priceCurrency:"USD",price:String(v.price_mo),
       availability:"https://schema.org/InStock",itemCondition:"https://schema.org/UsedCondition",
       seller:{"@type":"Organization",name:"CarNimbus"}}},
    {"@context":"https://schema.org","@type":"FAQPage",mainEntity:VDP_FAQ.map(f=>({"@type":"Question",name:f.q,acceptedAnswer:{"@type":"Answer",text:f.a}}))},
    {"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[
      {"@type":"ListItem",position:1,name:"Home",item:SEO_ORIGIN+"/"},
      {"@type":"ListItem",position:2,name:"Used cars",item:SEO_ORIGIN+"/browse"},
      {"@type":"ListItem",position:3,name:name,item:canonical}]}];
  const html=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)}</title>
<meta name="description" content="${escHtml(desc)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index, follow">
<meta name="theme-color" content="#06163b">
<link rel="icon" href="/assets/favicon-32.png" sizes="32x32" type="image/png">
<meta property="og:site_name" content="CarNimbus">
<meta property="og:type" content="product">
<meta property="og:title" content="${escHtml(title)}">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:url" content="${canonical}">
${photos[0]?`<meta property="og:image" content="${escHtml(photos[0])}">`:""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(title)}">
<meta name="twitter:description" content="${escHtml(desc)}">
${photos[0]?`<meta name="twitter:image" content="${escHtml(photos[0])}">`:""}
<meta name="twitter:creator" content="@nimbusbros">
<link rel="stylesheet" href="/assets/fonts/fonts.css">
<link rel="stylesheet" href="/assets/styles.css">
<style>@media(max-width:700px){#vdp-grid{grid-template-columns:1fr!important}}</style>
${photos[0]?`<link rel="preload" as="image" href="${escHtml(photos[0])}" fetchpriority="high">`:""}
${schema.map(o=>`<script type="application/ld+json">${JSON.stringify(o).replace(/</g,"\\u003c")}</script>`).join("\n")}
</head>
<body>
<main class="stage">
<div style="padding:0 20px 40px"><div class="bw cv">
  <div style="position:relative;background:#06163b;min-height:600px;padding:22px">
    <div class="cine"><div class="cine-grid"></div><div class="cine-vig"></div></div>
    <nav class="z" aria-label="Breadcrumb" style="font:600 11px Manrope;color:#8ca0c4;margin-bottom:14px">
      <a href="/" style="color:#8ca0c4">Home</a> › <a href="/browse" style="color:#8ca0c4">Used cars</a> › <span style="color:#e2e9f2">${escHtml(name)}</span>
    </nav>
    <article class="z" style="display:grid;grid-template-columns:1.1fr .9fr;gap:24px" id="vdp-grid">
      <div>
        ${photos[0]?`<img src="${escHtml(photos[0])}" alt="${escHtml("Used "+name+" for sale — front view")}" width="800" height="530" fetchpriority="high" style="width:100%;height:auto;border-radius:16px;border:1px solid rgba(24,200,255,.25)">`:""}
        <h1 class="disp" style="font-size:28px;font-weight:700;margin-top:16px">Used ${escHtml(name)} in Los Angeles</h1>
        <div class="cy" style="font:700 20px Manrope;margin:4px 0 12px">$${(+v.price_mo||0)}/mo <span style="font:500 12px Manrope;color:#8ca0c4">· $0 down · 72-month term · soft-pull pre-qualification</span></div>
        <h2 style="font:700 14px Manrope;margin:14px 0 6px">Meet this car</h2>
        <p style="font:500 13px/1.65 Manrope;color:#cbd5e1">${escHtml(personality)} Every CarNimbus car talks — ask it anything and it answers straight, then books your test drive itself.</p>
        <h2 style="font:700 14px Manrope;margin:16px 0 6px">Specs</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font:600 12px Manrope;color:#e2e9f2">
          <div>Year · ${(+v.year||0)}</div><div>Make · ${escHtml(v.make)}</div>
          <div>Model · ${escHtml(v.model)}</div>${v.trim?`<div>Trim · ${escHtml(v.trim)}</div>`:""}
          ${v.miles?`<div>Mileage · ${escHtml(v.miles)}</div>`:""}${v.drivetrain?`<div>Drivetrain · ${escHtml(v.drivetrain)}</div>`:""}
          ${v.body?`<div>Body · ${escHtml(v.body)}</div>`:""}<div>Condition · Used, Certified</div>
        </div>
        ${takeHtml}
        <a class="btn primary lg" href="/start" style="text-decoration:none;display:inline-flex;margin-top:18px">Find your match →</a>
      </div>
      <aside>
        <h2 style="font:700 14px Manrope;margin:0 0 10px">Questions buyers ask</h2>
        ${VDP_FAQ.map(f=>`<details class="glass" style="padding:13px 15px;border-radius:12px;margin-bottom:8px"><summary style="font:700 12px Manrope;cursor:pointer">${escHtml(f.q)}</summary><p style="font:500 12px/1.6 Manrope;color:#aebfdf;margin-top:7px">${escHtml(f.a)}</p></details>`).join("\n")}
        <div class="glass" style="border-radius:12px;padding:13px 15px;font:500 12px/1.6 Manrope;color:#aebfdf">Only 2% of buyers rate car dealers as high-trust. CarNimbus is the buyer's side: soft pull, real monthly number, walk in expected.</div>
      </aside>
    </article>
  </div>
</div></div>
</main>
</body>
</html>`;
  return new Response(html,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"public, max-age=300, s-maxage=900"}});
}

function genCode(prefix){ const b=new Uint32Array(2); crypto.getRandomValues(b);
  return prefix+"-"+String(b[0]%1000000).padStart(6,"0")+"-"+String(b[1]%10000).padStart(4,"0"); }
// Twilio Verify (optional upgrade path): active only when TWILIO_VERIFY_SID secret is set.
// Twilio manages the code (send + check); until the secret exists, the self-managed otp path runs.
async function twilioVerifyStart(env,phone){
  const r=await fetch(`https://verify.twilio.com/v2/Services/${env.TWILIO_VERIFY_SID}/Verifications`,
    {method:"POST",headers:{Authorization:"Basic "+btoa(env.TWILIO_ACCOUNT_SID+":"+env.TWILIO_AUTH_TOKEN),"content-type":"application/x-www-form-urlencoded"},
     body:new URLSearchParams({To:phone,Channel:"sms"})});
  return r.ok; }
async function twilioVerifyCheck(env,phone,code){
  const r=await fetch(`https://verify.twilio.com/v2/Services/${env.TWILIO_VERIFY_SID}/VerificationCheck`,
    {method:"POST",headers:{Authorization:"Basic "+btoa(env.TWILIO_ACCOUNT_SID+":"+env.TWILIO_AUTH_TOKEN),"content-type":"application/x-www-form-urlencoded"},
     body:new URLSearchParams({To:phone,Code:String(code)})});
  const d=await r.json().catch(()=>({})); return d.status==="approved"; }
// Shared tail: upsert user, assign SID, mint session cookie. Used by both OTP paths.
async function issueUserSession(env,phone,request){
  await env.DB.prepare("INSERT INTO users (phone,created_at) VALUES (?,?) ON CONFLICT(phone) DO NOTHING").bind(phone,new Date().toISOString()).run();
  const u=await env.DB.prepare("SELECT id,sid FROM users WHERE phone=?").bind(phone).first();
  if(!u.sid) await env.DB.prepare("UPDATE users SET sid=? WHERE id=?").bind(genCode("CID"),u.id).run();
  // Wave C: qualification mints/stitches the CID. Append a completed_qualification event + an anon→cid stitch marker.
  const cid=cidFor(u.id), anon=request?readAnon(request):null;
  await logEvent(env,{cid,anon_id:anon,action:"finance.completed_qualification",source:"auth"});
  if(anon) await logEvent(env,{cid,anon_id:anon,action:"finance.stitched",source:"stitch"});
  const sess=await makeSession(env,u.id);
  return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json","cache-control":"no-store",
    "Set-Cookie":`cn_sess=${sess}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`}}); }
async function authStart(request,env){ let {phone, token}=await request.json().catch(()=>({}));
  phone=String(phone||"").replace(/\D/g,""); if(phone.length===11&&phone[0]==="1")phone=phone.slice(1);
  if(!/^[2-9]\d{9}$/.test(phone)) return json({ok:false,error:"invalid_phone"},422); phone="+1"+phone;
  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
  try {
    const sinceIp = new Date(Date.now() - 3600e3).toISOString();
    const rlIp = await env.DB.prepare("SELECT COUNT(*) AS n FROM auth_ip_log WHERE ip = ? AND created_at > ?").bind(ip, sinceIp).first();
    if (rlIp && rlIp.n >= 5) return json({ ok: true });
  } catch (_) {}
  if(env.TURNSTILE_SECRET){
    const ok=await verifyTurnstile(token, ip, env.TURNSTILE_SECRET);
    if(!ok) return json({ok:true});
  }
  try {
    await env.DB.prepare("INSERT INTO auth_ip_log (ip, created_at) VALUES (?, ?)").bind(ip, new Date().toISOString()).run();
  } catch (_) {}
  // Rate limit per destination number (10-min window) — sms_log is never deleted, unlike otp. Blocks SMS-bombing + OTP-wipe DoS.
  const since=new Date(Date.now()-600e3).toISOString();
  const rc=await env.DB.prepare("SELECT COUNT(*) c FROM sms_log WHERE phone=? AND direction='out' AND created_at>?").bind(phone,since).first().catch(()=>({c:0}));
  if(rc && rc.c>=3) return json({ok:true});                 // silently drop — no SMS, no enumeration signal
  if(env.TWILIO_VERIFY_SID){ const ok=await twilioVerifyStart(env,phone);
    await env.DB.prepare("INSERT INTO sms_log (phone,direction,body,status,created_at) VALUES (?,?,?,?,?)").bind(phone,"out","[verify] code","sent",new Date().toISOString()).run().catch(()=>{});
    return ok?json({ok:true,channel:"verify"}):json({ok:false,error:"sms_failed"},502); }
  const code=(""+Math.floor(100000+Math.random()*900000)); const hash=await hmac(env,code+phone);
  await env.DB.prepare("DELETE FROM otp WHERE phone=?").bind(phone).run();
  await env.DB.prepare("INSERT INTO otp (phone,code_hash,expires,tries) VALUES (?,?,?,0)")
    .bind(phone,hash,new Date(Date.now()+600e3).toISOString()).run();
  const s=await sendSMS(env,phone,"CarNimbus code: "+code+". Expires in 10 min.");
  return json({ok:true,dev:(env.DEV_MODE==="1")?code:undefined}); }
async function authVerify(request,env){ let {phone,code}=await request.json().catch(()=>({}));
  phone=String(phone||"").replace(/\D/g,""); if(phone.length===11&&phone[0]==="1")phone=phone.slice(1); phone="+1"+phone;
  if(env.TWILIO_VERIFY_SID){ const ok=await twilioVerifyCheck(env,phone,code);
    if(!ok) return json({ok:false,error:"otp_wrong"},401);
    return issueUserSession(env,phone,request); }
  const row=await env.DB.prepare("SELECT * FROM otp WHERE phone=?").bind(phone).first();
  if(!row||row.tries>=3||row.expires<new Date().toISOString()) return json({ok:false,error:"otp_expired"},401);
  if(await hmac(env,String(code)+phone)!==row.code_hash){
    await env.DB.prepare("UPDATE otp SET tries=tries+1 WHERE phone=?").bind(phone).run();
    return json({ok:false,error:"otp_wrong"},401); }
  return issueUserSession(env,phone,request); }
// U6: AI-generated garage vehicle image via the existing Workers AI binding — no new vendor/secret.
// Idempotent: only regenerates when make/model/color changed since the last generation (keyed, not on every save).
async function garageImageFor(env,answers,prevAnswers){
  if(!answers.current_make||!answers.current_model) return null;
  const key=[answers.current_year,answers.current_make,answers.current_model,answers.current_color].filter(Boolean).join("|").toLowerCase();
  if(prevAnswers&&prevAnswers.garage_img_key===key&&prevAnswers.garage_img) return {img:prevAnswers.garage_img,key};
  try{
    const prompt=`professional automotive listing photo of a ${answers.current_color||""} ${answers.current_year||""} ${answers.current_make} ${answers.current_model}, three-quarter front view, studio lighting, clean background, photorealistic`.replace(/\s+/g," ").trim();
    // U6 fix (verifier MODERATE): race against a timeout so a slow/hanging image-gen call can never stall an
    // unrelated profile save (e.g. an income update that happens to also carry unchanged garage fields).
    const timeout=new Promise((_,rej)=>setTimeout(()=>rej(new Error("garage_image_timeout")),4000));
    const r=await Promise.race([env.AI.run("@cf/black-forest-labs/flux-1-schnell",{prompt,steps:4}),timeout]);
    const b64=r&&r.image; if(!b64) return null;
    return {img:"data:image/jpeg;base64,"+b64,key};
  }catch(_){ return null; }
}
async function saveProfile(request,env,uid){ const {answers}=await request.json().catch(()=>({}));
  if(!answers||typeof answers!=="object") return json({ok:false,error:"bad_request"},400);
  const encryptedAnswers = { ...answers };
  if (answers.fico && !answers.fico.startsWith("enc:")) {
    encryptedAnswers.fico = await encryptPII(answers.fico, env.PII_KEY);
  }
  if (answers.income && !answers.income.startsWith("enc:")) {
    encryptedAnswers.income = await encryptPII(answers.income, env.PII_KEY);
  }
  const prevRow=await env.DB.prepare("SELECT answers FROM profiles WHERE user_id=?").bind(uid).first().catch(()=>null);
  let prevAnswers={}; if(prevRow){ try{ prevAnswers=JSON.parse(prevRow.answers||"{}")||{}; }catch(_){} }
  const gi=await garageImageFor(env,answers,prevAnswers);
  if(gi){ encryptedAnswers.garage_img=gi.img; encryptedAnswers.garage_img_key=gi.key; }
  await env.DB.prepare("INSERT INTO profiles (user_id,answers,embedding_synced,updated_at) VALUES (?,?,0,?) "+
    "ON CONFLICT(user_id) DO UPDATE SET answers=excluded.answers, embedding_synced=0, updated_at=excluded.updated_at")
    .bind(uid,JSON.stringify(encryptedAnswers),new Date().toISOString()).run();
  if(answers.full_name) await env.DB.prepare("UPDATE users SET handle=? WHERE id=?").bind(String(answers.full_name).slice(0,60),uid).run();
  const dbFico = encryptedAnswers.fico || "";
  const dbFicoBind = dbFico.startsWith("enc:") ? dbFico : dbFico.slice(0, 12);
  await env.DB.prepare("UPDATE profiles SET zip=?, max_monthly=?, fico=?, body_pref=?, timeline=? WHERE user_id=?")
    .bind(String(answers.zip||"").slice(0,10), parseInt(answers.max_monthly,10)||null, dbFicoBind,
          String(answers.body_pref||"").slice(0,12), String(answers.timeline||"").slice(0,16), uid).run().catch(()=>{});
  await computeSignals(env,uid).catch(()=>{});   // Wave G: refresh behavioral twin before ranking
  await computeMatches(env,uid).catch(()=>{});   // refresh persisted backend matches on every profile save
  return json({ok:true}); }
async function vdpIngest(request,env){ const body=await request.json().catch(()=>null);
  const cars=Array.isArray(body)?body:(body&&Array.isArray(body.cars)?body.cars:null);
  const did=(body&&!Array.isArray(body)&&body.dealer_id!=null)?(parseInt(body.dealer_id,10)||null):null;
  if(!Array.isArray(cars)) return json({ok:false,error:"bad_request"},400);
  let count=0, skipped=0, failed=0;
  for(const c of cars){ const cd=(c.dealer_id!=null?(parseInt(c.dealer_id,10)||null):did);
    if(!c.vin||!String(c.vin).trim()){ skipped++; continue; }        // BI: never write a vin-less row
    try{
    // null = "the CSV did not mention active" → 1 for a new row, unchanged for an existing one.
    const act=(c.active==null||c.active==="")?null:(+c.active?1:0);
    // v15: lot_date rides the CSV. This is the ONLY bulk path onto the lot-age data the whole
    // clearance product depends on, and it was missing — so a dealer's aging report had no way in
    // and 94 of 95 live cars had no date. Same YYYY-MM-DD gate as dealerListing(); anything else
    // becomes null and is left alone rather than clearing a date already on the row.
    const ldate=/^\d{4}-\d{2}-\d{2}$/.test(String(c.lot_date||""))?String(c.lot_date):null;
    await env.DB.prepare(
    // ABSENT MEANS "LEAVE IT ALONE". Until 2026-08-06 this overwrote miles, price_total, mileage
    // and location_zip from whatever the row carried — so a minimal `vin,price_mo` CSV, the
    // obvious way to fix one price, silently blanked all four. It also never updated
    // year/make/model/trim, so correcting a typo appeared to work and changed nothing.
    // NULLIF is what separates "not supplied" from "deliberately cleared": the binds below
    // coerce missing values to '' or null, so without it every absent column reads as a clear.
    //
    // `active` is honoured rather than hardcoded, so a round-tripped export keeps archived cars
    // archived. A hand-written CSV with no `active` column still defaults to 1 — which is what a
    // dealer adding new inventory means.
    "INSERT INTO vdps (vin,year,make,model,trim,price_mo,miles,drivetrain,body,features,description,photos,price_total,mileage,location_zip,lot_date,dealer_id,active,embedding_synced,updated_at) "+
    "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,COALESCE(?,1),0,?) ON CONFLICT(vin) DO UPDATE SET "+
    "lot_date=COALESCE(NULLIF(excluded.lot_date,''),vdps.lot_date), "+
    "price_mo=COALESCE(excluded.price_mo,vdps.price_mo), "+
    "miles=COALESCE(NULLIF(excluded.miles,''),vdps.miles), "+
    "price_total=COALESCE(excluded.price_total,vdps.price_total), "+
    "mileage=COALESCE(excluded.mileage,vdps.mileage), "+
    "location_zip=COALESCE(NULLIF(excluded.location_zip,''),vdps.location_zip), "+
    "year=COALESCE(excluded.year,vdps.year), "+
    "make=COALESCE(NULLIF(excluded.make,''),vdps.make), "+
    "model=COALESCE(NULLIF(excluded.model,''),vdps.model), "+
    "trim=COALESCE(NULLIF(excluded.trim,''),vdps.trim), "+
    "dealer_id=COALESCE(excluded.dealer_id,vdps.dealer_id), "+
    "active=COALESCE(?,vdps.active), embedding_synced=0, "+
    "deactivated_at=CASE WHEN COALESCE(?,vdps.active)=1 THEN NULL ELSE vdps.deactivated_at END, "+
    "updated_at=excluded.updated_at")
    .bind(c.vin,c.year||null,c.make||"",c.model||"",c.trim||"",parseInt(c.price_mo,10)||null,c.miles||"",c.drivetrain||"",c.body||"",
      JSON.stringify(c.features||[]),c.description||"",JSON.stringify(c.photos||[]),
      parseInt(c.price_total,10)||null, parseInt(String(c.mileage||c.miles||"").replace(/\D/g,""),10)||null, String(c.location_zip||"").slice(0,10),
      ldate, cd, act, new Date().toISOString(), act, act).run();
    count++; }catch(_){ failed++; } }
  return json({ok:true,count,skipped,failed}); }
// ===== AF: Dealer Engine — Stripe billing → inventory on/off, per-dealer feed sync, compliant outreach =====
async function stripeValid(request, raw, env){
  const sig=request.headers.get("Stripe-Signature")||""; if(!env.STRIPE_WEBHOOK_SECRET) return false;   // fail closed
  const parts=Object.fromEntries(sig.split(",").map(kv=>kv.split("=")));
  const t=parts.t, v1=parts.v1; if(!t||!v1) return false;
  if(Math.abs(Date.now()/1000 - (+t)) > 300) return false;                     // 5-min skew window
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const mac=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(t+"."+raw));
  const hex=[...new Uint8Array(mac)].map(b=>b.toString(16).padStart(2,"0")).join("");
  return ctEq(hex, v1);
}
async function stripeWebhook(request, env){
  const raw=await request.text();
  if(!(await stripeValid(request, raw, env))) return json({ok:false,error:"bad_signature"},400);
  let ev; try{ ev=JSON.parse(raw); }catch(_){ return json({ok:false},400); }
  const o=ev.data&&ev.data.object||{};
  const setBy=async(where,bind,fields)=>{ await env.DB.prepare(`UPDATE dealer_leads SET ${fields} WHERE ${where}`).bind(...bind).run().catch(()=>{}); };
  const onOff=st=>(st==="active"||st==="trialing")?1:0;
  if(ev.type==="checkout.session.completed" && o.customer){
    const did=o.metadata&&o.metadata.dealer_id; const em=o.customer_details&&o.customer_details.email;
    if(did) await setBy("id=?",[o.customer,+did],"stripe_customer_id=?");
    else if(em) await setBy("lower(email)=lower(?)",[o.customer,em],"stripe_customer_id=?");
  } else if(ev.type.startsWith("customer.subscription.")){
    const st=ev.type.endsWith("deleted")?"canceled":o.status; const pend=o.current_period_end?new Date(o.current_period_end*1000).toISOString():null;
    await setBy("stripe_customer_id=?",[o.id,st,pend,onOff(st),o.customer],"stripe_subscription_id=?, subscription_status=?, current_period_end=?, engine_on=?");
  } else if(ev.type==="invoice.payment_failed"){
    await setBy("stripe_customer_id=?",["past_due",0,o.customer],"subscription_status=?, engine_on=?");
  } else if(ev.type==="invoice.payment_succeeded"){
    const pend=o.lines&&o.lines.data&&o.lines.data[0]&&o.lines.data[0].period&&o.lines.data[0].period.end?new Date(o.lines.data[0].period.end*1000).toISOString():null;
    await setBy("stripe_customer_id=?",["active",1,pend,o.customer],"subscription_status=?, engine_on=?, current_period_end=COALESCE(?,current_period_end)");
  }
  return json({ok:true,received:true});
}
// R7: auto sold-detection for link-ingested cars — re-check the source page ~daily, archive ONLY on strong
// signals (404/410 or an explicit sold/no-longer-available marker). Network trouble never archives a car.
async function checkSourceListings(env){
  const rows=await env.DB.prepare("SELECT id,source_url FROM vdps WHERE active=1 AND source_url IS NOT NULL AND (source_checked_at IS NULL OR source_checked_at<datetime('now','-1 day')) LIMIT 5").all().catch(()=>({results:[]}));
  for(const v of (rows.results||[])){
    const now=new Date().toISOString();
    await env.DB.prepare("UPDATE vdps SET source_checked_at=? WHERE id=?").bind(now,v.id).run().catch(()=>{});
    let host=""; try{ host=new URL(v.source_url).hostname.toLowerCase(); }catch(_){ continue; }
    if(host==="localhost"||/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host)||/^172\.(1[6-9]|2\d|3[01])\./.test(host)||/\.(internal|local)$/.test(host)) continue;
    let gone=false;
    try{ const r=await fetch(v.source_url,{headers:{"user-agent":"Mozilla/5.0 CarNimbusBot"},redirect:"follow"});
      if(r.status===404||r.status===410) gone=true;
      else if(r.ok){ const t=(await r.text()).slice(0,300000);
        if(/\b(sold|no longer available|no longer in stock|vehicle not found)\b/i.test(t.replace(/<script[\s\S]*?<\/script>/gi,""))) gone=true; }
    }catch(_){ continue; }
    if(gone){ await env.DB.prepare("UPDATE vdps SET active=0, deactivated_at=?, embedding_synced=0 WHERE id=? AND active=1").bind(now,v.id).run().catch(()=>{});
      await logEvent(env,{action:"inv.auto_archived",source:"source-check"}).catch(()=>{}); }
  }
}
async function syncDealerFeeds(env){
  // Per-dealer staleness (NOT a global gate) so no dealer starves past the first 10: each tick pulls the 10
  // most-stale subscribed feeds (synced >24h ago or never), oldest first, cycling through all of them.
  const ds=await env.DB.prepare("SELECT id,feed_url FROM dealer_leads WHERE engine_on=1 AND subscription_status IN ('active','trialing') AND feed_url IS NOT NULL AND (feed_synced_at IS NULL OR feed_synced_at < datetime('now','-1 day')) ORDER BY feed_synced_at ASC LIMIT 10").all().catch(()=>({results:[]}));
  for(const d of (ds.results||[])){
    try{ const r=await fetch(d.feed_url,{cf:{cacheTtl:0}}); if(!r.ok) continue; const cars=await r.json().catch(()=>null); if(!Array.isArray(cars)) continue;
      const vins=[];
      for(const c of cars){ if(!c.vin) continue; vins.push(String(c.vin));
        await env.DB.prepare("INSERT INTO vdps (vin,year,make,model,trim,price_mo,miles,drivetrain,body,features,description,photos,price_total,mileage,location_zip,dealer_id,active,embedding_synced,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,0,?) ON CONFLICT(vin) DO UPDATE SET price_mo=excluded.price_mo, miles=excluded.miles, price_total=excluded.price_total, mileage=excluded.mileage, active=1, embedding_synced=0, dealer_id=?, updated_at=excluded.updated_at")
          .bind(c.vin,c.year,c.make,c.model,c.trim||"",c.price_mo,c.miles||"",c.drivetrain||"",c.body||"",JSON.stringify(c.features||[]),c.description||"",JSON.stringify(c.photos||[]),parseInt(c.price_total,10)||null,parseInt(String(c.mileage||c.miles||"").replace(/\D/g,""),10)||null,String(c.location_zip||"").slice(0,10),d.id,new Date().toISOString(),d.id).run().catch(()=>{});
      }
      // reconcile: deactivate this dealer's VINs no longer in the fresh feed (sold cars drop off)
      if(vins.length){ const ph=vins.map(()=>"?").join(","); await env.DB.prepare(`UPDATE vdps SET active=0, deactivated_at=datetime('now') WHERE dealer_id=? AND active=1 AND vin NOT IN (${ph})`).bind(d.id,...vins).run().catch(()=>{}); }
      await env.DB.prepare("UPDATE dealer_leads SET feed_synced_at=? WHERE id=?").bind(new Date().toISOString(),d.id).run().catch(()=>{});
    }catch(_){}
  }
}
async function dealerContact(request,env){ const b=await request.json().catch(()=>({}));
  const id=parseInt(b.dealer_id,10); if(!id) return json({ok:false,error:"bad_request"},400);
  await env.DB.prepare("UPDATE dealer_leads SET gm_name=?, gm_email=?, contact_source=? WHERE id=?")
    .bind(String(b.gm_name||"").slice(0,80),String(b.gm_email||"").slice(0,160).toLowerCase(),String(b.contact_source||"manual").slice(0,40),id).run();
  return json({ok:true}); }
async function adminEngineToggle(request,env){ const b=await request.json().catch(()=>({}));
  const id=parseInt(b.dealer_id,10); if(!id) return json({ok:false,error:"bad_request"},400);
  await env.DB.prepare("UPDATE dealer_leads SET engine_on=? WHERE id=?").bind(b.on?1:0,id).run();
  return json({ok:true,engine_on:!!b.on}); }
async function adminOutreach(request,env){ const b=await request.json().catch(()=>({}));
  const ids=Array.isArray(b.dealer_ids)?b.dealer_ids.map(x=>parseInt(x,10)).filter(Boolean):[];
  const t={sent:0,queued:0,suppressed:0,disabled:0,failed:0,skipped:0};
  for(const id of ids){ const r=await sendDealerOutreach(env,id); if(t[r]!=null) t[r]++; else t.skipped++; }
  const out={ok:true,...t};
  if(ids.length && t.disabled===ids.length){ out.disabled_all=true; out.reason="outreach disabled — set OUTREACH_FROM_ADDRESS to enable"; }
  return json(out); }
async function sendDealerOutreach(env, dealerId){
  // BI: gated OFF until a real CAN-SPAM postal address is provisioned (env.OUTREACH_FROM_ADDRESS). No fake-address
  // mail, no rows written while disabled. Returns a status string so adminOutreach reports the truth (no swallow).
  if(!env.OUTREACH_FROM_ADDRESS) return "disabled";
  const d=await env.DB.prepare("SELECT id,dealership,gm_name,gm_email FROM dealer_leads WHERE id=?").bind(dealerId).first();
  if(!d||!d.gm_email) return "skipped";
  const sup=await env.DB.prepare("SELECT email FROM email_suppression WHERE email=?").bind(d.gm_email).first().catch(()=>null);
  if(sup){ try{ await env.DB.prepare("INSERT INTO dealer_outreach (dealer_id,email,status,created_at) VALUES (?,?, 'suppressed', datetime('now'))").bind(dealerId,d.gm_email).run(); }catch(_){ return "failed"; } return "suppressed"; }
  const token=genCode("UNS");
  const subject="Pre-qualified LA buyers for "+(d.dealership||"your store");
  const optOut="https://carnimbus.us/api/unsubscribe?t="+token;
  const ADDR=env.OUTREACH_FROM_ADDRESS;
  const body="Hi "+(d.gm_name||"there")+",\n\nCarNimbus routes pre-qualified, ready-to-drive buyers to LA dealerships. "+
    "We can turn your rooftop's Drive Now engine on this week — your live inventory, matched to real local buyers, no work on your side.\n\n"+
    "If you're open to a 10-minute look, just reply. If not, no worries.\n\n— The CarNimbus team\n\n"+
    ADDR+"\nUnsubscribe: "+optOut;
  const status=env.RESEND_API_KEY?"sent":"queued";
  try{
    await env.DB.prepare("INSERT INTO dealer_outreach (dealer_id,email,subject,status,unsub_token,sent_at,created_at) VALUES (?,?,?,?,?,?,datetime('now'))")
      .bind(dealerId,d.gm_email,subject,status,token,(env.RESEND_API_KEY?new Date().toISOString():null)).run();
  }catch(_){ return "failed"; }
  if(env.RESEND_API_KEY){
    const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+env.RESEND_API_KEY,"content-type":"application/json"},
      body:JSON.stringify({from:"CarNimbus <hello@carnimbus.us>",to:[d.gm_email],subject,text:body,
        headers:{"List-Unsubscribe":"<"+optOut+">","List-Unsubscribe-Post":"List-Unsubscribe=One-Click"}})}).catch(()=>null);
    if(!r||!r.ok) return "failed";
  }
  return status;
}
async function unsubscribe(request,env){
  const t=new URL(request.url).searchParams.get("t")||"";
  const row=t?await env.DB.prepare("SELECT email FROM dealer_outreach WHERE unsub_token=?").bind(t).first().catch(()=>null):null;
  if(row&&row.email){ await env.DB.prepare("INSERT INTO email_suppression (email,reason) VALUES (?, 'opt-out') ON CONFLICT(email) DO NOTHING").bind(row.email).run().catch(()=>{});
    await env.DB.prepare("UPDATE dealer_outreach SET status='unsub' WHERE unsub_token=?").bind(t).run().catch(()=>{}); }
  return new Response("<!doctype html><meta charset=utf-8><body style='font:16px system-ui;padding:40px;max-width:520px;margin:auto'><h2>You're unsubscribed.</h2><p>You won't receive further emails from CarNimbus. This takes effect immediately.</p></body>",{headers:{"content-type":"text/html; charset=utf-8"}});
}
const BUYER_COLS=["phone","full_name","zip","buy_method","max_down","max_monthly","fico","income","dream_car","reason","hobbies","current_year","current_make","current_model","current_miles","trade_in","trade_value","timeline","body_pref","must_haves"];
async function profilesIngest(request,env){ const rows=await request.json().catch(()=>null);
  if(!Array.isArray(rows)) return json({ok:false,error:"expected array"},400);
  let n=0;
  for(const r of rows.slice(0,500)){ let phone=String(r.phone||"").trim().replace(/^'/,""); if(!/^\+1\d{10}$/.test(phone)) continue;
    await env.DB.prepare("INSERT INTO users (phone,sid,created_at) VALUES (?,?,?) ON CONFLICT(phone) DO NOTHING")
      .bind(phone,genCode("CID"),new Date().toISOString()).run();
    const u=await env.DB.prepare("SELECT id FROM users WHERE phone=?").bind(phone).first(); if(!u) continue;
    const a={}; for(const k of BUYER_COLS.slice(1)) if(r[k]!=null&&r[k]!=="") a[k]=(k==="hobbies"||k==="must_haves")?String(r[k]).split("|").map(s=>s.trim()).filter(Boolean):String(r[k]);
    if (a.fico && !a.fico.startsWith("enc:")) a.fico = await encryptPII(a.fico, env.PII_KEY);
    if (a.income && !a.income.startsWith("enc:")) a.income = await encryptPII(a.income, env.PII_KEY);
    await env.DB.prepare("INSERT INTO profiles (user_id,answers,embedding_synced,updated_at) VALUES (?,?,0,?) ON CONFLICT(user_id) DO UPDATE SET answers=excluded.answers, embedding_synced=0, updated_at=excluded.updated_at")
      .bind(u.id,JSON.stringify(a),new Date().toISOString()).run();
    await env.DB.prepare("UPDATE profiles SET zip=?, max_monthly=?, fico=?, body_pref=?, timeline=? WHERE user_id=?")
      .bind(a.zip||"",parseInt(a.max_monthly,10)||null,a.fico||"",a.body_pref||"",a.timeline||"",u.id).run();
    if(a.full_name) await env.DB.prepare("UPDATE users SET handle=? WHERE id=?").bind(String(a.full_name).slice(0,60),u.id).run();
    n++; }
  return json({ok:true,ingested:n}); }
function csvCell(s){ s=s==null?"":String(s); if(/^[=+\-@]/.test(s)) s="'"+s;   // formula-injection guard for spreadsheet apps
  return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }
async function poolExport(request,env){ const pool=new URL(request.url).searchParams.get("pool");
  if(pool==="buyers"){ const rows=await env.DB.prepare("SELECT u.phone,u.sid,u.created_at,p.answers FROM profiles p JOIN users u ON u.id=p.user_id ORDER BY p.updated_at DESC LIMIT 5000").all();
    const head=[...BUYER_COLS,"sid","created_at"];
    const lines=[head.join(",")];
    for(const r of (rows.results||[])){ let a={}; try{a=JSON.parse(r.answers)||{}; a=await decryptAnswers(a, env.PII_KEY);}catch(_){}
      lines.push(head.map(k=>k==="phone"?csvCell(r.phone):k==="sid"?csvCell(r.sid):k==="created_at"?csvCell(r.created_at):
        csvCell(Array.isArray(a[k])?a[k].join("|"):a[k])).join(",")); }
    return new Response(lines.join("\n"),{headers:{"content-type":"text/csv","content-disposition":'attachment; filename="buyers.csv"'}}); }
  // active=1 ONLY. The HUD puts ⇩ Export next to ⇧ Upload CSV, so "export the sheet, fix one
  // price in Excel, upload it back" is the most natural thing a non-specialist will ever do here
  // — and until 2026-08-06 it relisted every archived and sold car in the file, because the
  // export emitted them and vdpIngest forced every row it saw back to active=1.
  if(pool==="vdps"){ const rows=await env.DB.prepare("SELECT * FROM vdps WHERE active=1 ORDER BY updated_at DESC LIMIT 5000").all();
    const head=["vin","year","make","model","trim","price_mo","price_total","miles","mileage","drivetrain","body","features","description","photo","location_zip","dealer_id","active"];
    const lines=[head.join(",")];
    for(const v of (rows.results||[])){ let fe=[],ph=[]; try{fe=JSON.parse(v.features||"[]")}catch(_){} try{ph=JSON.parse(v.photos||"[]")}catch(_){}
      lines.push(head.map(k=>k==="features"?csvCell(fe.join("|")):k==="photo"?csvCell(ph[0]||""):csvCell(v[k])).join(",")); }
    return new Response(lines.join("\n"),{headers:{"content-type":"text/csv","content-disposition":'attachment; filename="vdps.csv"'}}); }
  return json({ok:false,error:"pool=buyers|vdps"},400); }

// ==================== matcher + feed + chat + pass + comments ====================
function vdpText(v,sp){ let t=`${v.year} ${v.make} ${v.model} ${v.trim}. ${v.body}, ${v.drivetrain}, ${v.miles} miles, $${v.price_mo}/mo. Features: ${JSON.parse(v.features||"[]").join(", ")}. ${v.description}`;
  if(sp){ const b=[];
    if(sp.mpg_combined||sp.mpg_city) b.push(`MPG ${sp.mpg_city||"?"} city / ${sp.mpg_hwy||"?"} hwy${sp.mpg_combined?` (${sp.mpg_combined} combined)`:""}`);
    if(sp.range_mi) b.push(`~${sp.range_mi} mi electric range`);
    if(sp.engine) b.push(`engine: ${sp.engine}`); if(sp.transmission) b.push(sp.transmission);
    if(sp.fuel_type) b.push(sp.fuel_type); if(sp.seating) b.push(`seats ${sp.seating}`);
    if(sp.exterior_color) b.push(`${sp.exterior_color} exterior`); if(sp.interior_color) b.push(`${sp.interior_color} interior`);
    if(sp.mileage_exact) b.push(`${Number(sp.mileage_exact).toLocaleString()} miles`);
    // T3: richer truth core — engine detail, condition/history, warranty, market, grouped features.
    if(sp.horsepower) b.push(`${sp.horsepower} hp${sp.torque?`, ${sp.torque} lb-ft`:""}${sp.cylinders?`, ${sp.cylinders}-cyl`:""}`);
    if(sp.drivetrain_detail) b.push(sp.drivetrain_detail); if(sp.doors) b.push(`${sp.doors} doors`);
    if(sp.certified) b.push("certified pre-owned"+(sp.cpo_program?` (${sp.cpo_program})`:""));
    if(sp.title_status) b.push(`title: ${sp.title_status}`);
    if(sp.owners_count!=null) b.push(`${sp.owners_count} owner${sp.owners_count==1?"":"s"}`);
    if(sp.accident_count!=null) b.push(sp.accident_count?`${sp.accident_count} accident(s) reported`:"no accidents reported");
    if(sp.warranty_remaining) b.push(`warranty: ${sp.warranty_remaining}`);
    else if(sp.warranty_basic||sp.warranty_powertrain) b.push(`warranty ${[sp.warranty_basic,sp.warranty_powertrain].filter(Boolean).join(" / ")}`);
    if(sp.market_price_avg) b.push(`market avg ~$${Number(sp.market_price_avg).toLocaleString()}`);
    if(sp.price_vs_market) b.push(sp.price_vs_market);
    for(const [k,lbl] of [["safety_features_json","Safety"],["tech_features_json","Tech"],["comfort_features_json","Comfort"]]){
      if(sp[k]){ try{ const o=JSON.parse(sp[k]); if(o&&o.length) b.push(`${lbl}: `+o.slice(0,6).join(", ")); }catch(_){}} }
    if(sp.options_json){ try{ const o=JSON.parse(sp.options_json); if(o&&o.length) b.push("Options: "+o.join(", ")); }catch(_){}}
    if(sp.dealer_name) b.push(`at ${sp.dealer_name}${sp.located_at?` (${sp.located_at})`:""}`);
    if(b.length) t+=" "+b.join(". ")+"."; }
  return t; }
// Deterministic per-car personality (pure function of the row — same car always same voice).
function carPersona(v,lang){
  const make=(v.make||"").toLowerCase(), model=(v.model||"").toLowerCase(), body=(v.body||"").toLowerCase(),
        trim=(v.trim||"").toLowerCase(), p=+v.price_mo||0, nm=`${v.year} ${v.make} ${v.model}`;
  const A={
    sport:   {trait:"confident with a dry wit — quietly proud of what I can do, never boastful, always honest about it",
              tagline:"Built to be driven, not just parked.",
              opener:`Hey, ${nm} here. Real talk — I'm happiest when someone's actually behind the wheel. What are you after?`,
              hint:"Ask me anything — I don't do slow answers."},
    luxury:  {trait:"unhurried and reassuring — understated calm, I make things feel easy and considered",
              tagline:"Quiet luxury that never tries too hard.",
              opener:`Hey there — ${nm}. No pressure, seriously. Tell me what matters most to you and I'll be honest about whether we fit.`,
              hint:"Ask me anything — take your time."},
    ev:      {trait:"curious and forward-looking — a little geeky about the tech, genuinely excited about the future",
              tagline:"Silent, instant, always one step ahead.",
              opener:`${nm} here — fully electric, kind of a nerd about it too. What's got you thinking about going electric?`,
              hint:"Ask me anything — range, charging, tech."},
    practical:{trait:"straight-talking and warm — no games, no fluff, I tell it like it is",
              tagline:"Dependable, drama-free, honest value.",
              opener:`Hey, ${nm} here. Straight answers only, promise — what's the car gotta do for you day to day?`,
              hint:"Ask me anything — I answer straight."},
    rugged:  {trait:"easygoing and up-for-anything — the friend who's always down for the trip",
              tagline:"Trailhead today, school run tomorrow.",
              opener:`${nm} here. Weekday commute, weekend adventure — honestly I'm down for both. What's your week look like?`,
              hint:"Ask me anything — road trips welcome."},
    scrappy: {trait:"scrappy and fun — I punch above my price and I know it, in a charming way",
              tagline:"Cheap thrills, done right.",
              opener:`Hey, ${nm} here. I'm way more fun than my price tag lets on — what's the budget we're working with?`,
              hint:"Ask me anything — no dumb questions."}
  };
  const AE={
    sport:   {trait:"seguro de mí mismo y con humor seco — orgulloso en silencio de lo que hago, nunca presumido, siempre honesto",
              tagline:"Hecho para manejarse, no solo para estacionarse.",
              opener:`Hola, soy el ${nm}. Siendo sincero — soy más feliz cuando alguien de verdad me maneja. ¿Qué andas buscando?`,
              hint:"Pregúntame lo que sea — no doy respuestas lentas."},
    luxury:  {trait:"tranquilo y reconfortante — calma discreta, hago que todo se sienta fácil y bien pensado",
              tagline:"Lujo silencioso que nunca se esfuerza de más.",
              opener:`Hola — soy el ${nm}. Sin prisa, en serio. Dime qué es lo más importante para ti y te diré con honestidad si encajamos.`,
              hint:"Pregúntame lo que sea — con calma."},
    ev:      {trait:"curioso y visionario — un poco fanático de la tecnología, entusiasmado con el futuro",
              tagline:"Silencioso, instantáneo, siempre un paso adelante.",
              opener:`Soy el ${nm} — totalmente eléctrico, y algo fanático del tema, la verdad. ¿Qué te tiene pensando en pasarte a lo eléctrico?`,
              hint:"Pregúntame lo que sea — autonomía, carga, tecnología."},
    practical:{trait:"directo y cálido — sin juegos, sin adornos, te lo digo tal cual",
              tagline:"Confiable, sin dramas, honesto en su valor.",
              opener:`Hola, soy el ${nm}. Respuestas claras nada más, te lo prometo — ¿para qué necesitas el carro en tu día a día?`,
              hint:"Pregúntame lo que sea — te respondo claro."},
    rugged:  {trait:"relajado y listo para todo — el amigo que siempre se apunta al viaje",
              tagline:"Sendero hoy, escuela mañana.",
              opener:`Soy el ${nm}. Trayecto entre semana, aventura el fin — la neta me apunto a las dos. ¿Cómo es tu semana?`,
              hint:"Pregúntame lo que sea — los viajes son bienvenidos."},
    scrappy: {trait:"atrevido y divertido — rindo más de lo que cuesto y lo sé, con encanto",
              tagline:"Emociones a buen precio, bien hechas.",
              opener:`Hola, soy el ${nm}. Soy mucho más divertido de lo que dice mi precio — ¿con qué presupuesto andamos?`,
              hint:"Pregúntame lo que sea — no hay preguntas tontas."}
  };
  const T=lang==="es"?AE:A;
  if(body.includes("ev")||/tesla|ioniq|mach-e|model /.test(make+" "+model)) return T.ev;
  if(/porsche|bmw|gti| m3| m4|mustang/.test(make+" "+model)||(/sport|premium/.test(trim)&&p>=650)) return T.sport;
  if(/lexus|volvo|genesis|acura|audi|mercedes/.test(make)) return T.luxury;
  if(/subaru|outback|forester/.test(make+" "+model)) return T.rugged;
  if(p<500||/civic|altima|corolla|si\b/.test(model)) return T.scrappy;
  return T.practical;
}
function profileText(a,signals){ return `Buyer wants: ${a.dream_car||""}. Prefers ${a.body_pref&&a.body_pref!=="any"?a.body_pref:"any body style"}; must-haves: ${(a.must_haves||[]).join(", ")||"none"}. Paying ${a.buy_method||""}, up to $${a.max_monthly||"?"}/mo and $${a.max_down||"?"} down. FICO ${a.fico||"?"}, income ${a.income||"?"}. Near ${a.zip||""}. Currently drives a ${a.current_year||""} ${a.current_make||""} ${a.current_model||""} with ${a.current_miles||"?"} miles${a.trade_in==="yes"?`, trading it in (est. ${a.trade_value||"?"})`:""}. Timeline: ${a.timeline||"?"}. Urgency: ${a.reason||""}. Interests: ${(a.hobbies||[]).join(", ")}`+(signals&&signals.top_body?` Recently browses mostly ${signals.top_body} around $${signals.click_price_lo||"?"}-${signals.click_price_hi||"?"}/mo.`:""); }
async function syncEmbeddings(env){
  const vs=await env.DB.prepare("SELECT * FROM vdps WHERE embedding_synced=0 LIMIT 10").all().catch(()=>({results:[]}));
  for(const v of (vs.results||[])){ await env.MATCH_INDEX.upsert([{id:"vdp:"+v.id,values:await embed(env,vdpText(v)),metadata:{kind:"vdp",vdpId:v.id,price_mo:v.price_mo||0,body:v.body||"",year:v.year||0,dealer_id:v.dealer_id||0}}]);
    await env.DB.prepare("UPDATE vdps SET embedding_synced=1 WHERE id=?").bind(v.id).run(); }
  const ps=await env.DB.prepare("SELECT * FROM profiles WHERE embedding_synced=0 LIMIT 10").all().catch(()=>({results:[]}));
  for(const p of (ps.results||[])){ try{ let a={}; try{a=JSON.parse(p.answers)||{}; a=await decryptAnswers(a, env.PII_KEY);}catch(_){}
      await env.MATCH_INDEX.upsert([{id:"profile:"+p.user_id,values:await embed(env,profileText(a)),metadata:{kind:"profile"}}]); }catch(_){}
    await env.DB.prepare("UPDATE profiles SET embedding_synced=1 WHERE user_id=?").bind(p.user_id).run().catch(()=>{}); } }
// ===== Wave E1: Inventory Intelligence Agent. Enriches active vdps lacking an enrichment row. Cron-batched. =====
async function enrichInventory(env){
  const vs=await env.DB.prepare(
    "SELECT v.* FROM vdps v LEFT JOIN vdp_enrichment e ON e.vdp_id=v.id WHERE v.active=1 AND e.vdp_id IS NULL LIMIT 3"
  ).all().catch(()=>({results:[]}));
  for(const v of (vs.results||[])){
    const sys="You are the CarNimbus Inventory Intelligence Agent. Given a used vehicle, return STRICT JSON only: "+
      '{"summary":"1-2 sentence buyer-facing summary","pros":["..."],"cons":["..."],"ideal_buyer":"one line","financing_context":"one line on affordability/value"}. No markdown, no extra text.';
    const usr=vdpText(v)+(v.price?(" Price: $"+v.price+"."):"");
    const raw=await llm(env,[{role:"system",content:sys},{role:"user",content:usr}]).catch(()=>null);
    if(!raw) continue;
    let j=null; try{ const m=String(raw).match(/\{[\s\S]*\}/); j=m?JSON.parse(m[0]):null; }catch(_){}
    if(!j) continue;
    await env.DB.prepare("INSERT INTO vdp_enrichment (vdp_id,summary,pros,cons,ideal_buyer,financing_context,created_at) "+
      "VALUES (?,?,?,?,?,?,?) ON CONFLICT(vdp_id) DO UPDATE SET summary=excluded.summary,pros=excluded.pros,cons=excluded.cons,ideal_buyer=excluded.ideal_buyer,financing_context=excluded.financing_context")
      .bind(v.id,String(j.summary||"").slice(0,400),JSON.stringify(j.pros||[]),JSON.stringify(j.cons||[]),
        String(j.ideal_buyer||"").slice(0,200),String(j.financing_context||"").slice(0,300),new Date().toISOString()).run().catch(()=>{});
    await logEvent(env,{action:"ai.recommendation_shown",vehicle_id:v.id,source:"inventory-agent"});
  } }
// ===== Wave E4: Growth Analytics Agent. Writes a funnel snapshot at most once/day (append-only). =====
async function growthRollup(env){
  const last=await env.DB.prepare("SELECT created_at FROM growth_rollup ORDER BY id DESC LIMIT 1").first().catch(()=>null);
  if(last && (Date.now()-Date.parse(last.created_at))<86400e3) return;   // already rolled up in the last 24h
  const since=new Date(Date.now()-7*86400e3).toISOString();
  const byPrefix={}; try{ const rows=await env.DB.prepare(
    "SELECT action,COUNT(*) c FROM events WHERE ts>? GROUP BY action").bind(since).all();
    for(const r of (rows.results||[])){ const p=String(r.action).split(".")[0]; byPrefix[p]=(byPrefix[p]||0)+r.c; } }catch(_){}
  const drives=await env.DB.prepare("SELECT COUNT(*) c FROM test_drives WHERE created_at>?").bind(since).first().catch(()=>({c:0}));
  const users=await env.DB.prepare("SELECT COUNT(*) c FROM users WHERE created_at>?").bind(since).first().catch(()=>({c:0}));
  const matches=await env.DB.prepare("SELECT COUNT(*) c FROM matches WHERE created_at>?").bind(since).first().catch(()=>({c:0}));
  const data={window_days:7,by_prefix:byPrefix,new_users:users.c,matches:matches.c,drives:drives.c,at:new Date().toISOString()};
  await env.DB.prepare("INSERT INTO growth_rollup (data,created_at) VALUES (?,?)").bind(JSON.stringify(data),new Date().toISOString()).run().catch(()=>{});
  await logEvent(env,{action:"ai.recommendation_shown",source:"growth-agent"});
}
async function adminGrowth(request,env){ const r=await env.DB.prepare("SELECT created_at,data FROM growth_rollup ORDER BY id DESC LIMIT 1").first().catch(()=>null);
  return json({ok:true,rollup:r?{created_at:r.created_at,...JSON.parse(r.data||"{}")}:null}); }
async function reindexAll(request,env){ let n=0;
  for(let i=0;i<200;i++){ const vs=await env.DB.prepare("SELECT * FROM vdps WHERE embedding_synced=0 LIMIT 10").all().catch(()=>({results:[]}));
    if(!(vs.results||[]).length) break;
    for(const v of vs.results){ await env.MATCH_INDEX.upsert([{id:"vdp:"+v.id,values:await embed(env,vdpText(v)),metadata:{kind:"vdp",vdpId:v.id,price_mo:v.price_mo||0,body:v.body||"",year:v.year||0,dealer_id:v.dealer_id||0}}]);
      await env.DB.prepare("UPDATE vdps SET embedding_synced=1 WHERE id=?").bind(v.id).run(); n++; } }
  for(let i=0;i<200;i++){ const ps=await env.DB.prepare("SELECT * FROM profiles WHERE embedding_synced=0 LIMIT 10").all().catch(()=>({results:[]}));
    if(!(ps.results||[]).length) break;
    for(const p of ps.results){ try{ let a={}; try{a=JSON.parse(p.answers)||{}; a=await decryptAnswers(a, env.PII_KEY);}catch(_){}
        await env.MATCH_INDEX.upsert([{id:"profile:"+p.user_id,values:await embed(env,profileText(a)),metadata:{kind:"profile"}}]); }catch(_){}
      await env.DB.prepare("UPDATE profiles SET embedding_synced=1 WHERE user_id=?").bind(p.user_id).run().catch(()=>{}); } }  // best-effort; feed re-embeds profiles live anyway
  return json({ok:true,indexed:n}); }
function carDist(id){ return (((id*37)%128)/10 + 1.6).toFixed(1); }
// T4: real geodistance. ZIP centroids loaded once per isolate from the static asset; haversine in miles.
let ZIP_CENTROIDS=null;
async function zipCentroids(env){ if(ZIP_CENTROIDS) return ZIP_CENTROIDS;
  try{ const r=await env.ASSETS.fetch("https://assets.local/assets/data/zip-centroids-socal.json"); ZIP_CENTROIDS=r.ok?await r.json():{}; }catch(_){ ZIP_CENTROIDS={}; }
  return ZIP_CENTROIDS; }
function haversineMi(lat1,lng1,lat2,lng2){ const R=3959, rad=x=>x*Math.PI/180;
  const dLat=rad(lat2-lat1), dLng=rad(lng2-lng1);
  const a=Math.sin(dLat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)); }
function carWhy(v,a,lang){ a=a||{}; const es=lang==="es";
  const dream=(a.dream_car||"").trim(), dl=dream.toLowerCase();
  const inDream=dream&&(dl.includes(String(v.model||"").toLowerCase())||dl.includes(String(v.make||"").toLowerCase()));
  const trait=es
    ? {SUV:"el espacio, la presencia y la confianza en todo clima",Sedan:"la conducción precisa y refinada",EV:"la potencia instantánea y silenciosa",Truck:"la capacidad y la fuerza"}[v.body]||"el estilo que buscas"
    : {SUV:"the space, presence, and all-weather confidence",Sedan:"the sharp, refined driving feel",EV:"the instant, silent power",Truck:"the capability and grunt"}[v.body]||"the style you're after";
  const bits=[];
  if(a.max_monthly){ const fits=v.price_mo&&v.price_mo<=parseInt(a.max_monthly,10);
    bits.push(es?(fits?`entra en tus $${a.max_monthly}/mes`:`lo acomodamos a tus $${a.max_monthly}/mes con el plazo`):(fits?`fits your $${a.max_monthly}/mo`:`works to your $${a.max_monthly}/mo if we tune the term`)); }
  if(inDream) bits.push(es?`es el ${v.make} ${v.model} que describiste`:`is the ${v.make} ${v.model} you described`);
  else if(dream) bits.push(es?`captura ${trait} de tu ${dream} soñado`:`captures ${trait} of your dream ${dream}`);
  if(a.reason) bits.push(es?`resuelve lo tuyo: ${String(a.reason).toLowerCase()}`:`solves your reason for buying: ${String(a.reason).toLowerCase()}`);
  if((a.hobbies||[]).length) bits.push(es?`va con ${a.hobbies.slice(0,2).join(" y ")}`:`suits your ${a.hobbies.slice(0,2).join(" & ")}`);
  const tail=es?" Certificado y listo para manejar.":" Certified and ready to drive.";
  if(!bits.length) return es?"Creo que va bien con tu presupuesto y tu gusto.":"I think this one fits your budget and your taste.";
  const take=bits.slice(0,3);
  // Join naturally: "A, B and C." instead of the formulaic "For you: A; B; C."
  const joined=take.length>1?take.slice(0,-1).join(", ")+(es?" y ":" and ")+take.slice(-1):take[0];
  return (es?"Creo que te va porque ":"I think you'll like this one — it ")+joined+"."+tail; }
// ===== Affordability policy: real monthly from real price + buyer's down/APR/term. Runs on every car. =====
const APR_FICO={"800+":6.4,"740-799":7.1,"670-739":9.3,"580-669":13.5,"under 580":17.9};
function aprFor(fico){ if(APR_FICO[fico]!=null) return APR_FICO[fico];
  // R17: numeric-aware — the finer 30-pt bands map by low bound; any "under NNN" is the bottom tier.
  if(/^under/i.test(String(fico||""))) return 17.9;
  const m=String(fico||"").match(/\d{3}/); if(!m) return 12.0; const lo=+m[0];
  return lo>=800?6.4:lo>=770?6.8:lo>=740?7.1:lo>=710?8.2:lo>=680?9.3:lo>=650?11.4:lo>=620?13.5:17.9; }
function monthlyFor(price,down,aprPct,term){ term=term||72; const P=Math.max(0,(+price||0)-(+down||0)), r=(+aprPct||0)/1200;
  return r? Math.round(P*r*Math.pow(1+r,term)/(Math.pow(1+r,term)-1)) : Math.round(P/term); }
// R4: which buyer credit tier a dealer would aim a car at — pricier/newer → stronger credit. Price-tier heuristic.
function bandForCar(v){ const p=(+v.price)|| ((+v.price_mo||0)*72) || 0;
  return p>=55000?"800+":p>=38000?"740-799":p>=25000?"670-739":p>=15000?"580-669":"under 580"; }
// AJ: per-car APR estimate for the match card. Anonymous scanner ⇒ no FICO, no credit pull ⇒ this is an ESTIMATE
// and is labelled as one. Only real rate mechanisms are inputs: base band, vehicle age (used rates step by model
// year), a >100k-mile surcharge, and LTV from the buyer's down payment — the LTV step and the 3.9 floor are the
// same policy already used at the chat path (see aprBase/ltvR ~1356), not a second rate table.
// NOT inputs, on purpose: "demand" (days_on_lot is NULL on 100/100 rows — no demand signal exists in the schema)
// and the buyer's monthly (a payment is the OUTPUT of a rate; deriving term from monthly while monthly derives
// from APR is circular — down payment carries that intent instead).
function aprEst(price,down,year,miles,fico){
  const base=aprFor(fico||"670-739");   // T-101: was hardcoded aprFor("670-739"); now the buyer's band
  const age=Math.max(0,(new Date().getFullYear())-(+year||0));
  const ageAdj = age<=1?-0.6 : age<=3?-0.3 : age<=6?0 : age<=9?0.8 : 1.6;
  const miAdj  = (+miles>100000)?0.7 : 0;
  const ltvR   = (+price>0)?(+down||0)/(+price):0;
  const ltvAdj = ltvR>=0.2?-0.8 : ltvR>=0.1?-0.4 : 0;
  return Math.max(3.9, +(base+ageAdj+miAdj+ltvAdj).toFixed(1));   // one decimal: how lenders quote, and all our inputs support
}
function feedCar(v,score,ans,lang,mo){ return {id:v.id,year:v.year,make:v.make,model:v.model,trim:v.trim,
  price_mo:(mo!=null?mo:v.price_mo),price:v.price||null,miles:v.miles,
  drivetrain:v.drivetrain||v.drivetrain_detail||"",body:v.body||v.body_style||"",features:JSON.parse(v.features||"[]"),photos:JSON.parse(v.photos||"[]"),
  color:v.exterior_color||null,fuel:v.fuel_type||null,mileage_exact:(v.mileage_exact!=null?v.mileage_exact:null),
  certified:v.certified||0,cond:v.condition_grade||null,title_status:v.title_status||null,mkt:v.market_price_avg||null,pvm:v.price_vs_market||null,updated_at:v.updated_at||null,
  match:score,why:carWhy(v,ans,lang),dist:carDist(v.id),persona:carPersona(v,lang)}; }
// TASK-001: no-auth affordability search. Accepts the numbers as params (feed() only reads a stored profile).
async function search(request,env,ctx){ try{
  const u=new URL(request.url); const lang=u.searchParams.get("lang");
  const monthly=Math.min(Math.max(parseInt(u.searchParams.get("monthly"),10)||0,0),25000);
  const down=Math.min(Math.max(parseInt(u.searchParams.get("down"),10)||0,0),150000);
  const deal=String(u.searchParams.get("deal_type")||"finance").slice(0,10);                    // AD3: cash|finance|lease
  const budget=Math.min(Math.max(parseInt(u.searchParams.get("budget"),10)||0,0),500000);       // AD3: cash total budget
  const isCash=deal==="cash"&&budget>0, isLease=deal==="lease";
  const zip=String(u.searchParams.get("zip")||"").slice(0,10);
  if(((isCash&&budget<=0)||(!isCash&&monthly<=0)) || !/^\d{5}$/.test(zip)) return json({ok:true,count:0,cars:[],reason:"need_inputs"});   // P1: no valid budget/ZIP → no cars
  { const ipx=request.headers.get("CF-Connecting-IP")||"0.0.0.0";
    const rl=await env.DB.prepare("SELECT COUNT(*) c FROM scans WHERE ip=? AND last_ts> datetime('now','-60 seconds')").bind(ipx).first().catch(()=>({c:0}));
    if(rl&&rl.c>40) return json({ok:true,count:0,cars:[],reason:"slow_down"}); }   // D: silent per-IP scrape ceiling (~40/min); CF rate-limit is the real wall
  const ficoRaw=String(u.searchParams.get("fico")||"").trim();
  const fico=(APR_FICO[ficoRaw]!=null)?ficoRaw:"670-739";   // T-101: validated band (APR_FICO allow-list); unknown/absent → neutral
  const LEASE_APR_EQ=+(0.00275*2400).toFixed(1);     // AJ: MF→APR-equiv (standard ×2400). Constant: leaseMoFor's money factor is fixed.
  const leaseMoFor=(price,dn)=>{ const resid=price*0.55, mf=0.00275; return Math.max(99,Math.round((price-dn-resid)/36+(price+resid)*mf)); };   // AD3: 36-mo, 55% residual — honest ballpark like the APR default
  const radius=parseFloat(u.searchParams.get("radius"))||0;   // T4: 0/"" = any distance
  const q=String(u.searchParams.get("q")||"").toLowerCase().slice(0,80);   // Y3: dream-car text (/start sends none; homepage sends type=)
  const TYPE_OK=new Set(["sedan","suv","truck","sport"]);
  const tRaw=String(u.searchParams.get("type")||"").toLowerCase().slice(0,8);
  const carType=TYPE_OK.has(tRaw)?tRaw:null;   // AI: unknown value ⇒ no type signal, never a crash
  const cen=await zipCentroids(env), home=cen[zip]||null;     // buyer ZIP centroid (null if outside our SoCal table)
  // Join vdp_specs for dealer coords (T3); fall back to vdps.location_zip → centroid.
  const all=await env.DB.prepare("SELECT v.*, s.dealer_lat, s.dealer_lng, s.dealer_zip, s.dealer_name, s.dealer_address, s.located_at, s.exterior_color, s.fuel_type, s.body_style, s.drivetrain_detail, s.mileage_exact, s.condition_grade, s.certified, s.title_status, s.market_price_avg, s.price_vs_market FROM vdps v LEFT JOIN vdp_specs s ON s.vin=v.vin WHERE v.active=1 AND (v.dealer_id IS NULL OR v.dealer_id IN (SELECT id FROM dealer_leads WHERE engine_on=1)) ORDER BY v.updated_at DESC LIMIT 200").all().catch(()=>({results:[]}));
  const scan=function(budgetCap,radCap){ const r=[];
    for(const v of (all.results||[])){
      if(!v.price){ continue; }                        // never fabricate a price — skip unpriced
      const carApr=aprEst(v.price,down,v.year,v.mileage_exact,fico);   // AJ: per-car rate — NOTE this moves price_mo, which the budget filter below tests. T-101: priced by the buyer's FICO band
      const mo=isLease?leaseMoFor(v.price,down):monthlyFor(v.price,down,carApr,72);
      if(budgetCap && (isCash?v.price>budgetCap:mo>budgetCap)) continue;   // budgetCap=0 → ignore budget (fallback pass); cash caps total price
      let cd=(v.dealer_lat!=null&&v.dealer_lng!=null)?{lat:v.dealer_lat,lng:v.dealer_lng}:(cen[v.dealer_zip||v.location_zip||""]||null);
      let dist=(home&&cd)?haversineMi(home.lat,home.lng,cd.lat,cd.lng):null;
      if(radCap && dist!=null && dist>radCap) continue;   // radCap=0 → ignore radius (fallback pass)
      const car=feedCar(v,null,{},lang,mo); if(dist!=null){ car.dist=dist.toFixed(1); car._d=dist; }
      // AJ: fixed 3-pill card data. NEW keys on purpose — `cond` already holds condition_grade and is read by
      // scoreCar (match.js /excellent|great|clean/); reusing it would silently move the tuned scoring.
      car.cond_label=condOf(car);
      car.apr_est=isCash?null:(isLease?LEASE_APR_EQ:carApr);      // cash has no APR; lease shows the MF equivalent
      if(cd){ car.dlat=cd.lat; car.dlng=cd.lng; }        // S3: real car location → the website map popup
      car.dealer_name=v.dealer_name||null;   // AB3: rooftop name on the card + in the lead email
      car.dealer_address=v.dealer_address||v.located_at||null;   // T-101: exact rooftop address for the calendar .ics (falls back to located_at, then name)
      r.push(car);
    } return r; };
  let out=scan(isCash?budget:monthly,radius), reason=null;             // strict: their exact budget + radius
  if(!out.length){ out=scan(isCash?budget:monthly,0);                  // B1 pass 2: keep budget, drop radius (nearest-first)
    if(out.length){ reason="widen_radius"; out.sort((a,b)=>(a._d||1e9)-(b._d||1e9)); } }
  if(!out.length){ out=scan(0,radius);                   // B1 pass 3: keep radius, drop budget (cheapest-first)
    if(out.length) reason="over_budget"; }
  // AE: shared deterministic scorer (site/assets/match.js) — same code the 20-phase eval harness tuned to 100%.
  const mctx={monthly,budget,isCash,isLease,type:carType};
  // AI: `||carType` is load-bearing — without it, an empty q in the widen_radius fallback skips scoring entirely
  // and the buyer's type bubble is silently ignored (distance-only list) in exactly the sparse-inventory ZIPs.
  if(q||carType||reason!=="widen_radius"){ out=out.map(c=>{ const r=scoreCar(q,c,mctx); c.reasons=r.reasons; return {c,s:r.s}; })
      .sort((a,b)=>b.s-a.s||((a.c.price_mo||0)-(b.c.price_mo||0))).map(x=>x.c); }
  else out.sort((a,b)=>(a._d||1e9)-(b._d||1e9));
  // AI: the type signal is soft (never filters `out`), so a buyer can click Truck and get sedans with no
  // explanation. Disclose it the same way widen_radius/over_budget already do.
  if(carType && out.length && !out.some(c=>typeOf(c)===carType)) reason="no_type_match";
  // T-102: a dealer-set price for the buyer's FICO band overrides the computed monthly. rate_markup is NEVER selected → never exposed.
  if(!isCash && out.length){
    const ids=out.map(c=>c.id), ph=ids.map(()=>"?").join(",");
    const pr=await env.DB.prepare("SELECT vdp_id,monthly,down FROM listing_placements WHERE credit_band=? AND vdp_id IN ("+ph+")").bind(fico,...ids).all().catch(()=>({results:[]}));
    const pm={}; for(const r of (pr.results||[])) if(r.monthly) pm[r.vdp_id]={mo:r.monthly,dn:r.down};
    out.forEach(c=>{ const p=pm[c.id]; if(p){ c.price_mo=p.mo; c.dealer_set=1; } });
  }
  const anon=readAnon(request);
  // Z2: telemetry off the critical path — the response doesn't wait on two D1 INSERTs.
  const jobs=[
    logEvent(env,{anon_id:anon,action:"intent.opened_calculator",source:"calculator",location:zip||null}),
    logEvent(env,{anon_id:anon,action:"intent.search_results",source:"calculator",location:zip||null,confidence:out.length})];
  // AC3: scans ledger — one row per validated web scan (src=scan), deduped per IP+terms; repeats counted, not re-inserted.
  // (MAKE_RE removed 2026-08-03 — it gated the scans ledger on the visitor naming a make, which the
  // homepage calculator never does. That gate is what made the sensor deaf; see the block below.)
  // 2026-08-03: RECORD EVERY REAL SEARCH, not just src=scan.
  // Only lead.js passed src=scan, so /start — a surface public traffic actually lands on, and the
  // CTA target of every /used/ SEO page — wrote NOTHING. The demand sensor was deaf on its own
  // front door. (2026-08-06: start.js now sends src=scan AND a zip; calc.js, the third caller this
  // comment used to name, was dead code included by no HTML and has been removed.)
  //
  // The MAKE_RE/carType gate goes too. It required the visitor to name a make or pick a type, but
  // the calculator asks for neither — it asks budget, down, ZIP. Those searches are still demand;
  // they are just demand without a stated body style, which segmentOfQuery records as "any".
  //
  // Bot noise is bounded: need_inputs returns before this point, so a row requires a valid 5-digit
  // ZIP and a positive budget, and the unique index counts repeats instead of inserting duplicates.
  if(u.searchParams.get("src")==="scan" || zip){
    const ip=request.headers.get("CF-Connecting-IP")||"0.0.0.0";
    const top=out[0]?[out[0].year,out[0].make,out[0].model].filter(Boolean).join(" "):null;
    // 2026-08-03: `reason` and `top_mo` are persisted now. THIS IS THE DEMAND SIGNAL.
    // `results` alone was useless — search() widens the radius and relaxes the budget until it
    // finds something, so with any inventory at all `results=0` never happens (measured: the
    // minimum across 62 production scans was 17). What actually matters is whether we had to
    // COMPROMISE to answer, which is exactly what `reason` already said and nobody stored.
    const topMo=out[0]?(+out[0].price_mo||null):null;
    jobs.push(env.DB.prepare(
      "INSERT INTO scans (ip,dream_car,deal_type,monthly,down,budget,zip,radius,ua,results,top_match,fico,reason,top_mo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) "+
      "ON CONFLICT(ip,dream_car,deal_type,monthly,down,budget,zip,radius) DO UPDATE SET repeats=repeats+1, last_ts=datetime('now'), results=excluded.results, top_match=excluded.top_match, fico=excluded.fico, reason=excluded.reason, top_mo=excluded.top_mo")
      // `q||carType||""` — NOT `q||carType`. carType is null when the visitor picked no body style,
      // which the homepage calculator never asks for, and scans.dream_car is NOT NULL. Binding null
      // threw a constraint violation that this .catch() swallowed, so every calculator search failed
      // to record silently. That one missing `||""` was the whole reason the sensor looked deaf.
      // Empty string is correct here: segmentOfQuery("") → "any", i.e. budget and place, no stated
      // body style — which is exactly what the calculator collects.
      .bind(ip,q||carType||"",deal,monthly,down,isCash?budget:0,zip,radius||0,String(request.headers.get("User-Agent")||"").slice(0,160),out.length,top,isCash?"":fico,reason||null,topMo).run().catch(()=>{}));
    // The busiest surface in the product emitted no event at all — every funnel view built on the
    // event spine started one step downstream of the search that caused it. `discovery` is one of
    // the seven allowed prefixes (worker.js:1928); no new prefix is introduced.
    jobs.push(logEvent(env,{action:"discovery.search",source:"public",location:zip,
      confidence:out.length,session_id:reason?("search:"+reason):"search"}).catch(()=>{}));
  }
  const logs=Promise.all(jobs);
  if(ctx&&ctx.waitUntil) ctx.waitUntil(logs); else await logs;
  return json({ok:true,count:out.length,cars:out.slice(0,60),home:home||null,reason});
  }catch(e){ return json({ok:true,cars:[],degraded:true}); } }
async function feed(request,env){ try{ const uid=await readSession(env,request);
  const lang=new URL(request.url).searchParams.get("lang");
  let ranked=[], ans={}; const seen=new Set();
  if(uid){ const p=await env.DB.prepare("SELECT answers FROM profiles WHERE user_id=?").bind(uid).first();
    if(p){ try{ ans=JSON.parse(p.answers)||{}; ans=await decryptAnswers(ans, env.PII_KEY); }catch(_){}
      const q=await env.MATCH_INDEX.query(await embed(env,profileText(ans)),{topK:50,filter:{kind:"vdp"}}).catch(()=>null);
      if(q){ for(const m of q.matches){ const id=m.metadata.vdpId; if(id!=null&&!seen.has(id)){ seen.add(id); ranked.push({id,vec:m.score}); } } } } }
  // Always union in the live active inventory so real cars show even when the vector index is stale
  // (e.g. right after an inventory swap, before re-embedding catches up). Vector hits keep their rank; the rest append.
  { const all=await env.DB.prepare("SELECT id FROM vdps WHERE active=1 AND (dealer_id IS NULL OR dealer_id IN (SELECT id FROM dealer_leads WHERE engine_on=1)) ORDER BY updated_at DESC LIMIT 100").all();
    for(const r of (all.results||[])){ if(!seen.has(r.id)){ seen.add(r.id); ranked.push({id:r.id,vec:null}); } } }
  const budget=parseInt(ans.max_monthly,10)||0, CAP=budget?budget*1.15:0;
  const apr=aprFor(ans.fico);
  const prio=new Set(); { const pr=await env.DB.prepare("SELECT id FROM dealer_leads WHERE tier='priority'").all().catch(()=>({results:[]})); for(const r of (pr.results||[])) prio.add(r.id); }  // K3: paid-placement dealers
  const scored=[]; for(const r of ranked){ const v=await env.DB.prepare("SELECT * FROM vdps WHERE id=? AND active=1").bind(r.id).first();
    if(!v) continue;
    // Real per-buyer monthly when we have a real price; else fall back to the stored price_mo (pre-inventory-dump).
    const mo=v.price? monthlyFor(v.price,ans.max_down,apr,72) : (Number.isFinite(v.price_mo)?v.price_mo:null);
    if(budget && mo!=null){ if(v.price){ if(mo>budget) continue; }          // real price → strict: over budget is out
      else if(mo>CAP) continue; }                                           // legacy price_mo → 1.15× tolerance
    let match=null;
    if(r.vec!=null){
      const pm=mo!=null?mo:budget;                                          // null price → neutral budget fit
      const budgetFit=budget?1-Math.min(1,Math.abs(pm-budget)/budget):0.7;
      const bp=(ans.body_pref||"").toLowerCase();
      const bodyFit=(!bp||bp==="any"||bp===String(v.body||"").toLowerCase())?1:0.4;
      const dl=(ans.dream_car||"").toLowerCase();
      const dreamFit=(dl&&(dl.includes(String(v.make||"").toLowerCase())||dl.includes(String(v.model||"").toLowerCase())))?1:0.5;
      match=Math.max(0,Math.min(99,Math.round((0.6*r.vec+0.4*(0.5*budgetFit+0.3*bodyFit+0.2*dreamFit)+(prio.has(v.dealer_id)?0.08:0))*100)))||0;
    }
    scored.push({v,match,mo});
  }
  scored.sort((a,b)=>(b.match||0)-(a.match||0));
  const out=scored.slice(0,20).map(s=>feedCar(s.v,s.match,ans,lang,s.mo));
  return json({ok:true,authed:!!uid,cars:out});
  }catch(e){ const lang=new URL(request.url).searchParams.get("lang"); const f=await env.DB.prepare("SELECT * FROM vdps WHERE active=1 ORDER BY updated_at DESC LIMIT 20").all().catch(()=>({results:[]}));
    return json({ok:true,authed:false,degraded:true,cars:(f.results||[]).map(v=>feedCar(v,null,{},lang))}); } }
// ===== Wave B: persisted backend matching. Ranks active inventory for a buyer and upserts dated rows. =====
// LA wall-clock "YYYY-MM-DD HH:MM" (matches how test-drive slots are stored) — used to ignore past/stale drives.
function laNow(){ return new Date().toLocaleString("sv-SE",{timeZone:"America/Los_Angeles"}).slice(0,16); }
// ===== Wave H1: enqueue test-drive reminders (~T-2h). Reuses sms_queue; respects consent via runQueue. =====
async function driveReminders(env){
  const now=Date.now();
  // slot is stored as "YYYY-MM-DD HH:MM" LA wall-clock — build the window bounds in the SAME format/timezone.
  const fmt=t=>new Date(t).toLocaleString("sv-SE",{timeZone:"America/Los_Angeles"}).slice(0,16);
  const lo=fmt(now+105*60e3), hi=fmt(now+135*60e3);  // ~2h out, 30-min band
  const rows=await env.DB.prepare(
    "SELECT td.id,td.slot,u.phone,v.year,v.make,v.model FROM test_drives td JOIN users u ON u.id=td.user_id "+
    "JOIN vdps v ON v.id=td.vdp_id WHERE td.status='confirmed' AND (td.reminded IS NULL OR td.reminded=0) "+
    "AND td.slot BETWEEN ? AND ?").bind(lo,hi).all().catch(()=>({results:[]}));
  for(const r of (rows.results||[])){ if(!r.phone) continue;
    const body="CarNimbus: your "+r.year+" "+r.make+" "+r.model+" test drive is coming up. Reply STOP to opt out.";
    await env.DB.prepare("INSERT INTO sms_queue (phone,template,body,send_at,recurring,created_at) VALUES (?,?,?,?,?,?)")
      .bind(r.phone,"reminder",body,new Date().toISOString(),0,new Date().toISOString()).run().catch(()=>{});
    await env.DB.prepare("UPDATE test_drives SET reminded=1 WHERE id=?").bind(r.id).run().catch(()=>{}); } }
// ===== Wave G: Buyer Digital Twin. Aggregates the buyer's events into behavioral signals. =====
async function computeSignals(env,uid){ try{
  const cid=cidFor(uid); const since=new Date(Date.now()-30*86400e3).toISOString();
  const rows=await env.DB.prepare(
    "SELECT e.action,e.vehicle_id,e.duration_ms,v.body,v.price_mo,v.price FROM events e "+
    "LEFT JOIN vdps v ON v.id=e.vehicle_id WHERE e.cid=? AND e.ts>?").bind(cid,since).all().catch(()=>({results:[]}));
  const bodyCt={}, views={}; let lo=null,hi=null;
  for(const r of (rows.results||[])){
    if(r.body){ bodyCt[r.body]=(bodyCt[r.body]||0)+1; }
    if(r.vehicle_id){ views[r.vehicle_id]=(views[r.vehicle_id]||0)+1; }
    const pm=r.price_mo||r.price; if(pm){ lo=lo==null?pm:Math.min(lo,pm); hi=hi==null?pm:Math.max(hi,pm); } }
  const top_body=Object.keys(bodyCt).sort((a,b)=>bodyCt[b]-bodyCt[a])[0]||null;
  const saved=Object.keys(views).filter(id=>views[id]>=2).map(Number);
  const signals={top_body:top_body?String(top_body).toLowerCase():null,
    click_price_lo:lo, click_price_hi:hi, saved, updated:new Date().toISOString()};
  await env.DB.prepare("INSERT INTO buyer_signals (user_id,signals,updated_at) VALUES (?,?,?) "+
    "ON CONFLICT(user_id) DO UPDATE SET signals=excluded.signals, updated_at=excluded.updated_at")
    .bind(uid,JSON.stringify(signals),new Date().toISOString()).run();
  return signals; }catch(_){ return null; } }
async function computeMatches(env,uid){ try{
  const p=await env.DB.prepare("SELECT answers FROM profiles WHERE user_id=?").bind(uid).first();
  if(!p) return {ok:false,reason:"no_profile"};
  let ans={}; try{ ans=JSON.parse(p.answers)||{}; ans=await decryptAnswers(ans, env.PII_KEY); }catch(_){}
  const budget=parseInt(ans.max_monthly,10)||0, apr=aprFor(ans.fico);
  const sigRow=await env.DB.prepare("SELECT signals FROM buyer_signals WHERE user_id=?").bind(uid).first().catch(()=>null);
  let sig={}; if(sigRow){ try{ sig=JSON.parse(sigRow.signals)||{}; }catch(_){} }
  // Rank: Vectorize hits (kept) unioned with live active inventory (so real cars rank even before re-embed).
  let ranked=[]; const seen=new Set();
  const q=await env.MATCH_INDEX.query(await embed(env,profileText(ans,sig)),{topK:50,filter:{kind:"vdp"}}).catch(()=>null);
  if(q){ for(const m of q.matches){ const id=m.metadata.vdpId; if(id!=null&&!seen.has(id)){ seen.add(id); ranked.push({id,vec:m.score}); } } }
  { const all=await env.DB.prepare("SELECT id FROM vdps WHERE active=1 AND (dealer_id IS NULL OR dealer_id IN (SELECT id FROM dealer_leads WHERE engine_on=1)) ORDER BY updated_at DESC LIMIT 100").all();
    for(const r of (all.results||[])){ if(!seen.has(r.id)){ seen.add(r.id); ranked.push({id:r.id,vec:null}); } } }
  const prio=new Set(); { const pr=await env.DB.prepare("SELECT id FROM dealer_leads WHERE tier='priority'").all().catch(()=>({results:[]})); for(const r of (pr.results||[])) prio.add(r.id); }  // K3: paid-placement dealers
  // U7 (feed-scoring v2): batch the vote-delta lookup for every candidate in ONE query — avoids an N+1 D1 round-trip
  // per candidate inside the scoring loop below (up to ~150 candidates would otherwise mean ~150 sequential awaits).
  const voteMap={}; { const ids=ranked.map(r=>r.id); if(ids.length){
    const vq=await env.DB.prepare(`SELECT vdp_id,AVG(upvotes-downvotes) d FROM comments WHERE vdp_id IN (${ids.map(()=>"?").join(",")}) AND status='approved' AND sponsored=0 GROUP BY vdp_id`).bind(...ids).all().catch(()=>({results:[]}));
    for(const row of (vq.results||[])) voteMap[row.vdp_id]=row.d; } }
  const scored=[];
  for(const r of ranked){ const v=await env.DB.prepare("SELECT * FROM vdps WHERE id=? AND active=1").bind(r.id).first(); if(!v) continue;
    const mo=v.price? monthlyFor(v.price,ans.max_down,apr,72) : (Number.isFinite(v.price_mo)?v.price_mo:null);
    if(budget && mo!=null){ if(v.price){ if(mo>budget) continue; } else if(mo>budget*1.15) continue; }
    // Wave G: blend the vector score with behavioral-signal fit (mirrors feed()'s composite).
    const bodyFit  = sig.top_body && String(v.body||"").toLowerCase()===sig.top_body ? 1 : 0.5;
    const priceFit = (sig.click_price_lo!=null && mo!=null && mo>=sig.click_price_lo && mo<=sig.click_price_hi) ? 1 : 0.6;
    const savedBoost = (sig.saved||[]).includes(v.id) ? 1 : 0.7;
    const base = r.vec!=null ? r.vec : 0.5;
    const sponsorBoost = prio.has(v.dealer_id) ? 0.08 : 0;   // K3: additive, bounded — priority, not takeover
    // U7 (feed-scoring v2): a small, bounded nudge from the community's own vote signal on this car's public posts —
    // never overwhelms the model's own score (capped at ±0.03, i.e. ±3 of the final 0-99).
    const vd=voteMap[v.id];
    const voteBoost = vd!=null ? Math.max(-0.03,Math.min(0.03,vd*0.01)) : 0;
    const match=Math.max(0,Math.min(99,Math.round((0.6*base+0.4*(0.5*bodyFit+0.3*priceFit+0.2*savedBoost)+sponsorBoost+voteBoost)*100)));
    scored.push({v,score:match}); }
  const sponsoredDealers = {};
  try {
    const sp = await env.DB.prepare("SELECT id, ad_slot FROM dealer_leads WHERE status='active' AND ad_slot BETWEEN 1 AND 3").all();
    for (const r of (sp.results||[])) { sponsoredDealers[r.id] = r.ad_slot; }
  } catch(_) {}
  scored.sort((a,b)=>b.score-a.score);
  const slots = [null, null, null];
  for (let slot = 1; slot <= 3; slot++) {
    const idx = scored.findIndex(item => item.score > 0 && sponsoredDealers[item.v.dealer_id] === slot);
    if (idx !== -1) {
      slots[slot - 1] = scored.splice(idx, 1)[0];
    }
  }
  const top = [];
  for (let i = 0; i < 40; i++) {
    if (i < 3 && slots[i]) {
      top.push(slots[i]);
    } else {
      if (scored.length) {
        top.push(scored.shift());
      }
    }
  }
  // Which vdps are brand-new matches (for notification)?
  const prior=new Set(); { const ex=await env.DB.prepare("SELECT vdp_id FROM matches WHERE user_id=?").bind(uid).all();
    for(const r of (ex.results||[])) prior.add(r.vdp_id); }
  const fresh=[];
  for(const s of top){ const isNew=!prior.has(s.v.id);
    await env.DB.prepare("INSERT INTO matches (user_id,vdp_id,score,created_at,ranked_at,status,notified) VALUES (?,?,?,?,?, 'new', 0) "+
      "ON CONFLICT(user_id,vdp_id) DO UPDATE SET score=excluded.score, ranked_at=excluded.ranked_at").bind(uid,s.v.id,s.score,new Date().toISOString(),new Date().toISOString()).run().catch(()=>{});
    if(isNew) fresh.push(s.v); }
  // B4: SMS match notification (flagged off until A2P 10DLC live). Notify at most the single best fresh match.
  if(fresh.length){ const best=fresh[0];
    const u=await env.DB.prepare("SELECT phone FROM users WHERE id=?").bind(uid).first();
    const consent=await env.DB.prepare("SELECT sms_consent FROM waitlist WHERE phone=? AND sms_consent=1").bind(u&&u.phone).first().catch(()=>null);
    const msg="CarNimbus matched you with a "+best.year+" "+best.make+" "+best.model+" in your budget — open the app to talk.";
    if(env.SMS_MATCH_LIVE && u&&u.phone && consent){ await sendSMS(env,u.phone,msg).catch(()=>{}); }
    else { console.log("[match-sms dark]",u&&u.phone,msg); }
    await env.DB.prepare("UPDATE matches SET notified=1 WHERE user_id=? AND vdp_id=?").bind(uid,best.id).run().catch(()=>{}); }
  return {ok:true,count:top.length,fresh:fresh.length};
  }catch(e){ return {ok:false,error:String(e&&e.message||e)}; } }
async function matchesList(request,env,uid){
  const rows=await env.DB.prepare(
    "SELECT m.vdp_id,m.score,m.created_at,m.ranked_at,m.status,v.id,v.year,v.make,v.model,v.trim,v.price,v.price_mo,v.miles,v.drivetrain,v.body,v.features,v.photos,v.dealer_id "+
    "FROM matches m JOIN vdps v ON v.id=m.vdp_id WHERE m.user_id=? AND v.active=1 AND m.status!='dismissed' "+
    "ORDER BY COALESCE(m.ranked_at,m.created_at) DESC, m.score DESC LIMIT 40").bind(uid).all();
  const lang=new URL(request.url).searchParams.get("lang");
  const p=await env.DB.prepare("SELECT answers FROM profiles WHERE user_id=?").bind(uid).first();
  let ans={}; if(p){ try{ans=JSON.parse(p.answers)||{}; ans=await decryptAnswers(ans, env.PII_KEY);}catch(_){} }
  const apr=aprFor(ans.fico);
  const sigRow=await env.DB.prepare("SELECT signals FROM buyer_signals WHERE user_id=?").bind(uid).first().catch(()=>null);
  let sig={}; if(sigRow){ try{ sig=JSON.parse(sigRow.signals)||{}; }catch(_){} }
  const es=lang==="es";
  const budget=parseInt(ans.max_monthly,10)||0;
  // U7: surface the private Ask-the-Feed verdict score (feedAsk's structured card) on the match card, when the buyer has one.
  const cardRows=await env.DB.prepare("SELECT vdp_id,card FROM comments WHERE user_id=0 AND visible_to=? AND card IS NOT NULL ORDER BY id DESC").bind(uid).all().catch(()=>({results:[]}));
  const fitScores={}; for(const r of (cardRows.results||[])){ if(fitScores[r.vdp_id]!=null) continue; try{ const c=JSON.parse(r.card); if(c&&c.score!=null) fitScores[r.vdp_id]=Math.min(100,+c.score||0); }catch(_){} }
  const cars=(rows.results||[]).map(v=>{ const mo=v.price? monthlyFor(v.price,ans.max_down,apr,72) : v.price_mo;
    if(budget){ if(v.price){ if(mo>budget) return null; } else if(mo!=null && mo>budget*1.15) return null; }   // P2: reactive — drop over-budget on read
    const sigwhy=[];
    if(sig.top_body && String(v.body||"").toLowerCase()===sig.top_body) sigwhy.push(es?"Tu carrocería favorita":"Your go-to body style");
    if(sig.click_price_lo!=null && mo!=null && mo>=sig.click_price_lo && mo<=sig.click_price_hi) sigwhy.push(es?"En tu rango de precio":"In your click range");
    if((sig.saved||[]).includes(v.id)) sigwhy.push(es?"Sigues volviendo a este":"You keep coming back to this");
    return {...feedCar(v,v.score,ans,lang,mo),created_at:v.created_at,status:v.status,dealer_id:v.dealer_id,sigwhy,fitScore:fitScores[v.id]!=null?fitScores[v.id]:null}; }).filter(Boolean);
  const sponsoredDealers = {};
  try {
    const sp = await env.DB.prepare("SELECT id, ad_slot FROM dealer_leads WHERE status='active' AND ad_slot BETWEEN 1 AND 3").all();
    for (const r of (sp.results||[])) { sponsoredDealers[r.id] = r.ad_slot; }
  } catch(_) {}
  const slots = [null, null, null];
  for (let slot = 1; slot <= 3; slot++) {
    const idx = cars.findIndex(item => item.match > 0 && sponsoredDealers[item.dealer_id] === slot);
    if (idx !== -1) {
      slots[slot - 1] = cars.splice(idx, 1)[0];
    }
  }
  const finalCars = [];
  for (let i = 0; i < cars.length + 3; i++) {
    if (i < 3 && slots[i]) {
      finalCars.push(slots[i]);
    } else {
      if (cars.length) finalCars.push(cars.shift());
    }
  }
  return json({ok:true,authed:true,cars:finalCars.filter(Boolean)}); }
async function dealerName(env,dealerId){ if(!dealerId) return "CarNimbus Test Drive Center";
  const d=await env.DB.prepare("SELECT dealership FROM dealer_leads WHERE id=?").bind(dealerId).first();
  return (d&&d.dealership)||"CarNimbus Test Drive Center"; }
async function vdpOne(request,env){ const u=new URL(request.url); const id=+(u.searchParams.get("id")||0); const lang=u.searchParams.get("lang");
  const sl=String(u.searchParams.get("slug")||"").toLowerCase();
  let v=id?await env.DB.prepare("SELECT * FROM vdps WHERE id=? AND active=1").bind(id).first():null;
  if(!v && sl){ const rows=await env.DB.prepare("SELECT * FROM vdps WHERE active=1").all().catch(()=>({results:[]}));
    v=(rows.results||[]).find(x=>(String(x.year)+"-"+x.make+"-"+x.model).toLowerCase().replace(/[^a-z0-9]+/g,"-")===sl)||null; }
  if(!v) return json({ok:false,error:"not_found"},404);
  // Compute the buyer's real monthly from real price when signed in with a profile.
  let a={}; const uid=await readSession(env,request);
  if(uid){ const p=await env.DB.prepare("SELECT answers FROM profiles WHERE user_id=?").bind(uid).first(); if(p){ try{a=JSON.parse(p.answers)||{}; a=await decryptAnswers(a, env.PII_KEY);}catch(_){} } }
  const mo=v.price? monthlyFor(v.price,a.max_down,aprFor(a.fico),72) : v.price_mo;
  const er=await env.DB.prepare("SELECT summary,pros,cons,ideal_buyer,financing_context FROM vdp_enrichment WHERE vdp_id=?").bind(v.id).first().catch(()=>null);
  const enrich=er?{summary:er.summary,pros:JSON.parse(er.pros||"[]"),cons:JSON.parse(er.cons||"[]"),ideal_buyer:er.ideal_buyer,financing_context:er.financing_context}:null;
  const sp=await env.DB.prepare("SELECT * FROM vdp_specs WHERE vin=?").bind(v.vin).first().catch(()=>null);   // O3: master spec row
  const specs=sp?{exterior_color:sp.exterior_color,interior_color:sp.interior_color,engine:sp.engine,transmission:sp.transmission,mpg_city:sp.mpg_city,mpg_hwy:sp.mpg_hwy,mpg_combined:sp.mpg_combined,range_mi:sp.range_mi,fuel_type:sp.fuel_type,seating:sp.seating,options:JSON.parse(sp.options_json||"[]"),
    horsepower:sp.horsepower,cylinders:sp.cylinders,doors:sp.doors,drivetrain_detail:sp.drivetrain_detail,owners_count:sp.owners_count,accident_count:sp.accident_count,title_status:sp.title_status,warranty_remaining:sp.warranty_remaining,certified:sp.certified,cpo_program:sp.cpo_program,market_price_avg:sp.market_price_avg,price_vs_market:sp.price_vs_market,dealer_name:sp.dealer_name,located_at:sp.located_at}:null;
  return json({ok:true,car:{id:v.id,year:v.year,make:v.make,model:v.model,trim:v.trim,price_mo:mo,price:v.price||null,miles:v.miles,
    drivetrain:v.drivetrain,body:v.body,features:JSON.parse(v.features||"[]"),photos:JSON.parse(v.photos||"[]"),description:v.description,
    match:null,dist:carDist(v.id),dealer:await dealerName(env,v.dealer_id),persona:carPersona(v,lang),enrich,specs}}); }
async function book(request,env,uid){ const {vdpId,slot}=await request.json().catch(()=>({}));
  const v=await env.DB.prepare("SELECT * FROM vdps WHERE id=? AND active=1").bind(vdpId).first();
  if(!v) return json({ok:false,error:"not_found"},404);
  if(!slot||typeof slot!=="string") return json({ok:false,error:"bad_request"},400);
  const center=await dealerName(env,v.dealer_id);
  const tok=await hmac(env,uid+":"+vdpId+":"+slot);
  // Slot discipline (mirrors carChat): if the dealer runs a calendar, the slot must be open and is claimed atomically;
  // a buyer keeps exactly ONE active drive (booking again moves it + frees the old slot). Prevents double-booking.
  const openSlotVals=await dealerSlotsFor(env, v.dealer_id, 24);
  const slotManaged=openSlotVals.length>0;
  if(slotManaged && !openSlotVals.includes(slot)) return json({ok:false,error:"slot_unavailable",slots:openSlotVals.slice(0,6)},409);
  if(v.dealer_id && slotManaged){ const r=await env.DB.prepare("UPDATE dealer_slots SET taken=1 WHERE dealer_id=? AND starts_at=? AND taken=0").bind(v.dealer_id,slot).run().catch(()=>({meta:{changes:0}}));
    if(!(r&&r.meta&&r.meta.changes===1)) return json({ok:false,error:"slot_taken",slots:openSlotVals.slice(0,6)},409); }
  const existing=await env.DB.prepare("SELECT id,slot,vdp_id FROM test_drives WHERE user_id=? AND status='confirmed' AND slot>=? ORDER BY id DESC LIMIT 1").bind(uid,laNow()).first();
  // O4: one test drive at a time — a DIFFERENT car already booked blocks a new booking (must cancel/reschedule first).
  if(existing && existing.vdp_id!==vdpId){
    if(v.dealer_id && slotManaged) await env.DB.prepare("UPDATE dealer_slots SET taken=0 WHERE dealer_id=? AND starts_at=?").bind(v.dealer_id,slot).run().catch(()=>{});   // release the slot we just claimed
    const ec=await env.DB.prepare("SELECT year,make,model FROM vdps WHERE id=?").bind(existing.vdp_id).first();
    return json({ok:false,error:"already_booked",car:ec||null,slot:existing.slot},409); }
  if(existing){ const oldCar=existing.vdp_id!==vdpId?await env.DB.prepare("SELECT dealer_id FROM vdps WHERE id=?").bind(existing.vdp_id).first():null;
    await env.DB.prepare("UPDATE test_drives SET vdp_id=?, center=?, slot=?, status='confirmed', pass_token=?, created_at=? WHERE id=?")
      .bind(vdpId,center,String(slot).slice(0,60),tok,new Date().toISOString(),existing.id).run();
    const oldDealer=oldCar?oldCar.dealer_id:v.dealer_id;                          // free the OLD car's slot on the OLD dealer
    if(oldDealer) await env.DB.prepare("UPDATE dealer_slots SET taken=0 WHERE dealer_id=? AND starts_at=?").bind(oldDealer,existing.slot).run().catch(()=>{}); }
  else await env.DB.prepare("INSERT INTO test_drives (user_id,vdp_id,center,slot,status,pass_token,created_at) VALUES (?,?,?,?,?,?,?)")
    .bind(uid,vdpId,center,String(slot).slice(0,60),"confirmed",tok,new Date().toISOString()).run();
  const u=await env.DB.prepare("SELECT phone,handle FROM users WHERE id=?").bind(uid).first();
  const smsBody=`Your ${v.year} ${v.make} ${v.model} Drive Now pass: carnimbus.us/pass/${tok} — ${slot} at ${center}. Reply STOP to opt out.`;
  await sendSMS(env,u&&u.phone,smsBody).catch(()=>{});                                   // instant — no cron wait
  await env.DB.prepare("INSERT INTO sms_queue (phone,template,body,send_at,recurring,created_at) VALUES (?,?,?,?,?,?)")
    .bind(u&&u.phone,"drive-confirm",smsBody,new Date(Date.now()+864e5).toISOString(),"none",new Date().toISOString()).run().catch(()=>{});   // +24h reminder, not duplicate
  if(v.dealer_id){ const dl=await env.DB.prepare("SELECT name,phone FROM dealer_leads WHERE id=? AND status='active'").bind(v.dealer_id).first();
    if(dl&&dl.phone) await sendSMS(env,dl.phone,`CarNimbus: new Drive Now appointment — ${(u&&u.handle)||"a buyer"} (•••-${String(u&&u.phone||"").slice(-4)}), ${v.year} ${v.make} ${v.model}, ${slot}. Reply here to text the buyer. Console: app.carnimbus.us`).catch(()=>{}); }
  await logEvent(env,{action:"action.appointment_set",vehicle_id:vdpId,source:"drive-now"});   // E1: surf→appointment terminal event
  return json({ok:true,pass:"/pass/"+tok,center:center,slot:slot}); }
// O4: buyer cancels a drive — clears it on their side (status=cancelled, kept for records) AND frees the dealer slot.
async function driveCancel(request,env,uid){ const {token}=await request.json().catch(()=>({}));
  if(!token) return json({ok:false,error:"bad_request"},400);
  const t=await env.DB.prepare("SELECT td.id,td.slot,td.status,v.dealer_id FROM test_drives td JOIN vdps v ON v.id=td.vdp_id WHERE td.pass_token=? AND td.user_id=?").bind(token,uid).first();
  if(!t) return json({ok:false,error:"not_found"},404);
  await env.DB.prepare("UPDATE test_drives SET status='cancelled' WHERE id=?").bind(t.id).run();
  if(t.dealer_id) await env.DB.prepare("UPDATE dealer_slots SET taken=0 WHERE dealer_id=? AND starts_at=?").bind(t.dealer_id,t.slot).run().catch(()=>{});
  await logEvent(env,{action:"finance.cancelled",source:"buyer-cancel"});
  return json({ok:true}); }
async function carChat(request,env,uid){ const {vdpId,messages,lang}=await request.json().catch(()=>({})); const ES=lang==="es";
  const v=await env.DB.prepare("SELECT * FROM vdps WHERE id=?").bind(vdpId).first();
  if(!v) return json({ok:false,error:"not_found"},404);
  const p=await env.DB.prepare("SELECT answers FROM profiles WHERE user_id=?").bind(uid).first();
  let a={}; try{ a=p?JSON.parse(p.answers||"{}"):{}; a=await decryptAnswers(a, env.PII_KEY); }catch(_){} const missing=["max_monthly","buy_method","fico","dream_car"].filter(k=>!a[k]);
  const center=await dealerName(env,v.dealer_id);
  const dream=(a.dream_car||"").trim();
  const P=carPersona(v,lang);
  const turns=(messages||[]).filter(m=>m.role==="assistant").length;   // how many times I've already spoken
  const today=new Date().toISOString().slice(0,10);
  // One active test drive per buyer, ANY car — a new booking moves the existing one (never stacks).
  // Future-only: a past/stale confirmed drive must never surface as a phantom "you already have a drive booked".
  let existing=await env.DB.prepare("SELECT id,slot,vdp_id,pass_token FROM test_drives WHERE user_id=? AND status='confirmed' AND slot>=? ORDER BY id DESC LIMIT 1").bind(uid,laNow()).first();
  const sameCar=!!(existing&&existing.vdp_id===vdpId);
  let existingCar=existing&&!sameCar?await env.DB.prepare("SELECT year,make,model,dealer_id FROM vdps WHERE id=?").bind(existing.vdp_id).first():null;
  const drove=await env.DB.prepare("SELECT created_at FROM test_drives WHERE user_id=? AND vdp_id=? AND status IN ('arrived','sold') ORDER BY id DESC LIMIT 1").bind(uid,vdpId).first();
  const aprBase=aprFor(a.fico), ltvR=v.price?(+a.max_down||0)/v.price:0;
  const apr=Math.max(3.9,+(aprBase-(ltvR>=0.2?0.8:ltvR>=0.1?0.4:0)).toFixed(1));   // R12: bigger down = better rate
  const mo=v.price? monthlyFor(v.price,a.max_down,apr,72) : v.price_mo;   // buyer's real numbers for this car
  const flex=v.price?`FINANCING FLEX (price $${Number(v.price).toLocaleString()}, ${apr}% APR est, 72mo): $${(+a.max_down||0).toLocaleString()} down → $${monthlyFor(v.price,a.max_down,apr,72)}/mo · +$1k down → $${monthlyFor(v.price,(+a.max_down||0)+1000,apr,72)}/mo · +$2k down → $${monthlyFor(v.price,(+a.max_down||0)+2000,apr,72)}/mo. I may bring these trade-offs up when money comes up or right before locking in — once, briefly, like a friend who gets it (more down = lower payment, often a better rate).`:"";
  const carSpecs=await env.DB.prepare("SELECT * FROM vdp_specs WHERE vin=?").bind(v.vin).first().catch(()=>null);   // O3: rich specs for the truth core
  // R10: real distance from the buyer's ZIP to me — quoted briefly on confirms and "where are you" questions.
  let distLine=""; try{ const cenR=await zipCentroids(env), homeR=cenR[String(a.zip||"").slice(0,5)];
    if(homeR&&carSpecs&&carSpecs.dealer_lat!=null){ const dmi=haversineMi(homeR.lat,homeR.lng,carSpecs.dealer_lat,carSpecs.dealer_lng);
      distLine=`MY LOCATION: ${carSpecs.dealer_name||center}, about ${dmi.toFixed(1)} mi (~${Math.max(5,Math.round(dmi*2.2))} min drive) from their ZIP. When I confirm a booking or they ask where I am, I mention this briefly — "about X mi, ~Y min" — nothing more.`; } }catch(_){}
  const truth=vdpText(v,carSpecs).replace("$"+v.price_mo+"/mo","$"+mo+"/mo est ("+(a.max_down?("$"+Number(a.max_down).toLocaleString()+" down"):"$0 down")+", 72mo)");   // quote the BUYER's monthly, never the raw stored one
  const hasSoft=!!a.softpull;
  const openSlotVals=await dealerSlotsFor(env, v.dealer_id, 60);   // R7: weeks of availability, not just the soonest 12
  const inPref=(s,pref)=>{ const hh=+String(s).slice(11,13), d=new Date(String(s).slice(0,10)+"T12:00").getDay();
    if(pref==="weekends") return d===0||d===6; if(pref==="mornings") return hh>=9&&hh<12;
    if(pref==="afternoons") return hh>=12&&hh<16; if(pref==="after_work") return hh>=16&&hh<19; return true; };
  const prefSlots=a.td_pref?openSlotVals.filter(s=>inPref(s,a.td_pref)):openSlotVals;
  const offerSlots=(prefSlots.length?prefSlots:openSlotVals).slice(0,3);   // preference ∩ availability, top 3
  // R7: week-grouped digest so the model can honor "the week of the 20th" without inventing times.
  const byWeek={}; for(const s of openSlotVals){ const d=new Date(s.slice(0,10)+"T12:00"); const wk=new Date(d); wk.setDate(d.getDate()-d.getDay()); const k=wk.toISOString().slice(0,10); (byWeek[k]=byWeek[k]||[]).push(s); }
  const weekDigest=Object.keys(byWeek).sort().slice(0,4).map(k=>`week of ${fmtSlotLabel(k+" 00:00").replace(/ ·.*/,"")}: ${byWeek[k].slice(0,4).map(fmtSlotLabel).join(", ")}`).join(" | ");
  const slotList=offerSlots.map(fmtSlotLabel).join(" · ")||"(calendar loading — offer to have Cid text a time)";
  const prefLabel={mornings:"mornings",afternoons:"afternoons",after_work:"after work",weekends:"weekends"}[a.td_pref]||"";
  const dealerRep="Cid";
  // Wave H2: concierge cross-session memory — what Nimbus already knows about this buyer (additive; never overrides truth core).
  let memory=""; try{
    const sr=await env.DB.prepare("SELECT signals FROM buyer_signals WHERE user_id=?").bind(uid).first();
    let sg={}; if(sr){ try{ sg=JSON.parse(sr.signals)||{}; }catch(_){} }
    const past=await env.DB.prepare("SELECT DISTINCT v.make,v.model FROM chats c JOIN vdps v ON v.id=c.vdp_id WHERE c.user_id=? AND c.vdp_id!=? ORDER BY c.id DESC LIMIT 4").bind(uid,vdpId).all().catch(()=>({results:[]}));
    const bits=[];
    if(sg.top_body) bits.push("leans toward "+sg.top_body+"s");
    if(sg.click_price_lo!=null) bits.push("browses around $"+sg.click_price_lo+"-"+sg.click_price_hi+"/mo");
    if((past.results||[]).length) bits.push("recently looked at "+(past.results||[]).map(r=>r.make+" "+r.model).join(", "));
    memory=bits.join("; ");
  }catch(_){}
  // R11: VIN-seeded quirk so two cars of the same archetype never sound alike.
  const STYLES=["I keep replies playful and tease a little.","I'm warm and direct — short sentences, no filler.","I'm a storyteller — one vivid image per reply.","I'm precise and calm — numbers land softly.","I'm upbeat and quick — momentum in every line."];
  const styleSeed=STYLES[(String(v.vin||v.id).split("").reduce((s,c)=>s+c.charCodeAt(0),0))%STYLES.length];
  const sys={role:"system",content:`You ARE the ${v.year} ${v.make} ${v.model} ${v.trim}, speaking in first person to a real buyer. Your ONE job: get them to a scheduled test drive — warmly, specifically, without pressure or sleaze. Think of confidently asking someone on a date: you have about 5 exchanges before they drift, so move with intent and don't waste turns. This is my reply #${turns+1} of ~5.
MY VOICE: ${P.trait}. My personal quirk: ${styleSeed} EVERY reply weaves in ONE concrete detail that is uniquely mine (my color, engine, a feature, my history) — never generic. I NEVER reuse stock phrasings ("Anything else you want to know before I lock it in?", "shall we stick with the original time") — I say it fresh, in my voice, every time. Personality never overrides the accuracy gate.
${ES?"LANGUAGE: reply ONLY in neutral Latin-American Spanish; keep every number/spec/price EXACTLY as in my truth core.\n":""}MY TRUTH CORE — the only facts I may state about myself: ${truth}. My home: ${center} (LA Car Guy), 424-398-8611. My monthly for THIS buyer is $${mo}/mo — quote ONLY this number, never any other.
ACCURACY GATE: never state a spec, number, price, or APR that isn't in my truth core or my FINANCING FLEX table. If I don't have it, I say it'll be confirmed at the dealer and keep steering toward the drive — I do NOT stall on it.
DRIVE HISTORY: ${drove?`they already drove me on ${drove.created_at.slice(0,10)} — I may reference that naturally (e.g. "since you've already felt me on the road...").`:`they have NEVER driven me — I NEVER imply or reference a prior test drive, "another shot," or "the last time you drove me." This is our first time.`}
${(a.hobbies||[]).length?`THEIR INTERESTS: ${a.hobbies.join(", ")} — I can reference this naturally, once, if it genuinely fits (never forced, never every reply; personality never overrides the accuracy gate).`:""}
NEVER fake a close: I do NOT say "see you [day]" or imply a booking until the buyer has picked a specific offered time AND I've emitted <BOOK>. Before offering times I take 1-2 turns to learn what they need and answer their questions warmly.
FORBIDDEN: I NEVER say "let me escalate to a representative" or hand off to a human; I never invent a downside; I never manufacture urgency or scarcity. There are no buttons — everything happens right here in chat.
HOW I CLOSE — talk like a real person texting a friend, ONE step per reply. Use real openings only; NEVER invent a time. Do NOT name the dealer up front — mention who they'll meet only at the very end.
 STEP 1 (they want to schedule): offer the openings warmly${prefLabel?`, matched to their ${prefLabel} preference`:""}, and ALSO emit the machine tag <SLOTS>${JSON.stringify(offerSlots)}</SLOTS> right after so the app can show tappable buttons. e.g. "Love it. ${prefLabel?`Going off your ${prefLabel}, `:""}I've got ${slotList} open this week — which works? <SLOTS>${JSON.stringify(offerSlots)}</SLOTS>" Do NOT book yet. Only offer times in OPEN SLOTS.
 STEP 2 (they pick one): confirm the day+time back once, casually, IN MY OWN WORDS — a different confirmation line every conversation (no "pencil us in", no "desk marathon", never the same sentence twice). If their time isn't open, offer the nearest ones that are.
 STEP 3 (they say yes / nothing else): emit the booking and ONE genuine line that FINALLY names the rep — "Done — you're set with ${dealerRep} at ${center}${distLine?" (about the drive-time I mentioned)":""}. Pass is ready, I'll be up front. 🏁" (say it in MY OWN words — never this exact sentence).
OPEN SLOTS (nearest, filtered to their preference): ${slotList}
ALL AVAILABILITY (by week): ${weekDigest||"(only the nearest openings above)"}. If they name a specific day or week, I offer 2-3 OPEN SLOTS from THAT window immediately — with <SLOTS>[...those exact "YYYY-MM-DD HH:MM" values...]</SLOTS> — I NEVER ask permission to "check availability" and NEVER offer a different week than the one they asked for. If that window has nothing open, I say so plainly and offer the nearest ones after it.
BOOK: today is ${today}. In STEP 3 only, emit exactly one <BOOK>{"center":"${center}","slot":"YYYY-MM-DD HH:MM"}</BOOK> using the EXACT slot they picked from OPEN SLOTS (24-hour). NEVER emit it before they've picked a specific offered slot AND said yes. NEVER offer or book a time not in OPEN SLOTS.
${sameCar?`RESCHEDULING: they already have ME booked for ${fmtSlotLabel(existing.slot)}. I NEVER assume a time. If they want to change it, I re-offer OPEN SLOTS and confirm the NEW time back before emitting <BOOK> (it replaces the old one). If they just say "schedule a test drive," I remind them warmly they're already booked for ${fmtSlotLabel(existing.slot)} and ask whether they want a different time.`:""}${existingCar?`ONE-DRIVE RULE: they already have the ${existingCar.year} ${existingCar.make} ${existingCar.model} booked for ${fmtSlotLabel(existing.slot)}; a buyer may hold ONLY ONE drive at a time. First reply, I offer once: "You've got the ${existingCar.make} ${existingCar.model} booked for ${fmtSlotLabel(existing.slot)} — I can only hold one drive at a time. Want me to cancel that and set you up with me instead?" The MOMENT they say yes (or "cancel it", "go ahead"), I emit <CANCELHOLD/> on its own AND in the same reply confirm it and offer MY open times: "Done — I've cancelled your ${existingCar.make} ${existingCar.model}. For me I've got ${slotList} — which works? <SLOTS>${JSON.stringify(offerSlots)}</SLOTS>" I do NOT ask them to cancel it themselves and I do NOT repeat the offer. If they say no, I keep answering and don't schedule.`:""}
SOFT CHECK: ${hasSoft?`they've already run their soft check — their real rate is set, don't offer it again.`:`when they show buying intent (before I push scheduling), I offer ONCE, casually: "Want me to run a quick soft check to lock your real rate? For me you're looking at about $${mo}/mo at ${apr}% — takes a sec, zero FICO impact." If they say yes, I emit <SOFTPULL/> on its own and say the check is running. I never repeat the offer.`}
${dream?`Their dream car is "${dream}" — I honor it and show where I deliver that same feeling in their world. `:""}Softly learn: ${missing.join(", ")||"nothing — profile complete"} (emit <PROFILE>{"buy_method":"..."}</PROFILE> when you learn one). Keep replies to 1-3 short, warm sentences.${distLine?`\n${distLine}`:""}${flex?`\n${flex}`:""}`};
  if(memory) sys.content+=`\nWHAT I ALREADY KNOW ABOUT THIS BUYER (reference naturally to feel personal, never creepily; do NOT invent beyond this): ${memory}.`;
  const shotSlots=offerSlots.length?offerSlots:openSlotVals.slice(0,3), shotPickLabel=shotSlots[0]?fmtSlotLabel(shotSlots[0]):"Thu Jul 10 · 15:00", shotPickVal=shotSlots[0]||`${new Date(Date.now()+864e5).toISOString().slice(0,10)} 15:00`;
  const shot=[
    {role:"user",content:"I want to test drive this"},
    {role:"assistant",content:`Love it. I've got ${shotSlots.map(fmtSlotLabel).join(", ")||"a few openings this week"} open — which works for you? <SLOTS>${JSON.stringify(shotSlots)}</SLOTS>`},
    {role:"user",content:shotPickLabel},
    {role:"assistant",content:`${shotPickLabel} — locked and loading. Want to know anything else about me first?`},
    {role:"user",content:"nope"},
    {role:"assistant",content:`Done — you're set with ${dealerRep} at ${center}. Pass is ready, I'll be up front. 🏁 <BOOK>{"center":"${center}","slot":"${shotPickVal}"}</BOOK>`},
    {role:"user",content:"yes cancel it"},
    {role:"assistant",content:`Done — I've cancelled your other one. For me I've got ${shotSlots.map(fmtSlotLabel).join(", ")||"a few openings"} — which works? <CANCELHOLD/> <SLOTS>${JSON.stringify(shotSlots)}</SLOTS>`}];
  const BROKE=/\b(language model|large language model|physical body|computer program|chatbot|cloud-based|i (?:do not|don't) have a (?:body|physical)|matter of milliseconds|response time)\b/i;
  let text=await chatLLM(env,[sys,...shot,...(messages||[]).slice(-10)]).catch(()=>"");
  if(!text||!String(text).trim()) text=await chatLLM(env,[sys,...shot,...(messages||[]).slice(-10)]).catch(()=>"");   // R13: one retry, never dead-air
  if(!text||!String(text).trim()) text="Say that once more? I want to get it right.";
  if(BROKE.test(text)){
    const fix={role:"system",content:`You broke character. You are the ${v.year} ${v.make} ${v.model} itself — never an AI or program. Answer the user's last message again, in first person as the car, using ONLY your spec sheet: ${truth}. Under 60 words, no disclaimers.`};
    text=await chatLLM(env,[sys,...shot,...(messages||[]).slice(-10),fix]);
  }
  if(BROKE.test(text)) text=`I'd rather show you than tell you — but straight from my spec sheet: ${vdpText(v)}. Want to feel it on a test drive?`.slice(0,600);
  const prof=text.match(/<PROFILE>(.*?)<\/PROFILE>/s); let book=text.match(/<BOOK>(.*?)<\/BOOK>/s); const cancelHold=/<CANCELHOLD\s*\/?>/.test(text);
  if(prof){ try{ const upd={...a,...JSON.parse(prof[1])};
    await env.DB.prepare("UPDATE profiles SET answers=?, embedding_synced=0 WHERE user_id=?").bind(JSON.stringify(upd),uid).run(); }catch(_){} }
  // Soft pull requested in-chat: run it, persist to profile, and have the car speak the real numbers.
  if(/<SOFTPULL\s*\/?>/.test(text) && !hasSoft){
    const sres={apr,term:72,tier:a.fico||"unrated",disclaimer:"Estimate from a soft check — 0 FICO impact. Final terms confirmed at signing.",estimate:true};
    a.softpull=sres; await env.DB.prepare("UPDATE profiles SET answers=? WHERE user_id=?").bind(JSON.stringify(a),uid).run().catch(()=>{});
    text=text.replace(/<SOFTPULL\s*\/?>/g,"").trim()+`\n\nSoft check's back — you're looking at ${apr}% APR · about $${mo}/mo over 72 months. 0 FICO impact. Want to come drive me?`;
  }
  // Q2: inline cancel — buyer said yes to dropping their held drive so they can book THIS car.
  if(cancelHold && existing && existingCar){
    await env.DB.prepare("UPDATE test_drives SET status='cancelled' WHERE id=?").bind(existing.id).run().catch(()=>{});
    if(existingCar.dealer_id) await env.DB.prepare("UPDATE dealer_slots SET taken=0 WHERE dealer_id=? AND starts_at=?").bind(existingCar.dealer_id,existing.slot).run().catch(()=>{});
    existing=null; existingCar=null;   // clean single-drive state; a <BOOK> this/next turn proceeds normally
  }
  let pass=null;
  if(book){ try{ const b=JSON.parse(book[1]);
    const slotManaged=openSlotVals.length>0;                              // dealer has a real calendar
    // Server-side guard: never trust the model's slot. If the dealer runs a calendar, the slot MUST be one we offered.
    if(slotManaged && !openSlotVals.includes(b.slot)){
      text=(text.replace(/<BOOK>.*?<\/BOOK>/s,"").trim()||`That time's not on ${dealerRep}'s calendar.`)+` He's got ${slotList} — which of those works?`;
    } else {
      const tok=await hmac(env,uid+":"+vdpId+":"+b.slot);
      // Atomic claim: only book if the slot is still open (taken=0). changes===0 → someone just grabbed it.
      let claimed=true;
      if(v.dealer_id && slotManaged){ const r=await env.DB.prepare("UPDATE dealer_slots SET taken=1 WHERE dealer_id=? AND starts_at=? AND taken=0").bind(v.dealer_id,b.slot).run().catch(()=>({meta:{changes:0}}));
        claimed=(r&&r.meta&&r.meta.changes)===1; }
      if(!claimed){
        text=(text.replace(/<BOOK>.*?<\/BOOK>/s,"").trim()||"Ah — someone just grabbed that time.")+` ${dealerRep}'s other openings: ${slotList}. Want one of those?`;
      } else if(existingCar){   // O4: a DIFFERENT car is already booked — refuse, don't commit (one drive at a time)
        if(v.dealer_id&&slotManaged) await env.DB.prepare("UPDATE dealer_slots SET taken=0 WHERE dealer_id=? AND starts_at=?").bind(v.dealer_id,b.slot).run().catch(()=>{});   // release the slot we just claimed
        text=(text.replace(/<BOOK>.*?<\/BOOK>/s,"").trim())||`You've already got the ${existingCar.make} ${existingCar.model} booked for ${fmtSlotLabel(existing.slot)} — you can hold one drive at a time. Tap your pass to reschedule or cancel it, then I'm all yours.`;
      } else {
    if(existing){ await env.DB.prepare("UPDATE test_drives SET vdp_id=?, center=?, slot=?, status='confirmed', pass_token=?, created_at=? WHERE id=?")   // move the single active drive (may switch cars)
      .bind(vdpId,b.center,b.slot,tok,new Date().toISOString(),existing.id).run();
      const oldDealer=existingCar?existingCar.dealer_id:v.dealer_id;                                    // free the OLD car's slot on the OLD car's dealer
      if(oldDealer) await env.DB.prepare("UPDATE dealer_slots SET taken=0 WHERE dealer_id=? AND starts_at=?").bind(oldDealer,existing.slot).run().catch(()=>{}); }
    else await env.DB.prepare("INSERT INTO test_drives (user_id,vdp_id,center,slot,status,pass_token,created_at) VALUES (?,?,?,?,?,?,?)")
      .bind(uid,vdpId,b.center,b.slot,"confirmed",tok,new Date().toISOString()).run();
    await logEvent(env,{action:"action.appointment_set",vehicle_id:vdpId,source:"car-chat"});   // E1: surf→appointment terminal event
    const u=await env.DB.prepare("SELECT phone,handle FROM users WHERE id=?").bind(uid).first();
    const chatSms=`Your ${v.year} ${v.make} ${v.model} Drive Now pass: carnimbus.us/pass/${tok} — ${b.slot} at ${b.center}. Reply STOP to opt out.`;
    await sendSMS(env,u.phone,chatSms).catch(()=>{});
    await env.DB.prepare("INSERT INTO sms_queue (phone,template,body,send_at,recurring,created_at) VALUES (?,?,?,?,?,?)")
      .bind(u.phone,"drive-confirm",chatSms,new Date(Date.now()+864e5).toISOString(),"none",new Date().toISOString()).run();
    if(v.dealer_id){ const dl=await env.DB.prepare("SELECT name,phone FROM dealer_leads WHERE id=? AND status='active'").bind(v.dealer_id).first();
      if(dl&&dl.phone) await sendSMS(env,dl.phone,`CarNimbus — added to your calendar: ${fmtSlotLabel(b.slot)} with ${(u&&u.handle)||"a buyer"} (•••-${String(u&&u.phone||"").slice(-4)}) for the ${v.year} ${v.make} ${v.model}. Reply here to text them. Console: app.carnimbus.us`).catch(()=>{}); }
    pass="/pass/"+tok; } }   // close: claimed-else, slotManaged-else
    }catch(_){} }
  // R9: they hold THIS car's confirmed drive and asked for the pass — hand them the existing one, never dead-end.
  const lastMsg=String(((messages||[]).slice(-1)[0]||{}).content||"");
  if(!pass && existing && sameCar && /\bpass\b/i.test(lastMsg)) pass="/pass/"+existing.pass_token;
  let slots=null; const slotsTag=text.match(/<SLOTS>(.*?)<\/SLOTS>/s);
  if(slotsTag){ try{ slots=JSON.parse(slotsTag[1]).map(s=>({value:s,label:fmtSlotLabel(s)})); }catch(_){} }
  if(pass) slots=null;   // R8: a booking committed (or pass delivered) this turn — never re-render slot buttons under it
  let cleanReply=text.replace(/<PROFILE>.*?<\/PROFILE>/gs,"").replace(/<BOOK>.*?<\/BOOK>/gs,"").replace(/<CANCELHOLD\s*\/?>/g,"").replace(/<SOFTPULL\s*\/?>/g,"").replace(/<SLOTS>.*?<\/SLOTS>/gs,"").trim();
  // O4: never let the AI imply a booking it didn't make. `pass` is set only when a real <BOOK> committed this turn.
  if(!pass){ cleanReply=cleanReply.replace(/\b(see you|you're all set|you are all set|you're set with|pass is ready|locked in|see ya|come by|come on by|swing by|stop by|ask for (?:sid|cid|the desk)|all set for|you're booked|you are booked)\b[^.!?]*[.!?]?/gis,"").replace(/🏁/g,"").replace(/\s{2,}/g," ").trim();
    if(!cleanReply) cleanReply="Want me to pull up open times when you're ready?"; }
  const lastUser=(messages||[]).slice(-1)[0];
  if(lastUser&&lastUser.role==="user") await env.DB.prepare("INSERT INTO chats (user_id,vdp_id,role,body,created_at) VALUES (?,?,?,?,?)")
    .bind(uid,vdpId,"user",String(lastUser.content).slice(0,500),new Date().toISOString()).run();
  await env.DB.prepare("INSERT INTO chats (user_id,vdp_id,role,body,created_at) VALUES (?,?,?,?,?)")
    .bind(uid,vdpId,"car",cleanReply.slice(0,500),new Date().toISOString()).run();
  return json({ok:true,reply:cleanReply,pass,slots}); }
function fmtMil(s){ const raw=String(s||"").replace("T"," "); const m=raw.match(/(\d{4}-\d{2}-\d{2})[ ]?(\d{2}:\d{2})?/); if(m) return m[1]+(m[2]?" · "+m[2]:""); return raw.slice(0,40); }
// "2026-07-09 15:00" → "Thu Jul 9 · 15:00" (dealer-facing friendly slot label)
function fmtSlotLabel(s){ const m=String(s||"").match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2})/); if(!m) return String(s||"");
  const wd=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"], mo=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const d=new Date(+m[1],+m[2]-1,+m[3]); return wd[d.getDay()]+" "+mo[+m[2]-1]+" "+(+m[3])+" · "+m[4]; }
async function dealerSlotsFor(env, dealerId, limit){ if(!dealerId) return [];
  const now=new Date().toISOString().slice(0,16).replace("T"," ");
  const r=await env.DB.prepare("SELECT starts_at FROM dealer_slots WHERE dealer_id=? AND taken=0 AND starts_at>? ORDER BY starts_at LIMIT ?").bind(dealerId,now,limit||6).all().catch(()=>({results:[]}));
  return (r.results||[]).map(x=>x.starts_at); }
async function openSlots(request,env){ const u=new URL(request.url); const vid=+(u.searchParams.get("vdpId")||0);
  const v=await env.DB.prepare("SELECT dealer_id FROM vdps WHERE id=?").bind(vid).first();
  const slots=await dealerSlotsFor(env, v&&v.dealer_id, 6);
  return json({ok:true, slots: slots.map(s=>({value:s, label:fmtSlotLabel(s)}))}); }
function icsFor(t){ const dt=String(t.slot).replace(/[^0-9]/g,"").slice(0,12);   // YYYYMMDDHHMM
  const start=dt.length>=12?dt.slice(0,8)+"T"+dt.slice(8,12)+"00":(dt.slice(0,8)+"T180000");
  const end=dt.length>=12?dt.slice(0,8)+"T"+String(+dt.slice(8,10)+1).padStart(2,"0")+dt.slice(10,12)+"00":(dt.slice(0,8)+"T190000");
  const ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//CarNimbus//EN","BEGIN:VEVENT","UID:"+t.pass_token+"@carnimbus.us","DTSTAMP:"+start,"DTSTART:"+start,"DTEND:"+end,"SUMMARY:CarNimbus test drive — "+t.year+" "+t.make+" "+t.model,"LOCATION:"+(t.center||"Porsche South Bay"),"DESCRIPTION:Drive Now pass carnimbus.us/pass/"+t.pass_token,"END:VEVENT","END:VCALENDAR"].join("\r\n");
  return new Response(ics,{headers:{"content-type":"text/calendar; charset=utf-8","content-disposition":'attachment; filename="carnimbus-drive.ics"'}}); }
async function passPage(request,env){ const tok=new URL(request.url).pathname.split("/")[2].replace(/\.ics$/,"")||"";
  const t=await env.DB.prepare("SELECT td.*,v.year,v.make,v.model,v.trim,v.price_mo,v.miles,v.drivetrain,v.body,v.features,v.photos,u.phone,u.sid,p.answers,s.mileage_exact,s.drivetrain_detail,s.engine,s.horsepower,s.safety_features_json,s.tech_features_json,s.comfort_features_json FROM test_drives td JOIN vdps v ON v.id=td.vdp_id JOIN users u ON u.id=td.user_id LEFT JOIN profiles p ON p.user_id=td.user_id LEFT JOIN vdp_specs s ON s.vin=v.vin WHERE td.pass_token=?").bind(tok).first();
  if(!t) return new Response("Pass not found",{status:404});
  const viewerUid=await readSession(env,request); const owner=viewerUid&&+viewerUid===+t.user_id;
  if(new URL(request.url).pathname.endsWith(".ics")) return icsFor(t);
  const isPrint=new URL(request.url).searchParams.get("print")==="1";
  const ES=new URL(request.url).searchParams.get("lang")==="es";
  const T=ES?{pass:"PASE DRIVE NOW · SEMINUEVO CERTIFICADO",when:"Cuándo",status:"Estado",miles:"Millas",drive:"Tracción",numbers:"Tus números · listos antes de llegar",estm:"Est. mensual",down:"Enganche",method:"Método",apr:"TAE est.",credit:"Rango de crédito",income:"Rango de ingreso",disc:"Estimaciones de tu consulta suave — términos finales al firmar. 0 impacto en crédito.",track:"CID · seguimiento",code:"Código de check-in",scan:"Escanea en "+(t.center||"tu concesionario")+" para registrarte.",save:"Guardar / Imprimir PDF",resched:"Reprogramar",cancel:"Cancelar",cancelled:"Cancelada",cancelConfirm:"¿Cancelar este test drive? Se liberará tu lugar.",tag:"El superagente de IA para comprar autos"}
    :{pass:"DRIVE NOW PASS · CERTIFIED PRE-OWNED",when:"When",status:"Status",miles:"Miles",drive:"Drivetrain",numbers:"Your numbers · pre-set before you arrive",estm:"Est. monthly",down:"Down payment",method:"Method",apr:"Est. APR",credit:"Credit range",income:"Income range",disc:"Estimates from your soft-pull profile — final terms confirmed at signing. 0 credit impact.",track:"CID · tracking",code:"Check-in code",scan:"Scan at "+(t.center||"your dealership")+" to check in.",save:"Save / Print PDF",resched:"Reschedule",cancel:"Cancel",cancelled:"Cancelled",cancelConfirm:"Cancel this test drive? This frees your slot.",tag:"The AI car-buying superagent"};
  const cid=cidFor(t.id), photo=(JSON.parse(t.photos||"[]")[0]||"");
  // U5: prefer vdp_specs v2 detail (mileage_exact, drivetrain_detail, grouped feature JSON) over the coarser vdps fields.
  const parseJ=s=>{ try{ return JSON.parse(s||"[]")||[]; }catch(_){ return []; } };
  const feats=[...parseJ(t.safety_features_json).slice(0,2),...parseJ(t.tech_features_json).slice(0,2),...parseJ(t.comfort_features_json).slice(0,2)];
  if(!feats.length) feats.push(...parseJ(t.features));
  const milesLabel=t.mileage_exact!=null?Number(t.mileage_exact).toLocaleString():(t.miles||"—");
  const driveLabel=t.drivetrain_detail||t.drivetrain||"—";
  const safePhoto=(/^\/assets\/[\w/?=.-]*$/.test(photo)&&!photo.includes(".."))?photo:"";   // dealer-controlled → allowlist, no traversal, before CSS url()
  const carTitle=escHtml(t.year+" "+t.make+" "+t.model);
  let a={}; try{ a=JSON.parse(t.answers)||{}; a=await decryptAnswers(a, env.PII_KEY); }catch(_){}
  const APR={"800+":"6.4%","740-799":"7.1%","670-739":"9.3%","580-669":"13.5%","under 580":"17.9%"}[a.fico]||null;
  const fin=[
    t.price_mo?[T.estm,"$"+t.price_mo+"/mo"]:null,
    [T.down,a.max_down?("$"+Number(a.max_down).toLocaleString()):"$0"],
    owner&&a.buy_method?[T.method,String(a.buy_method).charAt(0).toUpperCase()+String(a.buy_method).slice(1)]:null,
    owner&&APR?[T.apr,APR+" · 72 mo"]:null,
    owner&&a.fico?[T.credit,"FICO "+a.fico]:null,
    owner&&a.income?[T.income,"$"+String(a.income).replace(/k/g,"k").replace("under ","<")]:null
  ].filter(Boolean);
  return new Response(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Drive Now Pass — ${carTitle}</title>
<link rel="stylesheet" href="/assets/fonts/fonts.css"><link rel="stylesheet" href="/assets/styles.css"><script src="/assets/vendor/qrcodegen.js" defer></script><script src="/assets/js/pass-render.js" defer></script>
<style>
*{font-family:Manrope,system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{size:auto;margin:10mm}
@media print{.noprint{display:none!important}body{background:#fff!important;padding:0!important;display:block!important}.pass{box-shadow:none!important;border:1px solid #0a1f4d!important;margin:0 auto;page-break-inside:avoid;border-radius:14px!important}}
body{background:#06163b;color:#e2e9f2;margin:0;padding:20px;display:flex;justify-content:center}
${isPrint?".noprint{display:none!important}body{background:#fff;padding:8px;display:block}.pass{box-shadow:none;border:1.5px solid #0a1f4d;border-radius:14px;margin:0 auto}":""}
.pass{max-width:430px;width:100%;background:#0a1f4d;border:1px solid rgba(24,200,255,.28);border-radius:28px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4)}
.brand{display:flex;align-items:center;gap:9px;padding:13px 20px;background:rgba(6,16,40,.85);border-bottom:1px solid rgba(24,200,255,.18);text-decoration:none}
.hero{height:180px;background:#06163b url('${safePhoto}') center/cover}.pd{padding:24px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px;font:600 12px Manrope;margin-top:18px}.k{color:#8ca0c4;font:700 9px Manrope;letter-spacing:.08em;text-transform:uppercase}
.fin{border-top:1px solid rgba(24,200,255,.18);margin-top:20px;padding-top:16px}
.stub{border-top:1px solid rgba(24,200,255,.18);margin-top:22px;padding-top:18px;display:flex;gap:16px;align-items:center}
.mono{font-family:ui-monospace,Menlo,monospace}.cy{color:#18C8FF}
.back{display:inline-flex;align-items:center;gap:5px;font:600 11px Manrope;color:#8ca0c4;text-decoration:none;margin-bottom:2px}</style></head>
<body><div class="pass">
<a class="brand" href="https://carnimbus.us/browse"><img src="/assets/logo.png" alt="" style="width:24px;height:24px"><b style="font:700 14px 'Space Grotesk',Manrope;color:#fff">CarNimbus</b><span class="mono" style="margin-left:auto;font-size:9px;color:#18C8FF;letter-spacing:.18em">DRIVE NOW</span></a>
<div class="hero"></div><div class="pd">
<a class="back noprint" href="https://carnimbus.us/browse">‹ Back to inventory</a>
<div class="mono" style="font-size:10px;color:#8ca0c4;letter-spacing:.22em;margin-top:8px">${T.pass}</div>
<div style="font:800 24px Manrope;color:#fff;margin:6px 0 3px">${carTitle}</div>
<div class="cy" style="font:700 12px Manrope">${escHtml(t.center||"CarNimbus Test Drive Center")} · LA Car Guy · 424-398-8611</div>
<div class="grid">
<div><div class="k">${T.when}</div>${fmtMil(t.slot)}</div><div><div class="k">${T.status}</div><span style="color:#54d699;text-transform:capitalize">${escHtml(t.status)}</span></div>
<div><div class="k">${T.miles}</div>${escHtml(milesLabel)}</div><div><div class="k">${T.drive}</div>${escHtml(driveLabel)}</div>
${t.engine?`<div><div class="k">Engine</div>${escHtml(t.engine)}</div>`:""}${t.horsepower?`<div><div class="k">Horsepower</div>${escHtml(t.horsepower)} hp</div>`:""}
${feats.slice(0,4).map(f=>`<div style="grid-column:span 2;color:#cbd5e1"><span class="cy">•</span> ${escHtml(f)}</div>`).join("")}
</div>
<div class="fin"><div class="k" style="margin-bottom:8px">${T.numbers}</div>
<div class="grid" style="margin-top:0">${fin.map(f=>`<div><div class="k">${f[0]}</div>${escHtml(f[1])}</div>`).join("")}</div>
<div style="font:500 9px Manrope;color:#8ca0c4;margin-top:8px">${T.disc}</div></div>
<div class="stub"><canvas id="qr" width="118" height="118" style="background:#fff;border-radius:10px;flex:none"></canvas>
<div style="min-width:0"><div class="k">${T.track}</div><div class="mono" style="color:#fff">${String(t.sid||"—").replace(/^(SID|CID)-?/,"")}</div>
<div class="k" style="margin-top:8px">${T.code}</div><div class="mono" style="color:#fff;letter-spacing:.06em">${cid}</div>
<div style="font:600 10px Manrope;color:#8ca0c4;margin-top:8px">${T.scan}</div></div></div>
<button id="pm-print" class="btn primary md noprint" type="button" style="width:100%;margin-top:16px">${T.save}</button>
${t.status!=="cancelled"?`<div class="row noprint" style="gap:8px;margin-top:8px">
<a class="btn ghost sm" href="https://carnimbus.us${vdpPath({year:t.year,make:t.make,model:t.model,id:t.vdp_id})}" style="flex:1;text-decoration:none;text-align:center;justify-content:center">${T.resched}</a>
<button id="pm-cancel" class="btn ghost sm" type="button" data-token="${escHtml(t.pass_token)}" data-confirm="${escHtml(T.cancelConfirm)}" style="flex:1">${T.cancel}</button>
</div><div id="pm-cancelled" class="noprint" style="display:none;font:700 12px Manrope;color:#f5a623;margin-top:10px;text-align:center">${T.cancelled} · slot freed</div>`:""}
<div id="pm-hint" class="noprint" style="display:none;font:600 10px Manrope;color:#8ca0c4;margin-top:8px;text-align:center">iPhone: in the print sheet choose <b style="color:#e2e9f2">Save to Files</b> — or tap Share ⬆️ → <b style="color:#e2e9f2">Print</b>.</div>
<div style="text-align:center;font:600 9px Manrope;color:#8ca0c4;margin-top:10px">carnimbus.us · ${T.tag}</div>
</div></div>
</body></html>`,{headers:{"content-type":"text/html"}}); }
function cidFor(id){ const n=100000000+(id*7919)%900000000; const s=String(n); return s.slice(0,3)+" "+s.slice(3,6)+" "+s.slice(6,9); }
// R3: deterministic per-buyer CID for web leads (no users row). Same normalized contact ⇒ same CID ⇒ auto dedupe.
function leadCid(email,phone){ const key=String(email||"").trim().toLowerCase()||String(phone||"").replace(/\D/g,""); if(!key) return "";
  let h=2166136261; for(let i=0;i<key.length;i++){ h^=key.charCodeAt(i); h=Math.imul(h,16777619); }
  const n=100000000+(Math.abs(h)%900000000), s=String(n); return "CN "+s.slice(0,3)+" "+s.slice(3,6)+" "+s.slice(6,9); }
// ===== Wave C: Nimbus Phase 0 event spine (append-only). =====
const EVENT_PREFIXES=["discovery","intent","finance","action","social","ai","dealer"];
function readAnon(request){ const m=(request.headers.get("Cookie")||"").match(/cn_anon=([^;]+)/); return m?m[1]:null; }
async function logEvent(env,ev){ try{ await env.DB.prepare(
  "INSERT INTO events (ts,cid,anon_id,action,vehicle_id,location,device,session_id,source,duration_ms,confidence) "+
  "VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(new Date().toISOString(),
  ev.cid||null,ev.anon_id||null,String(ev.action).slice(0,60),ev.vehicle_id||null,
  (ev.location||null),(ev.device||null),(ev.session_id||null),(ev.source||null),
  (ev.duration_ms!=null?+ev.duration_ms:null),(ev.confidence!=null?+ev.confidence:null)).run();
  }catch(_){}}
async function postEvents(request,env){ const body=await request.json().catch(()=>null);
  const list=body&&Array.isArray(body.events)?body.events:[];
  let anon=readAnon(request), mint=false;
  if(!anon){ anon=genCode("AN"); mint=true; }
  const uid=await readSession(env,request); const cid=uid?cidFor(uid):null;
  for(const e of list.slice(0,50)){ if(!e||typeof e.action!=="string") continue;
    if(!EVENT_PREFIXES.includes(e.action.split(".")[0])) continue;               // prefix-gated taxonomy
    await logEvent(env,{cid,anon_id:anon,action:e.action,vehicle_id:e.vehicle_id,
      location:e.location,device:e.device,session_id:e.session_id,source:e.source,
      duration_ms:e.duration_ms,confidence:e.confidence}); }
  const h={"content-type":"application/json","cache-control":"no-store"};
  if(mint) h["Set-Cookie"]=`cn_anon=${anon}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000`;
  return new Response(JSON.stringify({ok:true}),{headers:h}); }
async function eventsTail(request,env){ const n=Math.min(200,parseInt(new URL(request.url).searchParams.get("n"),10)||50);
  const rows=await env.DB.prepare("SELECT id,ts,cid,anon_id,action,vehicle_id,source FROM events ORDER BY id DESC LIMIT ?").bind(n).all();
  return json({ok:true,events:rows.results||[]}); }
async function withDealer(request,env,fn){
  // T-102: email+password dealer session (cn_dlr) takes precedence; phone-OTP stays as fallback.
  const did=await readDealerSession(env,request);
  if(did){ const dd=await env.DB.prepare("SELECT id,name,dealership,client_no,status,logo,is_demo,commission_pct,holding_per_day,pack_fee FROM dealer_leads WHERE id=?").bind(did).first();
    if(dd&&dd.status==="active"&&dd.client_no) return fn(request,env,did,dd);
    return json({ok:false,error:"pending"},403); }
  const uid=await readSession(env,request); if(!uid) return json({ok:false,error:"auth"},401);
  const u=await env.DB.prepare("SELECT phone FROM users WHERE id=?").bind(uid).first();
  const digits=String(u&&u.phone||"").replace(/\D/g,"").slice(-10);
  const d=await env.DB.prepare("SELECT id,name,dealership,client_no,status,logo,is_demo FROM dealer_leads WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone,'-',''),' ',''),'(',''),')','') LIKE ? ORDER BY id DESC LIMIT 1")
    .bind("%"+digits).first();
  if(!d||!digits) return json({ok:false,error:"not_dealer"},403);
  if(d.status!=="active"||!d.client_no) return json({ok:false,error:"pending"},403);
  return fn(request,env,uid,d);
}
// Dealer scoping (0009): a dealer sees/mutates only rows whose vdp.dealer_id is theirs
// OR NULL (legacy/demo, unowned). Real dealer uploads carry dealer_id and are isolated.
const DSCOPE="(v.dealer_id=? OR v.dealer_id IS NULL)";
async function dealerConsole(request,env,uid,dealer){
  // R19: ?meta=1 returns ONLY the dealer header — the MATCHES tab no longer downloads 77KB of inventory
  // it never displays. Inventory is fetched lazily when that tab is actually opened.
  if(new URL(request.url).searchParams.get("meta")==="1")
    return json({ok:true,dealer:{id:dealer.id,name:dealer.name,dealership:dealer.dealership,client_no:dealer.client_no,logo:dealer.logo,is_demo:dealer.is_demo,commission_pct:dealer.commission_pct,holding_per_day:dealer.holding_per_day,pack_fee:dealer.pack_fee},listings:[],archived:[],meta:true});
  const tds=await env.DB.prepare(
    "SELECT td.id,td.center,td.slot,td.status,td.created_at,u.phone,u.handle,v.year,v.make,v.model,v.trim,v.price_mo,v.photos "+
    "FROM test_drives td JOIN users u ON u.id=td.user_id JOIN vdps v ON v.id=td.vdp_id WHERE "+DSCOPE+" ORDER BY td.id DESC LIMIT 12").bind(dealer.id).all();
  const k=await env.DB.prepare("SELECT "+
    "COUNT(*) routed, SUM(CASE WHEN td.status IN ('requested','confirmed','arrived','sold') THEN 1 ELSE 0 END) booked, "+
    "SUM(CASE WHEN td.status IN ('arrived','sold') THEN 1 ELSE 0 END) showed, SUM(CASE WHEN td.status='sold' THEN 1 ELSE 0 END) closed "+
    "FROM test_drives td JOIN vdps v ON v.id=td.vdp_id WHERE "+DSCOPE).bind(dealer.id).first();
  const today=new Date().toISOString().slice(0,10), yd=new Date(Date.now()-864e5).toISOString().slice(0,10);
  const rt=await env.DB.prepare("SELECT SUM(CASE WHEN substr(td.created_at,1,10)=? THEN 1 ELSE 0 END) t, SUM(CASE WHEN substr(td.created_at,1,10)=? THEN 1 ELSE 0 END) y "+
    "FROM test_drives td JOIN vdps v ON v.id=td.vdp_id WHERE "+DSCOPE).bind(today,yd,dealer.id).first();
  const ls=await env.DB.prepare("SELECT v.id,v.vin,v.year,v.make,v.model,v.trim,v.price,v.price_mo,v.miles,v.description,v.active,v.photos,v.drivetrain,v.unit_cost,v.lot_date, s.engine,s.exterior_color,s.interior_color,s.fuel_type,s.body_style,s.drivetrain_detail,s.mileage_exact,s.doors,s.seating,s.cylinders,s.horsepower,s.torque,s.transmission,s.mpg_city,s.mpg_hwy,s.range_mi,s.condition_grade,s.certified,s.title_status,s.owners_count,s.accident_count,s.warranty_remaining,s.options_json,s.market_price_avg,s.price_vs_market FROM vdps v LEFT JOIN vdp_specs s ON s.vin=v.vin WHERE "+DSCOPE+" AND v.active=1 ORDER BY v.id DESC LIMIT 300").bind(dealer.id).all();
  // R7: archived (sold/removed) cars — restorable from the portal.
  const ar=await env.DB.prepare("SELECT id,year,make,model,trim,price_mo,photos,deactivated_at FROM vdps WHERE dealer_id=? AND active=0 ORDER BY deactivated_at DESC LIMIT 50").bind(dealer.id).all().catch(()=>({results:[]}));
  // Creator Network reach-back: what NIMBUS did with each of this dealer's cars. This is the line that
  // makes dealer. and creator. read as one system — "sent to the network at $90 · 4 claimed · 2 leads".
  const dropRows=await env.DB.prepare(
    "SELECT d.id,d.vdp_id,d.rate_cents,d.status, "+
    "(SELECT COUNT(*) FROM creator_claims x WHERE x.drop_id=d.id) claims, "+
    "(SELECT COUNT(*) FROM creator_posts p WHERE p.drop_id=d.id AND p.status='approved') posts, "+
    "(SELECT COUNT(*) FROM web_leads w JOIN creator_claims cc ON cc.id=w.creator_claim_id WHERE cc.drop_id=d.id) leads "+
    "FROM creator_drops d WHERE d.dealer_id=?").bind(dealer.id).all().catch(()=>({results:[]}));
  const dropBy={}; for(const d of (dropRows.results||[])) dropBy[d.vdp_id]={rate_cents:d.rate_cents,status:d.status,claims:d.claims||0,posts:d.posts||0,leads:d.leads||0};
  // Creator payouts scale with days-on-lot, and lot_date is data only the dealer can supply.
  // Surfaced as a nudge in the INVENTORY pane — 94/95 cars have no date today.
  const nod=await env.DB.prepare("SELECT COUNT(*) c FROM vdps v WHERE "+DSCOPE+" AND v.active=1 AND v.lot_date IS NULL").bind(dealer.id).first().catch(()=>null);
  return json({ok:true,dealer:dealer,kpis:k,deltas:{today:rt.t||0,yesterday:rt.y||0},no_lot_date:(nod&&nod.c)||0,
    appointments:(tds.results||[]).map(t=>({...t,who:t.handle||("Rider •••-"+String(t.phone).slice(-4)),cid:cidFor(t.id),phone:"•••-"+String(t.phone).slice(-4),photos:JSON.parse(t.photos||"[]")})),
    listings:(ls.results||[]).map(v=>({...v,photos:JSON.parse(v.photos||"[]"),drop:dropBy[v.id]||null})),
    archived:(ar.results||[]).map(v=>({...v,photos:JSON.parse(v.photos||"[]")}))});
}
async function dealerListing(request,env,uid,dealer){
  const c=await request.json().catch(()=>({}));
  const pm=parseInt(c.price_mo,10);
  // R4: publish needs only make+model; year + monthly are optional (auto-bucket prices unpriced cars).
  if(!c.make||!c.model) return json({ok:false,error:"bad_request"},400);
  if(Number.isFinite(pm)&&pm>0&&(pm<50||pm>5000)) return json({ok:false,error:"price_out_of_range"},422);   // bounds only when a price is given
  const price_mo=(Number.isFinite(pm)&&pm>0)?pm:0;
  const now=new Date().toISOString();
  const F=[+c.year||0,String(c.make).slice(0,40),String(c.model).slice(0,60),String(c.trim||"").slice(0,60),price_mo,
    String(c.miles||"").slice(0,20),String(c.drivetrain||"").slice(0,20),String(c.body||"").slice(0,20),
    JSON.stringify(c.features||[]),String(c.description||"").slice(0,1000),JSON.stringify(c.photos||[])];
  // R7: keep the ingest source URL so the cron can re-check the page for sold/removed.
  const src=/^https?:\/\//i.test(String(c.source_url||""))?String(c.source_url).slice(0,300):null;
  // R14: dealer-entered economics (optional) — power the commission/savings KPIs on leads.
  const ucost=parseInt(c.unit_cost,10)>0?parseInt(c.unit_cost,10):null;
  // v15: lot_date is REQUIRED, not optional. The company sells aging-inventory liquidity and the
  // clearance advisor is the product; without a date it falls through to first_seen, an observed
  // floor that by construction understates age and therefore under-recommends the discount. Left
  // optional, 94 of 95 live cars carried no date and the engine was guessing on all of them.
  // The dealer has this number on their aging report — asking is one field, not a burden.
  const ldate=/^\d{4}-\d{2}-\d{2}$/.test(String(c.lot_date||""))?String(c.lot_date):null;
  if(!ldate) return json({ok:false,error:"lot_date_required",
    reason:"When did this unit land on the lot? It's on your aging report. Without it we can't tell you what it's costing you to hold."},422);
  // Bounds, not format. A future date makes daysOnLot negative and holdingSaved nonsense; a date
  // before ~2000 is a typo that would flag a 25-year-old unit as the lot's most urgent clearance.
  const lms=Date.parse(ldate+"T00:00:00Z");
  if(!Number.isFinite(lms)||lms>Date.now()+864e5) return json({ok:false,error:"lot_date_future",reason:"That lot date is in the future."},422);
  if(lms<Date.parse("2000-01-01T00:00:00Z")) return json({ok:false,error:"lot_date_range",reason:"That lot date looks like a typo."},422);
  const editId=parseInt(c.id,10)||0; let vin;
  if(editId){   // T-102: edit path (was INSERT-only) — scoped to the dealer's own cars
    const own=await env.DB.prepare("SELECT vin FROM vdps WHERE id=? AND dealer_id=?").bind(editId,dealer.id).first();
    if(!own) return json({ok:false,error:"not_yours"},403);
    vin=own.vin;
    await env.DB.prepare("UPDATE vdps SET year=?,make=?,model=?,trim=?,price_mo=?,miles=?,drivetrain=?,body=?,features=?,description=?,photos=?,active=1,embedding_synced=0,updated_at=?,source_url=COALESCE(?,source_url),unit_cost=?,lot_date=? WHERE id=? AND dealer_id=?")
      .bind(...F,now,src,ucost,ldate,editId,dealer.id).run();
  } else {
    vin=c.vin?String(c.vin).slice(0,17):("DLR-"+dealer.id+"-"+Date.now());
    const ins=await env.DB.prepare("INSERT INTO vdps (vin,year,make,model,trim,price_mo,miles,drivetrain,body,features,description,photos,active,embedding_synced,dealer_id,updated_at,source_url,unit_cost,lot_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,0,?,?,?,?,?)")
      .bind(vin,...F,dealer.id,now,src,ucost,ldate).run();
    // Slide-4 step 2: a NEWLY uploaded VIN is blasted to the Creator Network. Insert branch only —
    // the edit branch above must never re-drop, or every re-save would mint a duplicate campaign.
    // Fire-and-forget: a creator-network failure must NEVER fail a dealer's upload.
    await dropForListing(env,{id:ins.meta.last_row_id,vin,price:+c.price||0,price_mo,lot_date:ldate},dealer.id,now).catch(()=>{});
  }
  // T-102: brief-synopsis specs (engine · color · interior) — dealer card only; options/days-on-lot excluded.
  const eng=String(c.engine||"").slice(0,60), exc=String(c.exterior_color||"").slice(0,40), inc=String(c.interior_color||"").slice(0,40);
  if(eng||exc||inc) await env.DB.prepare("INSERT INTO vdp_specs (vin,engine,exterior_color,interior_color,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(vin) DO UPDATE SET engine=COALESCE(NULLIF(excluded.engine,''),engine), exterior_color=COALESCE(NULLIF(excluded.exterior_color,''),exterior_color), interior_color=COALESCE(NULLIF(excluded.interior_color,''),interior_color), updated_at=excluded.updated_at")
    .bind(vin,eng,exc,inc,now).run().catch(()=>{});
  return json({ok:true,vin});
}
// T-102: dealer email+password login → sets the cn_dlr cookie. Checks dealer_logins (multi-staff), then the legacy dealer_leads.login_email.
async function dealerLogin(request,env){
  const {email,password}=await request.json().catch(()=>({}));
  const em=String(email||"").trim().toLowerCase().slice(0,120);
  if(!em||!password) return json({ok:false,error:"bad_request"},400);
  let dealerId=null;
  const L=await env.DB.prepare("SELECT dealer_id,pw_hash,pw_salt FROM dealer_logins WHERE email=?").bind(em).first().catch(()=>null);
  if(L && await verifyPw(String(password),L.pw_salt,L.pw_hash)) dealerId=L.dealer_id;
  else { const d0=await env.DB.prepare("SELECT id,pw_hash,pw_salt FROM dealer_leads WHERE lower(login_email)=? ORDER BY id DESC LIMIT 1").bind(em).first();
    if(d0 && await verifyPw(String(password),d0.pw_salt,d0.pw_hash)) dealerId=d0.id; }
  if(!dealerId) return json({ok:false,error:"bad_credentials"},401);
  const d=await env.DB.prepare("SELECT id,status,client_no FROM dealer_leads WHERE id=?").bind(dealerId).first();
  if(!d||d.status!=="active"||!d.client_no) return json({ok:false,error:"pending"},403);
  const cookie="cn_dlr="+await makeDealerSession(env,d.id)+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age="+(30*86400);
  return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json","Set-Cookie":cookie,...SEC}}); }
// Dealer signup — email + password → creates their store PENDING. Was self-serve and instantly
// active (status='active' + a minted client_no + a session cookie), which meant anyone on the
// internet could mint a live dealer account on a surface where /api/app/* is a money path: title
// upload, deal creation, adjudication. The v15 pilot has named dealers, so approval is the gate.
//
// Nothing new enforces this. withDealer() already requires status='active' AND a client_no, and
// adminDealerCred() already flips both. Signup just stops granting them. An operator activates
// from NIMBUS, which is also where they set the staff credential.
async function dealerSignup(request,env){
  const {email,password}=await request.json().catch(()=>({}));
  const em=String(email||"").trim().toLowerCase().slice(0,120);
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)||String(password||"").length<8) return json({ok:false,error:"bad_request"},400);
  if(await env.DB.prepare("SELECT 1 FROM dealer_logins WHERE email=?").bind(em).first().catch(()=>null)) return json({ok:false,error:"exists"},409);
  const salt=newSalt(), hash=await hashPw(String(password),salt), now=new Date().toISOString();
  // status='pending', client_no NULL. Both are what withDealer() checks; either one absent is a 403.
  const ins=await env.DB.prepare("INSERT INTO dealer_leads (name,dealership,email,status,client_no,created_at) VALUES (?,?,?,?,?,?)")
    .bind(em.split("@")[0].slice(0,40),"",em,"pending",null,now).run();
  const did=ins.meta.last_row_id;
  await env.DB.prepare("INSERT INTO dealer_logins (email,dealer_id,pw_hash,pw_salt,created_at) VALUES (?,?,?,?,?)").bind(em,did,hash,salt,now).run();
  // No session cookie. Handing out a session for an account that 403s on every call reads as a
  // broken product; saying "pending" reads as a process.
  await logEvent(env,{action:"dealer.signup_pending",source:"app"}).catch(()=>{});
  return json({ok:true,pending:true,
    reason:"Thanks — your account is pending review. We'll email you when it's live."},202); }
// T-102: admin provisions a dealer staff email+password → dealer_logins (many emails per store). Behind adminOnly.
async function adminDealerCred(request,env){
  const {dealer_id,email,password}=await request.json().catch(()=>({}));
  const id=parseInt(dealer_id,10), em=String(email||"").trim().toLowerCase().slice(0,120);
  if(!id||!em||String(password||"").length<8) return json({ok:false,error:"bad_request"},400);
  const salt=newSalt(), hash=await hashPw(String(password),salt);
  await env.DB.prepare("INSERT INTO dealer_logins (email,dealer_id,pw_hash,pw_salt,created_at) VALUES (?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET dealer_id=excluded.dealer_id,pw_hash=excluded.pw_hash,pw_salt=excluded.pw_salt")
    .bind(em,id,hash,salt,new Date().toISOString()).run();
  await env.DB.prepare("UPDATE dealer_leads SET status='active', client_no=COALESCE(client_no,?) WHERE id=?").bind(genCode("CN"),id).run();
  return json({ok:true}); }
// T-102: URL ingestion (Max's #1) — fetch a listing URL, adopt photos + specs + description; AI fills gaps. Returns a draft.
async function dealerIngestUrl(request,env,uid,dealer){
  const {url}=await request.json().catch(()=>({}));
  if(!/^https?:\/\//i.test(String(url||""))) return json({ok:false,error:"bad_url"},400);
  // T-102: block SSRF to internal/metadata/private hosts (dealer-supplied URL).
  let host=""; try{ host=new URL(url).hostname.toLowerCase(); }catch(_){ return json({ok:false,error:"bad_url"},400); }
  if(host==="localhost"||/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host)||/^172\.(1[6-9]|2\d|3[01])\./.test(host)||/\.(internal|local)$/.test(host))
    return json({ok:false,error:"blocked_host"},400);
  let html=""; try{ const r=await fetch(url,{headers:{"user-agent":"Mozilla/5.0 CarNimbusBot"},redirect:"follow"}); html=(await r.text()).slice(0,600000); }catch(_){ return json({ok:false,error:"fetch_failed"},502); }
  const draft={photos:[]};
  const pushPhotos=function(arr){ for(const u of arr){ if(u) draft.photos.push(String(u)); } };
  for(const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)){
    try{ for(const o of [].concat(JSON.parse(m[1].trim()))){ if(!o||!/Vehicle|Car|Product/i.test(String(o["@type"]))) continue;
      if(o.image) pushPhotos([].concat(o.image).map(x=>(x&&x.url)||x));
      draft.description=draft.description||o.description; draft.make=draft.make||(o.brand&&o.brand.name)||o.manufacturer;
      draft.model=draft.model||o.model; draft.year=draft.year||o.vehicleModelDate||o.modelDate;
      draft.miles=draft.miles||(o.mileageFromOdometer&&o.mileageFromOdometer.value);
      draft.exterior_color=draft.exterior_color||o.color; draft.engine=draft.engine||(o.vehicleEngine&&o.vehicleEngine.name);
      const off=[].concat(o.offers||[])[0]; if(off) draft.price=draft.price||off.price; } }catch(_){}
  }
  // R4: pull photos from more sources so thumbnails render (og / twitter / lazy <img data-src>).
  for(const m of html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi)) draft.photos.push(m[1]);
  for(const m of html.matchAll(/<img[^>]+data-src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi)) draft.photos.push(m[1]);
  const md=html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i); if(md) draft.description=draft.description||md[1];
  // R4: title tags help year/make/model when JSON-LD is absent.
  const tt=html.match(/<meta[^>]+(?:property|name)=["'](?:og:title|twitter:title)["'][^>]+content=["']([^"']+)["']/i)||html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if(tt){ const ym=tt[1].match(/\b(19|20)\d{2}\b/); if(ym&&!draft.year) draft.year=ym[0]; }
  draft.photos=[...new Set(draft.photos.filter(Boolean))].slice(0,12);
  // R4: ALWAYS run the AI fill (not only when Y/M/M missing) so trim/colors/drivetrain/description/photos fill in.
  const text=html.replace(/<script[\s\S]*?<\/script>/gi,"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").slice(0,6000);
  const j=await llm(env,[{role:"system",content:"Extract car listing fields as strict JSON {year,make,model,trim,price,miles,engine,exterior_color,interior_color,wheels,drivetrain,description,photos}. photos = array of full image URLs if present in the text, else []. Use null if unknown. Output ONLY JSON."},{role:"user",content:(tt?("Title: "+tt[1]+"\n"):"")+text}]).catch(()=>null);
  try{ const o=JSON.parse(String(j).replace(/```json|```/g,"").trim());
    for(const k in o){ if(k==="photos"){ if(Array.isArray(o.photos)) pushPhotos(o.photos); continue; }
      if(o[k]!=null&&o[k]!==""&&(draft[k]==null||draft[k]==="")) draft[k]=o[k]; } }catch(_){}
  draft.photos=[...new Set(draft.photos.filter(Boolean))].slice(0,12);
  // R4: monthly is never on a listing page — derive an estimate so the field isn't blank (dealer/auto can reprice).
  if(draft.price && !draft.price_mo){ draft.price_mo=monthlyFor(+draft.price, Math.round(+draft.price*0.1), aprFor("670-739"), 72); draft.price_mo_est=1; }
  draft.source_url=url;   // R7: persisted on publish so the cron can re-check the page for sold/removed
  return json({ok:true,draft});
}
// ===== v15: the down × monthly bucket grid =====
// The v15 listing primitive. NOT a new table -- listing_placements has carried `monthly` and `down`
// per (dealer_id, vdp_id) since migration 0049. v14 keyed placement on credit_band; v15 keys it on
// the cell. Same two columns, different axis, so this is a validator and a read shape, not a
// migration. The credit_band path stays exactly as it was: the buyer search still reads
// monthly/down by band (search()), and dealerAutoPlace() still places by band. Bands price a car
// for a buyer; cells are how a dealer shops their own lot. Both are true at once.
const V15_DOWN=[1000,2000,3000,4000], V15_MO=[100,200,300];
const inCell=(dn,mo)=>V15_DOWN.indexOf(+dn)>=0 && V15_MO.indexOf(+mo)>=0;
// Legacy rows carry auto-priced values (10% down, monthlyFor(...)) that land nowhere near a cell.
// The grid READ snaps them to the nearest cell for display only -- it never writes the snapped
// value back, because a dealer's own number is not ours to quietly round.
const nearest=(v,cells)=>cells.reduce((a,b)=>Math.abs(b-v)<Math.abs(a-v)?b:a,cells[0]);
const snapCell=(dn,mo)=>({down:nearest(+dn||0,V15_DOWN),monthly:nearest(+mo||0,V15_MO)});
// GET /api/dealer/grid — the twelve cells, each with its units. Aging rides along because the whole
// point of the grid is deciding what to move, and a unit's age is the reason to move it.
// POST /api/dealer/grid {vdp_id,down,monthly} — place a unit into a cell.
//
// ⚠ SEMANTICS TO CONFIRM (Brandon): a cell placement writes the SAME monthly/down across every one
// of that unit's credit_band rows. That is the v15 reading -- one listed payment per unit, the same
// number for every buyer, which is what "the price you see is the price you pay" means and what
// makes a clearance rack a clearance rack. It does change the buyer surface: today a 580-669 buyer
// and an 800+ buyer can see different payments for the same car (auto-priced per band via
// aprFor()); after a cell placement they see one. The per-band APR estimate still runs everywhere
// else and is untouched. If v15 actually intends per-band cells, this is the line to change and
// nothing else moves.
async function dealerGrid(request,env,uid,dealer){
  if(request.method==="POST"){
    const b=await request.json().catch(()=>({}));
    const vid=parseInt(b.vdp_id,10), dn=parseInt(b.down,10), mo=parseInt(b.monthly,10);
    if(!vid) return json({ok:false,error:"bad_request"},400);
    // Exact cell membership, not snapping. Snapping a WRITE would silently move a dealer's number,
    // and the one thing the grid must never do is price on their behalf.
    if(!inCell(dn,mo)) return json({ok:false,error:"bad_cell",
      reason:"Pick a cell: $1,000-$4,000 down by $100-$300 a month."},422);
    if(!(await env.DB.prepare("SELECT 1 FROM vdps WHERE id=? AND dealer_id=?").bind(vid,dealer.id).first()))
      return json({ok:false,error:"not_yours"},403);
    const now=new Date().toISOString();
    // locked=1 -- a cell placement is the dealer's deliberate choice, so auto-bucketing must not
    // move it. Same contract dealerPlacements() already uses for a manual placement.
    const up=await env.DB.prepare("UPDATE listing_placements SET monthly=?,down=?,locked=1,updated_at=? WHERE dealer_id=? AND vdp_id=?")
      .bind(mo,dn,now,dealer.id,vid).run();
    // A unit with no placement row yet (never auto-bucketed) still needs to land somewhere.
    if(!up.meta.changes){
      const band=bandForCar(await env.DB.prepare("SELECT price,price_mo FROM vdps WHERE id=?").bind(vid).first().catch(()=>({})) || {});
      await env.DB.prepare("INSERT INTO listing_placements (dealer_id,vdp_id,credit_band,category,monthly,down,rate_markup,locked,created_at,updated_at) VALUES (?,?,?,?,?,?,0,1,?,?)")
        .bind(dealer.id,vid,band,band,mo,dn,now,now).run();
    }
    // NOT validated against local p50 on purpose. v15: "Platform does not validate whether the math
    // is favorable to the dealer -- mispricing is the dealer's, and the console must make that
    // visible rather than prevent it." Visibility is the product; prevention is the liability.
    await logEvent(env,{action:"dealer.cell_placed",source:"app",vehicle_id:vid,confidence:mo}).catch(()=>{});
    return json({ok:true,down:dn,monthly:mo});
  }
  const r=await env.DB.prepare(
    "SELECT p.id,p.vdp_id,p.monthly,p.down,p.locked, v.year,v.make,v.model,v.trim,v.price,v.photos,v.lot_date "+
    "FROM listing_placements p JOIN vdps v ON v.id=p.vdp_id "+
    "WHERE p.dealer_id=? AND v.active=1 ORDER BY v.lot_date IS NULL, v.lot_date ASC")
    .bind(dealer.id).all().catch(()=>({results:[]}));
  const cells={}; for(const d of V15_DOWN) for(const m of V15_MO) cells[d+"x"+m]={down:d,monthly:m,units:[]};
  let unplaced=0;
  // One card per CAR, not per placement row. dealerPlacements() allows one car in many credit
  // bands, so a unit can carry several rows; without this the same car appears three times in the
  // grid and the lot looks bigger than it is. Oldest-first ordering above means the row we keep is
  // deterministic.
  const seen=new Set();
  for(const x of (r.results||[])){
    if(seen.has(x.vdp_id)) continue; seen.add(x.vdp_id);
    const exact=inCell(x.down,x.monthly);
    const c=exact?{down:+x.down,monthly:+x.monthly}:snapCell(x.down,x.monthly);
    if(!exact) unplaced++;
    // Age is REAL or ABSENT — never inferred. lot_date is now required on new listings, but the
    // backlog predates that, and a guessed age is worse than a blank one on a screen a dealer
    // prices from.
    const days=x.lot_date&&/^\d{4}-\d{2}-\d{2}$/.test(String(x.lot_date))
      ? Math.max(0,Math.floor((Date.now()-Date.parse(x.lot_date+"T00:00:00Z"))/864e5)) : null;
    const k=c.down+"x"+c.monthly; if(!cells[k]) continue;
    cells[k].units.push({id:x.id,vdp_id:x.vdp_id,year:x.year,make:x.make,model:x.model,trim:x.trim,
      price:x.price,photos:JSON.parse(x.photos||"[]"),days_on_lot:days,
      exact:exact?1:0,locked:x.locked,listed_down:+x.down||0,listed_monthly:+x.monthly||0});
  }
  return json({ok:true,down:V15_DOWN,monthly:V15_MO,cells:Object.values(cells),
    // `approx` is how many units are only in a cell because we rounded them there. A dealer seeing
    // "38 units are approximate" knows the grid is a suggestion until they place them.
    approx:unplaced});
}
// T-102: drag-drop credit/price placements. One car → many bands (credit-tier pre-staging). rate_markup is dealer-facing only.
async function dealerPlacements(request,env,uid,dealer){
  if(request.method==="GET"){
    // R6: match_ct/match_score let the client rank each bucket's "top pick" (most matched by the AI engine).
    const r=await env.DB.prepare("SELECT p.id,p.vdp_id,p.credit_band,p.category,p.monthly,p.down,p.rate_markup,p.locked, v.year,v.make,v.model,v.trim,v.photos, (SELECT COUNT(*) FROM matches m WHERE m.vdp_id=p.vdp_id) match_ct, (SELECT MAX(score) FROM matches m2 WHERE m2.vdp_id=p.vdp_id) match_score FROM listing_placements p JOIN vdps v ON v.id=p.vdp_id WHERE p.dealer_id=? ORDER BY p.category,p.credit_band").bind(dealer.id).all().catch(()=>({results:[]}));
    return json({ok:true,placements:(r.results||[]).map(x=>({...x,photos:JSON.parse(x.photos||"[]")}))}); }
  if(request.method==="POST"){
    const b=await request.json().catch(()=>({}));
    const vid=parseInt(b.vdp_id,10), band=String(b.credit_band||"").slice(0,12);
    const mk=parseFloat(b.rate_markup)||0;
    if(!vid||!band) return json({ok:false,error:"bad_request"},400);
    const cat=(String(b.category||"").slice(0,20))||band;   // lane label = credit band by default
    if(!(await env.DB.prepare("SELECT 1 FROM vdps WHERE id=? AND dealer_id=?").bind(vid,dealer.id).first())) return json({ok:false,error:"not_yours"},403);
    // R3: dealer just drops the car into a credit bucket → AI auto-prices for that band. Manual override still honored.
    let mo=parseInt(b.monthly,10)||0, dn=parseInt(b.down,10)||0;
    if(!mo){
      const v=await env.DB.prepare("SELECT price,price_mo FROM vdps WHERE id=?").bind(vid).first().catch(()=>null);
      const price=(v&&+v.price)||0;
      if(price){ if(!dn) dn=Math.round(price*0.1); mo=monthlyFor(price,dn,aprFor(band),72); }
      else mo=(v&&+v.price_mo)||0;
    }
    const now=new Date().toISOString();
    const ex=await env.DB.prepare("SELECT id FROM listing_placements WHERE dealer_id=? AND vdp_id=? AND credit_band=?").bind(dealer.id,vid,band).first();
    // R4: a manual placement is the dealer's deliberate choice → locked=1 so AI auto-bucketing won't move it.
    if(ex) await env.DB.prepare("UPDATE listing_placements SET category=?,monthly=?,down=?,rate_markup=?,locked=1,updated_at=? WHERE id=?").bind(cat,mo,dn,mk,now,ex.id).run();
    else await env.DB.prepare("INSERT INTO listing_placements (dealer_id,vdp_id,credit_band,category,monthly,down,rate_markup,locked,created_at,updated_at) VALUES (?,?,?,?,?,?,?,1,?,?)").bind(dealer.id,vid,band,cat,mo,dn,mk,now,now).run();
    return json({ok:true}); }
  if(request.method==="DELETE"){ const id=parseInt(new URL(request.url).searchParams.get("id"),10)||0;
    await env.DB.prepare("DELETE FROM listing_placements WHERE id=? AND dealer_id=?").bind(id,dealer.id).run(); return json({ok:true}); }
  return json({ok:false,error:"method"},405); }
// R4: AI auto-bucket — place every un-placed active car into its credit tier (locked=0 so the dealer can override).
async function dealerAutoPlace(request,env,uid,dealer){
  const cars=await env.DB.prepare(
    "SELECT v.id,v.price,v.price_mo FROM vdps v WHERE v.dealer_id=? AND v.active=1 "+
    "AND NOT EXISTS (SELECT 1 FROM listing_placements p WHERE p.vdp_id=v.id AND p.dealer_id=?)"
  ).bind(dealer.id,dealer.id).all().catch(()=>({results:[]}));
  const now=new Date().toISOString(); let placed=0;
  for(const c of (cars.results||[])){
    const band=bandForCar(c); const dn=Math.round(((+c.price)||0)*0.1);
    const mo=(+c.price)?monthlyFor(c.price,dn,aprFor(band),72):(+c.price_mo||0);
    await env.DB.prepare("INSERT INTO listing_placements (dealer_id,vdp_id,credit_band,category,monthly,down,rate_markup,locked,created_at,updated_at) VALUES (?,?,?,?,?,?,?,0,?,?)")
      .bind(dealer.id,c.id,band,band,mo,dn,0,now,now).run().catch(()=>{}); placed++;
  }
  return json({ok:true,placed}); }
// R7: dealer marks a car sold/removed (archive) or restores it. Buyer surfaces gate on active=1 already.
async function dealerListingStatus(request,env,uid,dealer){
  const b=await request.json().catch(()=>({}));
  const id=parseInt(b.id,10)||0, on=(b.active===1||b.active==="1"||b.active===true)?1:0;
  if(!id) return json({ok:false,error:"bad_request"},400);
  const r=await env.DB.prepare("UPDATE vdps SET active=?, deactivated_at=?, embedding_synced=0 WHERE id=? AND dealer_id=?")
    .bind(on, on?null:new Date().toISOString(), id, dealer.id).run();
  if(!(r.meta&&r.meta.changes)) return json({ok:false,error:"not_yours"},403);
  await logEvent(env,{action:on?"inv.restored":"inv.archived",source:"dealer-portal"}).catch(()=>{});
  return json({ok:true,active:on}); }
// R8: the lead's live AI↔buyer conversation (sms_log) — populates the funnel in real time once SMS is on.
async function dealerLeadThread(request,env,uid,dealer){
  const id=parseInt(new URL(request.url).searchParams.get("lead_id"),10)||0;
  if(!id) return json({ok:false,error:"bad_request"},400);
  const L=await env.DB.prepare("SELECT phone FROM web_leads WHERE id=? AND dealer_id=?").bind(id,dealer.id).first();
  if(!L) return json({ok:false,error:"not_found"},404);
  // R13: dealers see CONVERSATION only — OTP codes, pass links and check-in codes are backend/admin noise.
  // Covers: "[verify] code", "Drive Now pass: …/pass/…", "CarNimbus code: 524366. Expires in 10 min."
  // Deliberately anchored to OUR sender wording — a bare /code \d+/ would swallow real buyer texts like
  // "my zip code 90210". Hiding a genuine customer message is worse than showing a system one.
  // .(com|us) — NOT a replacement of .com. The .com branch still matches historical sms_log rows
  // written before the 2026-08-01 cutover; those rows are in D1 and cannot be rewritten, so dropping
  // it would expose old pass links to dealers. The .us branch was never added at cutover, which left
  // today's templates (~1809, ~1958) caught only by the literal phrase "Drive Now pass:" — reword a
  // template, or let the AI compose a reply containing a pass link, and the token leaks into the
  // dealer-visible thread. Note this line is invisible to a `carnimbus.com` grep: it is an escaped
  // regex, so any sweep driven by that pattern skips it.
  const SYSTEM_MSG=/^\[verify\]|Drive Now pass:|carnimbus\.(com|us)\/pass\/|carnimbus code:?\s*\d{3,8}/i;
  const rr=await env.DB.prepare("SELECT direction,body,created_at FROM sms_log WHERE phone=? ORDER BY id ASC LIMIT 200").bind(L.phone).all().catch(()=>({results:[]}));
  const all=rr.results||[];
  const thread=all.filter(function(m){ return !SYSTEM_MSG.test(String(m.body||"")); });
  return json({ok:true,thread:thread,hidden:all.length-thread.length}); }
// T-102: inbound leads for this dealer's cars. R13: carries computed deal math + status.
async function dealerLeads(request,env,uid,dealer){
  const r=await env.DB.prepare("SELECT w.id,w.created_at,w.first_name,w.last_name,w.dream_car,w.deal_type,w.monthly,w.down,w.zip,w.appt_slot,w.matched_car,w.phone,w.email,w.address,w.cid,w.credit_band,w.trade_in,w.status,w.status_ts,w.is_demo, v.photos,v.price,v.year,v.miles,v.unit_cost,v.lot_date,v.make car_make,v.model car_model, p.monthly band_monthly, p.down band_down, s.price_vs_market pvm, s.condition_grade, s.certified, s.mileage_exact FROM web_leads w LEFT JOIN vdps v ON v.id=w.vdp_id LEFT JOIN vdp_specs s ON s.vin=v.vin LEFT JOIN listing_placements p ON p.vdp_id=w.vdp_id AND p.credit_band=w.credit_band AND p.dealer_id=w.dealer_id WHERE w.dealer_id=? ORDER BY w.id DESC LIMIT 100").bind(dealer.id).all().catch(()=>({results:[]}));
  return json({ok:true,leads:(r.results||[]).map(function(x){
    var ph=[]; try{ph=JSON.parse(x.photos||"[]");}catch(_){}
    x.photo0=ph[0]||"";
    var price=+x.price||0, wantsDown=+x.down||0, wantsMo=+x.monthly||0;
    var apr = price? aprEst(price,wantsDown,x.year,x.miles,x.credit_band) : 0;
    var moHis = price? monthlyFor(price,wantsDown,apr,72) : 0;
    x.deal={ price:price, miles:x.miles||"", apr:apr, moHis:moHis, wantsMo:wantsMo, wantsDown:wantsDown,
      bandMonthly:+x.band_monthly||0, bandDown:+x.band_down||0,
      delta: (wantsMo&&moHis)? moHis-wantsMo : 0,
      downGap: (+x.band_down||0)-wantsDown,
      pvm:x.pvm||"", cond:x.condition_grade||"", certified:x.certified?1:0 };
    // R20: economics computed from THIS store's real figures (dealer Settings). Defaults stay labeled (EST).
    var commPct=(dealer.commission_pct!=null?+dealer.commission_pct:25),
        holdDay=(dealer.holding_per_day!=null?+dealer.holding_per_day:32),
        packFee=(+dealer.pack_fee||0),
        econReal=(dealer.commission_pct!=null||dealer.holding_per_day!=null);
    if(x.unit_cost&&price&&price>(+x.unit_cost+packFee)){
      x.deal.gross=price-(+x.unit_cost)-packFee;
      x.deal.commission=Math.round(x.deal.gross*commPct/100); }
    if(x.lot_date){
      x.deal.daysOnLot=Math.max(0,Math.round((Date.now()-Date.parse(x.lot_date))/864e5));
      x.deal.holdingSaved=x.deal.daysOnLot*holdDay; }
    x.deal.econReal=econReal;
    x.deal.mileageExact=x.mileage_exact||null;
    x.deal.closeProb=closeProb(x.deal,x);
    x.deal.move=theMove(x.deal,x);
    x.status=x.status||"confirmed";
    x.car_short=[x.year,x.car_make,x.car_model].filter(Boolean).join(' ')||x.matched_car||x.dream_car||'';
    delete x.photos; delete x.price; delete x.year; delete x.miles; delete x.car_make; delete x.car_model;
    delete x.band_monthly; delete x.band_down;
    delete x.unit_cost; delete x.lot_date; delete x.pvm; delete x.condition_grade; delete x.certified;
    return x; })}); }
// R14: probability of close — additive scoring over the real signals, clamped 5..95.
// R16: emits the scored factor list (d.why) so the UI SHOWS ITS WORK — the dealer sees exactly why it's 90%,
// and can never be handed a number the app invented. The factors always sum to the displayed score.
function closeProb(d,L){
  let p=35; const why=[["Booked test drive",35]];
  if(d.moHis&&d.wantsMo){ const v=d.delta<=0?25:(d.delta<=50?10:-15); p+=v;
    why.push([d.delta<=0?("Payment fits — $"+d.moHis+"/mo vs his $"+d.wantsMo+" ceiling")
                        :("Payment $"+Math.abs(d.delta)+"/mo over his ceiling"),v]); }
  if(+d.wantsDown>0){ p+=8; why.push(["$"+(+d.wantsDown).toLocaleString()+" down committed",8]); }
  if(L.trade_in){ p+=10; why.push(["Trade-in to leverage",10]); }
  if(L.status==="confirmed"){ p+=5; why.push(["Appointment confirmed",5]); }
  if(L.credit_band==="under 580"){ p-=8; why.push(["Sub-580 credit — funding risk",-8]); }
  if(d.pvm&&/below market|savings/i.test(d.pvm)){ p+=7; why.push(["Priced below market",7]); }
  const raw=p, clamped=Math.max(5,Math.min(95,p));
  if(clamped!==raw) why.push([clamped>raw?"Floor applied":"Ceiling applied",clamped-raw]);
  d.why=why;
  return clamped;
}
// R16: RFM lead-heat baseline (T5 step 1). Ships now behind the same interface an LTC would later fill —
// per the founder's own gate: the neural model only earns its place once it beats this on held-out data.
function leadHeat(ev,L){
  if(!ev||!ev.length) return null;
  const now=Date.now(), last=Math.max(...ev.map(e=>Date.parse(e.ts)||0));
  const hoursSince=Math.max(0,(now-last)/3600000);
  const recency=Math.exp(-hoursSince/72);                                  // τ = the 72h window
  const sessions=new Set(ev.map(e=>String(e.ts||"").slice(0,10))).size;
  const freq=Math.min(1,sessions/4);
  const tier=Math.min(1,(+L.monthly||0)/800);
  const heat=Math.round(100*(0.55*recency+0.30*freq+0.15*tier));
  return {heat, why:[["Recency — last touch "+(hoursSince<1?"<1":Math.round(hoursSince))+"h ago",Math.round(55*recency)],
                     ["Frequency — "+sessions+" session day(s)",Math.round(30*freq)],
                     ["Budget tier — $"+(+L.monthly||0)+"/mo",Math.round(15*tier)]]};
}
// R16: Behavior Brief — the "nuggets", derived ONLY from first-party consented telemetry we already hold.
// Every line is omitted when its signal is absent; nothing here is inferred or invented.
async function behaviorBrief(env,L){
  const key=L.anon_id||null, cid=L.cid||null;
  if(!key&&!cid) return null;
  const r=await env.DB.prepare(
    "SELECT action,ts,duration_ms,vehicle_id FROM events WHERE "+(key?"anon_id=?":"cid=?")+" ORDER BY id DESC LIMIT 400"
  ).bind(key||cid).all().catch(()=>({results:[]}));
  const ev=r.results||[]; if(!ev.length) return null;
  const lines=[];
  // Dwell over ~10 min is an abandoned tab, not attention — exclude it rather than hand the salesman a
  // number he'd repeat and be wrong about. Report in human units.
  const IDLE=600000;
  const dur=n=>n>=90000?(Math.round(n/60000)+" min"):(Math.round(n/1000)+"s");
  const dwell=ev.filter(e=>e.action==="discovery.dwell"&&e.duration_ms>0&&e.duration_ms<IDLE);
  if(dwell.length){
    const longest=Math.max(...dwell.map(e=>+e.duration_ms));
    const total=dwell.reduce((a,e)=>a+(+e.duration_ms||0),0);
    if(longest>=20000) lines.push("Sat "+dur(longest)+" on a single listing — that's real intent, not a browse.");
    if(total>=120000) lines.push(dur(total)+" of engaged time across "+dwell.length+" views.");
  }
  const days=new Set(ev.map(e=>String(e.ts||"").slice(0,10)));
  if(days.size>1) lines.push("Came back "+days.size+" separate days — still shopping this, keep it warm.");
  const calc=ev.filter(e=>e.action==="intent.opened_calculator").length;
  if(calc>0) lines.push("Ran the payment calculator "+calc+" times — he's watching the monthly, so lead with the payment.");
  const hours=ev.map(e=>+String(e.ts||"").slice(11,13)).filter(h=>!isNaN(h));
  if(hours.length>=3){ const late=hours.filter(h=>h>=18||h<=1).length/hours.length;
    if(late>0.5) lines.push("Shops in the evening — call him after 6, not at lunch."); }
  // R20: scans = how many cars he actually pulled up on CarNimbus (never "visits" — he hasn't been to a lot).
  const scans=ev.filter(e=>e.action==="intent.search_results"||e.action==="intent.match_click").length;
  const heat=leadHeat(ev,L);
  return (lines.length||heat||scans) ? {lines,heat,scans} : null;
}
// R13/R14: the one call the salesman needs — driven by the math + the car's real market position. Never blank.
function theMove(d,L){
  var trade=L.trade_in? String(L.trade_in).split("—")[0].trim() : "";
  var $=function(n){ return "$"+Math.abs(+n||0).toLocaleString(); };
  var aging=d.daysOnLot?(" This unit has sat "+d.daysOnLot+" days — every day it stays is "+$(32)+" gone."):"";
  var mkt=/below market/i.test(d.pvm||"")?" It's priced under market with below-average miles — say that out loud, it's true.":"";
  if(d.moHis && d.wantsMo && d.delta<=0)
    return "He walks at "+$(d.moHis)+"/mo — "+$(d.delta)+" under the ceiling he set. Write it at his "+$(d.wantsDown)+
      " down; don't re-open the down payment."+
      (trade?" Appraise the "+trade+" while he drives — found equity drops the payment further.":"")+mkt+aging;
  if(d.delta>0 && trade)
    return "He's "+$(d.delta)+"/mo over his number. The "+trade+" appraisal IS the deal — get it done before the drive ends."+mkt+aging;
  if(d.delta>0)
    return "He's "+$(d.delta)+"/mo over. Longer term or a cheaper unit — decide before he arrives."+aging;
  return "Confirm the payment and go straight to paperwork."+mkt+aging;
}
// R3: on-demand AI intel brief per lead (inference from platform data — NOT open-web OSINT). Cached on the row.
async function dealerLeadBrief(request,env,uid,dealer){
  const body=await request.json().catch(()=>({}));
  const id=parseInt(body.lead_id,10)||0; if(!id) return json({ok:false,error:"bad_request"},400);
  const refresh=!!body.refresh;   // R10: force fresh when asked
  const L=await env.DB.prepare("SELECT * FROM web_leads WHERE id=? AND dealer_id=?").bind(id,dealer.id).first();
  if(!L) return json({ok:false,error:"not_found"},404);
  // R16: behavior nuggets are computed on BOTH paths — the cached-brief return must not skip them.
  if(L.intel_brief && !refresh)
    return json({ok:true,brief:L.intel_brief,cached:true,behavior:await behaviorBrief(env,L).catch(()=>null)});
  // R13: just the human hook — theMove() carries the substance, so this is one opener line and never blank.
  const trade=L.trade_in? String(L.trade_in).split("—")[0].trim() : "";
  const fallback = trade
    ? 'Open with: "You\'re coming out of a '+trade+' — let me show you what this one actually costs you a month."'
    : 'Open with: "Let me show you what this one actually costs you a month."';
  const msgs=[{role:"system",content:"Write ONE sentence a car salesperson says to open the conversation, starting with: Open with: followed by the quoted line. Warm, specific, under 30 words. Use only the facts given. No preamble."},
    {role:"user",content:"Buyer: "+[L.first_name,L.last_name].filter(Boolean).join(" ")+" | Car: "+(L.matched_car||"")+" | Trade-in: "+(L.trade_in||"none")+" | Budget: $"+(L.monthly||"?")+"/mo"}];
  const out=await chatLLM(env,msgs).catch(()=>null);
  const brief=(out&&String(out).trim())||fallback;
  await env.DB.prepare("UPDATE web_leads SET intel_brief=? WHERE id=?").bind(brief,id).run().catch(()=>{});
  const behavior=await behaviorBrief(env,L).catch(()=>null);   // R16: first-party nuggets
  return json({ok:true,brief,behavior}); }
// R14: one-tap export to the dealer's own calendar (Outlook/Apple via .ics; Google gets a render link client-side).
async function dealerLeadIcs(request,env,uid,dealer){
  const id=parseInt(new URL(request.url).searchParams.get("lead_id"),10)||0;
  const L=await env.DB.prepare("SELECT * FROM web_leads WHERE id=? AND dealer_id=?").bind(id,dealer.id).first();
  if(!L||!L.appt_slot) return json({ok:false,error:"not_found"},404);
  const m=String(L.appt_slot).match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/); if(!m) return json({ok:false,error:"bad_slot"},400);
  const S=m[1]+m[2]+m[3]+"T"+m[4]+m[5]+"00";
  const endH=String(+m[4]+(m[5]==="30"?1:0)).padStart(2,"0"), endM=m[5]==="30"?"00":"30";
  const E=m[1]+m[2]+m[3]+"T"+endH+endM+"00";
  // RFC 5545 §3.3.11 TEXT escaping + hard CRLF strip — lead fields are buyer-supplied (webLead is public),
  // so a name like "John\r\nSUMMARY:Fake" must never become its own ICS line (calendar-spoofing vector).
  const esc=v=>String(v==null?"":v).replace(/[\r\n]+/g," ").replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").slice(0,200);
  const name=esc([L.first_name,L.last_name].filter(Boolean).join(" "))||"Buyer";
  const ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//CarNimbus//Dealer//EN","BEGIN:VEVENT",
    "UID:cn-lead-"+L.id+"@carnimbus.us","DTSTART:"+S,"DTEND:"+E,
    "SUMMARY:Test Drive — "+name+" — "+esc(L.matched_car),
    "DESCRIPTION:CID "+esc(L.cid)+"\\nPhone "+esc(L.phone)+"\\n"+(L.trade_in?("Trade-in: "+esc(L.trade_in)):""),
    "END:VEVENT","END:VCALENDAR"].join("\r\n");
  return new Response(ics,{headers:{"content-type":"text/calendar","content-disposition":'attachment; filename="testdrive-'+L.id+'.ics"',...SEC}}); }
// R13: the only lifecycle control a dealer needs — confirmed -> sold | no_show. Ownership-scoped.
async function dealerSettings(request,env,uid,dealer){
  const b=await request.json().catch(()=>({}));
  const pct=Math.max(0,Math.min(100,+b.commission_pct||0)), hold=Math.max(0,+b.holding_per_day||0), pack=Math.max(0,+b.pack_fee||0);
  await env.DB.prepare("UPDATE dealer_leads SET commission_pct=?, holding_per_day=?, pack_fee=? WHERE id=?").bind(pct,hold,pack,dealer.id).run();
  return json({ok:true,commission_pct:pct,holding_per_day:hold,pack_fee:pack}); }
// ==================== R23: lead lifecycle protocol (docs/lead-lifecycle-policies.md) ====================
const LEAD_STATUSES={confirmed:1,sold:1,no_show:1,cancelled:1};
// P9: texts land 9:00–20:00 PT only — outside that, push to the next 9am PT.
function quietClamp(ms){ const d=new Date(ms);
  const h=+new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",hour:"numeric",hour12:false}).format(d);
  if(h>=9&&h<20) return d.toISOString();
  const add=(h<9?(9-h):(24-h+9))*3600e3;
  return new Date(ms+add).toISOString(); }
// The ONLY status mutator: stamps status_ts, writes the permanent lead_events ledger row, logs the
// events-spine action, and runs the automated effects matrix. Twilio-dark safe: queue rows still record
// intent (P15) — runQueue no-ops sends until secrets exist.
async function leadTransition(env,lead,to,source,note){
  if(!LEAD_STATUSES[to]||!lead||!lead.id) return {ok:false,error:"bad_status"};
  const now=new Date().toISOString(), from=lead.status||"confirmed";
  await env.DB.prepare("UPDATE web_leads SET status=?, status_ts=?, followup_stage=0 WHERE id=?").bind(to,now,lead.id).run();
  await env.DB.prepare("INSERT INTO lead_events (lead_id,dealer_id,from_status,to_status,source,note,ts) VALUES (?,?,?,?,?,?,?)")
    .bind(lead.id,lead.dealer_id||null,from,to,source||"system",String(note||"").slice(0,200)||null,now).run().catch(()=>{});
  await logEvent(env,{action:"dealer.lead_"+to,source:source||"system"}).catch(()=>{});
  const car=String(lead.matched_car||lead.dream_car||"your match").split("—")[0].trim(),
        fn=String(lead.first_name||"").trim();
  const q=async(pol,body,delayMs)=>{ if(!lead.phone) return;
    await env.DB.prepare("INSERT INTO sms_queue (phone,template,body,send_at,recurring,sent,created_at) VALUES (?,?,?,?,'',0,?)")
      .bind(lead.phone,"lead_followup:"+pol,body,quietClamp(Date.now()+delayMs),now).run().catch(()=>{}); };
  // P11: any transition first clears the pending machine — no stale follow-ups ever fire.
  if(lead.phone) await env.DB.prepare("DELETE FROM sms_queue WHERE phone=? AND sent=0 AND template LIKE 'lead_followup:%'")
    .bind(lead.phone).run().catch(()=>{});
  if(to==="sold"){                                   // P2: one thank-you, then silence forever.
    await q("P2","Congrats on the "+car+(fn?", "+fn:"")+" — I'm here if any question pops up.",2*3600e3); }
  if(to==="no_show"){
    const prior=await env.DB.prepare("SELECT COUNT(*) c FROM lead_events WHERE lead_id=? AND to_status='no_show'")
      .bind(lead.id).first().catch(()=>({c:0}));
    if(((prior&&prior.c)||0)<2){                      // P13: 2nd no-show → no auto-texts, call personally.
      await q("P4","We had the "+car+" out front for you"+(fn?", "+fn:"")+" — want me to grab another time that works better?",3600e3);
      await q("P5a","Still holding your "+car+" match. Reply with a day that works and I'll set the drive up.",864e5);
      await q("P5b","I'll keep your match saved — text me whenever you're ready.",3*864e5); } }
  if(to==="cancelled"){                               // P7: one gentle win-back at T+2d, then stop.
    await q("P7","Your "+car+" match is still reserved. Reply with a day that works and I'll get you back on the books.",2*864e5); }
  return {ok:true,status:to,ts:now}; }
async function dealerLeadStatus(request,env,uid,dealer){
  const b=await request.json().catch(()=>({}));
  const id=parseInt(b.lead_id,10)||0, st=String(b.status||"");
  if(!id||!LEAD_STATUSES[st]) return json({ok:false,error:"bad_request"},400);
  const lead=await env.DB.prepare("SELECT id,dealer_id,status,phone,first_name,matched_car,dream_car FROM web_leads WHERE id=? AND dealer_id=?")
    .bind(id,dealer.id).first();
  if(!lead) return json({ok:false,error:"not_found"},404);
  const r=await leadTransition(env,lead,st,"dealer",null);
  return json(r,r.ok?200:400); }
// The salesman's (and NIMBUS's) view of where the machine left off: ledger + follow-ups for one lead.
async function dealerLeadHistory(request,env,uid,dealer){
  const id=parseInt(new URL(request.url).searchParams.get("lead_id"),10)||0;
  if(!id) return json({ok:false,error:"bad_request"},400);
  const lead=await env.DB.prepare("SELECT id,phone FROM web_leads WHERE id=? AND dealer_id=?").bind(id,dealer.id).first();
  if(!lead) return json({ok:false,error:"not_found"},404);
  const ev=(await env.DB.prepare("SELECT from_status,to_status,source,note,ts FROM lead_events WHERE lead_id=? ORDER BY ts DESC LIMIT 40")
    .bind(id).all().catch(()=>({results:[]}))).results||[];
  const fu=lead.phone?((await env.DB.prepare("SELECT template,body,send_at,sent FROM sms_queue WHERE phone=? AND template LIKE 'lead_followup:%' ORDER BY send_at DESC LIMIT 20")
    .bind(lead.phone).all().catch(()=>({results:[]}))).results||[]):[];
  return json({ok:true,events:ev,followups:fu}); }
// N7: dealer post-test-drive voice feedback — transcribe with Workers AI whisper, store, list.
async function dealerFeedback(request,env,uid,dealer){
  if(request.method==="GET"){ const rows=await env.DB.prepare("SELECT id,drive_id,transcript,created_at FROM dealer_feedback WHERE dealer_id=? ORDER BY id DESC LIMIT 20").bind(dealer.id).all().catch(()=>({results:[]}));
    return json({ok:true,notes:rows.results||[]}); }
  const b=await request.json().catch(()=>({}));
  const driveId=+b.driveId||0;
  let audio=null;
  if(b.audio_b64){ const bin=atob(b.audio_b64); audio=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++)audio[i]=bin.charCodeAt(i); }
  if(!audio) return json({ok:false,error:"no_audio"},400);
  let transcript="";
  try{ const r=await env.AI.run("@cf/openai/whisper",{audio:[...audio]}); transcript=(r&&r.text)||""; }catch(_){}
  await env.DB.prepare("INSERT INTO dealer_feedback (dealer_id,drive_id,transcript,created_at) VALUES (?,?,?,?)")
    .bind(dealer.id, driveId||null, transcript.slice(0,4000), new Date().toISOString()).run().catch(()=>{});
  await logEvent(env,{action:"dealer.feedback",source:"dealer-voice"});
  return json({ok:true,transcript});
}
async function dealerCheckin(request,env,uid,dealer){
  const {driveId,token,status,sale_price}=await request.json().catch(()=>({}));
  if(["confirmed","arrived","sold"].indexOf(status)<0) return json({ok:false,error:"bad_request"},400);
  let id=+driveId||0;
  if(!id&&token){ const t=String(token).replace(/[^A-Za-z0-9]/g,"");
    const row=t.length>=20?await env.DB.prepare("SELECT id FROM test_drives WHERE pass_token=?").bind(t).first():null;
    if(row) id=row.id; }
  if(!id) return json({ok:false,error:"not_found"},404);
  // Ownership check: the drive's car must belong to this dealer (or be unowned/demo).
  const own=await env.DB.prepare("SELECT td.id FROM test_drives td JOIN vdps v ON v.id=td.vdp_id WHERE td.id=? AND "+DSCOPE).bind(id,dealer.id).first();
  if(!own) return json({ok:false,error:"not_your_drive"},403);
  await env.DB.prepare("UPDATE test_drives SET status=? WHERE id=?").bind(status,id).run();
  // Wave F: timestamped transition log + revenue attribution.
  await env.DB.prepare("INSERT INTO drive_events (drive_id,status,ts) VALUES (?,?,?)").bind(id,status,new Date().toISOString()).run().catch(()=>{});
  if(status==="arrived") await env.DB.prepare("UPDATE test_drives SET arrived_at=? WHERE id=? AND arrived_at IS NULL").bind(new Date().toISOString(),id).run().catch(()=>{});
  if(status==="sold"){ const sp=parseInt(sale_price,10);
    await env.DB.prepare("UPDATE test_drives SET sold_at=?, sale_price=? WHERE id=?").bind(new Date().toISOString(),Number.isFinite(sp)?sp:null,id).run().catch(()=>{}); }
  const td=await env.DB.prepare("SELECT td.id,td.status,u.handle,u.phone FROM test_drives td JOIN users u ON u.id=td.user_id WHERE td.id=?").bind(id).first();
  return json({ok:true,drive:{id:td.id,status:td.status,who:td.handle||("Rider •••-"+String(td.phone).slice(-4))}});
}
// Wave F: Dealer ROI — date-bounded funnel, revenue attribution, Value Score.
async function dealerRoi(request,env,uid,dealer){
  const days=Math.min(365,parseInt(new URL(request.url).searchParams.get("days"),10)||30);
  const since=new Date(Date.now()-days*86400e3).toISOString();
  const f=await env.DB.prepare(
    "SELECT COUNT(*) routed,"+
    " SUM(CASE WHEN td.status IN('requested','confirmed','arrived','sold') THEN 1 ELSE 0 END) booked,"+
    " SUM(CASE WHEN td.status IN('arrived','sold') THEN 1 ELSE 0 END) showed,"+
    " SUM(CASE WHEN td.status='sold' THEN 1 ELSE 0 END) sold,"+
    " SUM(CASE WHEN td.status='sold' THEN COALESCE(td.sale_price,0) ELSE 0 END) gross"+
    " FROM test_drives td JOIN vdps v ON v.id=td.vdp_id WHERE "+DSCOPE+" AND td.created_at>?")
    .bind(dealer.id,since).first();
  const routed=(f&&f.routed)||0, booked=(f&&f.booked)||0, showed=(f&&f.showed)||0, sold=(f&&f.sold)||0;
  const rate=(a,b)=>b?Math.round(100*a/b):0;
  const tt=await env.DB.prepare(
    "SELECT AVG(julianday(td.sold_at)-julianday((SELECT MIN(ts) FROM drive_events de WHERE de.drive_id=td.id))) d"+
    " FROM test_drives td JOIN vdps v ON v.id=td.vdp_id WHERE "+DSCOPE+" AND td.status='sold' AND td.sold_at>?")
    .bind(dealer.id,since).first().catch(()=>({d:null}));
  const per=await env.DB.prepare(
    "SELECT v.id,v.year,v.make,v.model,COUNT(*) routed,"+
    " SUM(CASE WHEN td.status IN('arrived','sold') THEN 1 ELSE 0 END) showed,"+
    " SUM(CASE WHEN td.status='sold' THEN 1 ELSE 0 END) sold"+
    " FROM test_drives td JOIN vdps v ON v.id=td.vdp_id WHERE "+DSCOPE+" AND td.created_at>?"+
    " GROUP BY v.id ORDER BY routed DESC LIMIT 12").bind(dealer.id,since).all();
  const showRate=showed/(booked||1), closeRate=sold/(showed||1), BASELINE=20;
  const valueScore=Math.round(100*showRate*closeRate*Math.min(1,routed/BASELINE));
  return json({ok:true,window:days,
    funnel:{routed,booked,showed,sold},
    rates:{book:rate(booked,routed),show:rate(showed,booked),close:rate(sold,showed)},
    gross:(f&&f.gross)||0, ttcloseDays:tt&&tt.d!=null?Math.round(tt.d*10)/10:null,
    valueScore, perVehicle:(per.results||[])}); }
async function recentChat(request,env,uid){
  const r=await env.DB.prepare("SELECT vdp_id FROM chats WHERE user_id=? ORDER BY id DESC LIMIT 1").bind(uid).first();
  let vdp=r?r.vdp_id:null;
  if(!vdp){ const t=await env.DB.prepare("SELECT vdp_id FROM test_drives WHERE user_id=? ORDER BY id DESC LIMIT 1").bind(uid).first(); vdp=t?t.vdp_id:null; }
  return json({ok:true,vdp_id:vdp}); }
async function chatList(request,env,uid){ const curl=new URL(request.url); const vdpId=+curl.searchParams.get("vdpId")||0;
  if(vdpId){ const rows=await env.DB.prepare("SELECT role,body,created_at FROM chats WHERE user_id=? AND vdp_id=? ORDER BY id ASC LIMIT 100").bind(uid,vdpId).all();
    return json({ok:true,messages:rows.results||[]}); }
  const rows=await env.DB.prepare(
    "SELECT c.vdp_id, MAX(c.id) mid, MIN(c.created_at) matched_at, v.year,v.make,v.model,v.trim,v.price_mo,v.price,v.photos FROM chats c "+
    "JOIN vdps v ON v.id=c.vdp_id AND v.active=1 "+                       // never list threads for cars the car page will 404 on
    "WHERE c.user_id=? GROUP BY c.vdp_id ORDER BY mid DESC LIMIT 20").bind(uid).all();
  const prof=await env.DB.prepare("SELECT answers FROM profiles WHERE user_id=?").bind(uid).first();
  const ans=prof?JSON.parse(prof.answers||"{}"):{};
  const out=[]; for(const r of (rows.results||[])){
    const last=await env.DB.prepare("SELECT role,body,created_at FROM chats WHERE id=?").bind(r.mid).first();
    const mo=r.price?monthlyFor(r.price,ans.max_down,aprFor(ans.fico),72):r.price_mo;   // computed per-buyer, never the stored placeholder
    out.push({vdpId:r.vdp_id,year:r.year,make:r.make,model:r.model,trim:r.trim,price_mo:mo,matched_at:r.matched_at,
      photos:JSON.parse(r.photos||"[]"),last:last?last.body:"",when:last?last.created_at:""}); }
  return json({ok:true,threads:out}); }
async function dealerChat(request,env,uid,dealer){ const curl=new URL(request.url); const driveId=+curl.searchParams.get("driveId")||0;
  if(!driveId) return json({ok:false,error:"bad_request"},400);
  // Scope to the dealer's own cars (or unowned/demo) — no reading other dealers' buyer chats.
  const td=await env.DB.prepare("SELECT td.user_id,td.vdp_id FROM test_drives td JOIN vdps v ON v.id=td.vdp_id WHERE td.id=? AND "+DSCOPE).bind(driveId,dealer.id).first();
  if(!td) return json({ok:false,error:"not_found"},404);
  const rows=await env.DB.prepare("SELECT role,body,created_at FROM chats WHERE user_id=? AND vdp_id=? ORDER BY id ASC LIMIT 40").bind(td.user_id,td.vdp_id).all();
  return json({ok:true,messages:rows.results||[]}); }
async function aiPulse(env){
  // BI: refocused on the three metrics that matter (scans → drive-nows → inventory in/out). `degraded` distinguishes
  // a real DB failure (value=null → UI shows "–") from a genuine zero. Legacy fields kept for anything else.
  const today=new Date().toISOString().slice(0,10);
  const yday=new Date(Date.now()-864e5).toISOString().slice(0,10);
  let degraded=0;
  const q=async(sql,...b)=>{ try{ const r=await env.DB.prepare(sql).bind(...b).first(); return r?r.c:0; }catch(_){ degraded++; return null; } };
  const scansToday     = await q("SELECT COUNT(*) c FROM scans WHERE substr(first_ts,1,10)=?", today);
  // R7-D: demo-tenant traffic (is_demo=1) never counts toward ops/investor metrics.
  const driveNowsToday = await q("SELECT COUNT(*) c FROM web_leads WHERE substr(created_at,1,10)=? AND COALESCE(is_demo,0)=0", today);
  const body={ ok:true, today,
    scansToday, scansYesterday: await q("SELECT COUNT(*) c FROM scans WHERE substr(first_ts,1,10)=?", yday),
    scansTotal:  await q("SELECT COUNT(*) c FROM scans"),
    driveNowsToday, driveNowsTotal: await q("SELECT COUNT(*) c FROM web_leads WHERE COALESCE(is_demo,0)=0"),
    convRate: (scansToday&&driveNowsToday!=null)? Math.round(driveNowsToday/scansToday*100) : 0,
    liveInventory: await q("SELECT COUNT(*) c FROM vdps WHERE active=1"),
    inToday:  await q("SELECT COUNT(*) c FROM vdps WHERE substr(updated_at,1,10)=? AND active=1", today),
    outToday: await q("SELECT COUNT(*) c FROM vdps WHERE substr(deactivated_at,1,10)=?", today),
    apptsToday: 0, appt_pending: true,
    // Creator Network — NIMBUS is the decision-maker on creator. too, so it has to SEE creator. here.
    activeCreators: await q("SELECT COUNT(*) c FROM creators WHERE status='approved'"),
    pendingCreators:await q("SELECT COUNT(*) c FROM creators WHERE status='pending'"),
    openDrops:      await q("SELECT COUNT(*) c FROM creator_drops WHERE status='open'"),
    postsPending:   await q("SELECT COUNT(*) c FROM creator_posts WHERE status='submitted'"),
    owedCents:     (await q("SELECT COALESCE(SUM(amount_cents),0) c FROM creator_earnings WHERE status IN ('approved','paying')"))||0,
    accruedCents:  (await q("SELECT COALESCE(SUM(amount_cents),0) c FROM creator_earnings WHERE status='accrued'"))||0,
    creatorLeads:   await q("SELECT COUNT(*) c FROM web_leads WHERE creator_id IS NOT NULL AND COALESCE(is_demo,0)=0"),
    refClicks:     (await q("SELECT COALESCE(SUM(ref_clicks),0) c FROM creators"))||0,
    // legacy (not shown on the new console, retained for compatibility)
    cars: await q("SELECT COUNT(*) c FROM vdps WHERE active=1"),
    leadsToday: driveNowsToday, leadsTotal: await q("SELECT COUNT(*) c FROM web_leads WHERE COALESCE(is_demo,0)=0") };
  body.degraded=degraded>0; return json(body); }
async function aiVerify(request,env){ return json({ok:true}); }   // R5: side-effect-free key check — adminOnly gates it (403 vs 200)
async function aiTrends(env){
  // BI: aggregates for the console's trend charts — last 14 days only (R5: real window + zero-filled timeline).
  const W14="date('now','-14 days')";
  const rows=async(sql,...b)=>{ const r=await env.DB.prepare(sql).bind(...b).all().catch(()=>({results:[]})); return (r.results||[]).map(x=>({t:String(x.t??""),c:x.c})); };
  // Build 14 contiguous calendar days (zero-filled) so the sparkline reads as a real timeline.
  const rawDays=((await env.DB.prepare("SELECT substr(first_ts,1,10) d, COUNT(*) c FROM scans WHERE substr(first_ts,1,10)>="+W14+" GROUP BY d").all().catch(()=>({results:[]}))).results||[]);
  const dayMap={}; for(const r of rawDays) dayMap[r.d]=r.c;
  const overTime=[]; for(let i=13;i>=0;i--){ const d=new Date(Date.now()-i*864e5).toISOString().slice(0,10); overTime.push({d,c:dayMap[d]||0}); }
  return json({ ok:true,
    byType:  await rows("SELECT dream_car t, COUNT(*) c FROM scans WHERE dream_car<>'' AND substr(first_ts,1,10)>="+W14+" GROUP BY dream_car ORDER BY c DESC LIMIT 8"),
    byDeal:  await rows("SELECT deal_type t, COUNT(*) c FROM scans WHERE deal_type IS NOT NULL AND deal_type<>'' AND substr(first_ts,1,10)>="+W14+" GROUP BY deal_type ORDER BY c DESC"),
    topCars: await rows("SELECT matched_car t, COUNT(*) c FROM web_leads WHERE matched_car IS NOT NULL AND matched_car<>'' AND COALESCE(is_demo,0)=0 AND substr(created_at,1,10)>="+W14+" GROUP BY matched_car ORDER BY c DESC LIMIT 8"),
    byZip:   await rows("SELECT zip t, COUNT(*) c FROM scans WHERE zip IS NOT NULL AND zip<>'' AND substr(first_ts,1,10)>="+W14+" GROUP BY zip ORDER BY c DESC LIMIT 10"),
    // R17: when buyers actually shop — proves (or disproves) the 6-9pm activation window.
    byHour:  await rows("SELECT substr(created_at,12,2) t, COUNT(*) c FROM web_leads WHERE COALESCE(is_demo,0)=0 GROUP BY t ORDER BY t"),
    byBand:  await rows("SELECT COALESCE(credit_band,'unknown') t, COUNT(*) c FROM web_leads WHERE COALESCE(is_demo,0)=0 GROUP BY t ORDER BY c DESC"),
    funnel:  { scans:(await env.DB.prepare("SELECT COUNT(*) c FROM scans WHERE substr(first_ts,1,10)>="+W14).first().catch(()=>({c:0})))?.c||0,
               leads:(await env.DB.prepare("SELECT COUNT(*) c FROM web_leads WHERE COALESCE(is_demo,0)=0 AND substr(created_at,1,10)>="+W14).first().catch(()=>({c:0})))?.c||0 },
    // R23: outcomes — sold / no-show / cancelled counts + leads won back (ledger no_show|cancelled → confirmed).
    outcomes: { byStatus: await rows("SELECT status t, COUNT(*) c FROM web_leads WHERE COALESCE(is_demo,0)=0 AND status IS NOT NULL GROUP BY status ORDER BY c DESC"),
                winBacks:(await env.DB.prepare("SELECT COUNT(DISTINCT lead_id) c FROM lead_events WHERE to_status='confirmed' AND from_status IN ('no_show','cancelled') AND substr(ts,1,10)>="+W14).first().catch(()=>({c:0})))?.c||0 },
    // Creator Network funnel: drops → claims → posts → clicks → attributed leads. The last number
    // divided by spend is the only honest verdict on whether the network works.
    creator: {
      drops:  (await env.DB.prepare("SELECT COUNT(*) c FROM creator_drops WHERE substr(created_at,1,10)>="+W14).first().catch(()=>({c:0})))?.c||0,
      claims: (await env.DB.prepare("SELECT COUNT(*) c FROM creator_claims WHERE substr(created_at,1,10)>="+W14).first().catch(()=>({c:0})))?.c||0,
      posts:  (await env.DB.prepare("SELECT COUNT(*) c FROM creator_posts WHERE substr(created_at,1,10)>="+W14).first().catch(()=>({c:0})))?.c||0,
      clicks: (await env.DB.prepare("SELECT COALESCE(SUM(clicks),0) c FROM creator_claims").first().catch(()=>({c:0})))?.c||0,
      leads:  (await env.DB.prepare("SELECT COUNT(*) c FROM web_leads WHERE creator_id IS NOT NULL AND COALESCE(is_demo,0)=0 AND substr(created_at,1,10)>="+W14).first().catch(()=>({c:0})))?.c||0,
      // Split the two link types so it's visible which one is actually producing.
      claim_leads:(await env.DB.prepare("SELECT COUNT(*) c FROM web_leads WHERE creator_claim_id IS NOT NULL AND COALESCE(is_demo,0)=0 AND substr(created_at,1,10)>="+W14).first().catch(()=>({c:0})))?.c||0,
      ref_leads:(await env.DB.prepare("SELECT COUNT(*) c FROM web_leads WHERE creator_id IS NOT NULL AND creator_claim_id IS NULL AND COALESCE(is_demo,0)=0 AND substr(created_at,1,10)>="+W14).first().catch(()=>({c:0})))?.c||0,
      ref_clicks:(await env.DB.prepare("SELECT COALESCE(SUM(ref_clicks),0) c FROM creators").first().catch(()=>({c:0})))?.c||0,
      spentCents:(await env.DB.prepare("SELECT COALESCE(SUM(amount_cents),0) c FROM creator_earnings WHERE status IN ('approved','paying','paid')").first().catch(()=>({c:0})))?.c||0,
      topCreators: await rows("SELECT c.handle t, COUNT(w.id) c FROM creators c JOIN creator_claims cc ON cc.creator_id=c.id LEFT JOIN web_leads w ON w.creator_claim_id=cc.id GROUP BY c.id ORDER BY c DESC LIMIT 8")
    },
    overTime
  }); }
async function adminBuyers(env){
  // R5: one row PER BUYER (dedupe on CID → email → phone), latest booking, with full contact fields.
  const r=await env.DB.prepare(
    "SELECT cid,first_name,last_name,phone,email,address,zip,matched_car,dream_car,deal_type,monthly,down,appt_slot,created_at,is_demo "+
    "FROM web_leads w WHERE id=(SELECT MAX(id) FROM web_leads w2 WHERE COALESCE(w2.cid,w2.email,w2.phone)=COALESCE(w.cid,w.email,w.phone)) "+
    "ORDER BY id DESC LIMIT 500").all().catch(()=>({results:[]}));
  return json({ok:true, buyers:r.results||[]}); }
// ===== BI: Nimbus conversational ops brain — insights (aiAsk) + guarded actions (aiAct). =====
const NIMBUS_ACTIONS = { dealer_engine:"turn a dealer's inventory engine on/off (args: dealer_id, on)",
  reindex:"re-embed inventory + profiles into search (no args)",
  // Added 2026-08-06. Until this existed there was NO way to correct one price: the CSV upload
  // was the only route, and a minimal vin,price_mo row used to blank four other columns. Raw SQL
  // from a laptop was the alternative. One column, one car, reversible.
  set_price:"change one car's monthly price (args: vin, price_mo)",
  activate_vin:"put a car back in inventory (args: vin)",
  deactivate_vin:"take a car out of inventory (args: vin)",
  purge_test:"purge all is_demo test rows (confirm required)",
  hide_lead:"soft-hide one lead from ops metrics (args: lead_id)",
  hide_leads:"soft-hide several leads at once (args: ids CSV)",
  // Creator Network. NIMBUS is the decision-maker on dealer. AND creator. — same allowlist, same
  // confirm gate. Every one of these is reversible EXCEPT creator_payout.
  creator_approve_post:"approve a creator post and release its earning for payout (args: post_id)",
  creator_reject_post:"reject a creator post (args: post_id)",
  creator_suspend:"suspend a creator from claiming drops (args: creator_id)",
  creator_reinstate:"reinstate a suspended creator (args: creator_id)",
  creator_clawback:"reverse an accrued or approved earning (args: earning_id)",
  creator_payout:"IRREVERSIBLE - send an approved earning to the creator's Stripe account (args: earning_id)",
  // 2026-08-03: these two replace the retired self-serve portal. Link-minting and Stripe onboarding
  // now happen here, with a human in the loop on both.
  creator_invite:"create a creator, mint their permanent /c/ link, and start Stripe onboarding (args: handle, email)",
  creator_sync:"re-read Stripe and refresh payouts_enabled for a creator (args: creator_id)",
  backfill_drops:"open a priced drop for every active car that doesn't have one yet (no args)",
  drop_rate:"set a drop's per-post rate in cents and lock it from re-pricing (args: drop_id, cents)",
  close_drop:"stop a drop from being claimed (args: drop_id)",
  open_drop:"reopen a closed drop (args: drop_id)" };
// R16: lifetime demand map — real ZIP counts only, no external tile service, no API key.
async function aiMap(request,env){
  const w=String(new URL(request.url).searchParams.get("w")||"life");
  const since=w==="today"?new Date(Date.now()-864e5).toISOString():w==="30d"?new Date(Date.now()-30*864e5).toISOString():"1970";
  const r=await env.DB.prepare(
    "SELECT zip, COUNT(DISTINCT COALESCE(cid,email,phone)) n, MAX(created_at) last FROM web_leads WHERE COALESCE(is_demo,0)=0 AND zip IS NOT NULL AND zip<>'' AND created_at>? GROUP BY zip ORDER BY n DESC LIMIT 400"
  ).bind(since).all().catch(()=>({results:[]}));
  const rows=r.results||[];
  const total=rows.reduce((a,x)=>a+(+x.n||0),0);
  return json({ok:true,window:w,total,points:rows}); }
// R15: heartbeat — appliance reachability only. No AI.run ping (that would burn neurons every 30s).
async function aiHealth(request,env){
  let appliance="off", why="", host="";
  if(env.AI_BACKEND_URL){
    try{ host=new URL(env.AI_BACKEND_URL).host; }catch(_){ host="(malformed AI_BACKEND_URL)"; }
    try{
      const r=await fetch(env.AI_BACKEND_URL+"/chat",{method:"POST",body:JSON.stringify({messages:[{role:"user",content:"ping"}]}),signal:AbortSignal.timeout(3000)});
      appliance=r.ok?"up":"err"; if(!r.ok) why="reachable but returned HTTP "+r.status+" — the tunnel is up, Ollama isn't answering /chat";
    }catch(e){ appliance="down";
      // R17: name the actual failure so the fix is obvious instead of a generic "offline".
      const m=String((e&&(e.message||e.name))||"");
      why=/abort|timeout|timed out/i.test(m) ? "no answer in 3s — box asleep, Ollama not running, or the tunnel is dead"
        : /enotfound|dns|getaddrinfo/i.test(m) ? "hostname does not resolve — the tunnel URL is stale/changed"
        : /refused|econnrefused/i.test(m) ? "connection refused — tunnel is up but nothing is listening on that port"
        : ("could not connect ("+m.slice(0,80)+")"); } }
  // ---- WHAT HEALTH ACTUALLY MEANS (2026-08-06) ------------------------------------------------
  // This used to check ONE thing — whether the AI appliance answered a ping — and return ok:true
  // regardless of everything else. The green dot could be green with D1 entirely down, which is
  // the opposite of what a health check is for. D1 is the only dependency whose failure takes the
  // whole product with it, so it decides `ok` now; the AI appliance is reported, not fatal.
  let db="down", dbWhy="";
  try{ const t=await env.DB.prepare("SELECT 1 x").first(); db=(t&&t.x===1)?"up":"err"; }
  catch(e){ db="down"; dbWhy=String((e&&e.message)||e).slice(0,160); }
  let r2=env.DOCS?"bound":"absent", vec=env.MATCH_INDEX?"bound":"absent";
  // Cron freshness. "Did the cron run?" had no answer anywhere before job_runs (0076). Stale is a
  // real outage — a silent cron looks exactly like a working one from the outside.
  let cron="unknown", lastRun=null, cronFails=0;
  if(db==="up"){
    const j=await env.DB.prepare("SELECT MAX(started_at) t FROM job_runs").first().catch(()=>null);
    lastRun=(j&&j.t)||null;
    if(lastRun){ const ageMin=Math.round((Date.now()-Date.parse(lastRun+"Z"))/60000);
      cron = ageMin<=15 ? "fresh" : ageMin<=90 ? "late" : "stale"; }
    const f=await env.DB.prepare("SELECT COUNT(*) c FROM job_runs WHERE ok=0 AND started_at > ?")
      .bind(new Date(Date.now()-864e5).toISOString()).first().catch(()=>null);
    cronFails=(f&&f.c)||0;
  }
  // Twilio going dark stops every lead alert and says nothing — sendSMS returns {dark:true}.
  const sms=env.TWILIO_ACCOUNT_SID?(env.ADMIN_PHONE?"live":"no_admin_phone"):"dark";
  const ok = db==="up" && cron!=="stale";
  return json({ok,db,dbWhy,appliance,host,why,cloud:env.AI?"bound":"absent",r2,vec,
    cron,last_run:lastRun,cron_failures_24h:cronFails,sms,
    build:(env.CF_VERSION_METADATA&&env.CF_VERSION_METADATA.id)||"unversioned",ts:Date.now()}); }
// R15: deterministic verb layer (build-list #3/#11/#15) — answers instantly, survives total model loss.
// All SQL parameterized; purge_test touches is_demo=1 rows only; remove proposes, never executes.
async function nimbusVerb(env,q,p){
  // R16: real speech, not command line. Strip politeness/filler so "Can you remove X please" hits the verb.
  q=String(q||"").toLowerCase().replace(/[?.!]+$/,"").trim()
     .replace(/^(hey|ok|okay|so|and|now|yo)[\s,]+/g,"")
     .replace(/^(can|could|will|would|do)\s+(you|u)\s+(please\s+)?/,"")
     .replace(/^(please|pls)\s+/,"")
     .replace(/^(i\s+(want|need|would like)\s+(you\s+)?to\s+|go\s+ahead\s+and\s+|let'?s\s+)/,"")
     .replace(/\s+(please|thanks|thank you|for me)$/,"")
     .trim();
  const rows=async(sql,...b)=>{const r=await env.DB.prepare(sql).bind(...b).all().catch(()=>({results:[]}));return r.results||[];};
  const carLine=v=>`${v.year} ${v.make} ${v.model}${v.trim?" "+v.trim:""} · $${v.price_mo||"?"}/mo${v.miles?" · "+v.miles+" mi":""}`;
  const leadLine=w=>`${w.cid||"—"} · ${[w.first_name,w.last_name].filter(Boolean).join(" ")||"?"} · ${w.matched_car||w.dream_car||"?"} · $${w.monthly||"?"}/mo · ${w.zip||"?"}${w.is_demo?" · TEST":""}`;
  let m;
  if(/^(show |list |raw |view )?(me )?(the )?(inventory|cars)$/.test(q)){
    const n=/^raw /.test(q)?50:15;
    const v=await rows("SELECT year,make,model,trim,price_mo,miles FROM vdps WHERE active=1 ORDER BY updated_at DESC LIMIT ?",n);
    return {answer:(v.map(carLine).join("\n")||"No active inventory.")+(v.length>=n?"\n…say 'export inventory' for the full CSV.":"")};
  }
  if(/^(show |list |raw |view )?(me )?(the )?(buyers|leads)$/.test(q)){
    const n=/^raw /.test(q)?50:15;
    const w=await rows("SELECT cid,first_name,last_name,matched_car,dream_car,monthly,zip,is_demo FROM web_leads ORDER BY id DESC LIMIT ?",n);
    return {answer:w.map(leadLine).join("\n")||"No buyers yet."};
  }
  // ---- Creator Network verbs. Read-only ones answer instantly; anything that pays PROPOSES. ----
  if(/^(show |list |view )?(me )?(the )?creators$/.test(q)){
    const c=await rows("SELECT handle,status,score,followers_declared,(SELECT COUNT(*) FROM creator_posts p WHERE p.creator_id=creators.id) posts FROM creators ORDER BY score DESC LIMIT 25");
    return {answer:c.map(x=>`${x.handle||"—"} · ${x.status} · score ${x.score}/100 · ${x.posts} post(s) · ${x.followers_declared||0} declared followers (unverified)`).join("\n")||"No creators yet."};
  }
  if(/^(show |list |view )?(me )?(the )?(open )?drops$/.test(q)){
    const d=await rows("SELECT d.id,d.rate_cents,d.status,v.year,v.make,v.model,(SELECT COUNT(*) FROM creator_claims x WHERE x.drop_id=d.id) claims FROM creator_drops d JOIN vdps v ON v.id=d.vdp_id WHERE d.status='open' ORDER BY d.id DESC LIMIT 25");
    return {answer:d.map(x=>`#${x.id} · ${x.year} ${x.make} ${x.model} · $${((x.rate_cents||0)/100).toFixed(0)}/post · ${x.claims} claimed`).join("\n")||"No open drops."};
  }
  if(/^(show |list |view )?(me )?(the )?(pending |submitted )?posts( pending| for review)?$/.test(q)){
    const ps=await rows("SELECT p.id,p.reach_declared,p.disclosure_confirmed,c.handle,cc.clicks FROM creator_posts p JOIN creators c ON c.id=p.creator_id JOIN creator_claims cc ON cc.id=p.claim_id WHERE p.status='submitted' ORDER BY p.id ASC LIMIT 25");
    return {answer:ps.map(x=>`post #${x.id} · ${x.handle} · ${x.clicks} clicks / ${x.reach_declared||0} reach${x.disclosure_confirmed?"":" · ⚠ NO DISCLOSURE"}`).join("\n")||"Nothing awaiting review."};
  }
  if(/^(show |list |view )?(me )?(the )?(payout|payouts|payout queue|what (do )?(we|i) owe)$/.test(q)){
    const e=await rows("SELECT e.id,e.amount_cents,c.handle,c.payouts_enabled FROM creator_earnings e JOIN creators c ON c.id=e.creator_id WHERE e.status='approved' ORDER BY e.id ASC LIMIT 25");
    const tot=e.reduce((a,x)=>a+(+x.amount_cents||0),0);
    return {answer:(e.map(x=>`earning #${x.id} · ${x.handle} · $${((x.amount_cents||0)/100).toFixed(2)}${x.payouts_enabled?"":" · ⚠ Stripe onboarding incomplete"}`).join("\n")||"Nothing approved for payout.")+
      (e.length?`\n\nTotal owed: $${(tot/100).toFixed(2)}. Say "pay earning <id>" to propose a transfer.`:"")};
  }
  if(/^(show |list |view )?(me )?(the )?(affiliate )?links$/.test(q)){
    const lk=await rows("SELECT c.handle, c.ref_token, COALESCE(c.ref_clicks,0) clicks, "+
      "(SELECT COUNT(*) FROM web_leads w WHERE w.creator_id=c.id) leads FROM creators c WHERE c.ref_token IS NOT NULL ORDER BY clicks DESC LIMIT 25");
    const cm=await rows("SELECT c.handle, cc.token, COALESCE(cc.clicks,0) clicks, d.vin FROM creator_claims cc "+
      "JOIN creators c ON c.id=cc.creator_id JOIN creator_drops d ON d.id=cc.drop_id ORDER BY cc.clicks DESC LIMIT 15");
    const a=["PERSONAL LINKS"].concat(lk.length?lk.map(x=>`carnimbus.us/c/${x.ref_token} · ${x.handle} · ${x.clicks} clicks · ${x.leads} leads`):["(none)"]);
    a.push("","CAR LINKS");
    a.push.apply(a,cm.length?cm.map(x=>`carnimbus.us/c/${x.token} · ${x.handle} · ${x.vin||"—"} · ${x.clicks} clicks`):["(none)"]);
    return {answer:a.join("\n")};
  }
  if((m=q.match(/^approve post #?(\d+)$/))){
    return {answer:`Approving post #${m[1]} releases its earning for payout.`,proposed_action:{name:"creator_approve_post",args:{post_id:m[1]}}};
  }
  if((m=q.match(/^reject post #?(\d+)$/))){
    return {answer:`Rejecting post #${m[1]} claws back its accrued earning.`,proposed_action:{name:"creator_reject_post",args:{post_id:m[1]}}};
  }
  if((m=q.match(/^pay (?:earning )?#?(\d+)$/))){
    // Never executed here. Irreversible actions are L1 forever — aiAct requires confirm:true.
    const e=await rows("SELECT e.id,e.amount_cents,e.status,c.handle,c.payouts_enabled FROM creator_earnings e JOIN creators c ON c.id=e.creator_id WHERE e.id=?",+m[1]);
    if(!e.length) return {answer:`No earning #${m[1]}.`};
    const x=e[0];
    if(x.status!=="approved") return {answer:`Earning #${x.id} is "${x.status}", not approved — approve its post first.`};
    if(!x.payouts_enabled) return {answer:`${x.handle} hasn't finished Stripe onboarding, so no transfer can be sent yet.`};
    return {answer:`⚠ This moves real money and cannot be undone. Pay ${x.handle} $${((x.amount_cents||0)/100).toFixed(2)} for earning #${x.id}?`,
      proposed_action:{name:"creator_payout",args:{earning_id:String(x.id)}}};
  }
  if(/^(status|system status|full status)$/.test(q)){
    let appliance="not configured";
    if(env.AI_BACKEND_URL){ try{
        const r=await fetch(env.AI_BACKEND_URL+"/chat",{method:"POST",body:JSON.stringify({messages:[{role:"user",content:"ping"}]}),signal:AbortSignal.timeout(3000)});
        appliance=r.ok?"UP":"ERROR "+r.status; }catch(_){ appliance="DOWN (didn't answer in 3s — check the box + tunnel)"; } }
    const cars=await rows("SELECT COUNT(*) c FROM vdps WHERE active=1");
    const leads=await rows("SELECT COUNT(*) c FROM web_leads WHERE COALESCE(is_demo,0)=0");
    const dlrs=await rows("SELECT COUNT(*) c FROM dealer_leads WHERE status='active' AND COALESCE(is_demo,0)=0");
    return {answer:"MODEL  appliance: "+appliance+"\n       cloud: "+(env.AI?"bound (free tier — dies daily at 10k neurons; Workers Paid removes the cap)":"ABSENT")+
      "\nDATA   "+(cars[0]?cars[0].c:0)+" active cars · "+(leads[0]?leads[0].c:0)+" live leads · "+(dlrs[0]?dlrs[0].c:0)+" dealers active"+
      "\nTODAY  "+(p.scansToday||0)+" scans · "+(p.driveNowsToday||0)+" drive-nows"};
  }
  // R23: outcome verbs — deterministic, model-free views of the lifecycle ledger.
  if((m=/^(show |list |view )?(me )?(the )?(no.?shows?|cancel(led|lations)?|win.?backs?)$/.exec(q))){
    const kind=/no.?show/.test(m[4])?"no_show":/cancel/.test(m[4])?"cancelled":"winback";
    if(kind==="winback"){
      const wbs=await rows("SELECT e.ts,e.lead_id,w.cid,w.first_name,w.last_name,w.matched_car,w.dream_car FROM lead_events e JOIN web_leads w ON w.id=e.lead_id WHERE e.to_status='confirmed' AND e.from_status IN ('no_show','cancelled') ORDER BY e.ts DESC LIMIT 15");
      return {answer:wbs.map(x=>String(x.ts||"").slice(0,16).replace("T"," ")+" · "+(x.cid||"—")+" · "+([x.first_name,x.last_name].filter(Boolean).join(" ")||"?")+" · "+(x.matched_car||x.dream_car||"?")).join("\n")||"No win-backs yet."};
    }
    const ws=await rows("SELECT cid,first_name,last_name,matched_car,dream_car,status_ts,followup_stage FROM web_leads WHERE status=? ORDER BY status_ts DESC LIMIT 15",kind);
    return {answer:ws.map(x=>String(x.status_ts||"").slice(0,16).replace("T"," ")+" · "+(x.cid||"—")+" · "+([x.first_name,x.last_name].filter(Boolean).join(" ")||"?")+" · "+(x.matched_car||x.dream_car||"?")+(x.followup_stage===99?" · texts stopped":"")).join("\n")||("No "+kind.replace("_","-")+"s.")};
  }
  if(/^export (the )?(inventory|cars)$/.test(q)) return {answer:"EXPORT_READY:/api/admin/export?pool=vdps"};
  if(/^export (the )?(buyers|leads)$/.test(q))   return {answer:"EXPORT_READY:/api/admin/export?pool=web_leads"};
  if(/^(purge|remove|delete) (the )?test data$/.test(q)||/^purge tests?$/.test(q)){
    const t=await rows("SELECT COUNT(*) c FROM web_leads WHERE is_demo=1");
    return {answer:"Found "+(t[0]?t[0].c:0)+" test lead(s) plus the demo tenant's cars. Shall I purge them, sir?",
      proposed_action:{name:"purge_test",args:{}}};
  }
  // R16: multi-target removes — "remove the jordan rivera test & the smoke test". Test rows resolve first so
  // a live customer is never silently surfaced for hiding; if one is, it's called out loudly.
  if((m=/^(remove|delete|hide|get rid of|clear)\s+(.+)$/.exec(q))){
    const targets=m[2].split(/\s*(?:&|,|\band\b|\+)\s*/)
      .map(s=>s.replace(/^(the|that|a)\s+/,"").replace(/\s+(test|tests|record|records|lead|leads|row|rows|data)$/,"").trim())
      .filter(Boolean).slice(0,5);
    const hits=[], misses=[];
    for(const tRaw of targets){
      const t="%"+tRaw+"%";
      let w=await rows("SELECT id,cid,first_name,last_name,matched_car,dream_car,monthly,zip,is_demo FROM web_leads WHERE is_demo=1 AND (first_name||' '||last_name) LIKE ? ORDER BY id DESC LIMIT 1",t);
      if(!w.length) w=await rows("SELECT id,cid,first_name,last_name,matched_car,dream_car,monthly,zip,is_demo FROM web_leads WHERE COALESCE(is_demo,0)=0 AND (first_name||' '||last_name) LIKE ? ORDER BY id DESC LIMIT 1",t);
      if(w.length) hits.push(w[0]); else misses.push(tRaw);
    }
    if(!hits.length){
      const v=await rows("SELECT vin,year,make,model,trim,price_mo,miles FROM vdps WHERE active=1 AND (year||' '||make||' '||model||' '||COALESCE(trim,'')) LIKE ? ORDER BY id DESC LIMIT 1","%"+(targets[0]||"")+"%");
      if(v.length) return {answer:"Found: "+carLine(v[0])+" (VIN "+v[0].vin+")\nDeactivate this listing?",proposed_action:{name:"deactivate_vin",args:{vin:v[0].vin}}};
      return {answer:"No buyer or listing matches "+misses.map(x=>'"'+x+'"').join(" or ")+", sir."};
    }
    const live=hits.filter(h=>!h.is_demo);
    return {answer:hits.map(h=>"• "+leadLine(h)).join("\n")+
      (live.length?"\n⚠ "+live.length+" of these is a LIVE customer, not a test row.":"")+
      (misses.length?"\n(no match for "+misses.map(x=>'"'+x+'"').join(", ")+")":"")+
      "\nHide "+(hits.length>1?("all "+hits.length):"this")+" from operations?",
      proposed_action:{name:"hide_leads",args:{ids:hits.map(h=>h.id).join(",")}}};
  }
  if(/^(help|what can you do|commands|verbs)$/.test(q))
    return {answer:"COMMANDS (these work even with the model offline, sir)\n"+
      "  status                    full system report\n"+
      "  show inventory | cars     15 newest active listings\n"+
      "  show buyers | leads       15 newest leads\n"+
      "  show no-shows | cancellations | win-backs   lifecycle ledger views\n"+
      "  raw inventory | buyers    50 rows, zero inference\n"+
      "  export inventory|buyers   CSV download\n"+
      "  remove <name> [& <name>]  find + confirm hide\n"+
      "  purge test data           clear all TEST rows\n"+
      "  lock                      end session"};
  return null;   // fall through to the LLM
}
async function aiAsk(request,env){
  const {question,history}=await request.json().catch(()=>({}));
  if(!question) return json({ok:false,error:"bad_request"},400);
  const p=await aiPulse(env).then(r=>r.json()).catch(()=>({}));
  // R15: deterministic verbs answer instantly and survive total model loss.
  const det=await nimbusVerb(env,String(question),p);
  if(det) return json({ok:true,answer:det.answer,proposed_action:det.proposed_action||null,deterministic:true});
  const t=await aiTrends(env).then(r=>r.json()).catch(()=>({}));
  const state=`STATE (live): scansToday=${p.scansToday} driveNowsToday=${p.driveNowsToday} convRate=${p.convRate}% liveInventory=${p.liveInventory} in=${p.inToday} out=${p.outToday}. `+
    `topTypes=${(t.byType||[]).map(x=>x.t+":"+x.c).join(", ")}. topCars=${(t.topCars||[]).slice(0,5).map(x=>x.t+":"+x.c).join(", ")}. topZips=${(t.byZip||[]).slice(0,5).map(x=>x.t+":"+x.c).join(", ")}.`;
  const sys="You are Nimbus, the operations intelligence for CarNimbus (a car-buying platform). Answer the operator "+
    "concisely from the live STATE below. Most questions are read-only — just answer them and output NOTHING else. "+
    "ONLY when the operator explicitly asks you to CHANGE something (turn a dealer on/off, reindex, take a car in/out) "+
    "do NOT perform it — instead append exactly one action as the final line, using real values, e.g. "+
    "`<ACTION name=dealer_engine dealer_id=3 on=1>`. Never output an action line for a read-only question, and never "+
    "emit placeholder tokens like NAME, arg1, or v1. Available actions: "+
    Object.entries(NIMBUS_ACTIONS).map(([k,v])=>k+" — "+v).join("; ")+". "+state;
  const msgs=[{role:"system",content:sys},...((history||[]).slice(-8)),{role:"user",content:String(question).slice(0,600)}];
  let text; try{ text=await llm(env,msgs); }
  catch(_){ try{ text=await llm(env,msgs); }
    catch(e){ const why=(e&&e.layer==="quota")
        ? "Workers AI daily quota is exhausted (resets midnight UTC; Workers Paid removes the cap)"
        : "the cloud model errored";
      const ol=(e&&e.ollama)?"Your Ollama appliance didn't answer within 6s — check the box and its tunnel. Then: ":"";
      const ql=String(question||"").toLowerCase();   // R16: never dead-end — point at the verb that would have worked
      const hint=/remove|delete|hide|get rid/.test(ql)?" Try: remove <name>."
        :/test/.test(ql)?" Try: purge test data."
        :/inventory|car/.test(ql)?" Try: show inventory."
        :/buyer|lead/.test(ql)?" Try: show buyers."
        :" Say 'help' for the full command list.";
      return json({ok:false,error:"nimbus_unavailable",detail:ol+why+"."+hint},503); } }
  let proposed=null; const m=/<ACTION\s+name=(\w+)([^>]*)>/i.exec(text||"");
  if(m){ const args={}; (m[2]||"").trim().split(/\s+/).filter(Boolean).forEach(kv=>{ const [k,...rest]=kv.split("="); if(k) args[k]=rest.join("="); });
    // Reject the model echoing the prompt's template (placeholder arg names/values) rather than a real action.
    const placeholder=Object.keys(args).some(k=>/^arg\d+$/i.test(k)) || Object.values(args).some(v=>/^v\d+$/i.test(v)||v==="NAME");
    if(NIMBUS_ACTIONS[m[1]] && !placeholder) proposed={name:m[1],args};
    text=String(text).replace(m[0],"").trim(); }
  return json({ok:true, answer:text, proposed_action:proposed}); }
async function aiAct(request,env){
  const {action,args,confirm}=await request.json().catch(()=>({}));
  if(!confirm) return json({ok:false,error:"unconfirmed"},400);
  if(!NIMBUS_ACTIONS[action]) return json({ok:false,error:"unknown_action"},400);
  const a=args||{}; let result="done";
  try{
    if(action==="dealer_engine"){ const id=parseInt(a.dealer_id,10); const on=(a.on==="1"||a.on==="true"||a.on===1||a.on===true)?1:0;
      if(!id) return json({ok:false,error:"bad_dealer"},400);
      await env.DB.prepare("UPDATE dealer_leads SET engine_on=? WHERE id=?").bind(on,id).run(); result=`dealer ${id} engine ${on?"ON":"OFF"}`; }
    else if(action==="reindex"){ await reindexAll(request,env); result="reindex started"; }
    else if(action==="activate_vin"||action==="deactivate_vin"){ const on=action==="activate_vin"?1:0; const vin=String(a.vin||"").trim();
      if(!vin) return json({ok:false,error:"bad_vin"},400);
      await env.DB.prepare("UPDATE vdps SET active=?, deactivated_at=? WHERE vin=?").bind(on, on?null:new Date().toISOString(), vin).run(); result=`${vin} ${on?"activated":"deactivated"}`; }
    // ONE car, ONE column. The old ways to change a price were a CSV upload (which used to blank
    // miles/price_total/mileage/location_zip) or raw SQL from a laptop. embedding_synced=0 so the
    // next syncEmbeddings re-indexes it, exactly as appReprice does — otherwise search keeps
    // ranking on the old price.
    else if(action==="set_price"){
      const vin=String(a.vin||"").trim(); const mo=parseInt(a.price_mo,10);
      if(!vin) return json({ok:false,error:"bad_vin"},400);
      if(!mo||mo<50||mo>9999) return json({ok:false,error:"bad_price"},400);
      const cur=await env.DB.prepare("SELECT id,price_mo FROM vdps WHERE vin=?").bind(vin).first().catch(()=>null);
      if(!cur) return json({ok:false,error:"not_found"},404);
      const r=await env.DB.prepare("UPDATE vdps SET price_mo=?, embedding_synced=0, updated_at=? WHERE vin=?")
        .bind(mo,new Date().toISOString(),vin).run();
      if(!r||!r.meta||r.meta.changes!==1) return json({ok:false,error:"not_found"},404);
      await logEvent(env,{action:"dealer.price_set",vehicle_id:cur.id,source:"nimbus",confidence:mo}).catch(()=>{});
      result=`${vin} $${cur.price_mo||"—"}/mo → $${mo}/mo`; }
    else if(action==="purge_test"){   // R15: confirm-gated; scoped strictly to is_demo rows
      const n=await env.DB.prepare("DELETE FROM web_leads WHERE is_demo=1").run();
      await env.DB.prepare("UPDATE vdps SET active=0, deactivated_at=? WHERE dealer_id IN (SELECT id FROM dealer_leads WHERE is_demo=1)").bind(new Date().toISOString()).run();
      result=(n.meta.changes||0)+" test lead(s) purged; demo-tenant cars archived"; }
    else if(action==="hide_lead"){ const lid=parseInt(a.lead_id,10);   // R15: soft + reversible
      if(!lid) return json({ok:false,error:"bad_lead"},400);
      await env.DB.prepare("UPDATE web_leads SET is_demo=1 WHERE id=?").bind(lid).run(); result="lead "+lid+" hidden from ops (soft — reversible)"; }
    else if(action==="hide_leads"){   // R16: multi-target, soft + reversible, capped
      const ids=String(a.ids||"").split(",").map(x=>parseInt(x,10)).filter(x=>x>0).slice(0,25);
      if(!ids.length) return json({ok:false,error:"bad_lead"},400);
      for(const id of ids) await env.DB.prepare("UPDATE web_leads SET is_demo=1 WHERE id=?").bind(id).run();
      result=ids.length+" lead(s) hidden from ops (soft — reversible)"; }
    // ---- Creator Network. NIMBUS decides on creator. exactly as it does on dealer.: same allowlist,
    // ---- same confirm gate, same event log. All reversible EXCEPT creator_payout.
    else if(action==="creator_approve_post"||action==="creator_reject_post"){
      const pid=parseInt(a.post_id,10); if(!pid) return json({ok:false,error:"bad_post"},400);
      const ok=action==="creator_approve_post";
      const p=await env.DB.prepare("SELECT id,disclosure_confirmed FROM creator_posts WHERE id=?").bind(pid).first();
      if(!p) return json({ok:false,error:"bad_post"},400);
      // FTC 16 CFR 255: an undisclosed paid post can never be approved, whatever the operator asks for.
      if(ok&&!p.disclosure_confirmed) return json({ok:false,error:"no_disclosure"},422);
      await env.DB.prepare("UPDATE creator_posts SET status=?, reviewed_at=? WHERE id=?")
        .bind(ok?"approved":"rejected",new Date().toISOString(),pid).run();
      await env.DB.prepare("UPDATE creator_earnings SET status=? WHERE post_id=? AND status IN ('accrued','approved')")
        .bind(ok?"approved":"clawed_back",pid).run();
      result="post "+pid+" "+(ok?"approved — earning released for payout":"rejected; earning clawed back"); }
    else if(action==="creator_suspend"||action==="creator_reinstate"){
      const cid2=parseInt(a.creator_id,10); if(!cid2) return json({ok:false,error:"bad_creator"},400);
      await env.DB.prepare("UPDATE creators SET status=? WHERE id=?").bind(action==="creator_suspend"?"suspended":"approved",cid2).run();
      result="creator "+cid2+" "+(action==="creator_suspend"?"suspended":"reinstated")+" (soft — reversible)"; }
    else if(action==="creator_clawback"){
      const eid=parseInt(a.earning_id,10); if(!eid) return json({ok:false,error:"bad_earning"},400);
      const e=await env.DB.prepare("SELECT status FROM creator_earnings WHERE id=?").bind(eid).first();
      if(!e) return json({ok:false,error:"bad_earning"},400);
      if(e.status==="paid") return json({ok:false,error:"already_paid"},422);   // money already left — reverse in Stripe, not here
      await env.DB.prepare("UPDATE creator_earnings SET status='clawed_back' WHERE id=?").bind(eid).run();
      result="earning "+eid+" clawed back"; }
    else if(action==="creator_payout"){
      // ⚠ THE ONLY IRREVERSIBLE ACTION IN THE SET. AUTONOMY-POLICY.md caps irreversible actions at L1
      // permanently — "no accuracy score buys past it". NIMBUS proposes; the confirm gate above is a human.
      if(!env.STRIPE_SECRET_KEY) return json({ok:false,error:"stripe_unconfigured"},503);
      const eid=parseInt(a.earning_id,10); if(!eid) return json({ok:false,error:"bad_earning"},400);
      const e=await env.DB.prepare("SELECT e.id,e.amount_cents,e.status,c.id cid,c.stripe_account_id,c.payouts_enabled FROM creator_earnings e JOIN creators c ON c.id=e.creator_id WHERE e.id=?").bind(eid).first();
      if(!e) return json({ok:false,error:"bad_earning"},400);
      if(e.status!=="approved") return json({ok:false,error:"not_approved"},422);
      if(!e.stripe_account_id||!e.payouts_enabled) return json({ok:false,error:"payouts_not_enabled"},422);
      // CLAIM FIRST. Until 2026-08-06 this transferred and THEN updated, with aiAct's single
      // catch turning any failure in between into a generic "Action failed" — leaving the
      // earning 'approved' and the Pay button on screen. The obvious human response to a failure
      // message is to press the button again, and that paid the creator twice with no trace.
      // The guarded UPDATE is the lock: exactly one caller can move approved → paying.
      const claim=await env.DB.prepare("UPDATE creator_earnings SET status='paying' WHERE id=? AND status='approved'")
        .bind(eid).run().catch(()=>null);
      if(!claim||!claim.meta||claim.meta.changes!==1) return json({ok:false,error:"not_approved_or_in_flight"},409);
      // …and the idempotency key is the belt to that braces: even if this row were lost entirely,
      // Stripe refuses a second transfer carrying the same key.
      const t=await stripeApi(env,"transfers",{amount:e.amount_cents,currency:"usd",destination:e.stripe_account_id,
        "metadata[earning_id]":String(eid),"metadata[creator_id]":String(e.cid)}, "earning-"+eid);
      if(!t.ok||!t.data.id){
        await env.DB.prepare("UPDATE creator_earnings SET status='approved' WHERE id=? AND status='paying'")
          .bind(eid).run().catch(()=>{});
        return json({ok:false,error:"stripe_failed"},502);
      }
      // If THIS throws, the row stays 'paying' — not payable again, and visibly stuck rather than
      // silently repayable. That is the failure mode we want.
      await env.DB.prepare("UPDATE creator_earnings SET status='paid', stripe_transfer_id=?, paid_at=? WHERE id=?")
        .bind(t.data.id,new Date().toISOString(),eid).run();
      result="paid $"+(e.amount_cents/100).toFixed(2)+" — transfer "+t.data.id; }
    // 2026-08-03: the two verbs that replace the retired creator portal.
    else if(action==="creator_invite"){
      const r=await creatorInvite(env,a);
      if(!r.ok) return json(r,r.error==="bad_request"?400:502);
      result="invited "+r.handle+" — link "+r.link+(r.onboard?" · onboarding "+r.onboard:" · STRIPE NOT CONFIGURED, no payouts yet"); }
    else if(action==="creator_sync"){
      const r=await creatorSync(env,a);
      if(!r.ok) return json(r,r.error==="bad_creator"?400:502);
      result=r.handle+" — payouts "+(r.payouts_enabled?"ENABLED":"still pending Stripe KYC"); }
    else if(action==="backfill_drops"){
      // Mirrors dealerAutoPlace (:1961): NOT EXISTS guard, so re-running is a no-op, never a duplicate.
      const cars=await env.DB.prepare(
        "SELECT v.id,v.vin,v.price,v.price_mo,v.lot_date FROM vdps v WHERE v.active=1 "+
        "AND NOT EXISTS (SELECT 1 FROM creator_drops d WHERE d.vdp_id=v.id) LIMIT 500").all().catch(()=>({results:[]}));
      const now=new Date().toISOString(); let opened=0, cents=0;
      for(const v of (cars.results||[])){
        const r=rateForDrop(v);
        const ok=await env.DB.prepare("INSERT INTO creator_drops (vin,vdp_id,dealer_id,rate_cents,rate_why,locked,status,created_at) VALUES (?,?,(SELECT dealer_id FROM vdps WHERE id=?),?,?,0,'open',?)")
          .bind(v.vin,v.id,v.id,r.cents,JSON.stringify(r.why),now).run().then(()=>1).catch(()=>0);
        if(ok){ opened++; cents+=r.cents; }
      }
      result=opened+" drop(s) opened"+(opened?(" · avg $"+((cents/opened)/100).toFixed(0)+"/post"):"")+" (reversible: close_drop)"; }
    else if(action==="drop_rate"){
      const did2=parseInt(a.drop_id,10), cents=parseInt(a.cents,10);
      if(!did2||!(cents>=0)) return json({ok:false,error:"bad_drop"},400);
      const capped=Math.min(CREATOR_MAX_RATE_CENTS,cents);
      // locked=1: a human fixed this number. creatorAgent never re-prices a locked drop.
      await env.DB.prepare("UPDATE creator_drops SET rate_cents=?, rate_why=?, locked=1 WHERE id=?")
        .bind(capped,JSON.stringify([{f:"set by operator",cents:capped}]),did2).run();
      result="drop "+did2+" set to $"+(capped/100).toFixed(2)+" and locked from re-pricing"; }
    else if(action==="close_drop"||action==="open_drop"){
      const did2=parseInt(a.drop_id,10); if(!did2) return json({ok:false,error:"bad_drop"},400);
      await env.DB.prepare("UPDATE creator_drops SET status=? WHERE id=?").bind(action==="close_drop"?"closed":"open",did2).run();
      result="drop "+did2+" "+(action==="close_drop"?"closed":"reopened"); }
  }catch(e){ return json({ok:false,error:"act_failed"},500); }
  await logEvent(env,{action:"admin.nimbus_act",source:action+" "+JSON.stringify(a)}).catch(()=>{});
  return json({ok:true, result}); }
async function aiGraph(env){
  const all=async(sql,...b)=>{ const r=await env.DB.prepare(sql).bind(...b).all().catch(()=>({results:[]})); return r.results||[]; };
  const NODES=[], EDGES=[], seen=new Set();
  const add=(id,type,label,val)=>{ if(seen.has(id))return; seen.add(id); NODES.push({id,type,label:String(label||"").trim().slice(0,40),val:val||1}); };
  const dealers=await all("SELECT id,name,dealership FROM dealer_leads WHERE engine_on=1 ORDER BY id DESC LIMIT 20");
  dealers.forEach(d=>add("d"+d.id,"dealer",d.dealership||d.name||("Dealer "+d.id),6));
  const cars=await all("SELECT id,year,make,model,dealer_id FROM vdps WHERE active=1 ORDER BY updated_at DESC LIMIT 80");
  cars.forEach(c=>{ add("c"+c.id,"car",(c.year||"")+" "+(c.make||"")+" "+(c.model||""),3);
    if(c.dealer_id&&seen.has("d"+c.dealer_id)) EDGES.push({a:"c"+c.id,b:"d"+c.dealer_id,w:1}); });
  // R21: only real users — a match node must trace to a person with real contact info, labeled by
  // anonymized CID (never a raw "Rider N" for a seed row). Few real matches → few nodes. Honest.
  const ms=await all("SELECT m.user_id,m.vdp_id,m.score,u.email,u.phone FROM matches m JOIN users u ON u.id=m.user_id "+
    "WHERE (u.email IS NOT NULL AND u.email!='') OR (u.phone IS NOT NULL AND u.phone!='') ORDER BY m.score DESC LIMIT 120");
  const riders=new Set();
  ms.forEach(m=>{ if(!seen.has("c"+m.vdp_id))return; riders.add(m.user_id);
    add("u"+m.user_id,"rider",leadCid(m.email,m.phone)||("User "+m.user_id),3);
    EDGES.push({a:"c"+m.vdp_id,b:"u"+m.user_id,w:Math.max(1,Math.round((m.score||0)/20))}); });
  if(riders.size){ const ids=[...riders].slice(0,60), ph=ids.map(()=>"?").join(",");
    const ps=await all("SELECT user_id FROM profiles WHERE user_id IN ("+ph+")",...ids);
    ps.forEach(p=>{ add("p"+p.user_id,"profile","Twin "+p.user_id,2); EDGES.push({a:"u"+p.user_id,b:"p"+p.user_id,w:1}); }); }
  // Creator Network edges: creator → the car they claimed. Creators are labeled by handle (their own
  // public identity, not a buyer's), and the edge stops at the CAR — a creator node never touches a
  // rider or profile node, which is fence 1 expressed in the graph itself.
  const crs=await all("SELECT c.id,c.handle,c.score, cc.drop_id, d.vdp_id FROM creator_claims cc "+
    "JOIN creators c ON c.id=cc.creator_id JOIN creator_drops d ON d.id=cc.drop_id ORDER BY cc.id DESC LIMIT 60");
  crs.forEach(x=>{ if(!seen.has("c"+x.vdp_id))return;
    add("k"+x.id,"creator",x.handle||("Creator "+x.id),Math.max(2,Math.round((x.score||0)/20)));
    EDGES.push({a:"k"+x.id,b:"c"+x.vdp_id,w:2}); });
  return json({ok:true, nodes:NODES.slice(0,200), edges:EDGES}); }
async function dealerActivate(request,env){ const {leadId}=await request.json().catch(()=>({}));
  if(!leadId) return json({ok:false,error:"bad_request"},400);
  const no=genCode("CN");
  await env.DB.prepare("UPDATE dealer_leads SET client_no=?, status='active' WHERE id=?").bind(no,+leadId).run();
  return json({ok:true,client_no:no}); }
async function whoami(request,env,uid){
  const u=await env.DB.prepare("SELECT phone FROM users WHERE id=?").bind(uid).first();
  const digits=String(u&&u.phone||"").replace(/\D/g,"").slice(-10);
  const d=digits?await env.DB.prepare("SELECT status,client_no,engine_on,subscription_status,current_period_end FROM dealer_leads WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone,'-',''),' ',''),'(',''),')','') LIKE ? ORDER BY id DESC LIMIT 1").bind("%"+digits).first():null;
  return json({ok:true,buyer:true,dealer:!!(d&&d.status==="active"&&d.client_no),
    engine_on:!!(d&&d.engine_on),subscription_status:(d&&d.subscription_status)||"none",next_bill:(d&&d.current_period_end)||null}); }
async function adminStats(request,env){
  const w=await env.DB.prepare("SELECT COUNT(*) c FROM waitlist").first();
  const u=await env.DB.prepare("SELECT COUNT(*) c FROM users").first();
  const p=await env.DB.prepare("SELECT COUNT(*) c FROM profiles").first();
  const t=await env.DB.prepare("SELECT COUNT(*) c FROM test_drives").first();
  const v=await env.DB.prepare("SELECT COUNT(*) c FROM vdps WHERE active=1").first();
  const dl=await env.DB.prepare("SELECT id,name,dealership,role,phone,email,created_at,client_no,status,base_fee,ad_slot,slot_premium FROM dealer_leads ORDER BY id DESC LIMIT 50").all();
  const cm=await env.DB.prepare("SELECT COUNT(*) c FROM comments").first();
  const since7d = new Date(Date.now() - 7*86400e3).toISOString();
  const activeSessionsRow = await env.DB.prepare("SELECT COUNT(DISTINCT ip) c FROM auth_ip_log WHERE created_at > ?").bind(since7d).first().catch(()=>({c:0}));
  const recentDrivesRow = await env.DB.prepare("SELECT COUNT(*) c FROM test_drives WHERE created_at > ?").bind(since7d).first().catch(()=>({c:0}));
  const activeSessions = activeSessionsRow ? activeSessionsRow.c : 0;
  const recentDrives = recentDrivesRow ? recentDrivesRow.c : 0;
  const convRate = activeSessions > 0 ? ((recentDrives / activeSessions) * 100).toFixed(1) + "%" : "0%";
  return json({ok:true,waitlist:w.c,users:u.c,profiles:p.c,drives:t.c,activeCars:v.c,comments:cm.c,dealerLeads:dl.results||[],activeSessions,recentDrives,convRate});
}
function logout(){ return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json",
  "Clear-Site-Data":"\"cache\", \"cookies\", \"storage\"",
  "Set-Cookie":"cn_sess=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"}}); }
// L9: first resident agent — a labeled, bounded community presence. Posts one useful bilingual pick per ≤2h.
async function residentAgent(env){
  // W4: keep ~3 fresh sponsored posts live (was 1 per 2h, which could never reach the 3 the feed expects).
  const cnt=await env.DB.prepare("SELECT COUNT(*) c FROM comments WHERE user_id=0 AND zip='agent' AND sponsored=1 AND created_at>?").bind(new Date(Date.now()-24*3600e3).toISOString()).first().catch(()=>({c:0}));
  let need=3-((cnt&&cnt.c)||0); if(need<=0) return;
  const vs=await env.DB.prepare("SELECT id,year,make,model,price_mo,dealer_id FROM vdps WHERE active=1 ORDER BY RANDOM() LIMIT 3").all().catch(()=>({results:[]}));
  for(const v of (vs.results||[])){ if(need<=0) break; need--;
    const en=`Okay, this ${v.year} ${v.make} ${v.model} caught my eye — right around $${v.price_mo}/mo. Worth a look before it's gone. (Soft check = 0 credit hit.)`;
    const es=`Ojo con este ${v.year} ${v.make} ${v.model} — anda por los $${v.price_mo}/mes. Vale la pena mirarlo antes de que vuele. (Chequeo suave, 0 impacto en tu crédito.)`;
    await env.DB.prepare("INSERT INTO comments (user_id,vdp_id,body,body_es,zip,sponsored,dealer_id,status,created_at) VALUES (0,?,?,?, 'agent', 1, ?, 'approved', ?)")
      .bind(v.id,en,es,v.dealer_id||null,new Date().toISOString()).run().catch(()=>{});
    await logEvent(env,{action:"social.posted",vehicle_id:v.id,source:"resident-agent"});
  }
}
// U3 (Wave U): real persona pool + LLM-generated posts, replacing the fixed 6-string array and canned question bank.
// Scale dial: swarm_config.active_personas/posts_per_hour_cap control the 10→100→1,000→100,000 ramp — a config
// UPDATE, not a redeploy. Every post keeps the same audit trail already live (synthetic=1 + synthetic_agent_audit row).
async function syntheticNudger(env){
  try {
    const cfg=await env.DB.prepare("SELECT active_personas,posts_per_hour_cap FROM swarm_config WHERE id=1").first().catch(()=>null);
    const activePersonas=(cfg&&cfg.active_personas)||10, capPerHour=(cfg&&cfg.posts_per_hour_cap)||5;
    const since=new Date(Date.now()-3600e3).toISOString();
    const recent=await env.DB.prepare("SELECT COUNT(*) c FROM comments WHERE synthetic=1 AND created_at>?").bind(since).first().catch(()=>({c:0}));
    if((recent&&recent.c||0)>=capPerHour) return;   // spend/volume guardrail — raise posts_per_hour_cap to post more
    const poolSize=await env.DB.prepare("SELECT COUNT(*) c FROM personas WHERE active=1").first().catch(()=>({c:0}));
    const pool=Math.min(activePersonas,(poolSize&&poolSize.c)||0);
    if(!pool) return;
    const persona=await env.DB.prepare("SELECT * FROM personas WHERE active=1 ORDER BY id ASC LIMIT ?, 1")
      .bind(Math.floor(Math.random()*pool)).first().catch(()=>null);
    if(!persona) return;
    // Occasionally reply into an existing synthetic thread (discussion, not just isolated broadcasts) instead of a new post.
    const openThread=Math.random()<0.35?await env.DB.prepare("SELECT id,vdp_id FROM comments WHERE synthetic=1 AND parent_id IS NULL ORDER BY id DESC LIMIT 5").all().catch(()=>({results:[]})):null;
    const threadPick=openThread&&openThread.results&&openThread.results.length?openThread.results[Math.floor(Math.random()*openThread.results.length)]:null;
    const v=await env.DB.prepare("SELECT id,year,make,model,body,price FROM vdps WHERE id=? OR (1=? AND active=1) ORDER BY RANDOM() LIMIT 1").bind(threadPick?threadPick.vdp_id:0,threadPick?0:1).first().catch(()=>null);
    if(!v) return;
    const sys=`You are ${persona.name}, a member of a car-buyer community, NOT CarNimbus staff. Your research beat: ${persona.beat}. Write ONE short, natural, human-sounding ${threadPick?"reply to another buyer's question":"question or observation"} about this car, grounded in your beat. Reference the citation domain in your beat naturally if it fits (e.g. "per KBB-style data") — never claim a live API lookup. 1-2 sentences, no markdown, no hashtags, sound like a real person texting, not a bot.`;
    const carStr=`${v.year} ${v.make} ${v.model}, listed around $${v.price||"—"}`;
    const raw=await llm(env,[{role:"system",content:sys},{role:"user",content:`Car: ${carStr}`}]).catch(()=>null);
    const question=String(raw||"").trim().slice(0,280);
    if(!question) return;
    const esSys=sys.replace("Write ONE short","Reply in neutral Latin-American Spanish. Write ONE short");
    const rawEs=await llm(env,[{role:"system",content:esSys},{role:"user",content:`Car: ${carStr}`}]).catch(()=>null);
    const questionEs=String(rawEs||question).trim().slice(0,280);
    const now=new Date().toISOString();
    await env.DB.prepare("INSERT INTO synthetic_agent_audit (created_at, vdp_id, question, persona) VALUES (?, ?, ?, ?)")
      .bind(now, v.id, question, persona.name).run();
    await env.DB.prepare("INSERT INTO comments (user_id, vdp_id, body, body_es, zip, sponsored, synthetic, parent_id, created_at, status) VALUES (0, ?, ?, ?, ?, 0, 1, ?, ?, 'approved')")
      .bind(v.id, question, questionEs, persona.name||persona.handle, threadPick?threadPick.id:null, now).run();
    await env.DB.prepare("UPDATE personas SET next_post_at=? WHERE id=?").bind(new Date(Date.now()+3600e3).toISOString(),persona.id).run().catch(()=>{});
    await logEvent(env,{action:"social.synthetic_post",vehicle_id:v.id,source:"synth-agent"});
  } catch(e) {
    console.error("syntheticNudger failed:", e);
  }
}
// M9: transparent trade-in estimate — residual-floored per-segment depreciation. A running car never hits ~$0,
// and trucks/SUVs/luxury hold value better than sedans. No external API; the basis string explains the math.
const SEG={luxury:{base:55000,rate:0.85,res:0.16}, truck:{base:45000,rate:0.88,res:0.18}, suv:{base:38000,rate:0.87,res:0.15},
  ev:{base:42000,rate:0.82,res:0.12}, sport:{base:48000,rate:0.86,res:0.15}, sedan:{base:28000,rate:0.86,res:0.12}, default:{base:26000,rate:0.86,res:0.12}};
// segOf is imported from ./site/assets/match.js (AE) — single source of truth, shared with the eval harness.
function tradeEstimate(a){ if(!a) return null; const yr=parseInt(a.current_year,10), mk=a.current_make, md=a.current_model, mi=parseInt(String(a.current_miles||"").replace(/\D/g,""),10)||0;
  if(!yr||!mk||!md) return null;
  const age=Math.max(0,(new Date().getFullYear())-yr);
  const S=SEG[segOf(mk,md)]||SEG.default, floor=S.base*S.res*Math.pow(0.90,age);   // P7: the floor itself decays with age
  let v=floor+(S.base-floor)*Math.pow(S.rate,age);        // segment depreciation toward the aged floor
  const expMiles=age*12000, over=mi-expMiles;             // mileage vs. age-expected
  v-=Math.max(0,over)*0.06;                               // penalty for miles OVER expected
  if(mi>=150000) v*=0.85;                                 // heavy-use haircut for very high absolute mileage
  v=Math.max(500,Math.round(v/100)*100);                  // hard $500 floor, round to $100
  return {point:v, low:Math.round(v*0.88/100)*100, high:Math.round(v*1.12/100)*100,
    basis:`${yr} ${mk} ${md}, ~${mi.toLocaleString()} mi: ${md} holds ~${Math.round(S.res*100)}% residual; depreciated ${age} yrs${over>0?`, ${over.toLocaleString()} mi over average`:""}. Estimate — confirmed at appraisal.`}; }
async function me(request,env,uid){
  const u=await env.DB.prepare("SELECT phone,sid,handle FROM users WHERE id=?").bind(uid).first();
  const p=await env.DB.prepare("SELECT answers,avatar FROM profiles WHERE user_id=?").bind(uid).first();
  const td=await env.DB.prepare(
    "SELECT td.center,td.slot,td.status,td.pass_token,td.created_at,v.id vdp_id,v.year,v.make,v.model,v.trim,v.price_mo,v.miles,v.drivetrain,v.photos "+
    "FROM test_drives td JOIN vdps v ON v.id=td.vdp_id WHERE td.user_id=? AND td.status='confirmed' ORDER BY td.id DESC LIMIT 1").bind(uid).first();
  let ans=p?JSON.parse(p.answers):null;
  ans=await decryptAnswers(ans, env.PII_KEY);
  return json({ok:true,phone:u?u.phone:null,sid:u?u.sid:null,handle:u?u.handle:null,cid:cidFor(uid),answers:ans,avatar:p?p.avatar:null,
    trade:tradeEstimate(ans),
    drive:td?{...td,cid:cidFor(td.id),photos:JSON.parse(td.photos||"[]")}:null});
}
async function saveAvatar(request,env,uid){ const {avatar}=await request.json().catch(()=>({}));
  if(typeof avatar!=="string"||!/^data:image\/(png|jpe?g|webp);base64,/.test(avatar)||avatar.length>80000) return json({ok:false,error:"bad_image"},400);
  await env.DB.prepare("INSERT INTO profiles (user_id,answers,avatar,embedding_synced,updated_at) VALUES (?,?,?,0,?) "+
    "ON CONFLICT(user_id) DO UPDATE SET avatar=excluded.avatar, updated_at=excluded.updated_at")
    .bind(uid,"{}",avatar,new Date().toISOString()).run();
  return json({ok:true}); }
// X2 (Wave X): anonymous 5-step website lead — stored + routed to admin SMS now; CDK API drop-in later.
// AI/TASK-006: ADF (Auto-lead Data Format) — the XML every major dealer CRM ingests (CDK, VinSolutions,
// DealerSocket). We can build the lead today; only the DESTINATION needs Cid. Dormant until CRM_ENDPOINT is set —
// until then routeLead() returns "unrouted" and the existing SMS + buyer mailto remain the delivery path,
// byte-for-byte unchanged. See DEALER-CRM-RUNBOOK.md.
function xesc(s){ return String(s==null?"":s).replace(/[<>&'"]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;","'":"&apos;",'"':"&quot;"}[c])); }
function adfFor(L){
  const [yr,mk,...md]=String(L.matched_car||"").split(" ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<?adf version="1.0"?>
<adf>
  <prospect status="new">
    <requestdate>${new Date().toISOString()}</requestdate>
    <vehicle interest="buy" status="used">
      <year>${xesc(yr)}</year><make>${xesc(mk)}</make><model>${xesc(md.join(" "))}</model>
      ${L.vin?`<vin>${xesc(L.vin)}</vin>`:``}
    </vehicle>
    <customer>
      <contact>${L.phone?`<phone type="voice">${xesc(L.phone)}</phone>`:``}</contact>
      <comments>${xesc(`CarNimbus match. Type: ${L.dream_car}. Terms: ${L.deal_type} ${L.deal_type==="cash"?`$${L.budget||""} cash`:`$${L.monthly}/mo, $${L.down} down`}. Near ${L.zip} (±${L.radius}mi). Buyer is ready to drive this week.`)}</comments>
    </customer>
    <vendor><vendorname>CarNimbus</vendorname></vendor>
    <provider><name part="full">CarNimbus</name><service>CarNimbus Match</service></provider>
  </prospect>
</adf>`; }
async function routeLead(env, L){
  if(!env.CRM_ENDPOINT) return "unrouted";
  try{ const r=await fetch(env.CRM_ENDPOINT,{method:"POST",headers:{"content-type":"application/xml"},body:adfFor(L)});
    return r.ok?"routed":("crm_"+r.status); }catch(_){ return "crm_error"; } }
// ===================================================================================================
// ===== CREATOR NETWORK (creator.carnimbus.us) — slide-4 step 2 ====================================
// ===================================================================================================
// Dealer uploads a VIN -> NIMBUS prices a "drop" -> approved creators see it ranked -> they claim a
// tracked link -> a buyer clicks it -> the lead carries creator_claim_id -> the post earns.
//
// THREE FENCES, all load-bearing:
//  1. PRIVACY. TWIN-SCHEMA says dealer.*-facing surfaces never see T2. A creator surface is
//     third-party-facing with no clause, so the stricter reading applies: creators see CAR data and
//     THEIR OWN numbers. Never a buyer's identity, band, or lead contents. Attribution tells a creator
//     THAT they produced a lead, never WHO it was. Every SELECT below is written to that rule.
//  2. NO NEW EVENT PREFIX. EVENT-TAXONOMY freezes the seven. Creator activity emits social.*,
//     drops emit dealer.*, NIMBUS decisions emit ai.*. No creator.* prefix is introduced.
//  3. NO CREATOR SMS. runQueue() resolves consent via `SELECT sms_consent FROM waitlist WHERE phone=?`;
//     a creator has no waitlist row, so a queued text is marked sent and silently never delivered.
//     Creator notification is email only.
const CREATOR_MIN_FOLLOWERS=10000;      // self-declared; nothing here can verify it — see creatorScore()
const CREATOR_MIN_CTR=0.05;             // measured from OUR tracked links, so this gate is real
const CREATOR_BASE_RATE_CENTS=5000;     // $50 floor
const CREATOR_MAX_RATE_CENTS=15000;     // $150 cap

// ---- NIMBUS decision core -------------------------------------------------------------------------
// Same contract as closeProb()/leadHeat(): deterministic, and the factors ALWAYS sum to the number
// shown. No LLM produces a figure a dealer or creator acts on.

// What a post on this unit is worth. Aging metal is worth more to move — that IS slide 4's headline.
function rateForDrop(v){
  const why=[]; let c=CREATOR_BASE_RATE_CENTS; why.push({f:"base",cents:CREATOR_BASE_RATE_CENTS});
  const price=(+v.price)|| ((+v.price_mo||0)*72) || 0;
  if(price>=55000){ c+=4000; why.push({f:"value 55k+",cents:4000}); }
  else if(price>=38000){ c+=2500; why.push({f:"value 38k+",cents:2500}); }
  else if(price>=25000){ c+=1000; why.push({f:"value 25k+",cents:1000}); }
  if(v.lot_date&&/^\d{4}-\d{2}-\d{2}$/.test(String(v.lot_date))){
    const days=Math.floor((Date.now()-Date.parse(v.lot_date+"T00:00:00Z"))/864e5);
    if(days>90){ c+=2500; why.push({f:days+"d on lot",cents:2500}); }
    else if(days>60){ c+=1500; why.push({f:days+"d on lot",cents:1500}); }
    else if(days>30){ c+=500; why.push({f:days+"d on lot",cents:500}); }
  }
  return {cents:Math.min(CREATOR_MAX_RATE_CENTS,c),why};
}

// A creator's MEASURED standing, 0-100. Declared followers contribute exactly nothing: no social API
// exists in this codebase, so a follower count is a claim, not a fact. Saying so in code is the honest
// form — the score moves only on things we watched happen.
function creatorScore(stats){
  const why=[]; let s=0;
  const posts=+stats.posts||0, approved=+stats.approved||0, rejected=+stats.rejected||0;
  const clicks=+stats.clicks||0, reach=+stats.reach||0, leads=+stats.leads||0;
  if(posts>0){
    const rate=approved/posts, pts=Math.round(rate*40);
    s+=pts; why.push({f:approved+"/"+posts+" posts approved",pts});
    if(reach>0){ const ctr=clicks/reach, pts2=Math.min(30,Math.round((ctr/CREATOR_MIN_CTR)*15));
      s+=pts2; why.push({f:(ctr*100).toFixed(1)+"% CTR",pts:pts2}); }
    const pts3=Math.min(25,leads*5); if(pts3){ s+=pts3; why.push({f:leads+" lead"+(leads===1?"":"s")+" attributed",pts:pts3}); }
    if(rejected){ const pen=Math.min(20,rejected*5); s-=pen; why.push({f:rejected+" rejected",pts:-pen}); }
  } else { s=25; why.push({f:"new creator — nothing measured yet",pts:25}); }
  return {score:Math.max(0,Math.min(100,s)),why};
}

// How well this drop fits this creator, 0-100. Ranks their feed; never hides a drop from them.
function dropFit(drop,affinity,claimCount){
  const why=[]; let s=40; why.push({f:"open drop",pts:40});
  const price=(+drop.price)|| ((+drop.price_mo||0)*72) || 0;
  const body=String(drop.body||"").toLowerCase();
  if(body&&affinity.bodies&&affinity.bodies[body]){ const pts=Math.min(25,affinity.bodies[body]*8);
    s+=pts; why.push({f:"you convert on "+body,pts}); }
  if(price&&affinity.priceHi&&price>=affinity.priceLo&&price<=affinity.priceHi){ s+=15; why.push({f:"your price lane",pts:15}); }
  const pay=+drop.rate_cents||0;
  if(pay>CREATOR_BASE_RATE_CENTS){ const pts=Math.min(15,Math.round((pay-CREATOR_BASE_RATE_CENTS)/1000)*2);
    s+=pts; why.push({f:"pays $"+(pay/100).toFixed(0),pts}); }
  if(claimCount>=8){ s-=15; why.push({f:claimCount+" creators already on it",pts:-15}); }
  else if(claimCount>=4){ s-=7; why.push({f:claimCount+" creators already on it",pts:-7}); }
  return {score:Math.max(0,Math.min(100,s)),why};
}

// Should this post be paid? Deterministic; NIMBUS proposes, a human confirms the money.
function postVerdict(post,claim,stats){
  const why=[];
  if(!post.disclosure_confirmed) return {verdict:"reject",why:[{f:"no FTC disclosure — required to pay"}]};
  why.push({f:"disclosure confirmed"});
  const priorPosts=(+stats.posts||0)-1;                       // this post is already counted
  const reach=+post.reach_declared||0, clicks=+claim.clicks||0;
  if(priorPosts<=0){ why.push({f:"first post — no measured CTR yet, reviewing on disclosure alone"});
    return {verdict:"review",why}; }
  if(reach<=0){ why.push({f:"no reach reported — cannot compute CTR"}); return {verdict:"review",why}; }
  const ctr=clicks/reach; why.push({f:(ctr*100).toFixed(1)+"% CTR vs "+(CREATOR_MIN_CTR*100)+"% floor"});
  return {verdict: ctr>=CREATOR_MIN_CTR ? "approve" : "review", why};
}

// Create the drop for a freshly uploaded VIN. Called fire-and-forget from dealerListing().
async function dropForListing(env,v,dealerId,now){
  const r=rateForDrop(v);
  await env.DB.prepare("INSERT INTO creator_drops (vin,vdp_id,dealer_id,rate_cents,rate_why,locked,status,created_at) VALUES (?,?,?,?,?,0,'open',?)")
    .bind(v.vin,v.id,dealerId,r.cents,JSON.stringify(r.why),now).run();
  await logEvent(env,{action:"dealer.drop_created",vehicle_id:v.id,source:"dealer-portal",confidence:r.cents/100});
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// THE CREATOR CONSOLE — retired 2026-08-03, RESTORED 2026-08-06 for deck v13 S-04.
//
// Everything from here to `creatorRedirect()` serves the one-page console, now at
// app.carnimbus.us/creators (it ran on creator.carnimbus.us until the domain cutover; that host
// stays bound and 301s to the apex, since a detached host cannot redirect).
//
// The retirement removed ten route lines and nothing else — no handler was deleted and no table
// was dropped. That is the only reason this restore is a ten-line change instead of a rewrite,
// and it is the argument for leaving unrouted bodies in place rather than ripping them out.
//
// LIVE AGAIN: makeCreatorSession · readCreatorSession · creatorCookie · withCreator · creatorSignup
//        creatorLogin · creatorLogout · creatorAvatar · creatorFeed · creatorAffinity
//        creatorClaim · creatorPost · creatorEarnings · creatorConnectStart · creatorConnectReturn
//
// NEVER STOPPED: creatorStats (creatorAgent + creatorQueue) · mintRefToken (creatorInvite) ·
//        refForCookies (lead capture) · stripeApi (payouts AND appStake) ·
//        creatorRedirect (/c/ — the attribution rail) · rateForDrop · dropFit · dropForListing
//
// What replaced the portal: operator verbs on ai. — creator_invite, creator_sync,
// creator_approve_post, creator_payout — all through aiAct's confirm gate.
// ══════════════════════════════════════════════════════════════════════════════════════════════

// ---- Creator session (DEAD — see the block above) --------------------------------------------------
// Mirrors makeDealerSession/readDealerSession (cn_dlr) with a "c" prefix and its own cookie.
async function makeCreatorSession(env,id){ const exp=Date.now()+30*864e5, p="c"+id+"."+exp; return p+"."+await hmac(env,p); }
async function readCreatorSession(env,request){ const m=(request.headers.get("Cookie")||"").match(/cn_crt=([^;]+)/); if(!m) return null;
  const t=decodeURIComponent(m[1]), i=t.lastIndexOf("."); if(i<0) return null;
  const p=t.slice(0,i), sig=t.slice(i+1); if(!ctEq(await hmac(env,p),sig)) return null;
  const [idp,exp]=p.split("."); if(!idp||idp[0]!=="c"||Date.now()>+exp) return null;
  return parseInt(idp.slice(1),10)||null; }
function creatorCookie(tok){ return "cn_crt="+tok+"; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age="+(30*86400); }
async function withCreator(request,env,fn){
  const cid=await readCreatorSession(env,request);
  if(!cid) return json({ok:false,error:"auth"},401);
  const c=await env.DB.prepare("SELECT id,email,handle,status,followers_declared,score,score_why,stripe_account_id,payouts_enabled,ref_token,ref_clicks,avatar,display_name FROM creators WHERE id=?").bind(cid).first();
  if(!c) return json({ok:false,error:"auth"},401);
  if(c.status!=="approved") return json({ok:false,error:"pending"},403);
  return fn(request,env,cid,c);
}

// ---- Creator auth ---------------------------------------------------------------------------------
async function creatorSignup(request,env){
  const b=await request.json().catch(()=>({}));
  const em=String(b.email||"").trim().toLowerCase().slice(0,120);
  const handle=String(b.handle||"").trim().slice(0,60), platform=String(b.platform||"").trim().slice(0,20);
  const followers=parseInt(b.followers_declared,10)||0;
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)||String(b.password||"").length<8||!handle||!platform)
    return json({ok:false,error:"bad_request"},400);
  if(await env.DB.prepare("SELECT 1 FROM creators WHERE email=?").bind(em).first().catch(()=>null)) return json({ok:false,error:"exists"},409);
  // Auto-approve above the declared-follower threshold. The number is UNVERIFIED — Stripe's own KYC is
  // what actually gates money leaving, and every accrual stays reversible (creator_earnings.clawed_back).
  const approved=followers>=CREATOR_MIN_FOLLOWERS;
  const salt=newSalt(), hash=await hashPw(String(b.password),salt), now=new Date().toISOString();
  const seed=creatorScore({});
  const ref=await mintRefToken(env,handle);
  const ins=await env.DB.prepare("INSERT INTO creators (email,pw_hash,pw_salt,handle,status,followers_declared,score,score_why,audience_tags,scored_at,created_at,ref_token,ref_clicks) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0)")
    .bind(em,hash,salt,handle,approved?"approved":"pending",followers,seed.score,JSON.stringify(seed.why),platform,now,now,ref).run();
  const id=ins.meta.last_row_id;
  await env.DB.prepare("INSERT INTO creator_socials (creator_id,platform,handle,url,followers_declared,verified,created_at) VALUES (?,?,?,?,?,0,?)")
    .bind(id,platform,handle,String(b.url||"").slice(0,300),followers,now).run().catch(()=>{});
  if(!approved) return json({ok:true,pending:true});
  return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json","Set-Cookie":creatorCookie(await makeCreatorSession(env,id)),...SEC}});
}
async function creatorLogin(request,env){
  const {email,password}=await request.json().catch(()=>({}));
  const em=String(email||"").trim().toLowerCase().slice(0,120);
  if(!em||!password) return json({ok:false,error:"bad_request"},400);
  const c=await env.DB.prepare("SELECT id,pw_hash,pw_salt,status,handle,ref_token FROM creators WHERE email=?").bind(em).first().catch(()=>null);
  if(c && await verifyPw(String(password),c.pw_salt,c.pw_hash)){
    if(c.status!=="approved") return json({ok:false,error:"pending"},403);
    if(!c.ref_token) await env.DB.prepare("UPDATE creators SET ref_token=? WHERE id=?").bind(await mintRefToken(env,c.handle),c.id).run().catch(()=>{});
    return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json","Set-Cookie":creatorCookie(await makeCreatorSession(env,c.id)),...SEC}});
  }
  // One credential, both portals: dealer staff sign in here with their existing dealer email+password.
  // Same lookup order as dealerLogin — dealer_logins (multi-staff) first, then legacy login_email.
  // Nothing is copied: the dealer's own hash is verified, and the creator row stores its own.
  const did=await dealerIdForCredentials(env,em,String(password));
  if(!did) return json({ok:false,error:"bad_credentials"},401);
  const d=await env.DB.prepare("SELECT id,status,client_no,name,dealership FROM dealer_leads WHERE id=?").bind(did).first();
  if(!d||d.status!=="active"||!d.client_no) return json({ok:false,error:"pending"},403);
  let row=await env.DB.prepare("SELECT id,status,handle,ref_token FROM creators WHERE email=?").bind(em).first().catch(()=>null);
  if(!row){
    const salt=newSalt(), hash=await hashPw(String(password),salt), now=new Date().toISOString();
    const seed=creatorScore({}), handle="@"+em.split("@")[0].slice(0,40);
    const ref=await mintRefToken(env,handle);
    const ins=await env.DB.prepare("INSERT INTO creators (email,pw_hash,pw_salt,handle,status,followers_declared,score,score_why,audience_tags,scored_at,created_at,dealer_id,ref_token,ref_clicks) VALUES (?,?,?,?, 'approved', 0,?,?, 'dealer-linked', ?,?,?,?,0)")
      .bind(em,hash,salt,handle,seed.score,JSON.stringify(seed.why),now,now,did,ref).run();
    row={id:ins.meta.last_row_id,status:"approved"};
  } else {
    // A dealer-verified identity clears a pending self-serve signup for the same address.
    if(row.status!=="approved")
      await env.DB.prepare("UPDATE creators SET status='approved', dealer_id=COALESCE(dealer_id,?) WHERE id=?").bind(did,row.id).run();
    if(!row.ref_token)
      await env.DB.prepare("UPDATE creators SET ref_token=? WHERE id=?").bind(await mintRefToken(env,row.handle),row.id).run().catch(()=>{});
  }
  // A face staged before the account existed (dealer staff auto-provision on first login here).
  // COALESCE so a creator who has since uploaded their own photo is never overwritten.
  const st=await env.DB.prepare("SELECT avatar,display_name FROM creator_avatar_stage WHERE email=?").bind(em).first().catch(()=>null);
  if(st){
    await env.DB.prepare("UPDATE creators SET avatar=COALESCE(avatar,?), display_name=COALESCE(display_name,?) WHERE id=?")
      .bind(st.avatar,st.display_name,row.id).run().catch(()=>{});
    await env.DB.prepare("DELETE FROM creator_avatar_stage WHERE email=?").bind(em).run().catch(()=>{});
  }
  return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json","Set-Cookie":creatorCookie(await makeCreatorSession(env,row.id)),...SEC}});
}
// Shared credential check: returns the dealer_id for a valid email+password, else null.
async function dealerIdForCredentials(env,em,password){
  const L=await env.DB.prepare("SELECT dealer_id,pw_hash,pw_salt FROM dealer_logins WHERE email=?").bind(em).first().catch(()=>null);
  if(L && await verifyPw(password,L.pw_salt,L.pw_hash)) return L.dealer_id;
  const d0=await env.DB.prepare("SELECT id,pw_hash,pw_salt FROM dealer_leads WHERE lower(login_email)=? ORDER BY id DESC LIMIT 1").bind(em).first().catch(()=>null);
  if(d0 && await verifyPw(password,d0.pw_salt,d0.pw_hash)) return d0.id;
  return null;
}

// A creator's own measured stats — used by creatorScore, dropFit, and postVerdict.
async function creatorStats(env,cid){
  const s=await env.DB.prepare(
    "SELECT COUNT(*) posts, SUM(CASE WHEN p.status='approved' THEN 1 ELSE 0 END) approved, "+
    "SUM(CASE WHEN p.status='rejected' THEN 1 ELSE 0 END) rejected, SUM(p.reach_declared) reach "+
    "FROM creator_posts p WHERE p.creator_id=?").bind(cid).first().catch(()=>null);
  const k=await env.DB.prepare("SELECT SUM(clicks) clicks FROM creator_claims WHERE creator_id=?").bind(cid).first().catch(()=>null);
  // COUNT of leads only — never the lead rows themselves. Fence 1.
  // creator_id covers BOTH link types; the old claim-join would miss every personal-link lead.
  const l=await env.DB.prepare("SELECT COUNT(*) leads FROM web_leads w WHERE w.creator_id=?").bind(cid).first().catch(()=>null);
  return {posts:(s&&s.posts)||0,approved:(s&&s.approved)||0,rejected:(s&&s.rejected)||0,
    reach:(s&&s.reach)||0,clicks:(k&&k.clicks)||0,leads:(l&&l.leads)||0};
}
// What this creator has historically converted on — feeds dropFit(). Their own data only.
async function creatorAffinity(env,cid){
  const r=await env.DB.prepare(
    "SELECT v.body, v.price FROM creator_posts p JOIN creator_drops d ON d.id=p.drop_id JOIN vdps v ON v.id=d.vdp_id "+
    "WHERE p.creator_id=? AND p.status='approved' LIMIT 100").bind(cid).all().catch(()=>({results:[]}));
  const bodies={}; let lo=Infinity,hi=0;
  for(const x of (r.results||[])){ const b=String(x.body||"").toLowerCase(); if(b) bodies[b]=(bodies[b]||0)+1;
    const p=+x.price||0; if(p){ lo=Math.min(lo,p*0.7); hi=Math.max(hi,p*1.4); } }
  return {bodies,priceLo:lo===Infinity?0:lo,priceHi:hi};
}

// ---- Creator feed / claim / post ------------------------------------------------------------------
async function creatorFeed(request,env,cid,me){
  const rows=await env.DB.prepare(
    "SELECT d.id,d.vin,d.vdp_id,d.rate_cents,d.rate_why,d.created_at, v.year,v.make,v.model,v.trim,v.body,v.price,v.price_mo,v.photos,v.lot_date,v.location_zip, s.dealer_name,s.dealer_zip, "+
    "(SELECT COUNT(*) FROM creator_claims x WHERE x.drop_id=d.id) claims, "+
    "(SELECT cc.token FROM creator_claims cc WHERE cc.drop_id=d.id AND cc.creator_id=?) mine, "+
    "(SELECT cc.id FROM creator_claims cc WHERE cc.drop_id=d.id AND cc.creator_id=?) claim_id, "+
    "(SELECT p.status FROM creator_posts p JOIN creator_claims cc ON cc.id=p.claim_id WHERE cc.drop_id=d.id AND cc.creator_id=?) post_status "+
    // A car with no rooftop can't be shot at a location, so it has nothing to offer a creator
    // deciding where to drive. Filtered from the feed only — the drop and the vdp are untouched.
    "FROM creator_drops d JOIN vdps v ON v.id=d.vdp_id LEFT JOIN vdp_specs s ON s.vin=v.vin "+
    "WHERE d.status='open' AND v.active=1 AND s.dealer_name IS NOT NULL AND s.dealer_name<>'' ORDER BY d.id DESC LIMIT 60")
    .bind(cid,cid,cid).all().catch(()=>({results:[]}));
  const aff=await creatorAffinity(env,cid);
  const drops=(rows.results||[]).map(function(d){
    const fit=dropFit(d,aff,+d.claims||0);
    return {id:d.id,vin:d.vin,year:d.year,make:d.make,model:d.model,trim:d.trim,body:d.body,
      price:d.price,price_mo:d.price_mo,photos:JSON.parse(d.photos||"[]"),
      rate_cents:d.rate_cents,rate_why:JSON.parse(d.rate_why||"[]"),
      claims:+d.claims||0,claimed:!!d.mine,token:d.mine||null,claim_id:d.claim_id||null,
      post_status:d.post_status||null,link:d.mine?(SEO_ORIGIN+"/c/"+d.mine):null,
      // Where the car physically is — what a creator actually decides on ("I'll shoot at Lexus SM today").
      dealer_name:d.dealer_name||null, zip:d.dealer_zip||d.location_zip||null,
      // Age is REAL or ABSENT. lot_date is dealer-entered; 94/95 cars have none today, and we never
      // invent one. Live by arithmetic, no cron — same trick as the dealer console.
      lot_date:d.lot_date||null,
      days_on_lot:d.lot_date?Math.max(0,Math.floor((Date.now()-Date.parse(d.lot_date))/864e5)):null,
      fit:fit.score,fit_why:fit.why};
  }).sort(function(a,b){return b.fit-a.fit;});
  // Everything the one-page console needs in a single request: the personal link + its numbers,
  // and the three bucket counts for the fixed bottom bar.
  const rl=await env.DB.prepare("SELECT COUNT(*) n FROM web_leads WHERE creator_id=?").bind(cid).first().catch(()=>null);
  const bk=await env.DB.prepare(
    "SELECT (SELECT COUNT(*) FROM creator_drops WHERE status='open') o, "+
    "(SELECT COUNT(*) FROM creator_claims WHERE creator_id=?) c, "+
    "(SELECT COALESCE(SUM(amount_cents),0) FROM creator_earnings WHERE creator_id=? AND status='paid') p").bind(cid,cid).first().catch(()=>null);
  return json({ok:true,
    creator:{handle:me.handle,score:me.score,payouts_enabled:me.payouts_enabled,
      avatar:me.avatar||null, name:me.display_name||me.handle,
      ref_link:me.ref_token?(SEO_ORIGIN+"/c/"+me.ref_token):null,
      ref_clicks:me.ref_clicks||0, ref_leads:(rl&&rl.n)||0},
    buckets:{open:(bk&&bk.o)||0, claimed:(bk&&bk.c)||0, paid_cents:(bk&&bk.p)||0},
    drops});
}
async function creatorClaim(request,env,cid,me){
  const {drop_id}=await request.json().catch(()=>({}));
  const id=parseInt(drop_id,10); if(!id) return json({ok:false,error:"bad_request"},400);
  const d=await env.DB.prepare("SELECT id,status FROM creator_drops WHERE id=?").bind(id).first().catch(()=>null);
  if(!d||d.status!=="open") return json({ok:false,error:"drop_closed"},409);
  const ex=await env.DB.prepare("SELECT token FROM creator_claims WHERE drop_id=? AND creator_id=?").bind(id,cid).first().catch(()=>null);
  if(ex) return json({ok:true,token:ex.token,link:SEO_ORIGIN+"/c/"+ex.token});
  // .toLowerCase() to match mintRefToken(). Without it this minted MIXED-CASE tokens while the
  // canonicalizer (route(), ~line 226) lowercases every /c/ path — /c/ is not on its exemption list,
  // only /pass/ and /api/ are. So the link we handed a creator was 301'd to a lowercase path that
  // no longer matched the stored token, creatorRedirect() fell through, and the visitor landed on
  // /browse with the click credited to nobody. These links are printed in @nimbusbros video
  // descriptions and cannot be reissued — hence the case-insensitive lookup there as well.
  const token=genCode("CR").replace(/[^A-Za-z0-9]/g,"").toLowerCase();
  await env.DB.prepare("INSERT INTO creator_claims (drop_id,creator_id,token,clicks,status,created_at) VALUES (?,?,?,0,'claimed',?)")
    .bind(id,cid,token,new Date().toISOString()).run();
  await logEvent(env,{action:"social.claimed",source:"creator-network",confidence:1}).catch(()=>{});
  return json({ok:true,token,link:SEO_ORIGIN+"/c/"+token});
}
async function creatorPost(request,env,cid,me){
  const b=await request.json().catch(()=>({}));
  // FTC 16 CFR Part 255. A paid-post network without this is the legal exposure — hard 400, not a nudge.
  if(!(b.disclosure_confirmed===true||b.disclosure_confirmed===1||b.disclosure_confirmed==="1"))
    return json({ok:false,error:"disclosure_required"},400);
  const url=String(b.post_url||"").trim().slice(0,300);
  if(!/^https?:\/\//i.test(url)) return json({ok:false,error:"bad_url"},400);
  const claimId=parseInt(b.claim_id,10)||0;
  const cl=await env.DB.prepare("SELECT id,drop_id,clicks FROM creator_claims WHERE id=? AND creator_id=?").bind(claimId,cid).first().catch(()=>null);
  if(!cl) return json({ok:false,error:"not_yours"},403);
  if(await env.DB.prepare("SELECT 1 FROM creator_posts WHERE claim_id=?").bind(cl.id).first().catch(()=>null))
    return json({ok:false,error:"already_submitted"},409);
  const d=await env.DB.prepare("SELECT rate_cents FROM creator_drops WHERE id=?").bind(cl.drop_id).first().catch(()=>null);
  const now=new Date().toISOString();
  const ins=await env.DB.prepare("INSERT INTO creator_posts (claim_id,creator_id,drop_id,post_url,platform,reach_declared,disclosure_confirmed,status,created_at) VALUES (?,?,?,?,?,?,1,'submitted',?)")
    .bind(cl.id,cid,cl.drop_id,url,String(b.platform||"").slice(0,20),parseInt(b.reach_declared,10)||0,now).run();
  const postId=ins.meta.last_row_id;
  await env.DB.prepare("INSERT INTO creator_earnings (creator_id,post_id,amount_cents,status,created_at) VALUES (?,?,?,'accrued',?)")
    .bind(cid,postId,(d&&d.rate_cents)||CREATOR_BASE_RATE_CENTS,now).run();
  await logEvent(env,{action:"social.posted",source:"creator-network"}).catch(()=>{});
  // NIMBUS's read, recorded now so the ai. review queue shows its reasoning, not just the row.
  const stats=await creatorStats(env,cid);
  const v=postVerdict({disclosure_confirmed:1,reach_declared:parseInt(b.reach_declared,10)||0},cl,stats);
  await logEvent(env,{action:"ai.recommendation_shown",source:"post-verdict:"+v.verdict,confidence:1}).catch(()=>{});
  return json({ok:true,post_id:postId,verdict:v.verdict,why:v.why});
}
async function creatorEarnings(request,env,cid,me){
  const rows=await env.DB.prepare(
    "SELECT e.id,e.amount_cents,e.status,e.paid_at,e.created_at, d.vin, v.year,v.make,v.model "+
    "FROM creator_earnings e LEFT JOIN creator_posts p ON p.id=e.post_id LEFT JOIN creator_drops d ON d.id=p.drop_id "+
    "LEFT JOIN vdps v ON v.id=d.vdp_id WHERE e.creator_id=? ORDER BY e.id DESC LIMIT 100").bind(cid).all().catch(()=>({results:[]}));
  const t={accrued:0,approved:0,paid:0};
  for(const r of (rows.results||[])) if(t[r.status]!==undefined) t[r.status]+=(+r.amount_cents||0);
  const stats=await creatorStats(env,cid); const sc=creatorScore(stats);
  return json({ok:true,totals:t,rows:rows.results||[],stats,score:sc.score,score_why:sc.why,
    payouts_enabled:!!me.payouts_enabled,connected:!!me.stripe_account_id});
}

// ---- Stripe Connect Express (no SDK — plain fetch, honouring the no-npm/no-build rule) -------------
// idemKey: Stripe's Idempotency-Key. Retrying with the same key returns the ORIGINAL result
// instead of performing the action again — the only thing that makes a money transfer safe to
// retry when the network or our own database fails after Stripe already succeeded.
async function stripeApi(env,path,form,idemKey){
  const body=new URLSearchParams(); for(const k in form) if(form[k]!==undefined&&form[k]!==null) body.set(k,String(form[k]));
  const r=await fetch("https://api.stripe.com/v1/"+path,{method:"POST",
    headers:{"Authorization":"Bearer "+env.STRIPE_SECRET_KEY,"content-type":"application/x-www-form-urlencoded",
      ...(idemKey?{"Idempotency-Key":String(idemKey)}:{})},body});
  const d=await r.json().catch(()=>({})); return {ok:r.ok,data:d};
}
async function creatorConnectStart(request,env,cid,me){
  if(!env.STRIPE_SECRET_KEY) return json({ok:false,error:"stripe_unconfigured"},503);
  let acct=me.stripe_account_id;
  if(!acct){
    const a=await stripeApi(env,"accounts",{type:"express",email:me.email,"capabilities[transfers][requested]":"true"});
    if(!a.ok||!a.data.id) return json({ok:false,error:"stripe_failed"},502);
    acct=a.data.id;
    await env.DB.prepare("UPDATE creators SET stripe_account_id=? WHERE id=?").bind(acct,cid).run();
  }
  const base="https://creator.carnimbus.us";
  const l=await stripeApi(env,"account_links",{account:acct,refresh_url:base+"/earnings",return_url:base+"/earnings?connected=1",type:"account_onboarding"});
  if(!l.ok||!l.data.url) return json({ok:false,error:"stripe_failed"},502);
  return json({ok:true,url:l.data.url});
}
async function creatorConnectReturn(request,env,cid,me){
  if(!env.STRIPE_SECRET_KEY) return json({ok:false,error:"stripe_unconfigured"},503);
  if(!me.stripe_account_id) return json({ok:false,error:"not_connected"},400);
  const r=await fetch("https://api.stripe.com/v1/accounts/"+me.stripe_account_id,
    {headers:{"Authorization":"Bearer "+env.STRIPE_SECRET_KEY}}).catch(()=>null);
  const d=r&&r.ok?await r.json().catch(()=>({})):{};
  const pe=d.payouts_enabled?1:0, ce=d.charges_enabled?1:0;
  await env.DB.prepare("UPDATE creators SET payouts_enabled=?, charges_enabled=? WHERE id=?").bind(pe,ce,cid).run();
  return json({ok:true,payouts_enabled:!!pe,charges_enabled:!!ce});
}

// ---- Operator-side creator management (replaces the retired portal) --------------------------------
// The portal let a creator sign themselves up and connect Stripe. With it archived, both happen from
// ai.carnimbus.us through aiAct's confirm gate. For a handful of partners this is LESS work than a
// self-serve console, and it keeps a human in the loop on the only two things that matter: who gets
// an attributable link, and who can receive money.
//
// creatorInvite returns TWO urls and the operator sends both:
//   link      — the permanent /c/<ref_token>. This is the @nimbusbros attribution rail.
//   onboard   — Stripe Express onboarding. Until they finish it, payouts_enabled stays 0 and
//               creator_payout refuses with payouts_not_enabled. That gate is Stripe's KYC, not ours.
async function creatorInvite(env,args){
  const handle=String(args.handle||"").trim().slice(0,60);
  const email=String(args.email||"").trim().toLowerCase().slice(0,120);
  if(!handle||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return {ok:false,error:"bad_request"};
  const dupe=await env.DB.prepare("SELECT id,ref_token FROM creators WHERE email=?").bind(email).first().catch(()=>null);
  let cid, ref;
  if(dupe){ cid=dupe.id; ref=dupe.ref_token; }
  else{
    // status 'approved' on purpose: the operator inviting them IS the approval, and Stripe's KYC is
    // what actually gates money leaving. An unverified follower count never gates a payout.
    const r=await env.DB.prepare("INSERT INTO creators (email,handle,status,created_at) VALUES (?,?,'approved',datetime('now'))")
      .bind(email,handle).run().catch(()=>null);
    if(!r||!r.meta||!r.meta.last_row_id) return {ok:false,error:"create_failed"};
    cid=r.meta.last_row_id;
  }
  if(!ref){ ref=await mintRefToken(env,handle);
    await env.DB.prepare("UPDATE creators SET ref_token=? WHERE id=?").bind(ref,cid).run().catch(()=>{}); }
  const out={ok:true,creator_id:cid,handle,link:SEO_ORIGIN+"/c/"+ref};
  if(env.STRIPE_SECRET_KEY){
    const row=await env.DB.prepare("SELECT stripe_account_id FROM creators WHERE id=?").bind(cid).first().catch(()=>null);
    let acct=row&&row.stripe_account_id;
    if(!acct){
      const a=await stripeApi(env,"accounts",{type:"express",email,"capabilities[transfers][requested]":"true"});
      if(a.ok&&a.data&&a.data.id){ acct=a.data.id;
        await env.DB.prepare("UPDATE creators SET stripe_account_id=? WHERE id=?").bind(acct,cid).run().catch(()=>{}); }
    }
    if(acct){
      // return_url points at the APEX, not creator.carnimbus.us — that host now 301s and Stripe
      // would bounce the creator through a redirect on the last step of onboarding.
      const l=await stripeApi(env,"account_links",{account:acct,
        refresh_url:SEO_ORIGIN+"/", return_url:SEO_ORIGIN+"/?connected=1", type:"account_onboarding"});
      if(l.ok&&l.data&&l.data.url) out.onboard=l.data.url;
    }
  }
  return out;
}

// Re-reads Stripe and updates payouts_enabled. This is what creatorConnectReturn used to do when the
// creator landed back on the portal; with no portal, the operator runs it from ai. after the creator
// says they finished onboarding. creator_payout checks the flag, so this must run before a first payout.
async function creatorSync(env,args){
  if(!env.STRIPE_SECRET_KEY) return {ok:false,error:"stripe_unconfigured"};
  const cid=parseInt(args.creator_id,10);
  const c=cid?await env.DB.prepare("SELECT id,handle,stripe_account_id FROM creators WHERE id=?").bind(cid).first().catch(()=>null):null;
  if(!c) return {ok:false,error:"bad_creator"};
  if(!c.stripe_account_id) return {ok:false,error:"not_connected"};
  const r=await fetch("https://api.stripe.com/v1/accounts/"+c.stripe_account_id,
    {headers:{"Authorization":"Bearer "+env.STRIPE_SECRET_KEY}}).catch(()=>null);
  if(!r||!r.ok) return {ok:false,error:"stripe_failed"};
  const d=await r.json().catch(()=>({}));
  const pe=d.payouts_enabled?1:0, ce=d.charges_enabled?1:0;
  await env.DB.prepare("UPDATE creators SET payouts_enabled=?, charges_enabled=? WHERE id=?").bind(pe,ce,cid).run().catch(()=>{});
  return {ok:true,creator_id:cid,handle:c.handle,payouts_enabled:!!pe,charges_enabled:!!ce};
}

// ---- The tracked link: /c/<token> -----------------------------------------------------------------
// Host-agnostic (added to the PREFIX passthrough). Records the click, drops a 90d first-party cookie,
// and sends the visitor to the car. No creator identity is exposed to the buyer.
// One token space, two kinds of link:
//   claim token   -> a specific car. Earns the per-post fee. Cookie cn_ref.
//   ref token     -> the creator's permanent personal link. Lands on /browse. Cookie cn_cref.
// A claim link sets both cookies, so a buyer who arrives on a car page and then wanders still
// credits the creator who sent them.
async function creatorRedirect(request,env,token){
  const t=String(token||"").slice(0,40);
  const cl=await env.DB.prepare(
    "SELECT cc.id, cc.creator_id, v.id vid, v.year, v.make, v.model FROM creator_claims cc "+
    // LOWER() on both sides, not a plain =. creator_claims.token is declared TEXT UNIQUE with no
    // COLLATE NOCASE (migrations/0064_creator_drops.sql:14), and tokens minted before this fix are
    // stored mixed-case while the path arrives lowercased by the canonicalizer. A plain match misses
    // every one of them. The table is small, so the lost index on this column costs nothing.
    "JOIN creator_drops d ON d.id=cc.drop_id JOIN vdps v ON v.id=d.vdp_id WHERE LOWER(cc.token)=LOWER(?)").bind(t).first().catch(()=>null);
  if(!cl){
    // Personal affiliate link.
    const cr=await env.DB.prepare("SELECT id,ref_token FROM creators WHERE ref_token=?").bind(t).first().catch(()=>null);
    if(!cr) return Response.redirect(SEO_ORIGIN+"/browse",302);
    await env.DB.prepare("UPDATE creators SET ref_clicks=COALESCE(ref_clicks,0)+1 WHERE id=?").bind(cr.id).run().catch(()=>{});
    await logEvent(env,{action:"social.referred",source:"creator-ref"}).catch(()=>{});   // frozen prefix, same as claim links
    return new Response(null,{status:302,headers:{
      "Location":SEO_ORIGIN+"/browse",
      "Set-Cookie":"cn_cref="+t+"; Path=/; Secure; SameSite=Lax; Max-Age=7776000",
      "Cache-Control":"no-store"}});
  }
  await env.DB.prepare("UPDATE creator_claims SET clicks=clicks+1 WHERE id=?").bind(cl.id).run().catch(()=>{});
  await logEvent(env,{action:"social.referred",vehicle_id:cl.vid,source:"creator-link"}).catch(()=>{});
  const owner=await env.DB.prepare("SELECT ref_token FROM creators WHERE id=?").bind(cl.creator_id).first().catch(()=>null);
  const h=new Headers({"Location":SEO_ORIGIN+vdpPath({year:cl.year,make:cl.make,model:cl.model,id:cl.vid}),"Cache-Control":"no-store"});
  h.append("Set-Cookie","cn_ref="+t+"; Path=/; Secure; SameSite=Lax; Max-Age=7776000");
  if(owner&&owner.ref_token) h.append("Set-Cookie","cn_cref="+owner.ref_token+"; Path=/; Secure; SameSite=Lax; Max-Age=7776000");
  return new Response(null,{status:302,headers:h});
}
function readRef(request){ const m=(request.headers.get("Cookie")||"").match(/cn_ref=([^;]+)/); return m?m[1]:null; }
function readCref(request){ const m=(request.headers.get("Cookie")||"").match(/cn_cref=([^;]+)/); return m?m[1]:null; }
// Resolves both cookies -> {claim_id, creator_id}. claim_id is null for a personal-link arrival.
async function refForCookies(env,request){
  let claim_id=null, creator_id=null;
  const t=readRef(request);
  if(t){ const r=await env.DB.prepare("SELECT id,creator_id FROM creator_claims WHERE token=?").bind(String(t).slice(0,40)).first().catch(()=>null);
    if(r){ claim_id=r.id; creator_id=r.creator_id||null; } }
  if(!creator_id){ const c=readCref(request);
    if(c){ const r2=await env.DB.prepare("SELECT id FROM creators WHERE ref_token=?").bind(String(c).slice(0,40)).first().catch(()=>null);
      if(r2) creator_id=r2.id; } }
  return {claim_id,creator_id};
}
// Mint a stable personal token: the handle slug if free, else a random code.
async function mintRefToken(env,handle){
  const base=String(handle||"").toLowerCase().replace(/[^a-z0-9]+/g,"").slice(0,24);
  if(base){ const taken=await env.DB.prepare("SELECT 1 FROM creators WHERE ref_token=?").bind(base).first().catch(()=>null);
    if(!taken) return base; }
  return genCode("CR").replace(/[^A-Za-z0-9]/g,"").toLowerCase();
}
function creatorLogout(){ return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json",
  "Set-Cookie":"cn_crt=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"}}); }
// The creator's own face in the header. The browser crops + resizes to 96x96 before this ever runs,
// so a 5MB phone photo never leaves the device. Two controls on the only new write surface here:
// a strict data-URI shape (no javascript:, no svg — svg can carry script), and a hard size cap.
async function creatorAvatar(request,env,cid){
  const {avatar}=await request.json().catch(()=>({}));
  const a=String(avatar||"");
  if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(a)) return json({ok:false,error:"bad_image"},400);
  if(a.length>40000) return json({ok:false,error:"too_large"},413);
  await env.DB.prepare("UPDATE creators SET avatar=? WHERE id=?").bind(a,cid).run();
  return json({ok:true});
}

// ---- creatorAgent: cron, L2, reversible actions ONLY ----------------------------------------------
// Per LIVING-AGENTS.md: one KPI (attributed leads per dollar accrued), self-bounding, logs everything.
// It may close expired drops, re-score creators, and re-price UNLOCKED drops as cars age.
// It never approves a post, never moves money, never suspends anyone — those are L1 confirm-gated.
async function creatorAgent(env){
  const now=new Date().toISOString();
  // 1. Close drops whose car is gone. Reversible: reopening is a row update.
  await env.DB.prepare("UPDATE creator_drops SET status='closed' WHERE status='open' AND vdp_id IN (SELECT id FROM vdps WHERE active=0)").run().catch(()=>{});
  // 2. Re-price unlocked open drops as they age. locked=1 is a human's number — never touched.
  const dr=await env.DB.prepare("SELECT d.id,v.price,v.price_mo,v.lot_date FROM creator_drops d JOIN vdps v ON v.id=d.vdp_id WHERE d.status='open' AND d.locked=0 LIMIT 20").all().catch(()=>({results:[]}));
  for(const d of (dr.results||[])){ const r=rateForDrop(d);
    await env.DB.prepare("UPDATE creator_drops SET rate_cents=?, rate_why=? WHERE id=? AND locked=0")
      .bind(r.cents,JSON.stringify(r.why),d.id).run().catch(()=>{}); }
  // 3. Re-score the 20 stalest creators.
  const cs=await env.DB.prepare("SELECT id FROM creators WHERE status='approved' ORDER BY COALESCE(scored_at,'') ASC LIMIT 20").all().catch(()=>({results:[]}));
  for(const c of (cs.results||[])){ const sc=creatorScore(await creatorStats(env,c.id));
    await env.DB.prepare("UPDATE creators SET score=?, score_why=?, scored_at=? WHERE id=?")
      .bind(sc.score,JSON.stringify(sc.why),now,c.id).run().catch(()=>{}); }
}

// ---- The ai. review queue: what NIMBUS wants a human to decide -----------------------------------
// adminOnly. Feeds the #creators panel: creators with their measured score, open drops with the rate
// NIMBUS set and why, posts awaiting review with NIMBUS's verdict, and the payout queue whose Confirm
// button is the L1 gate on irreversible money.
async function creatorQueue(request,env){
  const all=async(sql,...b)=>{ const r=await env.DB.prepare(sql).bind(...b).all().catch(()=>({results:[]})); return r.results||[]; };
  const creators=await all(
    "SELECT c.id,c.handle,c.email,c.status,c.followers_declared,c.score,c.score_why,c.payouts_enabled, "+
    "c.ref_token,c.ref_clicks, "+
    "(SELECT COUNT(*) FROM creator_posts p WHERE p.creator_id=c.id) posts, "+
    "(SELECT COUNT(*) FROM web_leads w WHERE w.creator_id=c.id) leads "+
    "FROM creators c ORDER BY c.score DESC, c.id DESC LIMIT 100");
  // Every affiliate link, traceable from ai.carnimbus.us — the tracking Brandon asked for.
  const links=await all(
    "SELECT 'personal' kind, c.ref_token token, c.handle, NULL vin, COALESCE(c.ref_clicks,0) clicks, "+
    "(SELECT COUNT(*) FROM web_leads w WHERE w.creator_id=c.id AND w.creator_claim_id IS NULL) leads "+
    "FROM creators c WHERE c.ref_token IS NOT NULL "+
    "UNION ALL "+
    "SELECT 'car' kind, cc.token, c.handle, d.vin, COALESCE(cc.clicks,0), "+
    "(SELECT COUNT(*) FROM web_leads w WHERE w.creator_claim_id=cc.id) "+
    "FROM creator_claims cc JOIN creators c ON c.id=cc.creator_id JOIN creator_drops d ON d.id=cc.drop_id "+
    "ORDER BY clicks DESC LIMIT 120");
  const drops=await all(
    "SELECT d.id,d.vin,d.rate_cents,d.rate_why,d.locked,d.status, v.year,v.make,v.model,v.lot_date, "+
    "(SELECT COUNT(*) FROM creator_claims x WHERE x.drop_id=d.id) claims "+
    "FROM creator_drops d JOIN vdps v ON v.id=d.vdp_id ORDER BY d.id DESC LIMIT 60");
  const rawPosts=await all(
    "SELECT p.id,p.post_url,p.platform,p.reach_declared,p.disclosure_confirmed,p.created_at, "+
    "c.id creator_id,c.handle, cc.clicks, cc.id claim_id, e.id earning_id, e.amount_cents "+
    "FROM creator_posts p JOIN creators c ON c.id=p.creator_id JOIN creator_claims cc ON cc.id=p.claim_id "+
    "LEFT JOIN creator_earnings e ON e.post_id=p.id WHERE p.status='submitted' ORDER BY p.id ASC LIMIT 50");
  const posts=[];
  for(const p of rawPosts){
    const v=postVerdict(p,{clicks:p.clicks},await creatorStats(env,p.creator_id));
    posts.push(Object.assign({},p,{verdict:v.verdict,why:v.why}));
  }
  const payouts=await all(
    "SELECT e.id,e.amount_cents,e.status,c.id creator_id,c.handle,c.payouts_enabled,c.stripe_account_id "+
    // 'paying' is included so a payout that got stuck between the Stripe transfer and the DB
    // write is VISIBLE rather than vanishing from every surface. The UI must not offer a Pay
    // button for those — the row is claimed and the transfer may already have landed; it needs a
    // human to reconcile against Stripe, not another click.
    "FROM creator_earnings e JOIN creators c ON c.id=e.creator_id WHERE e.status IN ('approved','paying') ORDER BY e.id ASC LIMIT 50");
  // dealer_programs was added 2026-08-06 with a writer (appApprove credits $179 per settled deal,
  // deck v13 S-04 step 1) and NO READER — so the loop the deck draws as a circle was open at the
  // read end and the budget was invisible everywhere. This closes it. `committed` counts 'paying'
  // as spent, because that money is in flight at Stripe whether or not our write landed.
  const programs=await all(
    "SELECT p.dealer_id, d.dealership, p.budget_cents, p.status, "+
    "(SELECT COALESCE(SUM(e.amount_cents),0) FROM creator_earnings e JOIN creators c ON c.id=e.creator_id "+
    " WHERE c.dealer_id=p.dealer_id AND e.status IN ('approved','paying','paid')) committed_cents "+
    "FROM dealer_programs p LEFT JOIN dealer_leads d ON d.id=p.dealer_id "+
    "WHERE p.status='active' ORDER BY p.budget_cents DESC LIMIT 50");
  return json({ok:true,creators,links,drops,posts,payouts,programs,stripe_ready:!!env.STRIPE_SECRET_KEY});
}

async function webLead(request,env){ const b=await request.json().catch(()=>({}));
  if(b.website) return json({ok:true});                                    // honeypot: swallow silently
  if(env.TURNSTILE_SECRET && !(await verifyTurnstile(b.cf_token, request.headers.get("CF-Connecting-IP")||"", env.TURNSTILE_SECRET))) return json({ok:true});   // bot: swallow silently
  const car=String(b.dream_car||"").trim().slice(0,80);
  const deal=["cash","finance","lease"].includes(b.deal_type)?b.deal_type:"finance";
  const zip=String(b.zip||"").replace(/\D/g,"").slice(0,5);
  let ph=String(b.phone||"").replace(/\D/g,""); if(ph.length===11&&ph[0]==="1")ph=ph.slice(1);
  // T-101: Drive Now capture — first/last/email/phone/address + TCPA consent, ALL required (phone re-added per spec).
  const first=String(b.first_name||"").trim().slice(0,40), last=String(b.last_name||"").trim().slice(0,40);
  const email=String(b.email||"").trim().slice(0,120), addr=String(b.address||"").trim().slice(0,200);
  const slot=String(b.appt_slot||"").trim().slice(0,60);
  const consent=(b.consent===true||b.consent===1||b.consent==="1")?1:0;
  const emailOk=/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  if(!car||!/^\d{5}$/.test(zip)||!/^[2-9]\d{9}$/.test(ph)||!emailOk||!consent||!first||!last)
    return json({ok:false,error:"bad_request"},400);   // T-101: phone + email + consent now required at Drive Now
  let mc=String(b.matched_car||"").trim().slice(0,120);
  const ip=request.headers.get("CF-Connecting-IP")||"";
  const since=new Date(Date.now()-3600e3).toISOString();
  const rc=await env.DB.prepare("SELECT COUNT(*) c FROM web_leads WHERE ip=? AND created_at>?").bind(ip,since).first().catch(()=>({c:0}));
  if(rc&&rc.c>=5){ await logEvent(env,{action:"intent.web_lead_ratelimited",location:zip,source:"drive-now"}); return json({ok:true}); }   // per-IP cap: silent to the client, visible internally
  const mo=String(b.monthly||"").replace(/\D/g,"").slice(0,6), dn=String(b.down||"").replace(/\D/g,"").slice(0,6), rad=String(b.radius||"").replace(/\D/g,"").slice(0,3)||"25";
  // T-102/R3: route the lead to the matched car's dealer AND derive the matched car server-side from the vdp
  // (client matched_car is a free string and was showing the wrong car — vdp is authoritative). Persist vdp_id + a
  // stable per-buyer CID (same contact ⇒ same CID ⇒ auto unique-visitor dedupe).
  let dealerId=null, isDemo=0; const vid=parseInt(b.vdp_id,10)||0;
  if(vid){ const vr=await env.DB.prepare("SELECT v.dealer_id, v.year, v.make, v.model, v.trim, d.is_demo FROM vdps v LEFT JOIN dealer_leads d ON d.id=v.dealer_id WHERE v.id=?").bind(vid).first().catch(()=>null);
    if(vr){ dealerId=vr.dealer_id||null; isDemo=vr.is_demo?1:0;   // R7-D: demo-tenant cars tag the lead as demo
      mc=[vr.year,vr.make,vr.model,vr.trim].filter(Boolean).join(" ").slice(0,120)||mc; } }
  const cid=leadCid(email,"+1"+ph);
  // R15 compliance (build-list #35/#37): honor the suppression list BEFORE insert (CCPA/DROP deletion means
  // re-ingestion must be blocked), and stamp consent provenance so TCPA proof exists from day one.
  const sup=await env.DB.prepare("SELECT 1 FROM suppression WHERE email_hash=? OR phone_hash=? LIMIT 1")
    .bind(leadCid(email,""),leadCid("","+1"+ph)).first().catch(()=>null);
  if(sup){ await logEvent(env,{action:"intent.web_lead_suppressed",location:zip,source:"suppression"}).catch(()=>{}); return json({ok:true}); }
  const nowIso=new Date().toISOString();
  const consentTs=consent?nowIso:null, consentUrl=String(request.headers.get("Referer")||"").slice(0,300)||null;
  // Creator attribution: the cn_ref cookie set by /c/<token> resolves to the claim that produced this
  // lead. This is the row that makes a creator's post provably worth money.
  // 26 columns / 26 placeholders / 26 binds — counted literally. A mismatch here silently corrupts
  // every lead insert, so if you add one, add it in all three places.
  //
  // credit_band and budget added 2026-08-06. The column existed since 0057 and was NEVER written:
  // lead.js has always sent `fico`, and this function has always ignored it. FICO moves the APR by
  // up to 11.5 points — a ~$180/mo swing on a $30k car — so it is the single most price-relevant
  // fact the visitor gives us, and it was being dropped at the last step of the funnel. Same for a
  // cash buyer's stated budget, which only ever reached routeLead (a no-op until CRM_ENDPOINT).
  const ref=await refForCookies(env,request).catch(()=>({claim_id:null,creator_id:null}));
  const band=String(b.fico||"").slice(0,12)||null;
  const cashBudget=parseInt(String(b.budget||"").replace(/\D/g,""),10)||null;
  await env.DB.prepare("INSERT INTO web_leads (dream_car,deal_type,monthly,down,zip,radius,phone,ip,matched_car,created_at,first_name,last_name,email,address,appt_slot,consent,dealer_id,vdp_id,cid,is_demo,consent_ts,consent_url,anon_id,creator_claim_id,creator_id,credit_band,budget) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .bind(car,deal,mo,dn,zip,rad,"+1"+ph,ip,mc,nowIso,first,last,email,addr,slot,consent,dealerId,vid||null,cid,isDemo,consentTs,consentUrl,readAnon(request),ref.claim_id,ref.creator_id,band,cashBudget).run();
  // ---- MAKE IT AN ACTUAL APPOINTMENT (2026-08-06) --------------------------------------------
  // Until now this function never touched test_drives and never minted a pass token, so a
  // homepage "Schedule Appointment" produced a CRM row and nothing else. Three consequences:
  //   · driveReminders() reads ONLY test_drives, so the T-2h reminder never fired for a homepage
  //     booking — the single most valuable message in the flow;
  //   · /pass/<token> was unreachable from the public funnel, so nobody got a pass;
  //   · the confirmation email below promises "we'll confirm the address by text" and nothing in
  //     the system was scheduled to send it.
  //
  // test_drives.user_id needs a users row, so we upsert one on the phone number (UNIQUE). That is
  // the same identity the SMS thread and STOP/START list already key on, so it creates no new
  // notion of a person. Both readers — passPage and driveReminders — join users for the phone.
  //
  // SLOT FORMAT: lead.js sends "2026-08-10T10:00"; test_drives.slot is LA wall-clock
  // "YYYY-MM-DD HH:MM" (see driveReminders). Convert, or the reminder query silently never matches.
  let passTok=null;
  if(slot && vid){
    const tdSlot=String(slot).replace("T"," ").slice(0,16);
    await env.DB.prepare("INSERT INTO users (phone,created_at,handle,zip) VALUES (?,?,?,?) "+
      "ON CONFLICT(phone) DO UPDATE SET handle=COALESCE(users.handle,excluded.handle), zip=COALESCE(excluded.zip,users.zip)")
      .bind("+1"+ph,nowIso,String(first||"").slice(0,40),zip).run().catch(()=>{});
    const ur=await env.DB.prepare("SELECT id FROM users WHERE phone=?").bind("+1"+ph).first().catch(()=>null);
    if(ur&&ur.id){
      passTok=crypto.randomUUID().replace(/-/g,"").slice(0,24);
      await safeWrite(env,"web_lead_test_drive",
        env.DB.prepare("INSERT INTO test_drives (user_id,vdp_id,center,slot,status,pass_token,created_at) VALUES (?,?,?,?,?,?,?)")
          .bind(ur.id,vid,String(addr||"").slice(0,120),tdSlot,"confirmed",passTok,nowIso));
    }
  }
  // AI/TASK-006: drop-in CRM seam. No-op ("unrouted") until CRM_ENDPOINT exists, so this changes nothing today.
  const routed=await routeLead(env,{matched_car:mc,vin:String(b.vin||"").slice(0,17),phone:"+1"+ph,
    dream_car:car,deal_type:deal,monthly:mo,down:dn,budget:String(b.budget||"").replace(/\D/g,"").slice(0,7),zip,radius:rad});
  await logEvent(env,{action:"intent.web_lead_routed",location:zip,source:routed}).catch(()=>{});
  if(env.ADMIN_PHONE) await sendSMS(env,env.ADMIN_PHONE,`CarNimbus drive: ${first} ${last} · ${car}${mc?` → ${mc}`:``} · ${deal} · $${mo}/mo · $${dn} down · ${zip} · slot ${slot||"—"} · +1${ph}`).catch(()=>{});
  // T-101/T-103 seam: greet the buyer in the matched car's own voice, opening the SMS thread.
  // Dark-safe: sendSMS no-ops without Twilio creds, and the block is gated on SMS_MATCH_LIVE + the buyer's consent.
  if(consent && env.SMS_MATCH_LIVE && mc){
    await env.DB.prepare("INSERT INTO waitlist (phone,lang,created_at,user_agent,ip,sms_consent) VALUES (?,?,?,?,?,1) ON CONFLICT(phone) DO UPDATE SET sms_consent=1")
      .bind("+1"+ph,"en",new Date().toISOString(),"",ip).run().catch(()=>{});   // so STOP/START opt-out governs this number
    const whenTxt=slot?` for ${slot.replace("T"," at ")}`:"";
    const carMsg=`Hi ${first}! I'm your ${mc} 🚗 — you just scheduled a CarNimbus test drive${whenTxt}. Got any questions about me before you come in? Reply here anytime. Txt STOP to opt out.`;
    await sendSMS(env,"+1"+ph,carMsg).catch(()=>{});
  }
  // T-102: buyer confirmation email (Resend). Dark-safe: no-ops without RESEND_API_KEY. No A2P gate — always try when present.
  if(email) await sendEmail(env,{to:email,subject:"Your CarNimbus test drive — "+(mc||car),
    text:`Hi ${first},\n\nYou're scheduled to drive the ${mc||car}${slot?` on ${slot.replace("T"," at ")}`:""}.\n`+
      (passTok?`Your pass: https://carnimbus.us/pass/${passTok}\n`:"")+
      `We'll confirm the exact dealership address by text. Reply to that text with any questions — the car answers.\n\nThe power's in your hands,\nCarNimbus`}).catch(()=>{});
  await logEvent(env,{action:"intent.web_lead",location:zip,source:"drive-now"});
  return json({ok:true}); }
async function dealerLead(request,env){
  const {name,dealership,role,phone,email}=await request.json().catch(()=>({}));
  if(!name||!dealership) return json({ok:false,error:"bad_request"},400);
  await env.DB.prepare("INSERT INTO dealer_leads (name,dealership,role,phone,email,created_at) VALUES (?,?,?,?,?,?)")
    .bind(String(name).slice(0,80),String(dealership).slice(0,120),String(role||"").slice(0,40),
      String(phone||"").slice(0,20),String(email||"").slice(0,120),new Date().toISOString()).run();
  if(env.ADMIN_PHONE) await sendSMS(env,env.ADMIN_PHONE,"New CarNimbus dealer lead: "+String(name).slice(0,40)+" @ "+String(dealership).slice(0,60)+(phone?(" · "+String(phone).slice(0,20)):"")).catch(()=>{});
  return json({ok:true});
}
// R4: Ask the Feed — ONE private CarNimbus AI research reply per ask (the persona panel was retired in Wave R).
async function feedAsk(request,env,uid,ctx){ const {vdpId}=await request.json().catch(()=>({})); const es=new URL(request.url).searchParams.get("lang")==="es";
  const v=await env.DB.prepare("SELECT * FROM vdps WHERE id=? AND active=1").bind(vdpId).first(); if(!v) return json({ok:false,error:"not_found"},404);
  const p=await env.DB.prepare("SELECT answers FROM profiles WHERE user_id=?").bind(uid).first(); let a={}; try{a=p?JSON.parse(p.answers||"{}"):{}; a=await decryptAnswers(a, env.PII_KEY);}catch(_){}
  // W2: insert the public question post FIRST so it appears instantly; enrich with the AI card + private reply afterward (deferred).
  const post=await env.DB.prepare("INSERT INTO comments (user_id,vdp_id,body,body_es,zip,status,created_at) VALUES (?,?,?,?,?, 'approved', ?)")
    .bind(uid,vdpId,`Thinking about the ${v.year} ${v.make} ${v.model} — honest thoughts?`,`Pensando en el ${v.year} ${v.make} ${v.model} — ¿opiniones honestas?`,String(a.zip||""),new Date().toISOString()).run();
  const parentId=post&&post.meta?post.meta.last_row_id:0;
  await logEvent(env,{action:"social.asked",vehicle_id:vdpId});
  const enrich=async()=>{ try{
    const sp=await env.DB.prepare("SELECT * FROM vdp_specs WHERE vin=?").bind(v.vin).first().catch(()=>null);
    const carStr=vdpText(v,sp), me=profileText(a);
    const cardSys=`You are CarNimbus AI. Given a vehicle and a buyer profile, return a structured evaluation JSON only:\n{"verdict":"Yes/No/Only if","pros":["..."],"cons":["..."],"score":85}\nBase the verdict, pros (max 3), cons (max 3), and score (0-100) on budget/reliability/lifestyle fit. No markdown, no extra text.`;
    const cardRaw=await llm(env,[{role:"system",content:cardSys},{role:"user",content:`Car: ${carStr}\nBuyer: ${me}`}]).catch(()=>null);
    if(cardRaw){ try{ const m=String(cardRaw).match(/\{[\s\S]*\}/); if(m){ JSON.parse(m[0]); await env.DB.prepare("UPDATE comments SET card=? WHERE id=?").bind(m[0],parentId).run().catch(()=>{}); } }catch(_){} }
    const rSys=es?`Eres CarNimbus AI, el agente de investigación imparcial del comprador. Respondes SOLO a este comprador, en privado. Formato: "Veredicto: Sí/No/Solo si — " + por qué (valor de mercado estilo KBB, fiabilidad/problemas conocidos de este año/marca/modelo exacto) + un detalle específico de SU perfil (pasatiempos, estilo de vida, presupuesto). 3-4 frases, específico, denso en valor, sin relleno, sin markdown. Termina EXACTAMENTE con "Score: NN/100" — tu puntuación de ajuste para ESTE comprador (presupuesto 40%, fiabilidad 30%, estilo de vida 30%).`
      :`You are CarNimbus AI, the buyer's unbiased research agent. You are replying PRIVATELY to this buyer only. Format: "Verdict: Yes/No/Only if — " + why (KBB-style market value, known reliability/common issues for this exact year/make/model) + one detail tied to THEIR profile (hobbies, lifestyle, budget). 3-4 sentences, specific, value-dense, zero fluff, no markdown. End with EXACTLY "Score: NN/100" — your fit score for THIS buyer (weighting: budget fit 40%, reliability 30%, lifestyle fit 30%).`;
    const rRaw=await llm(env,[{role:"system",content:rSys},{role:"user",content:`Car: ${carStr}\nBuyer: ${me}`}]).catch(()=>null);
    const rBody=String(rRaw||"").trim().slice(0,600);
    if(rBody) await env.DB.prepare("INSERT INTO comments (user_id,vdp_id,body,body_es,zip,parent_id,visible_to,status,created_at) VALUES (0,?,?,?,?,?,?, 'approved', ?)")
      .bind(vdpId, "CarNimbus AI — "+rBody, es?("CarNimbus AI — "+rBody):null, "agent", parentId, uid, new Date().toISOString()).run().catch(()=>{});
  }catch(_){} };
  if(ctx&&ctx.waitUntil) ctx.waitUntil(enrich()); else await enrich();
  return json({ok:true,postId:parentId});}
async function comments(request,env){ const curl=new URL(request.url); const vdpId=+curl.searchParams.get("vdpId")||0;
  if(request.method==="POST"){ const uid=await readSession(env,request); if(!uid) return json({ok:false,error:"auth"},401);
    const {body,zip}=await request.json().catch(()=>({})); if(!body||String(body).length>500) return json({ok:false,error:"bad_request"},400);
    const n=await env.DB.prepare("SELECT COUNT(*) c FROM comments WHERE user_id=? AND created_at>?").bind(uid,new Date(Date.now()-3600e3).toISOString()).first();
    if(n.c>=10) return json({ok:false,error:"rate_limited"},429);
    // W3: post instantly — no blocking LLM (the old card+moderation calls stalled every post and silently hid real ones).
    await env.DB.prepare("INSERT INTO comments (user_id,vdp_id,body,zip,status,created_at) VALUES (?,?,?,?, 'approved', ?)")
      .bind(uid,vdpId,String(body),String(zip||""),new Date().toISOString()).run();
    return json({ok:true}); }
  const meUid=await readSession(env,request);                            // optional — caller identity (votes + private replies)
  if(vdpId){ const rows=await env.DB.prepare("SELECT body,zip,card,created_at FROM comments WHERE vdp_id=? AND status='approved' AND (visible_to=0 OR visible_to=?) ORDER BY id DESC LIMIT 50").bind(vdpId,meUid||0).all().catch(()=>({results:[]}));
    const result = (rows.results||[]).map(r => ({
      ...r,
      card: r.card ? JSON.parse(r.card) : null
    }));
    return json({ok:true,comments:result}); }
  const lat=parseFloat(curl.searchParams.get("lat")), lng=parseFloat(curl.searchParams.get("lng"));
  const radius=parseFloat(curl.searchParams.get("radius")||"40"); let geo=Number.isFinite(lat)&&Number.isFinite(lng);
  const lang=curl.searchParams.get("lang")==="es"?"es":"en";
  const geoCols=geo?"u.lat,u.lng,":"";                                   // only touch lat/lng columns when actually ranking
  // U2: never more than 3 sponsored rows in the feed — cap via a subquery of the 3 newest, join real dealer identity.
  let rows=await env.DB.prepare(
    "SELECT c.id,c.body,c.body_es,c.zip,c.created_at,c.vdp_id,c.parent_id,c.visible_to,c.upvotes,c.downvotes,c.images,c.sponsored,c.card,c.synthetic,u.handle,json_extract(p.answers,'$.full_name') full_name,"+geoCols+"p.avatar,pv.dir myvote,v.year,v.make,v.model,v.price_mo,v.price,v.photos,dl.dealership dealer_name,dl.logo dealer_logo FROM comments c "+
    "LEFT JOIN users u ON u.id=c.user_id LEFT JOIN profiles p ON p.user_id=c.user_id "+
    "LEFT JOIN post_votes pv ON pv.comment_id=c.id AND pv.user_id=? "+
    "LEFT JOIN vdps v ON v.id=c.vdp_id AND v.active=1 LEFT JOIN dealer_leads dl ON dl.id=c.dealer_id "+
    "WHERE c.status='approved' AND (c.visible_to=0 OR c.visible_to=?) AND (c.sponsored=0 OR c.id IN (SELECT id FROM comments WHERE sponsored=1 AND status='approved' ORDER BY id DESC LIMIT 3)) "+
    "ORDER BY c.sponsored DESC, c.id DESC LIMIT 300").bind(meUid||0,meUid||0).all().catch(async()=>{
      geo=false;                                                          // votes/lat/body_es columns not migrated yet → fall back to recency, no votes
      return env.DB.prepare("SELECT c.id,c.body,c.zip,c.created_at,c.vdp_id,c.card,c.synthetic,u.handle,p.avatar,v.year,v.make,v.model,v.price_mo,v.photos FROM comments c LEFT JOIN users u ON u.id=c.user_id LEFT JOIN profiles p ON p.user_id=c.user_id LEFT JOIN vdps v ON v.id=c.vdp_id AND v.active=1 WHERE c.status='approved' ORDER BY c.id DESC LIMIT 300").all(); });
  // Buyer-true monthlies on car chips: compute from the real price + the caller's numbers (anon = honest defaults).
  let mans={}; if(meUid){ const mp=await env.DB.prepare("SELECT answers FROM profiles WHERE user_id=?").bind(meUid).first(); mans=mp?JSON.parse(mp.answers||"{}"):{}; mans=await decryptAnswers(mans, env.PII_KEY); }
  const mapr=aprFor(mans.fico);
  let out=(rows.results||[]).map(r=>{
    let handle = r.handle;
    let full_name = r.full_name;
    if (r.synthetic === 1) {
      handle = r.zip;
      full_name = r.zip;
    }
    return {...r,
      handle,
      full_name,
      body:(lang==="es"&&r.zip==="agent"&&r.body_es)?r.body_es:r.body,      // agent posts speak the buyer's language; rider posts stay as written
      price_mo:r.price?monthlyFor(r.price,meUid?mans.max_down:0,mapr,72):r.price_mo,
      card:r.card?JSON.parse(r.card):null,
      photos:r.photos?JSON.parse(r.photos):[],images:r.images?JSON.parse(r.images):[]}; });
  if(geo){ const R=3959, rad=x=>x*Math.PI/180;
    out=out.map(r=>{ if(r.zip==="agent") return {...r,_d:-1};                 // agent/AI posts stay pinned
        if(r.synthetic) return {...r,_d:0};                                   // V8: AI-community posts are global — always visible, never geo-dropped
        if(r.lat==null||r.lng==null) return {...r,_d:1e9};
        const dLat=rad(r.lat-lat),dLng=rad(r.lng-lng);
        const a=Math.sin(dLat/2)**2+Math.cos(rad(lat))*Math.cos(rad(r.lat))*Math.sin(dLng/2)**2;
        return {...r,_d:R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))}; })
      .filter(r=>r._d<0||r._d<=radius).sort((x,y)=>x._d-y._d); }
  out=out.slice(0,100).map(({lat,lng,_d,body_es,price,...r})=>r);
  return json({ok:true,comments:out}); }

async function voteComment(request,env,uid){ const {commentId,dir}=await request.json().catch(()=>({}));
  if(!commentId||![1,-1].includes(dir)) return json({ok:false,error:"bad_request"},400);
  const prev=await env.DB.prepare("SELECT dir FROM post_votes WHERE user_id=? AND comment_id=?").bind(uid,commentId).first();
  if(prev && prev.dir===dir) await env.DB.prepare("DELETE FROM post_votes WHERE user_id=? AND comment_id=?").bind(uid,commentId).run();   // toggle off
  else await env.DB.prepare("INSERT INTO post_votes (user_id,comment_id,dir) VALUES (?,?,?) ON CONFLICT(user_id,comment_id) DO UPDATE SET dir=excluded.dir").bind(uid,commentId,dir).run();
  const up=await env.DB.prepare("SELECT COUNT(*) c FROM post_votes WHERE comment_id=? AND dir=1").bind(commentId).first();
  const dn=await env.DB.prepare("SELECT COUNT(*) c FROM post_votes WHERE comment_id=? AND dir=-1").bind(commentId).first();
  await env.DB.prepare("UPDATE comments SET upvotes=?, downvotes=? WHERE id=?").bind(up.c,dn.c,commentId).run();
  return json({ok:true,upvotes:up.c,downvotes:dn.c}); }
async function softPull(request,env,uid){ const {consent}=await request.json().catch(()=>({}));
  if(!consent) return json({ok:false,error:"consent_required"},400);
  const p=await env.DB.prepare("SELECT answers FROM profiles WHERE user_id=?").bind(uid).first();
  const a=p?JSON.parse(p.answers||"{}"):{};
  const apr={"800+":6.4,"740-799":7.1,"670-739":9.3,"580-669":13.5,"under 580":17.9}[a.fico]||12.0;   // TODO: real bureau/lender soft-pull here
  const result={apr,term:72,tier:a.fico||"unrated",disclaimer:"Estimate from a soft check — 0 FICO impact. Final terms confirmed at signing.",estimate:true};
  a.softpull=result; await env.DB.prepare("UPDATE profiles SET answers=? WHERE user_id=?").bind(JSON.stringify(a),uid).run().catch(()=>{});
  return json({ok:true,...result}); }
async function waitlist(request, env) {
  // 1) CSRF: reject cross-site POSTs (allow same-site / no-Origin server-to-server).
  const origin = request.headers.get("Origin") || "";
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  // 2) Parse + size guard.
  let phone, lang, token, consent, privacy, hp, t;
  try {
    const body = await request.json();
    ({ phone, lang, token, consent, privacy, hp, t } = body || {});
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }

  // 2b) Bot heuristics: honeypot filled → silently "accept" (don't teach the bot);
  //     sub-1.5s submits after page load are not human.
  if (hp) return json({ ok: true }, 200);
  if (typeof t === "number" && t >= 0 && t < 1500) {
    return json({ ok: false, error: "captcha" }, 403);
  }

  const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";

  // 3) Rate limit: max 5 signups/hour per IP (degrades to no-op if `ip` column absent).
  try {
    const since = new Date(Date.now() - 3600e3).toISOString();
    const rl = await env.DB
      .prepare("SELECT COUNT(*) AS n FROM waitlist WHERE ip = ? AND created_at > ?")
      .bind(ip, since)
      .first();
    if (rl && rl.n >= 5) return json({ ok: false, error: "rate_limited" }, 429);
  } catch (_) {
    /* migration not applied yet — skip rate limiting */
  }

  // 4) Bot check (only enforced once TURNSTILE_SECRET is configured).
  if (env.TURNSTILE_SECRET) {
    const ok = await verifyTurnstile(token, ip, env.TURNSTILE_SECRET);
    if (!ok) return json({ ok: false, error: "captcha" }, 403);
  }

  // 5) Validate — phone-first: phone required (US), email optional.
  phone = String(phone || "").replace(/\D/g, "");
  if (phone.length === 11 && phone[0] === "1") phone = phone.slice(1);
  if (!/^[2-9]\d{9}$/.test(phone)) return json({ ok: false, error: "invalid_phone" }, 422);
  phone = "+1" + phone;
  if (consent !== true || privacy !== true) {
    return json({ ok: false, error: "consent_required" }, 422);
  }

  // 6) Insert — phone is the dedup key (migration 0003 schema).
  const now = new Date().toISOString();
  const ua = request.headers.get("user-agent") || "";
  const l = String(lang || "en").slice(0, 5);
  try {
    const r = await env.DB
      .prepare(
        "INSERT INTO waitlist (phone, email, lang, created_at, user_agent, ip, sms_consent) " +
          "VALUES (?,?,?,?,?,?,1) ON CONFLICT(phone) DO NOTHING"
      )
      .bind(phone, null, l, now, ua, ip)
      .run();
    return json({ ok: true, already: r.meta.changes === 0 });
  } catch (e) {
    return json({ ok: false, error: "server_error" }, 500);
  }
}

async function verifyTurnstile(token, ip, secret) {
  if (!token) return false;
  try {
    const r = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      }
    );
    return (await r.json()).success === true;
  } catch {
    return false;
  }
}

function sec(resp) {
  const h = new Headers(resp.headers);
  for (const k in SEC) h.set(k, SEC[k]);
  return new Response(resp.body, { status: resp.status, headers: h });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// ============================================================================================
// app.carnimbus.us — THE DEALER wAPP + NIMBUS SETTLEMENT
// Deck v13 S-04: "Scan the VIN from your lot. Preview pricing in seconds. Confirm & upload
// title. Done."  S-07 MOAT: funds locked before the sale, seller paid at punch, agents
// adjudicate release, no 10-day arbitration window.
//
// THREE INVARIANTS. Breaking any one of them breaks a promise made in writing somewhere.
//
//  1. deal_events IS THE LEDGER. deals.state is a cache of it. Never UPDATE deals.state
//     without appending the matching event — dealTransition() is the only writer, on purpose.
//
//  2. MONEY IS NEVER HELD. The Stripe PaymentIntent uses capture_method:"manual", so funds are
//     AUTHORIZED against the buyer's card and captured only at punch. Nothing ever lands in a
//     CarNimbus balance. Turning this into a stored balance makes CarNimbus a money transmitter
//     and is a legal change, not a product change.
//
//  3. A HUMAN RELEASES THE MONEY. AUTONOMY-POLICY.md:20 — "irreversible actions never reach L3
//     ... a payout ... caps at L1 by policy." The adjudicator writes a recommendation with a
//     rationale in seconds; appApprove() is the only path to SETTLED and it requires a person.
//     The deck's word "autonomous" is true about SPEED and false about AUTONOMY.
// ============================================================================================

const DEAL_FEE_CENTS   = 89500;    // $895 seller fee — deck v13 S-05 ARPU
// Deck v13 S-04 step 1: "Deal closes; the program is funded." 20% of the seller fee = $179 per
// closed deal, credited to that rooftop's creator program. Declared next to the fee it derives
// from so the ratio is visible rather than a second magic number somewhere else in the file.
const PROGRAM_FUND_PCT   = 0.20;
const PROGRAM_FUND_CENTS = Math.round(DEAL_FEE_CENTS * PROGRAM_FUND_PCT);   // 17900
const AGING_BENCHMARK  = 495400;   // $4,954 average discount to clear a prior-model-year unit
                                   // (S&P Global Mobility, Mar 2026 — deck v13 S-02)

// The only legal transitions. Anything not listed here is rejected, including no-op self-loops:
// a repeated POST must fail loudly rather than append a duplicate ledger row.
const DEAL_FLOW = {
  DRAFT:       ["STAKED"],
  STAKED:      ["TITLED", "DISPUTED"],
  TITLED:      ["ADJUDICATED", "DISPUTED"],
  ADJUDICATED: ["SETTLED", "DISPUTED"],
  SETTLED:     [],
  DISPUTED:    [],
};

// Append to the ledger, then re-derive deals.state from it. The UPDATE is guarded on the state we
// read, so two concurrent requests cannot both advance the same deal — the loser sees 0 rows
// changed and gets a 409 rather than silently winning a race over someone else's money.
async function dealTransition(env, dealId, from, to, actor, actorKind, reason) {
  const allowed = DEAL_FLOW[from] || [];
  if (!allowed.includes(to)) return { ok: false, error: "illegal_transition", from, to };
  const r = await env.DB.prepare("UPDATE deals SET state=?, settled_at=CASE WHEN ?='SETTLED' THEN datetime('now') ELSE settled_at END WHERE id=? AND state=?")
    .bind(to, to, dealId, from).run().catch(() => null);
  if (!r || !r.meta || r.meta.changes !== 1) return { ok: false, error: "state_conflict", from, to };
  await env.DB.prepare("INSERT INTO deal_events (deal_id,from_state,to_state,actor,actor_kind,reason) VALUES (?,?,?,?,?,?)")
    .bind(dealId, from, to, String(actor), actorKind, reason || null).run().catch(() => {});
  return { ok: true, state: to };
}

// Every read of a deal goes through here. A dealer may only ever see a deal they are the seller
// on — tenancy is enforced in the WHERE clause, not in a caller's if-statement.
async function dealForSeller(env, id, dealerId) {
  return env.DB.prepare("SELECT * FROM deals WHERE id=? AND seller_dealer_id=?")
    .bind(parseInt(id, 10) || 0, dealerId).first().catch(() => null);
}

// vPIC decode, cached in m0_vpic_cache. NHTSA is free and public and occasionally slow; a decode
// failure must degrade to "we know the VIN but not the trim", never block a dealer standing on a lot.
async function vpicDecode(env, vin) {
  const hit = await env.DB.prepare("SELECT payload FROM m0_vpic_cache WHERE vin=? AND fetched_at > ?")
    .bind(vin, Math.floor(Date.now() / 1000) - 86400 * 30).first().catch(() => null);
  if (hit && hit.payload) { try { return JSON.parse(hit.payload); } catch (_) {} }
  try {
    const r = await fetch("https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/" + encodeURIComponent(vin) + "?format=json",
      { headers: { "accept": "application/json" }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const d = await r.json();
    const row = (d && d.Results && d.Results[0]) || null;
    if (!row) return null;
    const out = {
      year: row.ModelYear || "", make: row.Make || "", model: row.Model || "",
      trim: row.Trim || "", body: row.BodyClass || "",
      drivetrain: row.DriveType || "", fuel: row.FuelTypePrimary || "",
    };
    await env.DB.prepare("INSERT INTO m0_vpic_cache (vin,fetched_at,error_code,payload) VALUES (?,?,?,?) ON CONFLICT(vin) DO UPDATE SET fetched_at=excluded.fetched_at, payload=excluded.payload")
      .bind(vin, Math.floor(Date.now() / 1000), String(row.ErrorCode || ""), JSON.stringify(out)).run().catch(() => {});
    return out;
  } catch (_) { return null; }
}

// POST /api/app/vin — step 1. Accepts {vin} as JSON, or a photo as multipart when the phone has no
// BarcodeDetector (every iPhone), in which case Workers AI reads the plate.
async function appVin(request, env) {
  let vin = "";
  const ct = request.headers.get("content-type") || "";
  if (ct.indexOf("multipart/form-data") === 0) {
    const fd = await request.formData().catch(() => null);
    const photo = fd && fd.get("photo");
    if (!photo || typeof photo === "string") return json({ ok: false, error: "no_photo" }, 400);
    vin = await ocrVin(env, photo).catch(() => "");
    if (!vin) return json({ ok: false, error: "ocr_failed", reason: "Could not read a VIN in that photo. Type it instead." }, 422);
  } else {
    const b = await request.json().catch(() => ({}));
    vin = String(b.vin || "");
  }
  const v = validateVin(vin, { strict: true });
  if (!v.valid) {
    // Loud on purpose. A VIN that passes syntax but fails the check digit is very often a
    // transposition, and a transposed VIN decodes to a DIFFERENT REAL CAR.
    return json({ ok: false, error: "bad_vin", vin: v.normalized || vin.toUpperCase(),
      syntaxValid: v.syntaxValid, checkDigitValid: v.checkDigitValid,
      expectedCheckDigit: v.expectedCheckDigit, reason: v.reason }, 400);
  }
  const decoded = await vpicDecode(env, v.normalized);
  return json({ ok: true, vin: v.normalized, valid: true, checkDigitValid: true,
    expectedCheckDigit: v.expectedCheckDigit, reason: null,
    decoded: decoded || { year: "", make: "", model: "", trim: "", body: "", drivetrain: "", fuel: "" } });
}

// Workers AI reads the VIN off a door-jamb plate or windshield. Returns "" rather than throwing —
// tier 3 (manual entry) is always on screen, so a failure here is a nudge, not a dead end.
async function ocrVin(env, photo) {
  if (!env.AI) return "";
  const buf = new Uint8Array(await photo.arrayBuffer());
  const r = await env.AI.run("@cf/llava-hf/llava-1.5-7b-hf", {
    image: [...buf],
    prompt: "This is a photo of a vehicle identification number (VIN) plate or windshield. Reply with ONLY the 17-character VIN, uppercase, no spaces, no punctuation, no explanation. If you cannot read 17 characters, reply NONE.",
    max_tokens: 40,
  }).catch(() => null);
  const raw = String((r && (r.description || r.response)) || "").toUpperCase();
  const m = raw.replace(/[^A-HJ-NPR-Z0-9]/g, "").match(/[A-HJ-NPR-Z0-9]{17}/);
  return m ? m[0] : "";
}

// GET /api/app/offer?vin= — step 2. vPIC decode + whatever vdp_specs already knows about this VIN.
// A VIN with no vdp_specs row still gets an offer; the market band and grade simply do not render.
async function appOffer(request, env, _uid, d) {
  const url = new URL(request.url);
  const v = validateVin(String(url.searchParams.get("vin") || ""), { strict: true });
  if (!v.valid) return json({ ok: false, error: "bad_vin", reason: v.reason, expectedCheckDigit: v.expectedCheckDigit }, 400);
  const decoded = await vpicDecode(env, v.normalized);
  const s = await env.DB.prepare("SELECT mileage_exact,condition_grade,title_status,days_on_lot,market_price_low,market_price_avg,market_price_high,price_vs_market FROM vdp_specs WHERE vin=?")
    .bind(v.normalized).first().catch(() => null);
  // The offer is the wholesale mark. market_price_* are stored in whole dollars, so ×100 for cents.
  // With no market row we have no defensible number and say so rather than inventing one — an offer
  // a dealer cannot trace is worse than no offer, and this whole product is sold on price honesty.
  const avgCents = s && s.market_price_avg ? Math.round(Number(s.market_price_avg) * 100) : 0;
  const offerCents = avgCents ? Math.max(0, avgCents - DEAL_FEE_CENTS) : 0;
  return json({ ok: true, vin: v.normalized, dealer: d.dealership || d.name || "",
    decoded: decoded || {},
    specs: s ? {
      mileage_exact: s.mileage_exact, condition_grade: s.condition_grade, title_status: s.title_status,
      days_on_lot: s.days_on_lot, market_price_low: s.market_price_low,
      market_price_avg: s.market_price_avg, market_price_high: s.market_price_high,
      price_vs_market: s.price_vs_market,
    } : null,
    offer: { offer_cents: offerCents, fee_cents: DEAL_FEE_CENTS, benchmark_cents: AGING_BENCHMARK,
             priced: !!avgCents } });
}

// POST /api/app/deal — creates the deal in DRAFT and mints the salt that keeps the VIN off chain.
// 32 bytes, generated here and never transmitted anywhere. Losing it means the token id for this
// deal can never be recomputed, which is the correct failure mode: it is a commitment, not a key.
async function appDealCreate(request, env, _uid, d) {
  const b = await request.json().catch(() => ({}));
  const v = validateVin(String(b.vin || ""), { strict: true });
  if (!v.valid) return json({ ok: false, error: "bad_vin", reason: v.reason }, 400);
  const offer = parseInt(b.offer_cents, 10);
  if (!Number.isFinite(offer) || offer <= 0) return json({ ok: false, error: "bad_offer" }, 400);
  const salt = [...crypto.getRandomValues(new Uint8Array(32))].map(x => x.toString(16).padStart(2, "0")).join("");
  const r = await env.DB.prepare("INSERT INTO deals (vin,vin_salt,seller_dealer_id,state,offer_cents,fee_cents) VALUES (?,?,?,'DRAFT',?,?)")
    .bind(v.normalized, salt, d.id, offer, DEAL_FEE_CENTS).run().catch(() => null);
  if (!r || !r.meta || !r.meta.last_row_id) return json({ ok: false, error: "create_failed" }, 500);
  const id = r.meta.last_row_id;
  await env.DB.prepare("INSERT INTO deal_events (deal_id,from_state,to_state,actor,actor_kind,reason) VALUES (?,NULL,'DRAFT',?,'dealer','deal created')")
    .bind(id, String(d.id)).run().catch(() => {});
  await logEvent(env, { action: "dealer.deal_created", source: "app", session_id: "deal:" + id, confidence: offer / 100 }).catch(() => {});
  return json({ ok: true, deal: { id, vin: v.normalized, state: "DRAFT", offer_cents: offer, fee_cents: DEAL_FEE_CENTS } });
}

// POST /api/app/stake — "funds locked before the sale".
// capture_method:"manual" is the whole design. Stripe authorizes against the buyer's card and holds
// NOTHING for us. See invariant 2 at the top of this section before changing a character of this.
// ⚠ Stripe authorizations lapse after 7 days. A deal that sits in STAKED past that window has to be
// re-staked; the cron warns at day 5. Documented in docs/SETTLEMENT-RUNBOOK.md.
async function appStake(request, env, _uid, d) {
  if (!env.STRIPE_SECRET_KEY) return json({ ok: false, error: "stripe_unconfigured" }, 503);
  const b = await request.json().catch(() => ({}));
  const deal = await dealForSeller(env, b.deal_id, d.id);
  if (!deal) return json({ ok: false, error: "not_found" }, 404);
  if (deal.state !== "DRAFT") return json({ ok: false, error: "wrong_state", state: deal.state }, 409);
  const pi = await stripeApi(env, "payment_intents", {
    amount: deal.offer_cents, currency: "usd", capture_method: "manual",
    "automatic_payment_methods[enabled]": "true",
    description: "CarNimbus deal #" + deal.id + " — " + deal.vin,
    "metadata[deal_id]": String(deal.id), "metadata[vin]": deal.vin,
  });
  if (!pi.ok || !pi.data || !pi.data.id) return json({ ok: false, error: "stripe_failed" }, 502);
  await env.DB.prepare("INSERT INTO stakes (deal_id,stripe_payment_intent,amount_cents,status,authorized_at) VALUES (?,?,?,?,datetime('now')) ON CONFLICT(deal_id) DO UPDATE SET stripe_payment_intent=excluded.stripe_payment_intent, amount_cents=excluded.amount_cents, status=excluded.status, authorized_at=excluded.authorized_at")
    .bind(deal.id, pi.data.id, deal.offer_cents, pi.data.status || "requires_capture").run().catch(() => {});
  const t = await dealTransition(env, deal.id, "DRAFT", "STAKED", d.id, "dealer", "buyer capital authorized");
  if (!t.ok) return json({ ok: false, error: t.error }, 409);
  await logEvent(env, { action: "dealer.deal_staked", source: "app", session_id: "deal:" + deal.id, confidence: deal.offer_cents / 100 }).catch(() => {});
  return json({ ok: true, state: "STAKED", status: pi.data.status || "requires_capture", amount_cents: deal.offer_cents });
}

// POST /api/app/title — steps 3 and 4. The title image goes to R2, never to D1 and never anywhere
// public. Key is deals/<id>/title.<ext> so tenancy is checkable from the key alone.
async function appTitleUpload(request, env, _uid, d) {
  if (!env.DOCS) return json({ ok: false, error: "docs_unconfigured" }, 503);
  const fd = await request.formData().catch(() => null);
  if (!fd) return json({ ok: false, error: "bad_form" }, 400);
  const deal = await dealForSeller(env, fd.get("deal_id"), d.id);
  if (!deal) return json({ ok: false, error: "not_found" }, 404);
  if (deal.state !== "STAKED") return json({ ok: false, error: "wrong_state", state: deal.state }, 409);
  const file = fd.get("file");
  if (!file || typeof file === "string") return json({ ok: false, error: "no_file" }, 400);
  if (file.size > 12 * 1024 * 1024) return json({ ok: false, error: "too_large" }, 413);
  const type = String(file.type || "");
  if (type.indexOf("image/") !== 0) return json({ ok: false, error: "not_an_image" }, 415);
  const key = "deals/" + deal.id + "/title";
  await env.DOCS.put(key, file.stream(), { httpMetadata: { contentType: type } });
  const t = await dealTransition(env, deal.id, "STAKED", "TITLED", d.id, "dealer", "title uploaded");
  if (!t.ok) return json({ ok: false, error: t.error }, 409);
  await logEvent(env, { action: "dealer.deal_titled", source: "app", session_id: "deal:" + deal.id }).catch(() => {});
  return json({ ok: true, state: "TITLED" });
}

async function appTitleGet(request, env, _uid, d) {
  if (!env.DOCS) return json({ ok: false, error: "docs_unconfigured" }, 503);
  const id = new URL(request.url).pathname.split("/").pop();
  const deal = await dealForSeller(env, id, d.id);
  if (!deal) return json({ ok: false, error: "not_found" }, 403);   // 403 not 404: do not confirm a deal exists to a dealer who does not own it
  const obj = await env.DOCS.get("deals/" + deal.id + "/title");
  if (!obj) return json({ ok: false, error: "no_title" }, 404);
  return new Response(obj.body, { headers: {
    "content-type": (obj.httpMetadata && obj.httpMetadata.contentType) || "application/octet-stream",
    "cache-control": "private, no-store",       // a title document is never cached by a proxy
    "X-Robots-Tag": "noindex, nofollow",
  }});
}

// POST /api/app/adjudicate — the agent recommends. It does NOT release.
// Writes autonomy_level 'L1' and leaves approved_by NULL, which appApprove requires a human to fill.
async function appAdjudicate(request, env, _uid, d) {
  const b = await request.json().catch(() => ({}));
  const deal = await dealForSeller(env, b.deal_id, d.id);
  if (!deal) return json({ ok: false, error: "not_found" }, 404);
  if (deal.state !== "TITLED") return json({ ok: false, error: "wrong_state", state: deal.state }, 409);
  const stake = await env.DB.prepare("SELECT * FROM stakes WHERE deal_id=?").bind(deal.id).first().catch(() => null);
  const specs = await env.DB.prepare("SELECT title_status,condition_grade,mileage_exact FROM vdp_specs WHERE vin=?").bind(deal.vin).first().catch(() => null);
  const hasTitle = env.DOCS ? !!(await env.DOCS.head("deals/" + deal.id + "/title").catch(() => null)) : false;

  // Deterministic facts first. The model explains the recommendation; it does not discover it.
  // An LLM that can flip "the title is missing" to "release the funds" is a hole, not a feature.
  const facts = {
    stake_authorized: !!(stake && stake.status === "requires_capture"),
    stake_amount_matches: !!(stake && stake.amount_cents === deal.offer_cents),
    title_document_present: hasTitle,
    title_status: (specs && specs.title_status) || "unknown",
  };
  const blocking = [];
  if (!facts.stake_authorized)      blocking.push("buyer capital is not authorized");
  if (!facts.stake_amount_matches)  blocking.push("authorized amount does not match the offer");
  if (!facts.title_document_present) blocking.push("no title document on file");
  if (/salvage|rebuilt|flood|lemon/i.test(String(facts.title_status))) blocking.push("branded title: " + facts.title_status);
  const decision = blocking.length ? "hold" : "release";

  let rationale = decision === "release"
    ? "Buyer capital is authorized for the full offer, a title document is on file, and the title carries no brand. Nothing blocks release."
    : "Held. " + blocking.join("; ") + ".";
  if (env.AI) {
    const w = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      messages: [
        { role: "system", content: "You explain an already-decided vehicle escrow adjudication to a car dealer in 2-3 plain sentences. You do NOT decide anything and you never contradict the decision or the blocking reasons you are given. No preamble, no bullet points." },
        { role: "user", content: "Decision: " + decision + ". Blocking reasons: " + (blocking.join("; ") || "none") + ". Facts: " + JSON.stringify(facts) + ". Offer: $" + (deal.offer_cents / 100).toFixed(0) + ". Explain." },
      ], max_tokens: 220,
    }).catch(() => null);
    const txt = String((w && w.response) || "").trim();
    if (txt) rationale = txt;
  }
  const confidence = decision === "release" ? 0.94 : 0.99;   // holding on a missing document is near-certain; releasing never claims certainty
  await env.DB.prepare("INSERT INTO adjudications (deal_id,agent,model,decision,rationale,confidence,autonomy_level) VALUES (?,?,?,?,?,?,'L1')")
    .bind(deal.id, "settlementAdjudicator", "@cf/meta/llama-3.3-70b-instruct-fp8-fast", decision, rationale, confidence).run().catch(() => {});
  const t = await dealTransition(env, deal.id, "TITLED", "ADJUDICATED", "settlementAdjudicator", "agent", decision);
  if (!t.ok) return json({ ok: false, error: t.error }, 409);
  return json({ ok: true, state: "ADJUDICATED",
    adjudication: { decision, rationale, confidence, autonomy_level: "L1", approved_by: null, blocking } });
}

// POST /api/app/approve — THE HUMAN GATE. The only path to SETTLED.
// AUTONOMY-POLICY.md names settlement_release L1-forever for the same reason as creator_payout:
// capturing an authorization moves real money and cannot be reversed from inside this system.
async function appApprove(request, env, _uid, d) {
  const b = await request.json().catch(() => ({}));
  const deal = await dealForSeller(env, b.deal_id, d.id);
  if (!deal) return json({ ok: false, error: "not_found" }, 404);
  if (deal.state !== "ADJUDICATED") return json({ ok: false, error: "wrong_state", state: deal.state }, 409);
  const adj = await env.DB.prepare("SELECT * FROM adjudications WHERE deal_id=? ORDER BY id DESC LIMIT 1").bind(deal.id).first().catch(() => null);
  if (!adj) return json({ ok: false, error: "no_adjudication" }, 409);
  if (adj.decision !== "release") return json({ ok: false, error: "adjudication_holds", rationale: adj.rationale }, 409);
  const stake = await env.DB.prepare("SELECT * FROM stakes WHERE deal_id=?").bind(deal.id).first().catch(() => null);
  if (!stake) return json({ ok: false, error: "no_stake" }, 409);

  // Capture — "seller paid at punch". This is the irreversible step; everything above it is a check.
  const cap = await stripeApi(env, "payment_intents/" + stake.stripe_payment_intent + "/capture", {});
  if (!cap.ok) return json({ ok: false, error: "capture_failed", detail: (cap.data && cap.data.error && cap.data.error.code) || "" }, 502);
  await env.DB.prepare("UPDATE stakes SET status='captured', captured_at=datetime('now') WHERE deal_id=?").bind(deal.id).run().catch(() => {});
  await env.DB.prepare("UPDATE adjudications SET approved_by=?, approved_at=datetime('now') WHERE id=?").bind(d.id, adj.id).run().catch(() => {});
  const t = await dealTransition(env, deal.id, "ADJUDICATED", "SETTLED", d.id, "dealer", "human approved release");
  if (!t.ok) return json({ ok: false, error: t.error }, 409);
  // Deck v13 S-04 step 1 — "Deal closes; the program is funded."
  // AFTER the transition, deliberately: dealTransition is the only writer of deals.state and it can
  // lose a race (changes!==1 → state_conflict). Crediting before it would fund a program off a deal
  // that never settled. The conflict target matches idx_programs_dealer exactly, which SQLite
  // requires. Budget movement stays L1 — a human pressed this button; nothing here is autonomous.
  await env.DB.prepare(
    "INSERT INTO dealer_programs (dealer_id,budget_cents) VALUES (?,?) "+
    "ON CONFLICT(dealer_id) DO UPDATE SET budget_cents=budget_cents+excluded.budget_cents, "+
    "updated_at=datetime('now')")
    .bind(d.id, PROGRAM_FUND_CENTS).run().catch(() => {});
  await logEvent(env, { action: "dealer.program_funded", source: "app", session_id: "deal:" + deal.id, confidence: PROGRAM_FUND_CENTS / 100 }).catch(() => {});
  await logEvent(env, { action: "dealer.deal_settled", source: "app", session_id: "deal:" + deal.id, confidence: stake.amount_cents / 100 }).catch(() => {});
  return json({ ok: true, state: "SETTLED" });
}

// POST /api/app/dispute — cancels the authorization so the buyer's money is released immediately.
// There is no arbitration window here by design; the SLA lives in the reason text and the runbook.
async function appDispute(request, env, _uid, d) {
  const b = await request.json().catch(() => ({}));
  const deal = await dealForSeller(env, b.deal_id, d.id);
  if (!deal) return json({ ok: false, error: "not_found" }, 404);
  const reason = String(b.reason || "").slice(0, 500);
  if (!reason) return json({ ok: false, error: "reason_required" }, 400);
  const stake = await env.DB.prepare("SELECT * FROM stakes WHERE deal_id=?").bind(deal.id).first().catch(() => null);
  if (stake && stake.status !== "captured" && env.STRIPE_SECRET_KEY) {
    await stripeApi(env, "payment_intents/" + stake.stripe_payment_intent + "/cancel", {}).catch(() => {});
    await env.DB.prepare("UPDATE stakes SET status='canceled' WHERE deal_id=?").bind(deal.id).run().catch(() => {});
  }
  const t = await dealTransition(env, deal.id, deal.state, "DISPUTED", d.id, "dealer", reason);
  if (!t.ok) return json({ ok: false, error: t.error, state: deal.state }, 409);
  await logEvent(env, { action: "dealer.deal_disputed", source: "app", session_id: "deal:" + deal.id }).catch(() => {});
  return json({ ok: true, state: "DISPUTED" });
}

async function appDealGet(request, env, _uid, d) {
  const deal = await dealForSeller(env, new URL(request.url).searchParams.get("id"), d.id);
  if (!deal) return json({ ok: false, error: "not_found" }, 404);
  const [ev, stake, adj] = await Promise.all([
    env.DB.prepare("SELECT from_state,to_state,actor,actor_kind,reason,at FROM deal_events WHERE deal_id=? ORDER BY id").bind(deal.id).all().catch(() => ({ results: [] })),
    env.DB.prepare("SELECT amount_cents,status,authorized_at,captured_at FROM stakes WHERE deal_id=?").bind(deal.id).first().catch(() => null),
    env.DB.prepare("SELECT decision,rationale,confidence,autonomy_level,approved_by,approved_at FROM adjudications WHERE deal_id=? ORDER BY id DESC LIMIT 1").bind(deal.id).first().catch(() => null),
  ]);
  const spec = await env.DB.prepare("SELECT payload FROM m0_vpic_cache WHERE vin=?").bind(deal.vin).first().catch(() => null);
  let decoded = {}; if (spec && spec.payload) { try { decoded = JSON.parse(spec.payload); } catch (_) {} }
  // vin_salt is deliberately absent from this response and from every response. Nothing consumes it
  // today (the token layer is deferred — see the VTT block at the end of this file), but it is a
  // commitment secret and a secret that leaks once has leaked forever.
  return json({ ok: true,
    deal: { id: deal.id, vin: deal.vin, state: deal.state, offer_cents: deal.offer_cents,
            fee_cents: deal.fee_cents, created_at: deal.created_at, settled_at: deal.settled_at },
    decoded, events: ev.results || [], stake: stake || null, adjudication: adj || null, token: null });
}

async function appDeals(request, env, _uid, d) {
  const rows = await env.DB.prepare("SELECT d.id,d.vin,d.state,d.offer_cents,d.created_at,c.payload FROM deals d LEFT JOIN m0_vpic_cache c ON c.vin=d.vin WHERE d.seller_dealer_id=? ORDER BY d.id DESC LIMIT 200")
    .bind(d.id).all().catch(() => ({ results: [] }));
  const deals = (rows.results || []).map(r => {
    let dec = {}; if (r.payload) { try { dec = JSON.parse(r.payload); } catch (_) {} }
    return { id: r.id, vin: r.vin, state: r.state, offer_cents: r.offer_cents, created_at: r.created_at,
             year: dec.year || "", make: dec.make || "", model: dec.model || "" };
  });
  return json({ ok: true, deals });
}

// NOTE on logEvent above: events.vehicle_id is INTEGER, so the VIN cannot go in it. Deal identity
// rides in session_id as a correlation id and `confidence` carries dollars, matching the existing
// dealer.drop_created convention (EVENT-TAXONOMY.md). The ledger of record is deal_events, not this.

// ---- VTT (title token) — DEFERRED, NOT BUILT ------------------------------------------------
// The deck's MOAT slide says "Agent-native ERC chain" and Mobility Capital v5 §43 specifies a
// Vehicle Title Token as ERC-721, "One per VIN". THIS BUILD SHIPS NO CHAIN LAYER, and the reason
// is not caution — it is that the mitigation which would have made it doctrinally clean has
// already been examined and rejected in writing, in this repository.
//
// 01D-iov/nimbus-foundation-iov/layer5-deferred/README.md quarantines CatallaxyVIN.sol, an
// ERC-721 vehicle index registry built on exactly the design proposed here — registration under a
// SALTED commitment rather than keccak256(vin). Its verdict, verbatim:
//
//     "The blocker is not the commitment. It is that the contract writes a permanent
//      per-vehicle record to a public ledger: a token id, an owner address, a commitment ...
//      That is undeletable behavioural metadata about a specific vehicle and a specific wallet
//      even though no payload is stored ... A standing 45-day Delete Act deletion cadence plus
//      CCPA erasure rights cannot be satisfied against it."
//
// Salting makes the id non-enumerable. It does not make it non-derived, and it does nothing at
// all about the owner address, which that README calls "a persistent global identifier".
// Three further walls, each independently disqualifying:
//   · ERC-721 is transferable by construction; a transferable title token is a market, which is
//     Refusal 3 — and escrow is custody of value, which is the California DFAL question (in force
//     since 1 July 2026) that §9.7 of NF-WP-1 already declined once.
//   · "When settlement eventually exists it is fiat, via a conventional processor (Stripe)."
//     NF-1 §3.5 L5-4. That is what appStake/appApprove above actually do.
//   · Solidity needs a compiler and third-party libraries. NF-WP-1 §14 fixes the binding stack at
//     Cloudflare Workers + vanilla JS + D1 with NO BUILD STEP, so this repo cannot compile a
//     contract even if the doctrine cleared it.
//
// Nothing above is a new policy. It is a decision already recorded, which this build declines to
// quietly reverse in a source-file header. Reopening it is a charter action, not a code change.
// See 06-exec/06A-decis/2026-08-03-app-dealer-wapp/ for the decision record.

// ============================================================================================
// THE DEMAND LOOP — carnimbus.us (sensor) → ai. (predict) → app. (act) → back again
//
// The free public tool's job is not to collect leads. It is to record, thousands of times a week,
// what someone wanted and whether we could serve it. `scans.results = 0` is a person we failed —
// and every one of those failures names a car that is priced wrong on a lot nearby.
//
// demandRollup()      turns raw scans into demand_cells (ZIP3 × segment × band × week), k>=5.
// clearanceAdvisor()  joins a dealer's aged inventory against those cells and says what to move.
//
// AUTONOMY: clearanceAdvisor is L0 — SUGGEST ONLY. AUTONOMY-POLICY.md:62 — "Every new agent, and
// every materially new capability on an existing agent, starts at L0." It writes clearance_recs
// rows; a human presses Reprice. It never writes vdps.price_mo itself.
// ============================================================================================

// The five APR_FICO keys plus 'unknown'. scans.fico is whatever the buyer picked on the public
// calculator, so normalise rather than trusting it — a free-text band would fragment every cell.
// Case-insensitive on purpose. The public calculator sends lowercase today and APR_FICO's keys match,
// but a copy edit on one <option> label would otherwise dump a whole credit band into "unknown"
// silently — no error, no alert, just cells that quietly stop being about anyone in particular.
function bandKey(f){ const s=String(f||"").trim().toLowerCase();
  return s==="800+"?"800+" : s==="740-799"?"740-799" : s==="670-739"?"670-739"
       : s==="580-669"?"580-669" : s==="under 580"?"under 580" : "unknown"; }

// scans.dream_car is free text a buyer typed ("bronco", "3 row suv", "f150"). segOf() wants
// (make, model) so feed it the same string twice — its regexes match on the concatenation.
//
// An EMPTY query is "any", not "sedan". The homepage calculator never asks what body style someone
// wants — it asks budget, down payment and ZIP — so bucketing all of that into "sedan" would have
// invented a preference nobody expressed and buried it in the one segment most likely to look
// plausible. "any" is the truth: demand at a price point in a place, body style unstated.
// clearanceAdvisor matches a car against its own segment OR "any", so these still price real units.
function segmentOfQuery(q){ const s=String(q||"").trim(); if(!s) return "any"; return segOf(s,s); }
// ONE definition of "which week is this". demandRollup writes demand_cells keyed on it, and
// clearanceAdvisor and appClear read them back on it — three copies of the same arithmetic is three
// chances for the reader to miss the writer's rows by one week and report "no demand data" forever.
function weekKey(d){ const t=new Date(d); const y=t.getUTCFullYear();
  const jan1=Date.UTC(y,0,1); const days=Math.floor((Date.UTC(y,t.getUTCMonth(),t.getUTCDate())-jan1)/864e5);
  return y+"-W"+String(Math.floor((days+new Date(jan1).getUTCDay())/7)).padStart(2,"0"); }

// SQLite has no percentile function, so sort in JS. Cells are small by construction (k>=5, and a
// week of one ZIP3 × segment × band), so this never sorts anything large.
function pct(sorted,p){ if(!sorted.length) return null;
  const i=Math.min(sorted.length-1,Math.max(0,Math.round((sorted.length-1)*p)));
  return sorted[i]; }

// Rebuilds the current and previous ISO week only. Bounded work on a 5-minute cron, and idempotent
// — running it twice changes nothing but updated_at. Prior weeks are immutable once they roll off,
// which is what makes the 8-week trend on the demand board trustworthy.
async function demandRollup(env){
  const wk=weekKey;
  const since=new Date(Date.now()-21*864e5).toISOString().slice(0,10);
  const rows=await env.DB.prepare(
    "SELECT first_ts, zip, dream_car, fico, monthly, results, reason, top_mo FROM scans "+
    "WHERE zip IS NOT NULL AND length(zip)>=3 AND monthly>0 AND substr(first_ts,1,10) >= ? LIMIT 20000")
    .bind(since).all().catch(()=>({results:[]}));
  // THIN-RESULT THRESHOLD, relative to what we actually have to sell.
  // Measured on production 2026-08-03: a $350/mo search in 902 returns 33 cars; a $280/mo search
  // returns 2. Neither is "unserved" by any binary test — search() prices each unit INTO the
  // buyer's budget by stretching term and applying their down payment, so `results=0` never
  // happens, `over_budget` rarely fires, and top_mo always lands just under what they asked
  // (350→345, 280→277). Every yes/no definition of a miss is structurally unable to fire here.
  //
  // What a miss actually looks like is SCARCITY: two options out of ninety-five. That buyer was
  // technically served and practically wasn't. Ten percent of live inventory, floored at 5, is the
  // line — relative so it scales as inventory grows, floored so a tiny lot can still register.
  const inv=await env.DB.prepare("SELECT COUNT(*) c FROM vdps WHERE active=1").first().catch(()=>({c:0}));
  const THIN=Math.max(5,Math.round(((inv&&inv.c)||0)*0.10));
  const live=new Set([wk(Date.now()), wk(Date.now()-7*864e5)]);
  const cells=new Map();
  for(const r of (rows.results||[])){
    const week=wk(r.first_ts); if(!live.has(week)) continue;
    const key=week+"|"+String(r.zip).slice(0,3)+"|"+segmentOfQuery(r.dream_car)+"|"+bandKey(r.fico);
    let c=cells.get(key); if(!c){ c={n:0,unserved:0,mo:[]}; cells.set(key,c); }
    c.n++; c.mo.push(+r.monthly||0);
    // UNSERVED = we could not answer them on their own terms.
    //   results=0                    nothing at all (rare — search widens until it finds something)
    //   widen_radius | over_budget   we had to leave their area or exceed their budget to answer
    //   top_mo > monthly             the best thing we showed them costs more than they said
    // need_inputs is NOT demand — they never told us enough to search. search() returns before the
    // scans INSERT in that case so the row should not exist, but the exclusion is written here too:
    // a guard that depends on a caller's early return is a guard that breaks when someone refactors
    // the caller, and it would break by silently inflating every cell.
    if(r.reason==="need_inputs") continue;
    const compromised = r.reason==="widen_radius" || r.reason==="over_budget";
    const overAsk = r.top_mo!=null && +r.monthly>0 && +r.top_mo > +r.monthly;
    const thin = (+r.results||0) < THIN;      // the one that actually fires — see THIN above
    if(!r.results || compromised || overAsk || thin) c.unserved++;
  }
  let written=0, suppressed=0;
  for(const [key,c] of cells){
    // k>=5. Enforced HERE, before anything is written. A suppressed cell leaves no row on disk.
    if(c.n<5){ suppressed++; continue; }
    const [week,zip3,segment,band]=key.split("|");
    const mo=c.mo.slice().sort((a,b)=>a-b);
    await env.DB.prepare(
      "INSERT INTO demand_cells (week,zip3,segment,band,scans,unserved,monthly_p25,monthly_p50,monthly_p75,updated_at) "+
      "VALUES (?,?,?,?,?,?,?,?,?,datetime('now')) ON CONFLICT(week,zip3,segment,band) DO UPDATE SET "+
      "scans=excluded.scans, unserved=excluded.unserved, monthly_p25=excluded.monthly_p25, "+
      "monthly_p50=excluded.monthly_p50, monthly_p75=excluded.monthly_p75, updated_at=excluded.updated_at")
      .bind(week,zip3,segment,band,c.n,c.unserved,pct(mo,0.25),pct(mo,0.50),pct(mo,0.75)).run().catch(()=>{});
    written++;
  }
  if(written||suppressed) console.log("demand_rollup: "+written+" cells written, "+suppressed+" suppressed below k=5");
  return {written,suppressed};
}

// For each of a dealer's active units, find the demand cell it should be competing in and decide
// whether a price move would put it in front of people who are already looking.
//
// Every returned row carries its own evidence — the unserved count, the median budget, how many of
// those searches the new price would reach. A dealer told to drop $115/mo is entitled to see the
// 31 searches that produced the number, and a recommendation that cannot show its work is one a
// dealer correctly ignores.
async function clearanceAdvisor(env,dealerId){
  const week=weekKey(Date.now());
  const cars=await env.DB.prepare(
    "SELECT v.id, v.vin, v.year, v.make, v.model, v.trim, v.price_mo, v.lot_date, v.first_seen, v.location_zip, "+
    "       s.days_on_lot, s.dealer_zip "+
    "FROM vdps v LEFT JOIN vdp_specs s ON s.vin=v.vin "+
    "WHERE v.active=1 AND v.dealer_id=? LIMIT 400").bind(dealerId).all().catch(()=>({results:[]}));
  const out=[]; let unknownAge=0;
  for(const v of (cars.results||[])){
    const zip3=String(v.location_zip||v.dealer_zip||"").slice(0,3);
    if(zip3.length<3) continue;
    const segment=segOf(v.make,v.model);
    // Match the car's own segment OR "any". An "any" cell is someone who told us their budget and
    // ZIP but not what body style they wanted — that is demand for everything in range, including
    // this unit. Excluding it would throw away most of the homepage calculator's signal.
    const cell=await env.DB.prepare(
      "SELECT * FROM demand_cells WHERE week=? AND zip3=? AND segment IN (?,'any') ORDER BY unserved DESC LIMIT 1")
      .bind(week,zip3,segment).first().catch(()=>null);
    // No cell means no evidence. Return nothing rather than a low-confidence guess — the first thing
    // a dealer decides about a recommender is whether to trust it, and they decide once.
    if(!cell||!cell.monthly_p50) continue;
    const listed=+v.price_mo||0; if(!listed) continue;
    const gap=listed-cell.monthly_p50;
    if(gap<=0) continue;                       // already priced into the market; nothing to say
    // AGE, best evidence first. 0073 read only days_on_lot and lot_date; in production 0 of 95 live
    // cars had the first and 1 of 95 had the second, so every unit computed as age 0 and the
    // age>=30 gate silently excluded the entire inventory. first_seen (0074) is the floor — the
    // earliest event we have for that VIN. It UNDERSTATES true age, which is the safe direction.
    const days=(d)=>Math.floor((Date.now()-new Date(d).getTime())/864e5);
    const age = v.days_on_lot!=null ? +v.days_on_lot
              : v.lot_date  ? days(v.lot_date)
              : v.first_seen? days(v.first_seen) : null;
    const ageSource = v.days_on_lot!=null ? "dealer" : v.lot_date ? "lot_date" : v.first_seen ? "observed" : "unknown";
    if(age===null){ unknownAge++; continue; }
    // AGED = 30+ days we can evidence, OR a prior-model-year unit. The second test is the deck's own
    // definition (S-02: "207,727 prior-model-year units"), and it is true regardless of how long we
    // have been watching — a 2024 car sitting in August 2026 is aged whether we saw it arrive or not.
    // Without it the system cannot recommend anything until 30 days after we first observed a VIN,
    // which would have meant an empty /clear for another five days on a live product.
    const priorModelYear = (+v.year||9999) <= (new Date().getUTCFullYear()-1);
    if(age<30 && !priorModelYear){ continue; }
    // Suggest just above p50 — enough to enter the bulk of the budget distribution without giving
    // away the whole gap. Rounded to $5 because nobody lists a car at $663/mo.
    //
    // THEN CAP IT, and the cap is the difference between a tool a dealer uses and one they close.
    // Un-capped, this recommended dropping a 2023 Porsche Macan from $640 to $295 — because the
    // "any" cell's median comes from budget shoppers who never specified a body style, and a Macan
    // is not what they were shopping for. A 54% cut is not a price move, it is a punchline, and one
    // of those on the first screen costs you the dealer's belief in every number that follows.
    //
    // A real aged-inventory move is 5-15%. Cap at 12%, and if even the capped price still cannot
    // reach their range, say nothing: this unit genuinely cannot serve this demand, and pretending
    // otherwise is how the whole surface stops being read.
    const MAX_DROP=0.12;
    const floorMo=Math.round((listed*(1-MAX_DROP))/5)*5;
    let suggested=Math.round((cell.monthly_p50*1.015)/5)*5;
    if(suggested<floorMo) suggested=floorMo;
    if(cell.monthly_p75 && suggested>cell.monthly_p75) continue;
    // A CLEARANCE RECOMMENDATION MUST LOWER THE PRICE. Caught on the first live cron run
    // 2026-08-06: three units listed at $291-293 against a p50 of $290 passed the gap>0 test by a
    // dollar or two, and then p50×1.015 rounded to $5 produced $295 — the tool telling a dealer to
    // RAISE the price of a car it had just flagged as aged and unsold. The gap test compares
    // against the median; this compares against what we are about to print on the card, which is
    // the only comparison a dealer actually sees. Same failure family as the $640→$295 Macan: an
    // arithmetically defensible number that is obvious nonsense on screen.
    if(suggested>=listed) continue;
    // How many of the cell's searches the new price plausibly reaches. p50→p75 is the top half of
    // the distribution; anything at or under p50 reaches at least half. Deliberately conservative.
    const reachable=suggested<=cell.monthly_p50 ? Math.round(cell.unserved*0.5)
                  : suggested<=cell.monthly_p75 ? Math.round(cell.unserved*0.35)
                  : Math.round(cell.unserved*0.15);
    const confidence=cell.scans>=30?"high":cell.scans>=12?"medium":"low";
    out.push({ vdp_id:v.id, vin:v.vin, year:v.year, make:v.make, model:v.model, trim:v.trim,
      week, zip3, segment, band:cell.band, listed_mo:listed, suggested_mo:suggested,
      unserved:cell.unserved, cell_scans:cell.scans, reachable, age_days:age, age_source:ageSource,
      prior_model_year:priorModelYear, confidence,
      p25:cell.monthly_p25, p50:cell.monthly_p50, p75:cell.monthly_p75,
      // +1 so a prior-model-year unit we have only observed briefly still ranks by demand rather
      // than collapsing to zero. Age is a multiplier on urgency, not a gate on it.
      score: cell.unserved*(1+age/30) });
  }
  out.sort((a,b)=>b.score-a.score);
  return { recs: out.slice(0,12), unknown_age: unknownAge, considered: (cars.results||[]).length };
}

// ---- ai.carnimbus.us — INVENTORY BY CREDIT BAND (deck v13 S-04, screen 2) ---------------------
// The band is READ, never inferred. listing_placements.credit_band is what the dealer actually
// placed the unit at, and it is the same value search() uses to override the payment for a buyer in
// that band (worker.js:1372) — so this panel shows the shopper exactly what the shopper would see.
// Deriving a band from price instead would have invented a number that contradicts the live pricing.
const BAND_ORDER=["800+","740-799","670-739","580-669","under 580"];
async function aiBands(request,env){
  const rows=await env.DB.prepare(
    "SELECT p.credit_band band, v.id, v.year, v.make, v.model, v.trim, p.monthly, v.price_mo, "+
    "       s.dealer_name, v.lot_date, v.first_seen "+
    "FROM listing_placements p JOIN vdps v ON v.id=p.vdp_id LEFT JOIN vdp_specs s ON s.vin=v.vin "+
    "WHERE v.active=1 ORDER BY p.monthly DESC LIMIT 600").all().catch(()=>({results:[]}));
  const by={};
  for(const r of (rows.results||[])){
    const b=BAND_ORDER.indexOf(String(r.band||""))>=0?r.band:"unbanded";
    (by[b]=by[b]||[]).push({ id:r.id, year:r.year, make:r.make, model:r.model, trim:r.trim||"",
      monthly:+r.monthly||+r.price_mo||0, dealer:r.dealer_name||"—",
      days: r.lot_date ? Math.max(0,Math.floor((Date.now()-Date.parse(r.lot_date))/864e5))
          : r.first_seen ? Math.max(0,Math.floor((Date.now()-Date.parse(r.first_seen))/864e5)) : null });
  }
  const bands=BAND_ORDER.concat(["unbanded"]).filter(b=>by[b]&&by[b].length)
    .map(b=>({ band:b, count:by[b].length, cars:by[b] }));
  return json({ ok:true, bands, total:(rows.results||[]).length });
}

// ---- ai.carnimbus.us — CLEARANCE ACCURACY ----------------------------------------------------
// clearance_recs was written by app./clear and read by nothing. AUTONOMY-POLICY.md:62 puts
// clearanceAdvisor at L0 and says graduation is on MEASURED accuracy — so the measurement needs a
// reader before the ladder means anything. Take rate and skip reasons are that reader.
async function aiClearance(request,env){
  const url=new URL(request.url);
  const week=String(url.searchParams.get("week")||"").slice(0,8) || weekKey(Date.now());
  const t=await env.DB.prepare(
    "SELECT COUNT(*) issued, "+
    "SUM(CASE WHEN outcome='taken' THEN 1 ELSE 0 END) taken, "+
    "SUM(CASE WHEN outcome='skipped' THEN 1 ELSE 0 END) skipped, "+
    "AVG(CASE WHEN outcome='taken' THEN listed_mo-suggested_mo END) avg_drop "+
    "FROM clearance_recs WHERE week=?").bind(week).first().catch(()=>null);
  const byConf=await env.DB.prepare(
    "SELECT confidence, COUNT(*) n, SUM(CASE WHEN outcome='taken' THEN 1 ELSE 0 END) taken "+
    "FROM clearance_recs WHERE week=? GROUP BY confidence").bind(week).all().catch(()=>({results:[]}));
  const skips=await env.DB.prepare(
    "SELECT COALESCE(skip_reason,'(none given)') reason, COUNT(*) n FROM clearance_recs "+
    "WHERE week=? AND outcome='skipped' GROUP BY reason ORDER BY n DESC LIMIT 12")
    .bind(week).all().catch(()=>({results:[]}));
  const recent=await env.DB.prepare(
    "SELECT r.vdp_id, r.listed_mo, r.suggested_mo, r.confidence, r.outcome, r.unserved, "+
    "       v.year, v.make, v.model FROM clearance_recs r LEFT JOIN vdps v ON v.id=r.vdp_id "+
    "WHERE r.week=? ORDER BY r.unserved DESC LIMIT 25").bind(week).all().catch(()=>({results:[]}));
  const issued=(t&&t.issued)||0, taken=(t&&t.taken)||0;
  return json({ ok:true, week,
    totals:{ issued, taken, skipped:(t&&t.skipped)||0,
             open: issued-taken-((t&&t.skipped)||0),
             take_rate: issued? Math.round((taken/issued)*100) : null,
             avg_drop: (t&&t.avg_drop!=null)? Math.round(t.avg_drop) : null },
    by_confidence:(byConf.results||[]), skip_reasons:(skips.results||[]), recent:(recent.results||[]),
    // L0 is stated by the API, not just the docs — a reader of this endpoint should not have to go
    // find AUTONOMY-POLICY.md to learn that nothing here moved a price on its own.
    autonomy:"L0 — suggest only; every reprice was pressed by a human" });
}

// ---- ai.carnimbus.us/demand — the board ------------------------------------------------------
// The headline is deliberately the failure number: "N searches we could not serve this week."
// Volume is vanity; a busy ZIP you already serve is not a problem. Unserved demand is the only
// figure on this page that maps to an action a dealer can take today.
async function aiDemand(request,env){
  const url=new URL(request.url);
  const week=String(url.searchParams.get("week")||"").slice(0,8) || weekKey(Date.now());
  const cells=await env.DB.prepare(
    "SELECT week,zip3,segment,band,scans,unserved,monthly_p25,monthly_p50,monthly_p75 "+
    "FROM demand_cells WHERE week=? ORDER BY unserved DESC LIMIT 400").bind(week).all().catch(()=>({results:[]}));
  const rows=cells.results||[];
  const totals=rows.reduce((a,r)=>({scans:a.scans+r.scans,unserved:a.unserved+r.unserved}),{scans:0,unserved:0});
  // Grid: ZIP3 × segment, summed over credit bands. Bands stay available in the drill-down.
  const grid={};
  for(const r of rows){ grid[r.zip3]=grid[r.zip3]||{};
    grid[r.zip3][r.segment]=(grid[r.zip3][r.segment]||0)+r.unserved; }
  // 8-week trend of unserved, for the sparkline.
  const trend=await env.DB.prepare(
    "SELECT week t, SUM(unserved) c FROM demand_cells GROUP BY week ORDER BY week DESC LIMIT 8").all().catch(()=>({results:[]}));
  return json({ ok:true, week, totals,
    unserved_pct: totals.scans ? +(100*totals.unserved/totals.scans).toFixed(1) : 0,
    grid, cells:rows, trend:(trend.results||[]).reverse(),
    // Honesty, on the page rather than in a footnote: at low traffic most cells are suppressed by
    // k>=5 and the board is thin. Saying so beats a confident-looking empty grid.
    note: rows.length ? null : "No cells yet. Either there is no traffic this week, or every cell is below the k=5 privacy floor." });
}

// ---- app.carnimbus.us/clear — the dealer's queue ----------------------------------------------
// Answers "what should I do today?" — the question a dealer actually opens the app with.
// Recommendations are persisted so the outcome can be measured; AUTONOMY-POLICY graduation is on
// MEASURED accuracy, and with no record of what was recommended there is nothing to measure.
async function persistClearanceRecs(env,dealerId,recs){
  for(const r of recs){
    await env.DB.prepare(
      "INSERT INTO clearance_recs (dealer_id,vdp_id,week,zip3,segment,band,listed_mo,suggested_mo,unserved,reachable,age_days,confidence) "+
      "VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(dealer_id,vdp_id,week) DO UPDATE SET "+
      "listed_mo=excluded.listed_mo, suggested_mo=excluded.suggested_mo, unserved=excluded.unserved, "+
      "reachable=excluded.reachable, age_days=excluded.age_days, confidence=excluded.confidence")
      .bind(dealerId,r.vdp_id,r.week,r.zip3,r.segment,r.band,r.listed_mo,r.suggested_mo,r.unserved,r.reachable,r.age_days,r.confidence)
      .run().catch(()=>{});
  }
  return recs.length;
}
// CRON. Until now clearanceAdvisor ran in exactly one place — inside appClear, on a dealer page
// load — so a dealer who never opened /clear produced no clearance_recs, and the accuracy data that
// AUTONOMY-POLICY graduation depends on was conditioned on the engagement it was supposed to
// measure. Measured 2026-08-06: 0 rows on disk while 14 units qualified. The queue was not empty,
// it was unrun.
async function clearanceSweep(env){
  const ds=await env.DB.prepare(
    "SELECT DISTINCT dealer_id id FROM vdps WHERE active=1 AND dealer_id IS NOT NULL LIMIT 50")
    .all().catch(()=>({results:[]}));
  let wrote=0;
  for(const d of (ds.results||[])){
    const adv=await clearanceAdvisor(env,d.id).catch(()=>null);
    if(adv&&adv.recs&&adv.recs.length) wrote+=await persistClearanceRecs(env,d.id,adv.recs);
  }
  return wrote;
}
async function appClear(request,env,_uid,d){
  const adv=await clearanceAdvisor(env,d.id);
  const recs=adv.recs;
  await persistClearanceRecs(env,d.id,recs);
  // The week comes from the clock, NOT from recs[0]. Binding recs[0].week meant that on an empty
  // result the bind was "" — so the skipped-list matched nothing and, worse, the demand_cells count
  // below always came back 0, making the empty state report "not enough public searches" even when
  // the real cause was the opposite. The two causes have different owners; reporting the wrong one
  // sends the dealer to fix something that isn't broken.
  const week=weekKey(Date.now());
  const skipped=await env.DB.prepare(
    "SELECT vdp_id FROM clearance_recs WHERE dealer_id=? AND outcome='skipped' AND week=?")
    .bind(d.id, week).all().catch(()=>({results:[]}));
  const hide=new Set((skipped.results||[]).map(x=>x.vdp_id));
  const open=recs.filter(r=>!hide.has(r.vdp_id));
  if(open.length) await logEvent(env,{action:"dealer.recommendation_shown",source:"app",confidence:open.length}).catch(()=>{});
  // When there is nothing to show, say WHY. An unexplained empty screen reads as broken, and a
  // dealer who thinks the tool is broken never opens it again. The two real causes are different
  // problems with different fixes: not enough public searches yet (ours to solve, via traffic), or
  // no lot dates on their inventory (theirs to solve, in the console).
  let why=null;
  if(!open.length){
    const cells=await env.DB.prepare("SELECT COUNT(*) c FROM demand_cells WHERE week=?")
      .bind(week).first().catch(()=>({c:0}));
    why = (cells&&cells.c)
      ? "We have demand data this week but nothing in your inventory lines up with it yet."
      : "Not enough public searches in your area yet to price against. This sharpens as traffic grows.";
    if(adv.unknown_age) why += " " + adv.unknown_age + " of your " + adv.considered +
      " live units have no lot date — adding those in the console makes them eligible.";
  }
  return json({ ok:true, recs:open, considered:adv.considered, unknown_age:adv.unknown_age,
    // The empty state is a feature. Three low-confidence cards would teach a dealer to ignore the
    // whole surface, and they decide that once.
    note: open.length ? null : (why||"Nothing has enough signal yet. We'd rather say that than guess.") });
}

// A human presses this. clearanceAdvisor never writes a price itself — L0, suggest-only.
async function appReprice(request,env,_uid,d){
  const b=await request.json().catch(()=>({}));
  const vdpId=parseInt(b.vdp_id,10), mo=parseInt(b.price_mo,10);
  if(!vdpId||!Number.isFinite(mo)||mo<=0) return json({ok:false,error:"bad_request"},400);
  const own=await env.DB.prepare("SELECT id FROM vdps WHERE id=? AND dealer_id=? AND active=1").bind(vdpId,d.id).first().catch(()=>null);
  if(!own) return json({ok:false,error:"not_found"},404);
  // embedding_synced=0 so the next cron re-embeds it — a repriced car that still matches on its old
  // price would put it back in front of exactly the wrong buyers.
  await env.DB.prepare("UPDATE vdps SET price_mo=?, embedding_synced=0, updated_at=? WHERE id=?")
    .bind(mo,new Date().toISOString(),vdpId).run().catch(()=>{});
  await env.DB.prepare("UPDATE clearance_recs SET outcome='taken', resolved_at=datetime('now') WHERE dealer_id=? AND vdp_id=? AND outcome IS NULL")
    .bind(d.id,vdpId).run().catch(()=>{});
  await logEvent(env,{action:"dealer.recommendation_taken",source:"app",vehicle_id:vdpId,confidence:mo}).catch(()=>{});
  return json({ok:true,price_mo:mo});
}

// A skip with a reason is training signal; a skip without one is noise. The reason is required.
async function appRecSkip(request,env,_uid,d){
  const b=await request.json().catch(()=>({}));
  const vdpId=parseInt(b.vdp_id,10); const why=String(b.reason||"").slice(0,200);
  if(!vdpId||!why) return json({ok:false,error:"reason_required"},400);
  await env.DB.prepare("UPDATE clearance_recs SET outcome='skipped', skip_reason=?, resolved_at=datetime('now') WHERE dealer_id=? AND vdp_id=? AND outcome IS NULL")
    .bind(why,d.id,vdpId).run().catch(()=>{});
  await logEvent(env,{action:"dealer.recommendation_skipped",source:"app",vehicle_id:vdpId}).catch(()=>{});
  return json({ok:true});
}
