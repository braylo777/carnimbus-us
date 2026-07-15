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

const ALLOWED_ORIGINS = [
  "https://carnimbus.com",
  "https://www.carnimbus.com",
  "https://carnimbus.us",
  "https://www.carnimbus.us",
];
// H-CSRF: same-origin gate for state-changing POSTs. Empty Origin allowed (same-origin nav + server-to-server);
// browsers always attach Origin on cross-site POST — the actual CSRF vector we reject. Any carnimbus subdomain
// (app./dealer./admin./ai.) is first-party — they POST same-origin to /api/* — so accept the whole domain family,
// not just the ALLOWED_ORIGINS apex list (which is for the marketing waitlist only).
function sameOrigin(request){ const o=request.headers.get("Origin")||""; if(!o) return true;
  try{ const h=new URL(o).hostname; return h==="carnimbus.com"||h==="carnimbus.us"||h.endsWith(".carnimbus.com")||h.endsWith(".carnimbus.us"); }
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
    "img-src 'self' data:",
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
    catch(e){ return sec(json({ok:false,error:"server_error"},500)); }   // e.g. SESSION_SECRET unset → never fall back to a forgeable session; keep sec() headers
  },
  async route(request, env, ctx) {
    let url = new URL(request.url);
    // Subdomain doors: one Worker, path-prefixed surfaces.
    const sub=url.hostname.split(".")[0];
    const PREFIX={app:"/app",dealer:"/dealer",admin:"/admin",ai:"/ai"}[sub];
    // AG: ai.carnimbus.com serves the NIMBUS ops HUD again (admin-gated at the API). APIs (/api/ai/*) resolve here.
    // (redirect removed — the /ai PREFIX + /index.html fallback serves site/ai/index.html; noindex via asset header.)
    // AH2: admin.carnimbus.com is retired — ai.carnimbus.com is the single NIMBUS access point.
    if(sub==="admin" && !url.pathname.startsWith("/api/")) return Response.redirect("https://ai.carnimbus.com"+url.pathname.replace(/^\/admin/,"")+url.search,301);
    // Renamed app routes: /chat → /matches, /you → /profile (301). /talk/<slug> = clean car URL (resolved below).
    if(sub==="app"){ const rn={"/chat":"/matches","/you":"/profile","/app/chat":"/matches","/app/you":"/profile"};
      if(rn[url.pathname]) return Response.redirect(url.origin+rn[url.pathname]+url.search,301);
      // Closed system: every app page requires a session — only doors are /signin (+ assets/legal).
      { const p=url.pathname.toLowerCase();
        const open = p==="/signin"||p==="/privacy"||p.startsWith("/assets/")||p==="/site.webmanifest"||
                     p.startsWith("/favicon")||p==="/robots.txt"||p.startsWith("/sitemap")||
                     p.startsWith("/api/")||                    // APIs keep their own withUser/adminOnly gates
                     /^\/pass\/[A-Za-z0-9_-]+$/.test(url.pathname); // tokened pass link is bearer-gated
        if(!open){
          const uid=await readSession(env,request);             // SESSION_SECRET unset → throws → top catch 500 (fail-close)
          if(!uid){ const nxt=url.pathname+url.search; return Response.redirect(url.origin+"/signin?next="+encodeURIComponent(nxt),302); }
        } }
      // Vanity car URL: /talk/2025-porsche-macan → resolve slug to a vdp id, serve the car page.
      const tm=url.pathname.match(/^\/talk\/([a-z0-9-]+)$/i);
      if(tm){ const slug=tm[1];
        const rows=await env.DB.prepare("SELECT id,year,make,model FROM vdps WHERE active=1").all().catch(()=>({results:[]}));
        const hit=(rows.results||[]).find(v=>(String(v.year)+"-"+v.make+"-"+v.model).toLowerCase().replace(/[^a-z0-9]+/g,"-")===slug.toLowerCase());
        if(hit){ url.pathname="/car"; url.searchParams.set("id",hit.id); request=new Request(url,request); }   // clean path → PREFIX block serves car.html, no 301
        else return Response.redirect(url.origin+"/matches",302); } }
    // Vanity URLs: legacy prefixed or .html paths 301 to the clean form on the right subdomain.
    { const P=url.pathname;
      if(!P.startsWith("/api/")&&!P.startsWith("/assets/")&&!P.startsWith("/pass/")&&!P.startsWith("/used/")){
        if(!PREFIX && (P.startsWith("/app/")||P.startsWith("/dealer/"))){
          const s2=P.startsWith("/app/")?"app":"dealer";
          let clean=P.replace(/^\/(app|dealer)/,"").replace(/\.html$/,"")||"/"; if(clean==="/index")clean="/";
          return Response.redirect("https://"+s2+".carnimbus.com"+clean+url.search,301);
        }
        if(PREFIX && (P.startsWith(PREFIX+"/")||/\.html$/.test(P))){
          let clean=(P.startsWith(PREFIX+"/")?P.slice(PREFIX.length):P).replace(/\.html$/,"")||"/"; if(clean==="/index")clean="/";
          return Response.redirect(url.origin+clean+url.search,301);
        }
      } }
    if(PREFIX && !url.pathname.startsWith(PREFIX) && !url.pathname.startsWith("/api/") &&
       !url.pathname.startsWith("/assets/") && !url.pathname.startsWith("/pass/") && !url.pathname.startsWith("/used/") &&
       !url.pathname.startsWith("/sitemap") && url.pathname!=="/robots.txt" &&
       url.pathname!=="/favicon.ico" && url.pathname!=="/site.webmanifest"){
      // AG-fix: root serves the DIRECTORY form ("/ai/","/admin/") not "/index.html" — Assets canonicalizes an
      // explicit index.html to its dir with a 307, which then hit the clean-URL rule below and looped.
      // AH2: ai.carnimbus.com is the ONLY console door — root serves the NIMBUS HUD (site/ai/index.html);
      // deeper ai paths (/pools,/events,/growth,/wall) serve the admin tool pages from site/admin/.
      url.pathname = sub==="ai" ? (url.pathname==="/" ? "/ai/" : "/admin"+url.pathname)
                   : PREFIX + (url.pathname==="/" ? (sub==="app"?"/discover.html":sub==="dealer"?"/pitch":"/") : url.pathname);
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
    if (url.pathname === "/api/auth/start" && request.method === "POST")  return sec(await authStart(request, env));
    if (url.pathname === "/api/auth/verify" && request.method === "POST") return sec(await authVerify(request, env));
    if (url.pathname === "/api/profile" && request.method === "POST")     return sec(await withUser(request, env, saveProfile));
    if (url.pathname === "/api/avatar" && request.method === "POST")      return sec(await withUser(request, env, saveAvatar));
    if (url.pathname === "/api/feed")                                     return sec(await feed(request, env));
    if (url.pathname === "/api/search")                                   return sec(await search(request, env, ctx));
    if (url.pathname === "/api/matches")                                  return sec(await withUser(request, env, matchesList));
    if (url.pathname === "/api/vdp")                                      return sec(await vdpOne(request, env));
    if (url.pathname === "/api/slots")                                    return sec(await openSlots(request, env));
    if (url.pathname === "/api/comments/vote" && request.method === "POST") return sec(await withUser(request, env, voteComment));
    if (url.pathname === "/api/softpull" && request.method === "POST")     return sec(await withUser(request, env, softPull));
    if (url.pathname === "/api/car-chat" && request.method === "POST")    return sec(await withUser(request, env, carChat));
    if (url.pathname === "/api/book" && request.method === "POST")         return sec(await withUser(request, env, book));
    if (url.pathname === "/api/drive/cancel" && request.method === "POST")  return sec(await withUser(request, env, driveCancel));
    if (url.pathname.startsWith("/pass/"))                                return sec(await passPage(request, env));
    if (url.pathname === "/api/comments")                                 return sec(await comments(request, env));
    if (url.pathname === "/api/feed/ask" && request.method === "POST")     return sec(await withUser(request, env, feedAsk, ctx));
    if (url.pathname === "/api/me")                                       return sec(await withUser(request, env, me));
    if (url.pathname === "/api/dealer" && request.method === "POST")      return sec(await dealerLead(request, env));
    if (url.pathname === "/api/webleads" && request.method === "POST")     return sec(await webLead(request, env));
    if (url.pathname === "/api/logout" && request.method === "POST")      return sec(logout());
    if (url.pathname === "/api/dealer/console")                           return sec(await withDealer(request, env, dealerConsole));
    if (url.pathname === "/api/dealer/roi")                               return sec(await withDealer(request, env, dealerRoi));
    if (url.pathname === "/api/dealer/listing" && request.method === "POST") return sec(await withDealer(request, env, dealerListing));
    if (url.pathname === "/api/dealer/checkin" && request.method === "POST") return sec(await withDealer(request, env, dealerCheckin));
    if (url.pathname === "/api/dealer/feedback")                             return sec(await withDealer(request, env, dealerFeedback));
    if (url.pathname === "/api/admin/stats")                              return sec(await adminOnly(request, env, adminStats));
    if (url.pathname === "/api/admin/dealer/activate" && request.method === "POST") return sec(await adminOnly(request, env, dealerActivate));
    if (url.pathname === "/api/admin/reindex" && request.method === "POST") return sec(await adminOnly(request, env, reindexAll));
    if (url.pathname === "/api/admin/profiles/ingest" && request.method === "POST") return sec(await adminOnly(request, env, profilesIngest));
    if (url.pathname === "/api/admin/export")                             return sec(await adminOnly(request, env, poolExport));
    if (url.pathname === "/api/whoami")                                   return sec(await withUser(request, env, whoami));
    if (url.pathname === "/api/chats/recent")                             return sec(await withUser(request, env, recentChat));
    if (url.pathname === "/api/chats")                                    return sec(await withUser(request, env, chatList));
    if (url.pathname === "/api/dealer/chat")                              return sec(await withDealer(request, env, dealerChat));
    if (url.pathname === "/api/ai/pulse")                                 return sec(await adminOnly(request, env, (req,e)=>aiPulse(e)));
    if (url.pathname === "/api/ai/graph")                                 return sec(await adminOnly(request, env, (req,e)=>aiGraph(e)));
    if (url.pathname === "/api/ai/trends")                                return sec(await adminOnly(request, env, (req,e)=>aiTrends(e)));
    if (url.pathname === "/api/ai/ask" && request.method === "POST")      return sec(await adminOnly(request, env, (req,e)=>aiAsk(req,e)));
    if (url.pathname === "/api/ai/act" && request.method === "POST")      return sec(await adminOnly(request, env, (req,e)=>aiAct(req,e)));
    if (url.pathname === "/api/admin/buyers")                             return sec(await adminOnly(request, env, (req,e)=>adminBuyers(e)));
    if (url.pathname === "/api/events" && request.method === "POST")      return sec(await postEvents(request, env));
    if (url.pathname === "/api/admin/events/tail")                        return sec(await adminOnly(request, env, eventsTail));
    if (url.pathname === "/api/admin/growth")                             return sec(await adminOnly(request, env, adminGrowth));
    let assetRes = await env.ASSETS.fetch(request);
    { const h = new Headers(assetRes.headers);
      if (["app","dealer","admin","ai"].includes(url.hostname.split(".")[0])) h.set("X-Robots-Tag", "noindex, nofollow");
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
  async scheduled(event, env) {
    await runQueue(env);
    await syncEmbeddings(env);
    await residentAgent(env).catch(()=>{});   // L9: one labeled community post per ≤2h
    await syntheticNudger(env).catch(()=>{});  // C1: synthetic agent nudges per ≤4h
    // Refresh persisted backend matches for all buyers with a profile (demo-scale; bounded to 50/run).
    try{ const us=await env.DB.prepare("SELECT user_id FROM profiles ORDER BY updated_at DESC LIMIT 50").all();
      for(const r of (us.results||[])){ await computeSignals(env, r.user_id).catch(()=>{}); await computeMatches(env, r.user_id).catch(()=>{}); } }catch(_){}
    await enrichInventory(env).catch(()=>{});   // Wave E1: inventory intelligence, 3 vehicles/run
    await growthRollup(env).catch(()=>{});      // Wave E4: funnel snapshot, ≤1/day
    await syncDealerFeeds(env).catch(()=>{});   // AF: pull each subscribed dealer's authorized feed, ≤1/day
    await driveReminders(env).catch(()=>{});    // Wave H1: enqueue T-2h test-drive reminders
  },
};

// ==================== auth/session (HMAC cookie) ====================
async function hmac(env, s){ const secret=env.SESSION_SECRET; if(!secret) throw new Error("SESSION_SECRET unset");
  const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("HMAC",k,new TextEncoder().encode(s)); return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/[+/=]/g,m=>({"+":"-","/":"_","=":""}[m])); }
async function makeSession(env,userId){ const exp=Date.now()+30*864e5; const p=userId+"."+exp; return p+"."+await hmac(env,p); }
async function readSession(env,request){ const m=(request.headers.get("Cookie")||"").match(/cn_sess=([^;]+)/); if(!m) return null;
  const parts=m[1].split("."); if(parts.length!==3) return null; const [uid,exp,sig]=parts;
  if(!uid||!exp||!sig||Date.now()>+exp) return null;
  return ctEq(await hmac(env,uid+"."+exp),sig) ? +uid : null; }
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
async function adminOnly(request,env,fn){ if(!env.ADMIN_KEY||!ctEq(request.headers.get("x-admin-key")||"",env.ADMIN_KEY)) return json({ok:false,error:"forbidden"},403); return fn(request,env); }

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
async function smsInbound(request,env){ const form=await request.formData().catch(()=>null);
  if(!form || !(await twilioValid(request,env,form))) return new Response('<?xml version="1.0"?><Response/>',{status:403,headers:{"content-type":"text/xml"}});
  const from=form?String(form.get("From")||""):"", rawText=form?String(form.get("Body")||"").trim():"", text=rawText.toUpperCase();
  let reply="";
  if(/^(STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT)$/.test(text)){
    await env.DB.prepare("UPDATE waitlist SET sms_consent=0 WHERE phone=?").bind(from).run().catch(()=>{});
    reply="You're unsubscribed from CarNimbus texts. No more messages. Reply START to rejoin."; }
  else if(/^(HELP|INFO)$/.test(text)) reply="CarNimbus: AI car buying, LA. Up to 4 msgs/mo. Msg&data rates may apply. Reply STOP to cancel. hello@carnimbus.com";
  else if(text==="START"){ await env.DB.prepare("UPDATE waitlist SET sms_consent=1 WHERE phone=?").bind(from).run().catch(()=>{}); reply="Welcome back to CarNimbus. Reply STOP anytime."; }
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
async function llm(env,messages){ if(env.AI_BACKEND_URL){ try{ const r=await fetch(env.AI_BACKEND_URL+"/chat",{method:"POST",body:JSON.stringify({messages})});
    if(r.ok){ const d=await r.json().catch(()=>null); if(d&&typeof d.text==="string") return d.text; } }catch(_){} }
  const r=await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast",{messages,max_tokens:512}); return r.response; }
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
const SEO_ORIGIN="https://carnimbus.com";

function robotsTxt(host){
  if(host!=="carnimbus.com"&&host!=="www.carnimbus.com")
    return new Response("User-agent: *\nDisallow: /\n",{headers:{"content-type":"text/plain; charset=utf-8","cache-control":"public, max-age=3600"}});
  const body=`# CarNimbus robots.txt
User-agent: *
Allow: /
Disallow: /api/
Disallow: /pass/
Disallow: /app/
Disallow: /dealer/
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
<div class="row" style="gap:10px;margin-top:18px"><a class="btn primary md" href="https://app.carnimbus.com/car?id=${a.id}" style="text-decoration:none">Talk to the ${escHtml(a.make+" "+a.model)} →</a>
<a class="btn ghost md" href="https://app.carnimbus.com/car?id=${b.id}" style="text-decoration:none">Talk to the ${escHtml(b.make+" "+b.model)} →</a></div>
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
        <a class="btn primary lg" href="https://app.carnimbus.com/car?id=${v.id}" style="text-decoration:none;display:inline-flex;margin-top:18px">Talk to this car →</a>
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
    await env.DB.prepare(
    "INSERT INTO vdps (vin,year,make,model,trim,price_mo,miles,drivetrain,body,features,description,photos,price_total,mileage,location_zip,dealer_id,active,embedding_synced,updated_at) "+
    "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,0,?) ON CONFLICT(vin) DO UPDATE SET price_mo=excluded.price_mo, miles=excluded.miles, price_total=excluded.price_total, mileage=excluded.mileage, location_zip=excluded.location_zip, dealer_id=COALESCE(excluded.dealer_id,vdps.dealer_id), active=1, embedding_synced=0, deactivated_at=NULL, updated_at=excluded.updated_at")
    .bind(c.vin,c.year,c.make,c.model,c.trim||"",c.price_mo,c.miles||"",c.drivetrain||"",c.body||"",
      JSON.stringify(c.features||[]),c.description||"",JSON.stringify(c.photos||[]),
      parseInt(c.price_total,10)||null, parseInt(String(c.mileage||c.miles||"").replace(/\D/g,""),10)||null, String(c.location_zip||"").slice(0,10),
      cd, new Date().toISOString()).run();
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
  const optOut="https://carnimbus.com/api/unsubscribe?t="+token;
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
      body:JSON.stringify({from:"CarNimbus <hello@carnimbus.com>",to:[d.gm_email],subject,text:body,
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
  if(pool==="vdps"){ const rows=await env.DB.prepare("SELECT * FROM vdps ORDER BY updated_at DESC LIMIT 5000").all();
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
// AJ: per-car APR estimate for the match card. Anonymous scanner ⇒ no FICO, no credit pull ⇒ this is an ESTIMATE
// and is labelled as one. Only real rate mechanisms are inputs: base band, vehicle age (used rates step by model
// year), a >100k-mile surcharge, and LTV from the buyer's down payment — the LTV step and the 3.9 floor are the
// same policy already used at the chat path (see aprBase/ltvR ~1356), not a second rate table.
// NOT inputs, on purpose: "demand" (days_on_lot is NULL on 100/100 rows — no demand signal exists in the schema)
// and the buyer's monthly (a payment is the OUTPUT of a rate; deriving term from monthly while monthly derives
// from APR is circular — down payment carries that intent instead).
function aprEst(price,down,year,miles){
  const base=aprFor("670-739");
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
  const apr=aprFor("670-739");                       // neutral default band for anon (no FICO on file); AJ: per-car aprEst() now prices each car in scan()
  const LEASE_APR_EQ=+(0.00275*2400).toFixed(1);     // AJ: MF→APR-equiv (standard ×2400). Constant: leaseMoFor's money factor is fixed.
  const leaseMoFor=(price,dn)=>{ const resid=price*0.55, mf=0.00275; return Math.max(99,Math.round((price-dn-resid)/36+(price+resid)*mf)); };   // AD3: 36-mo, 55% residual — honest ballpark like the APR default
  const radius=parseFloat(u.searchParams.get("radius"))||0;   // T4: 0/"" = any distance
  const q=String(u.searchParams.get("q")||"").toLowerCase().slice(0,80);   // Y3: dream-car text (legacy: calc.js/start.js send none; homepage now sends type=)
  const TYPE_OK=new Set(["sedan","suv","truck","sport"]);
  const tRaw=String(u.searchParams.get("type")||"").toLowerCase().slice(0,8);
  const carType=TYPE_OK.has(tRaw)?tRaw:null;   // AI: unknown value ⇒ no type signal, never a crash
  const cen=await zipCentroids(env), home=cen[zip]||null;     // buyer ZIP centroid (null if outside our SoCal table)
  // Join vdp_specs for dealer coords (T3); fall back to vdps.location_zip → centroid.
  const all=await env.DB.prepare("SELECT v.*, s.dealer_lat, s.dealer_lng, s.dealer_zip, s.dealer_name, s.exterior_color, s.fuel_type, s.body_style, s.drivetrain_detail, s.mileage_exact, s.condition_grade, s.certified, s.title_status, s.market_price_avg, s.price_vs_market FROM vdps v LEFT JOIN vdp_specs s ON s.vin=v.vin WHERE v.active=1 AND (v.dealer_id IS NULL OR v.dealer_id IN (SELECT id FROM dealer_leads WHERE engine_on=1)) ORDER BY v.updated_at DESC LIMIT 200").all().catch(()=>({results:[]}));
  const scan=function(budgetCap,radCap){ const r=[];
    for(const v of (all.results||[])){
      if(!v.price){ continue; }                        // never fabricate a price — skip unpriced
      const carApr=aprEst(v.price,down,v.year,v.mileage_exact);   // AJ: per-car rate — NOTE this moves price_mo, which the budget filter below tests
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
  const anon=readAnon(request);
  // Z2: telemetry off the critical path — the response doesn't wait on two D1 INSERTs.
  const jobs=[
    logEvent(env,{anon_id:anon,action:"intent.opened_calculator",source:"calculator",location:zip||null}),
    logEvent(env,{anon_id:anon,action:"intent.search_results",source:"calculator",location:zip||null,confidence:out.length})];
  // AC3: scans ledger — one row per validated web scan (src=scan), deduped per IP+terms; repeats counted, not re-inserted.
  const MAKE_RE=/acura|alfa|aston|audi|bentley|bmw|buick|cadillac|chevrolet|chevy|chrysler|dodge|ferrari|fiat|ford|genesis|gmc|honda|hummer|hyundai|infiniti|jaguar|jeep|kia|lamborghini|land rover|range rover|lexus|lincoln|lotus|lucid|maserati|mazda|mclaren|mercedes|benz|mini|mitsubishi|nissan|polestar|pontiac|porsche|\bram\b|rivian|rolls|saab|saturn|scion|smart|subaru|suzuki|tesla|toyota|volkswagen|\bvw\b|volvo/;
  // AI: `||carType` keeps the ledger alive — the homepage no longer sends free text, so MAKE_RE never matches and
  // scans would silently stop recording (NIMBUS DAILY SCANS → 0). dream_car now holds the type for scanner rows.
  if(u.searchParams.get("src")==="scan" && (MAKE_RE.test(q)||carType)){
    const ip=request.headers.get("CF-Connecting-IP")||"0.0.0.0";
    const top=out[0]?[out[0].year,out[0].make,out[0].model].filter(Boolean).join(" "):null;
    jobs.push(env.DB.prepare(
      "INSERT INTO scans (ip,dream_car,deal_type,monthly,down,budget,zip,radius,ua,results,top_match) VALUES (?,?,?,?,?,?,?,?,?,?,?) "+
      "ON CONFLICT(ip,dream_car,deal_type,monthly,down,budget,zip,radius) DO UPDATE SET repeats=repeats+1, last_ts=datetime('now'), results=excluded.results, top_match=excluded.top_match")
      .bind(ip,q||carType,deal,monthly,down,isCash?budget:0,zip,radius||0,String(request.headers.get("User-Agent")||"").slice(0,160),out.length,top).run().catch(()=>{}));
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
  const smsBody=`Your ${v.year} ${v.make} ${v.model} Drive Now pass: carnimbus.com/pass/${tok} — ${slot} at ${center}. Reply STOP to opt out.`;
  await sendSMS(env,u&&u.phone,smsBody).catch(()=>{});                                   // instant — no cron wait
  await env.DB.prepare("INSERT INTO sms_queue (phone,template,body,send_at,recurring,created_at) VALUES (?,?,?,?,?,?)")
    .bind(u&&u.phone,"drive-confirm",smsBody,new Date(Date.now()+864e5).toISOString(),"none",new Date().toISOString()).run().catch(()=>{});   // +24h reminder, not duplicate
  if(v.dealer_id){ const dl=await env.DB.prepare("SELECT name,phone FROM dealer_leads WHERE id=? AND status='active'").bind(v.dealer_id).first();
    if(dl&&dl.phone) await sendSMS(env,dl.phone,`CarNimbus: new Drive Now appointment — ${(u&&u.handle)||"a buyer"} (•••-${String(u&&u.phone||"").slice(-4)}), ${v.year} ${v.make} ${v.model}, ${slot}. Reply here to text the buyer. Console: dealer.carnimbus.com`).catch(()=>{}); }
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
    const chatSms=`Your ${v.year} ${v.make} ${v.model} Drive Now pass: carnimbus.com/pass/${tok} — ${b.slot} at ${b.center}. Reply STOP to opt out.`;
    await sendSMS(env,u.phone,chatSms).catch(()=>{});
    await env.DB.prepare("INSERT INTO sms_queue (phone,template,body,send_at,recurring,created_at) VALUES (?,?,?,?,?,?)")
      .bind(u.phone,"drive-confirm",chatSms,new Date(Date.now()+864e5).toISOString(),"none",new Date().toISOString()).run();
    if(v.dealer_id){ const dl=await env.DB.prepare("SELECT name,phone FROM dealer_leads WHERE id=? AND status='active'").bind(v.dealer_id).first();
      if(dl&&dl.phone) await sendSMS(env,dl.phone,`CarNimbus — added to your calendar: ${fmtSlotLabel(b.slot)} with ${(u&&u.handle)||"a buyer"} (•••-${String(u&&u.phone||"").slice(-4)}) for the ${v.year} ${v.make} ${v.model}. Reply here to text them. Console: dealer.carnimbus.com`).catch(()=>{}); }
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
  const ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//CarNimbus//EN","BEGIN:VEVENT","UID:"+t.pass_token+"@carnimbus.com","DTSTAMP:"+start,"DTSTART:"+start,"DTEND:"+end,"SUMMARY:CarNimbus test drive — "+t.year+" "+t.make+" "+t.model,"LOCATION:"+(t.center||"Porsche South Bay"),"DESCRIPTION:Drive Now pass carnimbus.com/pass/"+t.pass_token,"END:VEVENT","END:VCALENDAR"].join("\r\n");
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
  const passSlug=(t.year+"-"+t.make+"-"+t.model).toLowerCase().replace(/[^a-z0-9]+/g,"-");
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
<a class="brand" href="https://app.carnimbus.com/matches"><img src="/assets/logo.png" alt="" style="width:24px;height:24px"><b style="font:700 14px 'Space Grotesk',Manrope;color:#fff">CarNimbus</b><span class="mono" style="margin-left:auto;font-size:9px;color:#18C8FF;letter-spacing:.18em">DRIVE NOW</span></a>
<div class="hero"></div><div class="pd">
<a class="back noprint" href="https://app.carnimbus.com/matches">‹ Back to my matches</a>
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
<a class="btn ghost sm" href="https://app.carnimbus.com/talk/${passSlug}" style="flex:1;text-decoration:none;text-align:center;justify-content:center">${T.resched}</a>
<button id="pm-cancel" class="btn ghost sm" type="button" data-token="${escHtml(t.pass_token)}" data-confirm="${escHtml(T.cancelConfirm)}" style="flex:1">${T.cancel}</button>
</div><div id="pm-cancelled" class="noprint" style="display:none;font:700 12px Manrope;color:#f5a623;margin-top:10px;text-align:center">${T.cancelled} · slot freed</div>`:""}
<div id="pm-hint" class="noprint" style="display:none;font:600 10px Manrope;color:#8ca0c4;margin-top:8px;text-align:center">iPhone: in the print sheet choose <b style="color:#e2e9f2">Save to Files</b> — or tap Share ⬆️ → <b style="color:#e2e9f2">Print</b>.</div>
<div style="text-align:center;font:600 9px Manrope;color:#8ca0c4;margin-top:10px">carnimbus.com · ${T.tag}</div>
</div></div>
</body></html>`,{headers:{"content-type":"text/html"}}); }
function cidFor(id){ const n=100000000+(id*7919)%900000000; const s=String(n); return s.slice(0,3)+" "+s.slice(3,6)+" "+s.slice(6,9); }
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
  const uid=await readSession(env,request); if(!uid) return json({ok:false,error:"auth"},401);
  const u=await env.DB.prepare("SELECT phone FROM users WHERE id=?").bind(uid).first();
  const digits=String(u&&u.phone||"").replace(/\D/g,"").slice(-10);
  const d=await env.DB.prepare("SELECT id,name,dealership,client_no,status FROM dealer_leads WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone,'-',''),' ',''),'(',''),')','') LIKE ? ORDER BY id DESC LIMIT 1")
    .bind("%"+digits).first();
  if(!d||!digits) return json({ok:false,error:"not_dealer"},403);
  if(d.status!=="active"||!d.client_no) return json({ok:false,error:"pending"},403);
  return fn(request,env,uid,d);
}
// Dealer scoping (0009): a dealer sees/mutates only rows whose vdp.dealer_id is theirs
// OR NULL (legacy/demo, unowned). Real dealer uploads carry dealer_id and are isolated.
const DSCOPE="(v.dealer_id=? OR v.dealer_id IS NULL)";
async function dealerConsole(request,env,uid,dealer){
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
  const ls=await env.DB.prepare("SELECT id,year,make,model,trim,price_mo,active FROM vdps v WHERE "+DSCOPE+" ORDER BY id DESC LIMIT 20").bind(dealer.id).all();
  return json({ok:true,dealer:dealer,kpis:k,deltas:{today:rt.t||0,yesterday:rt.y||0},
    appointments:(tds.results||[]).map(t=>({...t,who:t.handle||("Rider •••-"+String(t.phone).slice(-4)),cid:cidFor(t.id),phone:"•••-"+String(t.phone).slice(-4),photos:JSON.parse(t.photos||"[]")})),
    listings:ls.results||[]});
}
async function dealerListing(request,env,uid,dealer){
  const c=await request.json().catch(()=>({}));
  const pm=parseInt(c.price_mo,10);
  if(!c.year||!c.make||!c.model||!Number.isFinite(pm)) return json({ok:false,error:"bad_request"},400);
  if(pm<50||pm>5000) return json({ok:false,error:"price_out_of_range"},422);   // server-authoritative price bounds
  const vin=c.vin||("DLR-"+dealer.id+"-"+Date.now());
  await env.DB.prepare(
    "INSERT INTO vdps (vin,year,make,model,trim,price_mo,miles,drivetrain,body,features,description,photos,active,embedding_synced,dealer_id,updated_at) "+
    "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,0,?,?)")
    .bind(vin,+c.year,String(c.make).slice(0,40),String(c.model).slice(0,60),String(c.trim||"").slice(0,60),pm,
      String(c.miles||"").slice(0,20),String(c.drivetrain||"").slice(0,20),String(c.body||"").slice(0,20),
      JSON.stringify(c.features||[]),String(c.description||"").slice(0,500),JSON.stringify(c.photos||[]),dealer.id,new Date().toISOString()).run();
  return json({ok:true});
}
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
  const driveNowsToday = await q("SELECT COUNT(*) c FROM web_leads WHERE substr(created_at,1,10)=?", today);
  const body={ ok:true, today,
    scansToday, scansYesterday: await q("SELECT COUNT(*) c FROM scans WHERE substr(first_ts,1,10)=?", yday),
    scansTotal:  await q("SELECT COUNT(*) c FROM scans"),
    driveNowsToday, driveNowsTotal: await q("SELECT COUNT(*) c FROM web_leads"),
    convRate: (scansToday&&driveNowsToday!=null)? Math.round(driveNowsToday/scansToday*100) : 0,
    liveInventory: await q("SELECT COUNT(*) c FROM vdps WHERE active=1"),
    inToday:  await q("SELECT COUNT(*) c FROM vdps WHERE substr(updated_at,1,10)=? AND active=1", today),
    outToday: await q("SELECT COUNT(*) c FROM vdps WHERE substr(deactivated_at,1,10)=?", today),
    apptsToday: 0, appt_pending: true,
    // legacy (not shown on the new console, retained for compatibility)
    cars: await q("SELECT COUNT(*) c FROM vdps WHERE active=1"),
    leadsToday: driveNowsToday, leadsTotal: await q("SELECT COUNT(*) c FROM web_leads") };
  body.degraded=degraded>0; return json(body); }
async function aiTrends(env){
  // BI: aggregates for the console's trend charts — models/types/zips coming through the portal.
  const rows=async(sql,...b)=>{ const r=await env.DB.prepare(sql).bind(...b).all().catch(()=>({results:[]})); return (r.results||[]).map(x=>({t:String(x.t??""),c:x.c})); };
  return json({ ok:true,
    byType:  await rows("SELECT dream_car t, COUNT(*) c FROM scans WHERE dream_car<>'' GROUP BY dream_car ORDER BY c DESC"),
    byDeal:  await rows("SELECT deal_type t, COUNT(*) c FROM scans WHERE deal_type IS NOT NULL AND deal_type<>'' GROUP BY deal_type ORDER BY c DESC"),
    topCars: await rows("SELECT matched_car t, COUNT(*) c FROM web_leads WHERE matched_car IS NOT NULL AND matched_car<>'' GROUP BY matched_car ORDER BY c DESC LIMIT 8"),
    byZip:   await rows("SELECT zip t, COUNT(*) c FROM scans WHERE zip IS NOT NULL AND zip<>'' GROUP BY zip ORDER BY c DESC LIMIT 10"),
    overTime:((await env.DB.prepare("SELECT substr(first_ts,1,10) d, COUNT(*) c FROM scans GROUP BY d ORDER BY d DESC LIMIT 14").all().catch(()=>({results:[]}))).results||[]).reverse()
  }); }
async function adminBuyers(env){
  // BI: the new one-line buyer record (zip + selections + picked car + email), from web_leads. Old name/phone
  // profiles are archived (0045) and no longer shown.
  const r=await env.DB.prepare("SELECT created_at, zip, dream_car, deal_type, monthly, down, matched_car, email FROM web_leads ORDER BY id DESC LIMIT 500").all().catch(()=>({results:[]}));
  return json({ok:true, buyers:r.results||[]}); }
// ===== BI: Nimbus conversational ops brain — insights (aiAsk) + guarded actions (aiAct). =====
const NIMBUS_ACTIONS = { dealer_engine:"turn a dealer's inventory engine on/off (args: dealer_id, on)",
  reindex:"re-embed inventory + profiles into search (no args)",
  activate_vin:"put a car back in inventory (args: vin)",
  deactivate_vin:"take a car out of inventory (args: vin)" };
async function aiAsk(request,env){
  const {question,history}=await request.json().catch(()=>({}));
  if(!question) return json({ok:false,error:"bad_request"},400);
  const p=await aiPulse(env).then(r=>r.json()).catch(()=>({}));
  const t=await aiTrends(env).then(r=>r.json()).catch(()=>({}));
  const state=`STATE (live): scansToday=${p.scansToday} driveNowsToday=${p.driveNowsToday} convRate=${p.convRate}% liveInventory=${p.liveInventory} in=${p.inToday} out=${p.outToday}. `+
    `topTypes=${(t.byType||[]).map(x=>x.t+":"+x.c).join(", ")}. topCars=${(t.topCars||[]).slice(0,5).map(x=>x.t+":"+x.c).join(", ")}. topZips=${(t.byZip||[]).slice(0,5).map(x=>x.t+":"+x.c).join(", ")}.`;
  const sys="You are Nimbus, the operations intelligence for CarNimbus (a car-buying platform). Answer the operator "+
    "concisely from the live STATE below. If they ask you to CHANGE something, do NOT do it — propose exactly one "+
    "action on its own final line as `<ACTION name=NAME arg1=v1 arg2=v2>` and explain it in one sentence. "+
    "Available actions: "+Object.entries(NIMBUS_ACTIONS).map(([k,v])=>k+" — "+v).join("; ")+". "+state;
  const msgs=[{role:"system",content:sys},...((history||[]).slice(-8)),{role:"user",content:String(question).slice(0,600)}];
  let text=await llm(env,msgs);
  let proposed=null; const m=/<ACTION\s+name=(\w+)([^>]*)>/i.exec(text||"");
  if(m){ const args={}; (m[2]||"").trim().split(/\s+/).filter(Boolean).forEach(kv=>{ const [k,...rest]=kv.split("="); if(k) args[k]=rest.join("="); });
    if(NIMBUS_ACTIONS[m[1]]) proposed={name:m[1],args}; text=String(text).replace(m[0],"").trim(); }
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
  const ms=await all("SELECT user_id,vdp_id,score FROM matches ORDER BY score DESC LIMIT 120");
  const riders=new Set();
  ms.forEach(m=>{ if(!seen.has("c"+m.vdp_id))return; riders.add(m.user_id);
    add("u"+m.user_id,"rider","Rider "+m.user_id,3);
    EDGES.push({a:"c"+m.vdp_id,b:"u"+m.user_id,w:Math.max(1,Math.round((m.score||0)/20))}); });
  if(riders.size){ const ids=[...riders].slice(0,60), ph=ids.map(()=>"?").join(",");
    const ps=await all("SELECT user_id FROM profiles WHERE user_id IN ("+ph+")",...ids);
    ps.forEach(p=>{ add("p"+p.user_id,"profile","Twin "+p.user_id,2); EDGES.push({a:"u"+p.user_id,b:"p"+p.user_id,w:1}); }); }
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
async function webLead(request,env){ const b=await request.json().catch(()=>({}));
  if(b.website) return json({ok:true});                                    // honeypot: swallow silently
  if(env.TURNSTILE_SECRET && !(await verifyTurnstile(b.cf_token, request.headers.get("CF-Connecting-IP")||"", env.TURNSTILE_SECRET))) return json({ok:true});   // bot: swallow silently
  const car=String(b.dream_car||"").trim().slice(0,80);
  const deal=["cash","finance","lease"].includes(b.deal_type)?b.deal_type:"finance";
  const zip=String(b.zip||"").replace(/\D/g,"").slice(0,5);
  let ph=String(b.phone||"").replace(/\D/g,""); if(ph.length===11&&ph[0]==="1")ph=ph.slice(1);
  if(!car||!/^\d{5}$/.test(zip)||(ph&&!/^[2-9]\d{9}$/.test(ph))) return json({ok:false,error:"bad_request"},400);   // Y4: phone optional — email is the contact channel now
  const mc=String(b.matched_car||"").trim().slice(0,120);
  const ip=request.headers.get("CF-Connecting-IP")||"";
  const since=new Date(Date.now()-3600e3).toISOString();
  const rc=await env.DB.prepare("SELECT COUNT(*) c FROM web_leads WHERE ip=? AND created_at>?").bind(ip,since).first().catch(()=>({c:0}));
  if(rc&&rc.c>=5){ await logEvent(env,{action:"intent.web_lead_ratelimited",location:zip,source:"sid-form"}); return json({ok:true}); }   // per-IP cap: silent to the client, visible internally
  const mo=String(b.monthly||"").replace(/\D/g,"").slice(0,6), dn=String(b.down||"").replace(/\D/g,"").slice(0,6), rad=String(b.radius||"").replace(/\D/g,"").slice(0,3)||"25";
  await env.DB.prepare("INSERT INTO web_leads (dream_car,deal_type,monthly,down,zip,radius,phone,ip,matched_car,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .bind(car,deal,mo,dn,zip,rad,ph?("+1"+ph):"",ip,mc,new Date().toISOString()).run();
  // AI/TASK-006: drop-in CRM seam. No-op ("unrouted") until CRM_ENDPOINT exists, so this changes nothing today.
  const routed=await routeLead(env,{matched_car:mc,vin:String(b.vin||"").slice(0,17),phone:ph?("+1"+ph):"",
    dream_car:car,deal_type:deal,monthly:mo,down:dn,budget:String(b.budget||"").replace(/\D/g,"").slice(0,7),zip,radius:rad});
  await logEvent(env,{action:"intent.web_lead_routed",location:zip,source:routed}).catch(()=>{});
  if(env.ADMIN_PHONE) await sendSMS(env,env.ADMIN_PHONE,`CarNimbus web lead: ${car}${mc?` → matched ${mc}`:``} · ${deal} · $${mo}/mo · $${dn} down · ${zip} ±${rad}mi${ph?` · +1${ph}`:``} (emailing Cid)`).catch(()=>{});
  await logEvent(env,{action:"intent.web_lead",location:zip,source:"sid-form"});
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
