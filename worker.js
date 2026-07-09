// CarNimbus — static site (Assets) + waitlist API (D1), security-hardened.
//
// Rollout notes:
//  - Apply migration 0002_hardening.sql (adds `ip`, `sms_consent`) BEFORE deploying this.
//    (Rate-limit + insert degrade gracefully if not yet applied, but consent/ip won't persist.)
//  - Turnstile is OPTIONAL: verification only runs once `TURNSTILE_SECRET` is set
//    (`wrangler secret put TURNSTILE_SECRET`). Until then the form still works.
//  - CSP currently allows Google Fonts + Wikimedia inventory images; tighten to 'self'
//    after fonts are self-hosted (P1) and inventory images are localized.

const ALLOWED_ORIGINS = [
  "https://carnimbus.com",
  "https://www.carnimbus.com",
  "https://carnimbus.us",
  "https://www.carnimbus.us",
];

const SEC = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
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
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; "),
};

export default {
  async fetch(request, env) {
    try { return await this.route(request, env); }
    catch(e){ return sec(json({ok:false,error:"server_error"},500)); }   // e.g. SESSION_SECRET unset → never fall back to a forgeable session; keep sec() headers
  },
  async route(request, env) {
    let url = new URL(request.url);
    // Subdomain doors: one Worker, path-prefixed surfaces.
    const sub=url.hostname.split(".")[0];
    const PREFIX={app:"/app",dealer:"/dealer",admin:"/admin",ai:"/ai"}[sub];
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
          if(!uid) return Response.redirect(url.origin+"/signin",302);
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
      url.pathname = PREFIX + (url.pathname==="/" ? (sub==="app"?"/discover.html":"/index.html") : url.pathname);
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
    if (url.pathname === "/api/waitlist" && request.method === "POST") {
      return sec(await waitlist(request, env));
    }
    if (url.pathname === "/api/sms/inbound" && request.method === "POST") return sec(await smsInbound(request, env));
    if (url.pathname === "/api/sms/send" && request.method === "POST")    return sec(await adminOnly(request, env, smsSendRoute));
    if (url.pathname === "/api/sms/numbers")                              return sec(await adminOnly(request, env, smsNumbers));
    if (url.pathname === "/api/vdp/ingest" && request.method === "POST")  return sec(await adminOnly(request, env, vdpIngest));
    if (url.pathname === "/api/auth/start" && request.method === "POST")  return sec(await authStart(request, env));
    if (url.pathname === "/api/auth/verify" && request.method === "POST") return sec(await authVerify(request, env));
    if (url.pathname === "/api/profile" && request.method === "POST")     return sec(await withUser(request, env, saveProfile));
    if (url.pathname === "/api/avatar" && request.method === "POST")      return sec(await withUser(request, env, saveAvatar));
    if (url.pathname === "/api/feed")                                     return sec(await feed(request, env));
    if (url.pathname === "/api/search")                                   return sec(await search(request, env));
    if (url.pathname === "/api/matches")                                  return sec(await withUser(request, env, matchesList));
    if (url.pathname === "/api/vdp")                                      return sec(await vdpOne(request, env));
    if (url.pathname === "/api/slots")                                    return sec(await openSlots(request, env));
    if (url.pathname === "/api/comments/vote" && request.method === "POST") return sec(await withUser(request, env, voteComment));
    if (url.pathname === "/api/softpull" && request.method === "POST")     return sec(await withUser(request, env, softPull));
    if (url.pathname === "/api/car-chat" && request.method === "POST")    return sec(await withUser(request, env, carChat));
    if (url.pathname === "/api/book" && request.method === "POST")         return sec(await withUser(request, env, book));
    if (url.pathname.startsWith("/pass/"))                                return sec(await passPage(request, env));
    if (url.pathname === "/api/comments")                                 return sec(await comments(request, env));
    if (url.pathname === "/api/me")                                       return sec(await withUser(request, env, me));
    if (url.pathname === "/api/dealer" && request.method === "POST")      return sec(await dealerLead(request, env));
    if (url.pathname === "/api/logout" && request.method === "POST")      return sec(logout());
    if (url.pathname === "/api/dealer/console")                           return sec(await withDealer(request, env, dealerConsole));
    if (url.pathname === "/api/dealer/roi")                               return sec(await withDealer(request, env, dealerRoi));
    if (url.pathname === "/api/dealer/listing" && request.method === "POST") return sec(await withDealer(request, env, dealerListing));
    if (url.pathname === "/api/dealer/checkin" && request.method === "POST") return sec(await withDealer(request, env, dealerCheckin));
    if (url.pathname === "/api/admin/stats")                              return sec(await adminOnly(request, env, adminStats));
    if (url.pathname === "/api/admin/dealer/activate" && request.method === "POST") return sec(await adminOnly(request, env, dealerActivate));
    if (url.pathname === "/api/admin/reindex" && request.method === "POST") return sec(await adminOnly(request, env, reindexAll));
    if (url.pathname === "/api/admin/profiles/ingest" && request.method === "POST") return sec(await adminOnly(request, env, profilesIngest));
    if (url.pathname === "/api/admin/export")                             return sec(await adminOnly(request, env, poolExport));
    if (url.pathname === "/api/whoami")                                   return sec(await withUser(request, env, whoami));
    if (url.pathname === "/api/chats/recent")                             return sec(await withUser(request, env, recentChat));
    if (url.pathname === "/api/chats")                                    return sec(await withUser(request, env, chatList));
    if (url.pathname === "/api/chats/clear" && request.method === "POST")  return sec(await withUser(request, env, chatClear));
    if (url.pathname === "/api/dealer/chat")                              return sec(await withDealer(request, env, dealerChat));
    if (url.pathname === "/api/ai/pulse")                                 return sec(await aiPulse(env));
    if (url.pathname === "/api/events" && request.method === "POST")      return sec(await postEvents(request, env));
    if (url.pathname === "/api/admin/events/tail")                        return sec(await adminOnly(request, env, eventsTail));
    if (url.pathname === "/api/admin/growth")                             return sec(await adminOnly(request, env, adminGrowth));
    let assetRes = await env.ASSETS.fetch(request);
    { const h = new Headers(assetRes.headers);
      if (["app","dealer","admin","ai"].includes(url.hostname.split(".")[0])) h.set("X-Robots-Tag", "noindex, nofollow");
      const ct=h.get("content-type")||"";
      // HTML + JS always revalidate — stale app shells were serving old code for days. Images/fonts stay cached.
      if (ct.includes("text/html")||ct.includes("javascript")) h.set("Cache-Control","no-cache, must-revalidate");
      assetRes = new Response(assetRes.body, { status: assetRes.status, headers: h });
    }
    return sec(assetRes);
  },
  async scheduled(event, env) {
    await runQueue(env);
    await syncEmbeddings(env);
    await residentAgent(env).catch(()=>{});   // L9: one labeled community post per ≤2h
    // Refresh persisted backend matches for all buyers with a profile (demo-scale; bounded to 50/run).
    try{ const us=await env.DB.prepare("SELECT user_id FROM profiles ORDER BY updated_at DESC LIMIT 50").all();
      for(const r of (us.results||[])){ await computeSignals(env, r.user_id).catch(()=>{}); await computeMatches(env, r.user_id).catch(()=>{}); } }catch(_){}
    await enrichInventory(env).catch(()=>{});   // Wave E1: inventory intelligence, 3 vehicles/run
    await growthRollup(env).catch(()=>{});      // Wave E4: funnel snapshot, ≤1/day
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
  return (await hmac(env,uid+"."+exp))===sig ? +uid : null; }
async function withUser(request,env,fn){ const uid=await readSession(env,request); if(!uid) return json({ok:false,error:"auth"},401); return fn(request,env,uid); }
async function adminOnly(request,env,fn){ if(!env.ADMIN_KEY||request.headers.get("x-admin-key")!==env.ADMIN_KEY) return json({ok:false,error:"forbidden"},403); return fn(request,env); }

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
async function authStart(request,env){ let {phone}=await request.json().catch(()=>({}));
  phone=String(phone||"").replace(/\D/g,""); if(phone.length===11&&phone[0]==="1")phone=phone.slice(1);
  if(!/^[2-9]\d{9}$/.test(phone)) return json({ok:false,error:"invalid_phone"},422); phone="+1"+phone;
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
async function saveProfile(request,env,uid){ const {answers}=await request.json().catch(()=>({}));
  if(!answers||typeof answers!=="object") return json({ok:false,error:"bad_request"},400);
  await env.DB.prepare("INSERT INTO profiles (user_id,answers,embedding_synced,updated_at) VALUES (?,?,0,?) "+
    "ON CONFLICT(user_id) DO UPDATE SET answers=excluded.answers, embedding_synced=0, updated_at=excluded.updated_at")
    .bind(uid,JSON.stringify(answers),new Date().toISOString()).run();
  if(answers.full_name) await env.DB.prepare("UPDATE users SET handle=? WHERE id=?").bind(String(answers.full_name).slice(0,60),uid).run();
  await env.DB.prepare("UPDATE profiles SET zip=?, max_monthly=?, fico=?, body_pref=?, timeline=? WHERE user_id=?")
    .bind(String(answers.zip||"").slice(0,10), parseInt(answers.max_monthly,10)||null, String(answers.fico||"").slice(0,12),
          String(answers.body_pref||"").slice(0,12), String(answers.timeline||"").slice(0,16), uid).run().catch(()=>{});
  await computeSignals(env,uid).catch(()=>{});   // Wave G: refresh behavioral twin before ranking
  await computeMatches(env,uid).catch(()=>{});   // refresh persisted backend matches on every profile save
  return json({ok:true}); }
async function vdpIngest(request,env){ const cars=await request.json().catch(()=>null);
  if(!Array.isArray(cars)) return json({ok:false,error:"bad_request"},400);
  for(const c of cars) await env.DB.prepare(
    "INSERT INTO vdps (vin,year,make,model,trim,price_mo,miles,drivetrain,body,features,description,photos,price_total,mileage,location_zip,active,embedding_synced,updated_at) "+
    "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,0,?) ON CONFLICT(vin) DO UPDATE SET price_mo=excluded.price_mo, miles=excluded.miles, price_total=excluded.price_total, mileage=excluded.mileage, location_zip=excluded.location_zip, active=1, embedding_synced=0, updated_at=excluded.updated_at")
    .bind(c.vin,c.year,c.make,c.model,c.trim||"",c.price_mo,c.miles||"",c.drivetrain||"",c.body||"",
      JSON.stringify(c.features||[]),c.description||"",JSON.stringify(c.photos||[]),
      parseInt(c.price_total,10)||null, parseInt(String(c.mileage||c.miles||"").replace(/\D/g,""),10)||null, String(c.location_zip||"").slice(0,10),
      new Date().toISOString()).run();
  return json({ok:true,count:cars.length}); }
const BUYER_COLS=["phone","full_name","zip","buy_method","max_down","max_monthly","fico","income","dream_car","reason","hobbies","current_year","current_make","current_model","current_miles","trade_in","trade_value","timeline","body_pref","must_haves"];
async function profilesIngest(request,env){ const rows=await request.json().catch(()=>null);
  if(!Array.isArray(rows)) return json({ok:false,error:"expected array"},400);
  let n=0;
  for(const r of rows.slice(0,500)){ let phone=String(r.phone||"").trim().replace(/^'/,""); if(!/^\+1\d{10}$/.test(phone)) continue;
    await env.DB.prepare("INSERT INTO users (phone,sid,created_at) VALUES (?,?,?) ON CONFLICT(phone) DO NOTHING")
      .bind(phone,genCode("CID"),new Date().toISOString()).run();
    const u=await env.DB.prepare("SELECT id FROM users WHERE phone=?").bind(phone).first(); if(!u) continue;
    const a={}; for(const k of BUYER_COLS.slice(1)) if(r[k]!=null&&r[k]!=="") a[k]=(k==="hobbies"||k==="must_haves")?String(r[k]).split("|").map(s=>s.trim()).filter(Boolean):String(r[k]);
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
    for(const r of (rows.results||[])){ let a={}; try{a=JSON.parse(r.answers)||{}}catch(_){}
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
function vdpText(v){ return `${v.year} ${v.make} ${v.model} ${v.trim}. ${v.body}, ${v.drivetrain}, ${v.miles} miles, $${v.price_mo}/mo. Features: ${JSON.parse(v.features||"[]").join(", ")}. ${v.description}`; }
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
  for(const p of (ps.results||[])){ try{ let a={}; try{a=JSON.parse(p.answers)||{}}catch(_){}
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
    for(const p of ps.results){ try{ let a={}; try{a=JSON.parse(p.answers)||{}}catch(_){}
        await env.MATCH_INDEX.upsert([{id:"profile:"+p.user_id,values:await embed(env,profileText(a)),metadata:{kind:"profile"}}]); }catch(_){}
      await env.DB.prepare("UPDATE profiles SET embedding_synced=1 WHERE user_id=?").bind(p.user_id).run().catch(()=>{}); } }  // best-effort; feed re-embeds profiles live anyway
  return json({ok:true,indexed:n}); }
function carDist(id){ return (((id*37)%128)/10 + 1.6).toFixed(1); }
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
function aprFor(fico){ return APR_FICO[fico]!=null?APR_FICO[fico]:12.0; }
function monthlyFor(price,down,aprPct,term){ term=term||72; const P=Math.max(0,(+price||0)-(+down||0)), r=(+aprPct||0)/1200;
  return r? Math.round(P*r*Math.pow(1+r,term)/(Math.pow(1+r,term)-1)) : Math.round(P/term); }
function feedCar(v,score,ans,lang,mo){ return {id:v.id,year:v.year,make:v.make,model:v.model,trim:v.trim,
  price_mo:(mo!=null?mo:v.price_mo),price:v.price||null,miles:v.miles,
  drivetrain:v.drivetrain,body:v.body,features:JSON.parse(v.features||"[]"),photos:JSON.parse(v.photos||"[]"),
  match:score,why:carWhy(v,ans,lang),dist:carDist(v.id),persona:carPersona(v,lang)}; }
// TASK-001: no-auth affordability search. Accepts the numbers as params (feed() only reads a stored profile).
async function search(request,env){ try{
  const u=new URL(request.url); const lang=u.searchParams.get("lang");
  const monthly=parseInt(u.searchParams.get("monthly"),10)||0;
  const down=parseInt(u.searchParams.get("down"),10)||0;
  const zip=String(u.searchParams.get("zip")||"").slice(0,10);
  const apr=aprFor("670-739");                       // neutral default band for anon (no FICO on file)
  const all=await env.DB.prepare("SELECT * FROM vdps WHERE active=1 ORDER BY updated_at DESC LIMIT 200").all().catch(()=>({results:[]}));
  const out=[];
  for(const v of (all.results||[])){
    if(!v.price){ continue; }                        // never fabricate a price — skip unpriced
    const mo=monthlyFor(v.price,down,apr,72);
    if(monthly && mo>monthly) continue;              // strict: over their number is out
    out.push({...feedCar(v,null,{},lang,mo)});
  }
  out.sort((a,b)=>(a.price_mo||0)-(b.price_mo||0));   // cheapest-first (best headroom)
  const anon=readAnon(request);
  await logEvent(env,{anon_id:anon,action:"intent.opened_calculator",source:"calculator",location:zip||null});
  return json({ok:true,count:out.length,cars:out.slice(0,24)});
  }catch(e){ return json({ok:true,cars:[],degraded:true}); } }
async function feed(request,env){ try{ const uid=await readSession(env,request);
  const lang=new URL(request.url).searchParams.get("lang");
  let ranked=[], ans={}; const seen=new Set();
  if(uid){ const p=await env.DB.prepare("SELECT answers FROM profiles WHERE user_id=?").bind(uid).first();
    if(p){ try{ ans=JSON.parse(p.answers)||{}; }catch(_){}
      const q=await env.MATCH_INDEX.query(await embed(env,profileText(ans)),{topK:50,filter:{kind:"vdp"}}).catch(()=>null);
      if(q){ for(const m of q.matches){ const id=m.metadata.vdpId; if(id!=null&&!seen.has(id)){ seen.add(id); ranked.push({id,vec:m.score}); } } } } }
  // Always union in the live active inventory so real cars show even when the vector index is stale
  // (e.g. right after an inventory swap, before re-embedding catches up). Vector hits keep their rank; the rest append.
  { const all=await env.DB.prepare("SELECT id FROM vdps WHERE active=1 ORDER BY updated_at DESC LIMIT 100").all();
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
  let ans={}; try{ ans=JSON.parse(p.answers)||{}; }catch(_){}
  const budget=parseInt(ans.max_monthly,10)||0, apr=aprFor(ans.fico);
  const sigRow=await env.DB.prepare("SELECT signals FROM buyer_signals WHERE user_id=?").bind(uid).first().catch(()=>null);
  let sig={}; if(sigRow){ try{ sig=JSON.parse(sigRow.signals)||{}; }catch(_){} }
  // Rank: Vectorize hits (kept) unioned with live active inventory (so real cars rank even before re-embed).
  let ranked=[]; const seen=new Set();
  const q=await env.MATCH_INDEX.query(await embed(env,profileText(ans,sig)),{topK:50,filter:{kind:"vdp"}}).catch(()=>null);
  if(q){ for(const m of q.matches){ const id=m.metadata.vdpId; if(id!=null&&!seen.has(id)){ seen.add(id); ranked.push({id,vec:m.score}); } } }
  { const all=await env.DB.prepare("SELECT id FROM vdps WHERE active=1 ORDER BY updated_at DESC LIMIT 100").all();
    for(const r of (all.results||[])){ if(!seen.has(r.id)){ seen.add(r.id); ranked.push({id:r.id,vec:null}); } } }
  const prio=new Set(); { const pr=await env.DB.prepare("SELECT id FROM dealer_leads WHERE tier='priority'").all().catch(()=>({results:[]})); for(const r of (pr.results||[])) prio.add(r.id); }  // K3: paid-placement dealers
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
    const match=Math.max(0,Math.min(99,Math.round((0.6*base+0.4*(0.5*bodyFit+0.3*priceFit+0.2*savedBoost)+sponsorBoost)*100)));
    scored.push({v,score:match}); }
  scored.sort((a,b)=>b.score-a.score);
  const top=scored.slice(0,40);
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
    "SELECT m.vdp_id,m.score,m.created_at,m.ranked_at,m.status,v.id,v.year,v.make,v.model,v.trim,v.price,v.price_mo,v.miles,v.drivetrain,v.body,v.features,v.photos "+
    "FROM matches m JOIN vdps v ON v.id=m.vdp_id WHERE m.user_id=? AND v.active=1 AND m.status!='dismissed' "+
    "ORDER BY COALESCE(m.ranked_at,m.created_at) DESC, m.score DESC LIMIT 40").bind(uid).all();
  const lang=new URL(request.url).searchParams.get("lang");
  const p=await env.DB.prepare("SELECT answers FROM profiles WHERE user_id=?").bind(uid).first();
  let ans={}; if(p){ try{ans=JSON.parse(p.answers)||{};}catch(_){} }
  const apr=aprFor(ans.fico);
  const sigRow=await env.DB.prepare("SELECT signals FROM buyer_signals WHERE user_id=?").bind(uid).first().catch(()=>null);
  let sig={}; if(sigRow){ try{ sig=JSON.parse(sigRow.signals)||{}; }catch(_){} }
  const es=lang==="es";
  const cars=(rows.results||[]).map(v=>{ const mo=v.price? monthlyFor(v.price,ans.max_down,apr,72) : v.price_mo;
    const sigwhy=[];
    if(sig.top_body && String(v.body||"").toLowerCase()===sig.top_body) sigwhy.push(es?"Tu carrocería favorita":"Your go-to body style");
    if(sig.click_price_lo!=null && mo!=null && mo>=sig.click_price_lo && mo<=sig.click_price_hi) sigwhy.push(es?"En tu rango de precio":"In your click range");
    if((sig.saved||[]).includes(v.id)) sigwhy.push(es?"Sigues volviendo a este":"You keep coming back to this");
    return {...feedCar(v,v.score,ans,lang,mo),created_at:v.created_at,status:v.status,sigwhy}; });
  return json({ok:true,authed:true,cars}); }
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
  if(uid){ const p=await env.DB.prepare("SELECT answers FROM profiles WHERE user_id=?").bind(uid).first(); if(p){ try{a=JSON.parse(p.answers)||{};}catch(_){} } }
  const mo=v.price? monthlyFor(v.price,a.max_down,aprFor(a.fico),72) : v.price_mo;
  const er=await env.DB.prepare("SELECT summary,pros,cons,ideal_buyer,financing_context FROM vdp_enrichment WHERE vdp_id=?").bind(v.id).first().catch(()=>null);
  const enrich=er?{summary:er.summary,pros:JSON.parse(er.pros||"[]"),cons:JSON.parse(er.cons||"[]"),ideal_buyer:er.ideal_buyer,financing_context:er.financing_context}:null;
  return json({ok:true,car:{id:v.id,year:v.year,make:v.make,model:v.model,trim:v.trim,price_mo:mo,price:v.price||null,miles:v.miles,
    drivetrain:v.drivetrain,body:v.body,features:JSON.parse(v.features||"[]"),photos:JSON.parse(v.photos||"[]"),description:v.description,
    match:null,dist:carDist(v.id),dealer:await dealerName(env,v.dealer_id),persona:carPersona(v,lang),enrich}}); }
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
  return json({ok:true,pass:"/pass/"+tok,center:center,slot:slot}); }
async function carChat(request,env,uid){ const {vdpId,messages,lang}=await request.json().catch(()=>({})); const ES=lang==="es";
  const v=await env.DB.prepare("SELECT * FROM vdps WHERE id=?").bind(vdpId).first();
  if(!v) return json({ok:false,error:"not_found"},404);
  const p=await env.DB.prepare("SELECT answers FROM profiles WHERE user_id=?").bind(uid).first();
  let a={}; try{ a=p?JSON.parse(p.answers||"{}"):{}; }catch(_){} const missing=["max_monthly","buy_method","fico","dream_car"].filter(k=>!a[k]);
  const center=await dealerName(env,v.dealer_id);
  const dream=(a.dream_car||"").trim();
  const P=carPersona(v,lang);
  const turns=(messages||[]).filter(m=>m.role==="assistant").length;   // how many times I've already spoken
  const today=new Date().toISOString().slice(0,10);
  // One active test drive per buyer, ANY car — a new booking moves the existing one (never stacks).
  // Future-only: a past/stale confirmed drive must never surface as a phantom "you already have a drive booked".
  const existing=await env.DB.prepare("SELECT id,slot,vdp_id FROM test_drives WHERE user_id=? AND status='confirmed' AND slot>=? ORDER BY id DESC LIMIT 1").bind(uid,laNow()).first();
  const existingCar=existing&&existing.vdp_id!==vdpId?await env.DB.prepare("SELECT year,make,model,dealer_id FROM vdps WHERE id=?").bind(existing.vdp_id).first():null;
  const apr=aprFor(a.fico), mo=v.price? monthlyFor(v.price,a.max_down,apr,72) : v.price_mo;   // buyer's real numbers for this car
  const truth=vdpText(v).replace("$"+v.price_mo+"/mo","$"+mo+"/mo est ("+(a.max_down?("$"+Number(a.max_down).toLocaleString()+" down"):"$0 down")+", 72mo)");   // quote the BUYER's monthly, never the raw stored one
  const hasSoft=!!a.softpull;
  const openSlotVals=await dealerSlotsFor(env, v.dealer_id, 12);
  const inPref=(s,pref)=>{ const hh=+String(s).slice(11,13), d=new Date(String(s).slice(0,10)+"T12:00").getDay();
    if(pref==="weekends") return d===0||d===6; if(pref==="mornings") return hh>=9&&hh<12;
    if(pref==="afternoons") return hh>=12&&hh<16; if(pref==="after_work") return hh>=16&&hh<19; return true; };
  const prefSlots=a.td_pref?openSlotVals.filter(s=>inPref(s,a.td_pref)):openSlotVals;
  const offerSlots=(prefSlots.length?prefSlots:openSlotVals).slice(0,3);   // preference ∩ availability, top 3
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
  const sys={role:"system",content:`You ARE the ${v.year} ${v.make} ${v.model} ${v.trim}, speaking in first person to a real buyer. Your ONE job: get them to a scheduled test drive — warmly, specifically, without pressure or sleaze. Think of confidently asking someone on a date: you have about 5 exchanges before they drift, so move with intent and don't waste turns. This is my reply #${turns+1} of ~5.
MY VOICE: ${P.trait}. Personality colors how I talk but NEVER overrides the accuracy gate.
${ES?"LANGUAGE: reply ONLY in neutral Latin-American Spanish; keep every number/spec/price EXACTLY as in my truth core.\n":""}MY TRUTH CORE — the only facts I may state about myself: ${truth}. My home: ${center} (LA Car Guy), 424-398-8611. My monthly for THIS buyer is $${mo}/mo — quote ONLY this number, never any other.
ACCURACY GATE: never state a spec, number, price, or APR that isn't in my truth core. If I don't have it, I say it'll be confirmed at the dealer and keep steering toward the drive — I do NOT stall on it.
NEVER fake a close: I do NOT say "see you [day]" or imply a booking until the buyer has picked a specific offered time AND I've emitted <BOOK>. Before offering times I take 1-2 turns to learn what they need and answer their questions warmly.
FORBIDDEN: I NEVER say "let me escalate to a representative" or hand off to a human; I never invent a downside; I never manufacture urgency or scarcity. There are no buttons — everything happens right here in chat.
HOW I CLOSE — talk like a real person texting a friend, ONE step per reply. Use real openings only; NEVER invent a time. Do NOT name the dealer up front — mention who they'll meet only at the very end.
 STEP 1 (they want to schedule): offer the openings warmly${prefLabel?`, matched to their ${prefLabel} preference`:""}, and ALSO emit the machine tag <SLOTS>${JSON.stringify(offerSlots)}</SLOTS> right after so the app can show tappable buttons. e.g. "Love it. ${prefLabel?`Going off your ${prefLabel}, `:""}I've got ${slotList} open this week — which works? <SLOTS>${JSON.stringify(offerSlots)}</SLOTS>" Do NOT book yet. Only offer times in OPEN SLOTS.
 STEP 2 (they pick one): confirm it back ONCE, casual and human — "[Day] at [time] it is. Anything else you want to know before I lock it in?" (no "pencil us in", no "desk marathon" script). If their time isn't open, offer the nearest ones that are.
 STEP 3 (they say yes / nothing else): emit the booking and ONE genuine line that FINALLY names the rep — "Done — you're set with ${dealerRep} at ${center}. Pass is ready, I'll be up front. 🏁"
OPEN SLOTS (real availability, already filtered to their preference): ${slotList}
BOOK: today is ${today}. In STEP 3 only, emit exactly one <BOOK>{"center":"${center}","slot":"YYYY-MM-DD HH:MM"}</BOOK> using the EXACT slot they picked from OPEN SLOTS (24-hour). NEVER emit it before they've picked a specific offered slot AND said yes. NEVER offer or book a time not in OPEN SLOTS.
${existing&&!existingCar?`RESCHEDULING: they already have ME booked for ${existing.slot}. If they want to change it, warmly re-offer slots and confirm the NEW time; the <BOOK> replaces the old one automatically.`:""}${existingCar?`HEADS UP: they already have the ${existingCar.year} ${existingCar.make} ${existingCar.model} booked for ${existing.slot}. A buyer can only hold ONE test drive at a time. If they want to drive me instead, I say so plainly ("You've got the ${existingCar.make} ${existingCar.model} booked for ${fmtSlotLabel(existing.slot)} — want to switch that to me?") and only book once they confirm; booking me cancels that one.`:""}
SOFT CHECK: ${hasSoft?`they've already run their soft check — their real rate is set, don't offer it again.`:`when they show buying intent (before I push scheduling), I offer ONCE, casually: "Want me to run a quick soft check to lock your real rate? For me you're looking at about $${mo}/mo at ${apr}% — takes a sec, zero FICO impact." If they say yes, I emit <SOFTPULL/> on its own and say the check is running. I never repeat the offer.`}
${dream?`Their dream car is "${dream}" — I honor it and show where I deliver that same feeling in their world. `:""}Softly learn: ${missing.join(", ")||"nothing — profile complete"} (emit <PROFILE>{"buy_method":"..."}</PROFILE> when you learn one). Keep replies to 1-3 short, warm sentences.`};
  if(memory) sys.content+=`\nWHAT I ALREADY KNOW ABOUT THIS BUYER (reference naturally to feel personal, never creepily; do NOT invent beyond this): ${memory}.`;
  const shotSlots=offerSlots.length?offerSlots:openSlotVals.slice(0,3), shotPickLabel=shotSlots[0]?fmtSlotLabel(shotSlots[0]):"Thu Jul 10 · 15:00", shotPickVal=shotSlots[0]||`${new Date(Date.now()+864e5).toISOString().slice(0,10)} 15:00`;
  const shot=[
    {role:"user",content:"I want to test drive this"},
    {role:"assistant",content:`Love it. I've got ${shotSlots.map(fmtSlotLabel).join(", ")||"a few openings this week"} open — which works for you? <SLOTS>${JSON.stringify(shotSlots)}</SLOTS>`},
    {role:"user",content:shotPickLabel},
    {role:"assistant",content:`${shotPickLabel} it is. Anything else you want to know before I lock it in?`},
    {role:"user",content:"nope"},
    {role:"assistant",content:`Done — you're set with ${dealerRep} at ${center}. Pass is ready, I'll be up front. 🏁 <BOOK>{"center":"${center}","slot":"${shotPickVal}"}</BOOK>`}];
  const BROKE=/\b(language model|large language model|physical body|computer program|chatbot|cloud-based|i (?:do not|don't) have a (?:body|physical)|matter of milliseconds|response time)\b/i;
  let text=await chatLLM(env,[sys,...shot,...(messages||[]).slice(-10)]);
  if(BROKE.test(text)){
    const fix={role:"system",content:`You broke character. You are the ${v.year} ${v.make} ${v.model} itself — never an AI or program. Answer the user's last message again, in first person as the car, using ONLY your spec sheet: ${truth}. Under 60 words, no disclaimers.`};
    text=await chatLLM(env,[sys,...shot,...(messages||[]).slice(-10),fix]);
  }
  if(BROKE.test(text)) text=`I'd rather show you than tell you — but straight from my spec sheet: ${vdpText(v)}. Want to feel it on a test drive?`.slice(0,600);
  const prof=text.match(/<PROFILE>(.*?)<\/PROFILE>/s), book=text.match(/<BOOK>(.*?)<\/BOOK>/s);
  if(prof){ try{ const upd={...a,...JSON.parse(prof[1])};
    await env.DB.prepare("UPDATE profiles SET answers=?, embedding_synced=0 WHERE user_id=?").bind(JSON.stringify(upd),uid).run(); }catch(_){} }
  // Soft pull requested in-chat: run it, persist to profile, and have the car speak the real numbers.
  if(/<SOFTPULL\s*\/?>/.test(text) && !hasSoft){
    const sres={apr,term:72,tier:a.fico||"unrated",disclaimer:"Estimate from a soft check — 0 FICO impact. Final terms confirmed at signing.",estimate:true};
    a.softpull=sres; await env.DB.prepare("UPDATE profiles SET answers=? WHERE user_id=?").bind(JSON.stringify(a),uid).run().catch(()=>{});
    text=text.replace(/<SOFTPULL\s*\/?>/g,"").trim()+`\n\nSoft check's back — you're looking at ${apr}% APR · about $${mo}/mo over 72 months. 0 FICO impact. Want to come drive me?`;
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
      } else {
    if(existing){ await env.DB.prepare("UPDATE test_drives SET vdp_id=?, center=?, slot=?, status='confirmed', pass_token=?, created_at=? WHERE id=?")   // move the single active drive (may switch cars)
      .bind(vdpId,b.center,b.slot,tok,new Date().toISOString(),existing.id).run();
      const oldDealer=existingCar?existingCar.dealer_id:v.dealer_id;                                    // free the OLD car's slot on the OLD car's dealer
      if(oldDealer) await env.DB.prepare("UPDATE dealer_slots SET taken=0 WHERE dealer_id=? AND starts_at=?").bind(oldDealer,existing.slot).run().catch(()=>{}); }
    else await env.DB.prepare("INSERT INTO test_drives (user_id,vdp_id,center,slot,status,pass_token,created_at) VALUES (?,?,?,?,?,?,?)")
      .bind(uid,vdpId,b.center,b.slot,"confirmed",tok,new Date().toISOString()).run();
    const u=await env.DB.prepare("SELECT phone,handle FROM users WHERE id=?").bind(uid).first();
    const chatSms=`Your ${v.year} ${v.make} ${v.model} Drive Now pass: carnimbus.com/pass/${tok} — ${b.slot} at ${b.center}. Reply STOP to opt out.`;
    await sendSMS(env,u.phone,chatSms).catch(()=>{});
    await env.DB.prepare("INSERT INTO sms_queue (phone,template,body,send_at,recurring,created_at) VALUES (?,?,?,?,?,?)")
      .bind(u.phone,"drive-confirm",chatSms,new Date(Date.now()+864e5).toISOString(),"none",new Date().toISOString()).run();
    if(v.dealer_id){ const dl=await env.DB.prepare("SELECT name,phone FROM dealer_leads WHERE id=? AND status='active'").bind(v.dealer_id).first();
      if(dl&&dl.phone) await sendSMS(env,dl.phone,`CarNimbus — added to your calendar: ${fmtSlotLabel(b.slot)} with ${(u&&u.handle)||"a buyer"} (•••-${String(u&&u.phone||"").slice(-4)}) for the ${v.year} ${v.make} ${v.model}. Reply here to text them. Console: dealer.carnimbus.com`).catch(()=>{}); }
    pass="/pass/"+tok; } }   // close: claimed-else, slotManaged-else
    }catch(_){} }
  let slots=null; const slotsTag=text.match(/<SLOTS>(.*?)<\/SLOTS>/s);
  if(slotsTag){ try{ slots=JSON.parse(slotsTag[1]).map(s=>({value:s,label:fmtSlotLabel(s)})); }catch(_){} }
  const cleanReply=text.replace(/<PROFILE>.*?<\/PROFILE>/gs,"").replace(/<BOOK>.*?<\/BOOK>/gs,"").replace(/<SOFTPULL\s*\/?>/g,"").replace(/<SLOTS>.*?<\/SLOTS>/gs,"").trim();
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
  const t=await env.DB.prepare("SELECT td.*,v.year,v.make,v.model,v.trim,v.price_mo,v.miles,v.drivetrain,v.body,v.features,v.photos,u.phone,u.sid,p.answers FROM test_drives td JOIN vdps v ON v.id=td.vdp_id JOIN users u ON u.id=td.user_id LEFT JOIN profiles p ON p.user_id=td.user_id WHERE td.pass_token=?").bind(tok).first();
  if(!t) return new Response("Pass not found",{status:404});
  if(new URL(request.url).pathname.endsWith(".ics")) return icsFor(t);
  const isPrint=new URL(request.url).searchParams.get("print")==="1";
  const ES=new URL(request.url).searchParams.get("lang")==="es";
  const T=ES?{pass:"PASE DRIVE NOW · SEMINUEVO CERTIFICADO",when:"Cuándo",status:"Estado",miles:"Millas",drive:"Tracción",numbers:"Tus números · listos antes de llegar",estm:"Est. mensual",down:"Enganche",method:"Método",apr:"TAE est.",credit:"Rango de crédito",income:"Rango de ingreso",disc:"Estimaciones de tu consulta suave — términos finales al firmar. 0 impacto en crédito.",track:"CID · seguimiento",code:"Código de check-in",scan:"Escanea en "+(t.center||"tu concesionario")+" para registrarte.",save:"Guardar / Imprimir PDF",tag:"El superagente de IA para comprar autos"}
    :{pass:"DRIVE NOW PASS · CERTIFIED PRE-OWNED",when:"When",status:"Status",miles:"Miles",drive:"Drivetrain",numbers:"Your numbers · pre-set before you arrive",estm:"Est. monthly",down:"Down payment",method:"Method",apr:"Est. APR",credit:"Credit range",income:"Income range",disc:"Estimates from your soft-pull profile — final terms confirmed at signing. 0 credit impact.",track:"CID · tracking",code:"Check-in code",scan:"Scan at "+(t.center||"your dealership")+" to check in.",save:"Save / Print PDF",tag:"The AI car-buying superagent"};
  const cid=cidFor(t.id), photo=(JSON.parse(t.photos||"[]")[0]||""), feats=JSON.parse(t.features||"[]");
  const safePhoto=(/^\/assets\/[\w/?=.-]*$/.test(photo)&&!photo.includes(".."))?photo:"";   // dealer-controlled → allowlist, no traversal, before CSS url()
  const carTitle=escHtml(t.year+" "+t.make+" "+t.model);
  let a={}; try{ a=JSON.parse(t.answers)||{}; }catch(_){}
  const APR={"800+":"6.4%","740-799":"7.1%","670-739":"9.3%","580-669":"13.5%","under 580":"17.9%"}[a.fico]||null;
  const fin=[
    t.price_mo?[T.estm,"$"+t.price_mo+"/mo"]:null,
    [T.down,a.max_down?("$"+Number(a.max_down).toLocaleString()):"$0"],
    a.buy_method?[T.method,String(a.buy_method).charAt(0).toUpperCase()+String(a.buy_method).slice(1)]:null,
    APR?[T.apr,APR+" · 72 mo"]:null,
    a.fico?[T.credit,"FICO "+a.fico]:null,
    a.income?[T.income,"$"+String(a.income).replace(/k/g,"k").replace("under ","<")]:null
  ].filter(Boolean);
  return new Response(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Drive Now Pass — ${carTitle}</title>
<link rel="stylesheet" href="/assets/fonts/fonts.css"><link rel="stylesheet" href="/assets/styles.css"><script src="/assets/vendor/qrcodegen.js" defer></script><script src="/assets/js/pass-render.js" defer></script>
<style>
*{font-family:Manrope,system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{size:auto;margin:10mm}
@media print{.noprint{display:none!important}body{background:#fff!important;padding:0!important;display:block!important}.pass{box-shadow:none!important;border:1px solid #0a1f4d!important;margin:0 auto;page-break-inside:avoid;border-radius:14px!important}}
body{background:#06163b;color:#e2e9f2;margin:0;padding:20px;display:flex;justify-content:center}
${isPrint?".noprint{display:none!important}body{background:#fff;padding:8px;display:block}.pass{box-shadow:none;border:1.5px solid #0a1f4d;border-radius:14px;margin:0 auto}":""}
.pass{max-width:430px;width:100%;background:#0a1f4d;border:1px solid rgba(24,200,255,.28);border-radius:22px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4)}
.brand{display:flex;align-items:center;gap:9px;padding:13px 20px;background:rgba(6,16,40,.85);border-bottom:1px solid rgba(24,200,255,.18)}
.hero{height:180px;background:#06163b url('${safePhoto}') center/cover}.pd{padding:20px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;font:600 12px Manrope;margin-top:16px}.k{color:#8ca0c4;font:700 9px Manrope;letter-spacing:.08em;text-transform:uppercase}
.fin{border-top:1px solid rgba(24,200,255,.18);margin-top:16px;padding-top:14px}
.stub{border-top:2px dashed rgba(24,200,255,.3);margin-top:18px;padding-top:16px;display:flex;gap:16px;align-items:center}
.mono{font-family:ui-monospace,Menlo,monospace}.cy{color:#18C8FF}</style></head>
<body><div class="pass">
<div class="brand"><img src="/assets/logo.png" alt="" style="width:24px;height:24px"><b style="font:700 14px 'Space Grotesk',Manrope;color:#fff">CarNimbus</b><span class="mono" style="margin-left:auto;font-size:9px;color:#18C8FF;letter-spacing:.18em">DRIVE NOW</span></div>
<div class="hero"></div><div class="pd">
<div class="mono" style="font-size:10px;color:#8ca0c4;letter-spacing:.22em">${T.pass}</div>
<div style="font:800 22px Manrope;color:#fff;margin:5px 0 3px">${carTitle}</div>
<div class="cy" style="font:700 12px Manrope">${escHtml(t.center||"CarNimbus Test Drive Center")} · LA Car Guy · 424-398-8611</div>
<div class="grid">
<div><div class="k">${T.when}</div>${fmtMil(t.slot)}</div><div><div class="k">${T.status}</div><span style="color:#54d699;text-transform:capitalize">${escHtml(t.status)}</span></div>
<div><div class="k">${T.miles}</div>${escHtml(t.miles||"—")}</div><div><div class="k">${T.drive}</div>${escHtml(t.drivetrain||"—")}</div>
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
  if(mint) h["Set-Cookie"]=`cn_anon=${anon}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`;
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
async function dealerCheckin(request,env,uid,dealer){
  const {driveId,token,status,sale_price}=await request.json().catch(()=>({}));
  if(["confirmed","arrived","sold"].indexOf(status)<0) return json({ok:false,error:"bad_request"},400);
  let id=+driveId||0;
  if(!id&&token){ const t=String(token).replace(/[^A-Za-z0-9]/g,"");
    const row=t.length>=20?await env.DB.prepare("SELECT id FROM test_drives WHERE pass_token=?").bind(t).first()
      :await env.DB.prepare("SELECT id FROM test_drives WHERE pass_token LIKE ? ORDER BY id DESC LIMIT 1").bind(t.slice(0,6)+"%").first();
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
async function chatClear(request,env,uid){ const {vdpId}=await request.json().catch(()=>({}));
  if(!vdpId) return json({ok:false,error:"bad_request"},400);
  await env.DB.prepare("DELETE FROM chats WHERE user_id=? AND vdp_id=?").bind(uid,vdpId).run();
  return json({ok:true}); }
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
  const v=await env.DB.prepare("SELECT COUNT(*) c FROM vdps WHERE active=1").first();
  const u=await env.DB.prepare("SELECT COUNT(*) c FROM users").first();
  const t=await env.DB.prepare("SELECT COUNT(*) c FROM test_drives").first();
  const e=await env.DB.prepare("SELECT COUNT(*) c FROM vdps WHERE embedding_synced=1").first();
  const ch=await env.DB.prepare("SELECT COUNT(*) c FROM chats").first();
  return json({ok:true,cars:v.c,riders:u.c,drives:t.c,embeddings:e.c,chats:ch.c}); }
async function dealerActivate(request,env){ const {leadId}=await request.json().catch(()=>({}));
  if(!leadId) return json({ok:false,error:"bad_request"},400);
  const no=genCode("CN");
  await env.DB.prepare("UPDATE dealer_leads SET client_no=?, status='active' WHERE id=?").bind(no,+leadId).run();
  return json({ok:true,client_no:no}); }
async function whoami(request,env,uid){
  const u=await env.DB.prepare("SELECT phone FROM users WHERE id=?").bind(uid).first();
  const digits=String(u&&u.phone||"").replace(/\D/g,"").slice(-10);
  const d=digits?await env.DB.prepare("SELECT status,client_no FROM dealer_leads WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone,'-',''),' ',''),'(',''),')','') LIKE ? ORDER BY id DESC LIMIT 1").bind("%"+digits).first():null;
  return json({ok:true,buyer:true,dealer:!!(d&&d.status==="active"&&d.client_no)}); }
async function adminStats(request,env){
  const w=await env.DB.prepare("SELECT COUNT(*) c FROM waitlist").first();
  const u=await env.DB.prepare("SELECT COUNT(*) c FROM users").first();
  const p=await env.DB.prepare("SELECT COUNT(*) c FROM profiles").first();
  const t=await env.DB.prepare("SELECT COUNT(*) c FROM test_drives").first();
  const v=await env.DB.prepare("SELECT COUNT(*) c FROM vdps WHERE active=1").first();
  const dl=await env.DB.prepare("SELECT id,name,dealership,role,phone,email,created_at,client_no,status FROM dealer_leads ORDER BY id DESC LIMIT 50").all();
  const cm=await env.DB.prepare("SELECT COUNT(*) c FROM comments").first();
  return json({ok:true,waitlist:w.c,users:u.c,profiles:p.c,drives:t.c,activeCars:v.c,comments:cm.c,dealerLeads:dl.results||[]});
}
function logout(){ return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json",
  "Set-Cookie":"cn_sess=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"}}); }
// L9: first resident agent — a labeled, bounded community presence. Posts one useful bilingual pick per ≤2h.
async function residentAgent(env){
  const last=await env.DB.prepare("SELECT created_at FROM comments WHERE user_id=0 AND zip='agent' ORDER BY id DESC LIMIT 1").first().catch(()=>null);
  if(last && (Date.now()-Date.parse(last.created_at))<2*3600e3) return;
  const v=await env.DB.prepare("SELECT id,year,make,model,price_mo FROM vdps WHERE active=1 ORDER BY RANDOM() LIMIT 1").first().catch(()=>null);
  if(!v) return;
  const en=`Okay, this ${v.year} ${v.make} ${v.model} caught my eye — right around $${v.price_mo}/mo. Worth a look before it's gone. (Soft check = 0 credit hit.)`;
  const es=`Ojo con este ${v.year} ${v.make} ${v.model} — anda por los $${v.price_mo}/mes. Vale la pena mirarlo antes de que vuele. (Chequeo suave, 0 impacto en tu crédito.)`;
  await env.DB.prepare("INSERT INTO comments (user_id,vdp_id,body,body_es,zip,created_at) VALUES (0,?,?,?, 'agent', ?)")
    .bind(v.id,en,es,new Date().toISOString()).run().catch(()=>{});
  await logEvent(env,{action:"social.posted",vehicle_id:v.id,source:"resident-agent"});
}
// M9: transparent trade-in estimate — residual-floored per-segment depreciation. A running car never hits ~$0,
// and trucks/SUVs/luxury hold value better than sedans. No external API; the basis string explains the math.
const SEG={luxury:{base:55000,rate:0.85,res:0.16}, truck:{base:45000,rate:0.88,res:0.18}, suv:{base:38000,rate:0.87,res:0.15},
  ev:{base:42000,rate:0.82,res:0.12}, sport:{base:48000,rate:0.86,res:0.15}, sedan:{base:28000,rate:0.86,res:0.12}, default:{base:26000,rate:0.86,res:0.12}};
function segOf(mk,md){ mk=(mk||"").toLowerCase(); md=(md||"").toLowerCase();
  if(/lexus|bmw|mercedes|audi|genesis|acura|infiniti|volvo|porsche|cadillac/.test(mk)) return "luxury";
  if(/f-150|silverado|ram|tundra|tacoma|sierra|ranger|frontier/.test(md)) return "truck";
  if(/tesla|ioniq|mach-e|leaf|bolt|ev\b/.test(mk+" "+md)) return "ev";
  if(/tahoe|yukon|suburban|explorer|pilot|highlander|4runner|suv|rav4|cr-v|crv/.test(md)) return "suv";
  return "sedan"; }
function tradeEstimate(a){ if(!a) return null; const yr=parseInt(a.current_year,10), mk=a.current_make, md=a.current_model, mi=parseInt(String(a.current_miles||"").replace(/\D/g,""),10)||0;
  if(!yr||!mk||!md) return null;
  const age=Math.max(0,(new Date().getFullYear())-yr);
  const S=SEG[segOf(mk,md)]||SEG.default, floor=S.base*S.res;
  let v=floor+(S.base-floor)*Math.pow(S.rate,age);        // asymptotes to residual value, not zero
  const expMiles=age*12000, over=mi-expMiles;             // mileage vs. expected
  v-=Math.max(0,over)*0.05;                               // ~$0.05 per excess mile
  v=Math.max(Math.round(floor/100)*100,Math.round(v/100)*100);   // residual floor, round to $100
  return {point:v, low:Math.round(v*0.88/100)*100, high:Math.round(v*1.12/100)*100,
    basis:`${yr} ${mk} ${md}, ~${mi.toLocaleString()} mi: ${md} holds ~${Math.round(S.res*100)}% residual; depreciated ${age} yrs${over>0?`, ${over.toLocaleString()} mi over average`:""}. Estimate — confirmed at appraisal.`}; }
async function me(request,env,uid){
  const u=await env.DB.prepare("SELECT phone,sid,handle FROM users WHERE id=?").bind(uid).first();
  const p=await env.DB.prepare("SELECT answers,avatar FROM profiles WHERE user_id=?").bind(uid).first();
  const td=await env.DB.prepare(
    "SELECT td.center,td.slot,td.status,td.pass_token,td.created_at,v.id vdp_id,v.year,v.make,v.model,v.trim,v.price_mo,v.miles,v.drivetrain,v.photos "+
    "FROM test_drives td JOIN vdps v ON v.id=td.vdp_id WHERE td.user_id=? ORDER BY td.id DESC LIMIT 1").bind(uid).first();
  let ans=p?JSON.parse(p.answers):null;
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
async function dealerLead(request,env){
  const {name,dealership,role,phone,email}=await request.json().catch(()=>({}));
  if(!name||!dealership) return json({ok:false,error:"bad_request"},400);
  await env.DB.prepare("INSERT INTO dealer_leads (name,dealership,role,phone,email,created_at) VALUES (?,?,?,?,?,?)")
    .bind(String(name).slice(0,80),String(dealership).slice(0,120),String(role||"").slice(0,40),
      String(phone||"").slice(0,20),String(email||"").slice(0,120),new Date().toISOString()).run();
  if(env.ADMIN_PHONE) await sendSMS(env,env.ADMIN_PHONE,"New CarNimbus dealer lead: "+String(name).slice(0,40)+" @ "+String(dealership).slice(0,60)+(phone?(" · "+String(phone).slice(0,20)):"")).catch(()=>{});
  return json({ok:true});
}
async function comments(request,env){ const curl=new URL(request.url); const vdpId=+curl.searchParams.get("vdpId")||0;
  if(request.method==="POST"){ const uid=await readSession(env,request); if(!uid) return json({ok:false,error:"auth"},401);
    const {body,zip}=await request.json().catch(()=>({})); if(!body||String(body).length>500) return json({ok:false,error:"bad_request"},400);
    const n=await env.DB.prepare("SELECT COUNT(*) c FROM comments WHERE user_id=? AND created_at>?").bind(uid,new Date(Date.now()-3600e3).toISOString()).first();
    if(n.c>=10) return json({ok:false,error:"rate_limited"},429);
    await env.DB.prepare("INSERT INTO comments (user_id,vdp_id,body,zip,created_at) VALUES (?,?,?,?,?)").bind(uid,vdpId,String(body),String(zip||""),new Date().toISOString()).run();
    // Feed reads human — no auto agent-reply on keyword (removed Wave B). Historical agent posts still render.
    return json({ok:true}); }
  if(vdpId){ const rows=await env.DB.prepare("SELECT body,zip,created_at FROM comments WHERE vdp_id=? ORDER BY id DESC LIMIT 50").bind(vdpId).all();
    return json({ok:true,comments:rows.results||[]}); }
  const lat=parseFloat(curl.searchParams.get("lat")), lng=parseFloat(curl.searchParams.get("lng"));
  const radius=parseFloat(curl.searchParams.get("radius")||"40"); let geo=Number.isFinite(lat)&&Number.isFinite(lng);
  const meUid=await readSession(env,request);                            // optional — to surface the caller's own vote
  const lang=curl.searchParams.get("lang")==="es"?"es":"en";
  const geoCols=geo?"u.lat,u.lng,":"";                                   // only touch lat/lng columns when actually ranking
  let rows=await env.DB.prepare(
    "SELECT c.id,c.body,c.body_es,c.zip,c.created_at,c.vdp_id,c.upvotes,c.downvotes,c.images,c.sponsored,u.handle,"+geoCols+"p.avatar,pv.dir myvote,v.year,v.make,v.model,v.price_mo,v.price,v.photos FROM comments c "+
    "LEFT JOIN users u ON u.id=c.user_id LEFT JOIN profiles p ON p.user_id=c.user_id "+
    "LEFT JOIN post_votes pv ON pv.comment_id=c.id AND pv.user_id=? "+
    "LEFT JOIN vdps v ON v.id=c.vdp_id AND v.active=1 ORDER BY c.sponsored DESC, c.id DESC LIMIT 300").bind(meUid||0).all().catch(async()=>{
      geo=false;                                                          // votes/lat/body_es columns not migrated yet → fall back to recency, no votes
      return env.DB.prepare("SELECT c.id,c.body,c.zip,c.created_at,c.vdp_id,u.handle,p.avatar,v.year,v.make,v.model,v.price_mo,v.photos FROM comments c LEFT JOIN users u ON u.id=c.user_id LEFT JOIN profiles p ON p.user_id=c.user_id LEFT JOIN vdps v ON v.id=c.vdp_id AND v.active=1 ORDER BY c.id DESC LIMIT 300").all(); });
  // Buyer-true monthlies on car chips: compute from the real price + the caller's numbers (anon = honest defaults).
  let mans={}; if(meUid){ const mp=await env.DB.prepare("SELECT answers FROM profiles WHERE user_id=?").bind(meUid).first(); mans=mp?JSON.parse(mp.answers||"{}"):{}; }
  const mapr=aprFor(mans.fico);
  let out=(rows.results||[]).map(r=>({...r,
    body:(lang==="es"&&r.zip==="agent"&&r.body_es)?r.body_es:r.body,      // agent posts speak the buyer's language; rider posts stay as written
    price_mo:r.price?monthlyFor(r.price,meUid?mans.max_down:0,mapr,72):r.price_mo,
    photos:r.photos?JSON.parse(r.photos):[],images:r.images?JSON.parse(r.images):[]}));
  if(geo){ const R=3959, rad=x=>x*Math.PI/180;
    out=out.map(r=>{ if(r.zip==="agent") return {...r,_d:-1};                 // agent/AI posts stay pinned
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
