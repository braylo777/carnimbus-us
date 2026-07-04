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
    let url = new URL(request.url);
    // Subdomain doors: one Worker, path-prefixed surfaces.
    const sub=url.hostname.split(".")[0];
    const PREFIX={app:"/app",dealer:"/dealer",admin:"/admin",ai:"/ai"}[sub];
    if(PREFIX && !url.pathname.startsWith(PREFIX) && !url.pathname.startsWith("/api/") &&
       !url.pathname.startsWith("/assets/") && !url.pathname.startsWith("/pass/") &&
       url.pathname!=="/favicon.ico" && url.pathname!=="/site.webmanifest"){
      url.pathname = PREFIX + (url.pathname==="/" ? (sub==="app"?"/discover.html":"/index.html") : url.pathname);
      request = new Request(url, request);
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
    if (url.pathname === "/api/feed")                                     return sec(await feed(request, env));
    if (url.pathname === "/api/car-chat" && request.method === "POST")    return sec(await withUser(request, env, carChat));
    if (url.pathname.startsWith("/pass/"))                                return sec(await passPage(request, env));
    if (url.pathname === "/api/comments")                                 return sec(await comments(request, env));
    if (url.pathname === "/api/me")                                       return sec(await withUser(request, env, me));
    if (url.pathname === "/api/dealer" && request.method === "POST")      return sec(await dealerLead(request, env));
    if (url.pathname === "/api/logout" && request.method === "POST")      return sec(logout());
    if (url.pathname === "/api/dealer/console")                           return sec(await withDealer(request, env, dealerConsole));
    if (url.pathname === "/api/dealer/listing" && request.method === "POST") return sec(await withDealer(request, env, dealerListing));
    if (url.pathname === "/api/dealer/checkin" && request.method === "POST") return sec(await withDealer(request, env, dealerCheckin));
    if (url.pathname === "/api/admin/stats")                              return sec(await adminOnly(request, env, adminStats));
    if (url.pathname === "/api/admin/dealer/activate" && request.method === "POST") return sec(await adminOnly(request, env, dealerActivate));
    if (url.pathname === "/api/whoami")                                   return sec(await withUser(request, env, whoami));
    if (url.pathname === "/api/chats")                                    return sec(await withUser(request, env, chatList));
    if (url.pathname === "/api/dealer/chat")                              return sec(await withDealer(request, env, dealerChat));
    if (url.pathname === "/api/ai/pulse")                                 return sec(await aiPulse(env));
    return sec(await env.ASSETS.fetch(request));
  },
  async scheduled(event, env) {
    await runQueue(env);
    await syncEmbeddings(env);
  },
};

// ==================== auth/session (HMAC cookie) ====================
async function hmac(env, s){ const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(env.SESSION_SECRET||"dev"),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
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
async function smsInbound(request,env){ const form=await request.formData().catch(()=>null);
  const from=form?String(form.get("From")||""):"", text=form?String(form.get("Body")||"").trim().toUpperCase():"";
  let reply="";
  if(/^(STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT)$/.test(text)){
    await env.DB.prepare("UPDATE waitlist SET sms_consent=0 WHERE phone=?").bind(from).run().catch(()=>{});
    reply="You're unsubscribed from CarNimbus texts. No more messages. Reply START to rejoin."; }
  else if(/^(HELP|INFO)$/.test(text)) reply="CarNimbus: AI car buying, LA. Up to 4 msgs/mo. Msg&data rates may apply. Reply STOP to cancel. hello@carnimbus.com";
  else if(text==="START"){ await env.DB.prepare("UPDATE waitlist SET sms_consent=1 WHERE phone=?").bind(from).run().catch(()=>{}); reply="Welcome back to CarNimbus. Reply STOP anytime."; }
  await env.DB.prepare("INSERT INTO sms_log (phone,direction,body,status,created_at) VALUES (?,?,?,?,?)")
    .bind(from,"in",text,"received",new Date().toISOString()).run().catch(()=>{});
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
async function embed(env,text){ if(env.AI_BACKEND_URL){ const r=await fetch(env.AI_BACKEND_URL+"/embed",{method:"POST",body:JSON.stringify({text})}); return (await r.json()).vector; }
  const r=await env.AI.run("@cf/baai/bge-base-en-v1.5",{text:[text]}); return r.data[0]; }
async function llm(env,messages){ if(env.AI_BACKEND_URL){ const r=await fetch(env.AI_BACKEND_URL+"/chat",{method:"POST",body:JSON.stringify({messages})}); return (await r.json()).text; }
  const r=await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast",{messages,max_tokens:512}); return r.response; }

// ==================== auth + profile + VDP ingest ====================
function genCode(prefix){ const b=new Uint32Array(2); crypto.getRandomValues(b);
  return prefix+"-"+String(b[0]%1000000).padStart(6,"0")+"-"+String(b[1]%10000).padStart(4,"0"); }
async function authStart(request,env){ let {phone}=await request.json().catch(()=>({}));
  phone=String(phone||"").replace(/\D/g,""); if(phone.length===11&&phone[0]==="1")phone=phone.slice(1);
  if(!/^[2-9]\d{9}$/.test(phone)) return json({ok:false,error:"invalid_phone"},422); phone="+1"+phone;
  const code=(""+Math.floor(100000+Math.random()*900000)); const hash=await hmac(env,code+phone);
  await env.DB.prepare("DELETE FROM otp WHERE phone=?").bind(phone).run();
  await env.DB.prepare("INSERT INTO otp (phone,code_hash,expires,tries) VALUES (?,?,?,0)")
    .bind(phone,hash,new Date(Date.now()+600e3).toISOString()).run();
  const s=await sendSMS(env,phone,"CarNimbus code: "+code+". Expires in 10 min.");
  return json({ok:true,dev:(env.DEV_MODE==="1"&&s.dark)?code:undefined}); }
async function authVerify(request,env){ let {phone,code}=await request.json().catch(()=>({}));
  phone=String(phone||"").replace(/\D/g,""); if(phone.length===11&&phone[0]==="1")phone=phone.slice(1); phone="+1"+phone;
  const row=await env.DB.prepare("SELECT * FROM otp WHERE phone=?").bind(phone).first();
  if(!row||row.tries>=3||row.expires<new Date().toISOString()) return json({ok:false,error:"otp_expired"},401);
  if(await hmac(env,String(code)+phone)!==row.code_hash){
    await env.DB.prepare("UPDATE otp SET tries=tries+1 WHERE phone=?").bind(phone).run();
    return json({ok:false,error:"otp_wrong"},401); }
  await env.DB.prepare("INSERT INTO users (phone,created_at) VALUES (?,?) ON CONFLICT(phone) DO NOTHING").bind(phone,new Date().toISOString()).run();
  const u=await env.DB.prepare("SELECT id,sid FROM users WHERE phone=?").bind(phone).first();
  if(!u.sid) await env.DB.prepare("UPDATE users SET sid=? WHERE id=?").bind(genCode("SID"),u.id).run();
  const sess=await makeSession(env,u.id);
  return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json","cache-control":"no-store",
    "Set-Cookie":`cn_sess=${sess}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`}}); }
async function saveProfile(request,env,uid){ const {answers}=await request.json().catch(()=>({}));
  if(!answers||typeof answers!=="object") return json({ok:false,error:"bad_request"},400);
  await env.DB.prepare("INSERT INTO profiles (user_id,answers,embedding_synced,updated_at) VALUES (?,?,0,?) "+
    "ON CONFLICT(user_id) DO UPDATE SET answers=excluded.answers, embedding_synced=0, updated_at=excluded.updated_at")
    .bind(uid,JSON.stringify(answers),new Date().toISOString()).run();
  return json({ok:true}); }
async function vdpIngest(request,env){ const cars=await request.json().catch(()=>null);
  if(!Array.isArray(cars)) return json({ok:false,error:"bad_request"},400);
  for(const c of cars) await env.DB.prepare(
    "INSERT INTO vdps (vin,year,make,model,trim,price_mo,miles,drivetrain,body,features,description,photos,active,embedding_synced,updated_at) "+
    "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,0,?) ON CONFLICT(vin) DO UPDATE SET price_mo=excluded.price_mo, miles=excluded.miles, active=1, embedding_synced=0, updated_at=excluded.updated_at")
    .bind(c.vin,c.year,c.make,c.model,c.trim||"",c.price_mo,c.miles||"",c.drivetrain||"",c.body||"",
      JSON.stringify(c.features||[]),c.description||"",JSON.stringify(c.photos||[]),new Date().toISOString()).run();
  return json({ok:true,count:cars.length}); }

// ==================== matcher + feed + chat + pass + comments ====================
function vdpText(v){ return `${v.year} ${v.make} ${v.model} ${v.trim}. ${v.body}, ${v.drivetrain}, ${v.miles} miles, $${v.price_mo}/mo. Features: ${JSON.parse(v.features||"[]").join(", ")}. ${v.description}`; }
function profileText(a){ return `Budget $${a.q1}/mo. Wants ${a.q2}, ${a.q3}. Drives ${a.q4} daily. Needs ${a.q5} seats. Priority: ${a.q6}. Trade-in: ${a.q7}. Timeline: ${a.q8}. Credit: ${a.q9}. Dream car: ${a.q10}`; }
async function syncEmbeddings(env){
  const vs=await env.DB.prepare("SELECT * FROM vdps WHERE embedding_synced=0 LIMIT 10").all().catch(()=>({results:[]}));
  for(const v of (vs.results||[])){ await env.MATCH_INDEX.upsert([{id:"vdp:"+v.id,values:await embed(env,vdpText(v)),metadata:{kind:"vdp",vdpId:v.id}}]);
    await env.DB.prepare("UPDATE vdps SET embedding_synced=1 WHERE id=?").bind(v.id).run(); }
  const ps=await env.DB.prepare("SELECT * FROM profiles WHERE embedding_synced=0 LIMIT 10").all().catch(()=>({results:[]}));
  for(const p of (ps.results||[])){ await env.MATCH_INDEX.upsert([{id:"profile:"+p.user_id,values:await embed(env,profileText(JSON.parse(p.answers))),metadata:{kind:"profile"}}]);
    await env.DB.prepare("UPDATE profiles SET embedding_synced=1 WHERE user_id=?").bind(p.user_id).run(); } }
async function feed(request,env){ try{ const uid=await readSession(env,request);
  let ranked=null;
  if(uid){ const p=await env.DB.prepare("SELECT answers FROM profiles WHERE user_id=?").bind(uid).first();
    if(p){ const q=await env.MATCH_INDEX.query(await embed(env,profileText(JSON.parse(p.answers))),{topK:20,filter:{kind:"vdp"}}).catch(()=>null);
      if(q) ranked=q.matches.map(m=>({id:m.metadata.vdpId,score:Math.round(m.score*100)})); } }
  if(!ranked){ const all=await env.DB.prepare("SELECT id FROM vdps WHERE active=1 ORDER BY updated_at DESC LIMIT 20").all();
    ranked=(all.results||[]).map(r=>({id:r.id,score:null})); }
  const out=[]; for(const r of ranked){ const v=await env.DB.prepare("SELECT * FROM vdps WHERE id=? AND active=1").bind(r.id).first();
    if(v) out.push({id:v.id,year:v.year,make:v.make,model:v.model,trim:v.trim,price_mo:v.price_mo,miles:v.miles,
      drivetrain:v.drivetrain,body:v.body,features:JSON.parse(v.features||"[]"),photos:JSON.parse(v.photos||"[]"),match:r.score}); }
  return json({ok:true,authed:!!uid,cars:out});
  }catch(e){ const f=await env.DB.prepare("SELECT * FROM vdps WHERE active=1 ORDER BY updated_at DESC LIMIT 20").all().catch(()=>({results:[]}));
    return json({ok:true,authed:false,degraded:true,cars:(f.results||[]).map(v=>({id:v.id,year:v.year,make:v.make,model:v.model,trim:v.trim,price_mo:v.price_mo,miles:v.miles,drivetrain:v.drivetrain,body:v.body,features:JSON.parse(v.features||"[]"),photos:JSON.parse(v.photos||"[]"),match:null}))}); } }
async function carChat(request,env,uid){ const {vdpId,messages}=await request.json().catch(()=>({}));
  const v=await env.DB.prepare("SELECT * FROM vdps WHERE id=?").bind(vdpId).first();
  if(!v) return json({ok:false,error:"not_found"},404);
  const p=await env.DB.prepare("SELECT answers FROM profiles WHERE user_id=?").bind(uid).first();
  const a=p?JSON.parse(p.answers):{}; const missing=["q1","q4","q7","q9"].filter(k=>!a[k]);
  const sys={role:"system",content:`You ARE the ${v.year} ${v.make} ${v.model} ${v.trim}, speaking in first person with a confident, playful personality. FACTS (answer ONLY from these): ${vdpText(v)}. If asked something not in your facts, say you'd rather show them in person. Softly learn: ${missing.join(", ")||"nothing — profile complete"} (emit <PROFILE>{"q4":"..."}</PROFILE> when learned). When the user shows test-drive intent, emit <BOOK>{"center":"Culver City","slot":"tomorrow 6pm"}</BOOK> and get them excited. Keep replies under 60 words.`};
  const text=await llm(env,[sys,...(messages||[]).slice(-10)]);
  const prof=text.match(/<PROFILE>(.*?)<\/PROFILE>/s), book=text.match(/<BOOK>(.*?)<\/BOOK>/s);
  if(prof){ try{ const upd={...a,...JSON.parse(prof[1])};
    await env.DB.prepare("UPDATE profiles SET answers=?, embedding_synced=0 WHERE user_id=?").bind(JSON.stringify(upd),uid).run(); }catch(_){} }
  let pass=null;
  if(book){ try{ const b=JSON.parse(book[1]); const tok=await hmac(env,uid+":"+vdpId+":"+b.slot);
    await env.DB.prepare("INSERT INTO test_drives (user_id,vdp_id,center,slot,status,pass_token,created_at) VALUES (?,?,?,?,?,?,?)")
      .bind(uid,vdpId,b.center,b.slot,"requested",tok,new Date().toISOString()).run();
    const u=await env.DB.prepare("SELECT phone FROM users WHERE id=?").bind(uid).first();
    await env.DB.prepare("INSERT INTO sms_queue (phone,template,body,send_at,recurring,created_at) VALUES (?,?,?,?,?,?)")
      .bind(u.phone,"drive-confirm",`Your ${v.year} ${v.make} ${v.model} Drive Now pass: carnimbus.com/pass/${tok} — ${b.slot} at ${b.center}. Reply STOP to opt out.`,new Date().toISOString(),"none",new Date().toISOString()).run();
    pass="/pass/"+tok; }catch(_){} }
  const cleanReply=text.replace(/<PROFILE>.*?<\/PROFILE>/gs,"").replace(/<BOOK>.*?<\/BOOK>/gs,"").trim();
  const lastUser=(messages||[]).slice(-1)[0];
  if(lastUser&&lastUser.role==="user") await env.DB.prepare("INSERT INTO chats (user_id,vdp_id,role,body,created_at) VALUES (?,?,?,?,?)")
    .bind(uid,vdpId,"user",String(lastUser.content).slice(0,500),new Date().toISOString()).run();
  await env.DB.prepare("INSERT INTO chats (user_id,vdp_id,role,body,created_at) VALUES (?,?,?,?,?)")
    .bind(uid,vdpId,"car",cleanReply.slice(0,500),new Date().toISOString()).run();
  return json({ok:true,reply:cleanReply,pass}); }
async function passPage(request,env){ const tok=new URL(request.url).pathname.split("/")[2]||"";
  const t=await env.DB.prepare("SELECT td.*,v.year,v.make,v.model,u.phone FROM test_drives td JOIN vdps v ON v.id=td.vdp_id JOIN users u ON u.id=td.user_id WHERE td.pass_token=?").bind(tok).first();
  if(!t) return new Response("Pass not found",{status:404});
  return new Response(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Drive Now Pass</title><link rel="stylesheet" href="/assets/styles.css"></head>
<body style="background:#06163b;display:flex;align-items:center;justify-content:center;min-height:100vh">
<div class="wl-done" style="max-width:380px;margin:20px"><div class="wl-done-h">🎟️ Drive Now Pass</div>
<div class="wl-done-p"><b style="color:#fff">${t.year} ${t.make} ${t.model}</b><br>${t.slot} · ${t.center} Test Drive Center<br>Rider: •••-${String(t.phone).slice(-4)} · Status: ${t.status}</div>
<div class="wl-done-p" style="font-size:11px">Show this screen when you arrive. Terms already set — no 4-hour ordeal.</div></div></body></html>`,{headers:{"content-type":"text/html"}}); }
function cidFor(id){ const n=100000000+(id*7919)%900000000; const s=String(n); return s.slice(0,3)+" "+s.slice(3,6)+" "+s.slice(6,9); }
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
async function dealerConsole(request,env,uid,dealer){
  const tds=await env.DB.prepare(
    "SELECT td.id,td.center,td.slot,td.status,td.created_at,u.phone,u.handle,v.year,v.make,v.model,v.trim,v.price_mo,v.photos "+
    "FROM test_drives td JOIN users u ON u.id=td.user_id JOIN vdps v ON v.id=td.vdp_id ORDER BY td.id DESC LIMIT 12").all();
  const k=await env.DB.prepare("SELECT "+
    "COUNT(*) routed, SUM(CASE WHEN status IN ('requested','confirmed','arrived','sold') THEN 1 ELSE 0 END) booked, "+
    "SUM(CASE WHEN status IN ('arrived','sold') THEN 1 ELSE 0 END) showed, SUM(CASE WHEN status='sold' THEN 1 ELSE 0 END) closed FROM test_drives").first();
  const today=new Date().toISOString().slice(0,10), yd=new Date(Date.now()-864e5).toISOString().slice(0,10);
  const rt=await env.DB.prepare("SELECT SUM(CASE WHEN substr(created_at,1,10)=? THEN 1 ELSE 0 END) t, SUM(CASE WHEN substr(created_at,1,10)=? THEN 1 ELSE 0 END) y FROM test_drives").bind(today,yd).first();
  const ls=await env.DB.prepare("SELECT id,year,make,model,trim,price_mo,active FROM vdps ORDER BY id DESC LIMIT 20").all();
  return json({ok:true,dealer:dealer,kpis:k,deltas:{today:rt.t||0,yesterday:rt.y||0},
    appointments:(tds.results||[]).map(t=>({...t,who:t.handle||("Rider •••-"+String(t.phone).slice(-4)),cid:cidFor(t.id),phone:"•••-"+String(t.phone).slice(-4),photos:JSON.parse(t.photos||"[]")})),
    listings:ls.results||[]});
}
async function dealerListing(request,env,uid,dealer){
  const c=await request.json().catch(()=>({}));
  if(!c.year||!c.make||!c.model||!c.price_mo) return json({ok:false,error:"bad_request"},400);
  const vin=c.vin||("DLR-"+dealer.id+"-"+Date.now());
  await env.DB.prepare(
    "INSERT INTO vdps (vin,year,make,model,trim,price_mo,miles,drivetrain,body,features,description,photos,active,embedding_synced,updated_at) "+
    "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,0,?)")
    .bind(vin,+c.year,String(c.make).slice(0,40),String(c.model).slice(0,60),String(c.trim||"").slice(0,60),+c.price_mo,
      String(c.miles||"").slice(0,20),String(c.drivetrain||"").slice(0,20),String(c.body||"").slice(0,20),
      JSON.stringify(c.features||[]),String(c.description||"").slice(0,500),JSON.stringify(c.photos||[]),new Date().toISOString()).run();
  return json({ok:true});
}
async function dealerCheckin(request,env,uid,dealer){
  const {driveId,token,status}=await request.json().catch(()=>({}));
  if(["confirmed","arrived","sold"].indexOf(status)<0) return json({ok:false,error:"bad_request"},400);
  let id=+driveId||0;
  if(!id&&token){ const t=String(token).replace(/[^A-Za-z0-9]/g,"");
    const row=t.length>=20?await env.DB.prepare("SELECT id FROM test_drives WHERE pass_token=?").bind(t).first()
      :await env.DB.prepare("SELECT id FROM test_drives WHERE pass_token LIKE ? ORDER BY id DESC LIMIT 1").bind(t.slice(0,6)+"%").first();
    if(row) id=row.id; }
  if(!id) return json({ok:false,error:"not_found"},404);
  await env.DB.prepare("UPDATE test_drives SET status=? WHERE id=?").bind(status,id).run();
  const td=await env.DB.prepare("SELECT td.id,td.status,u.handle,u.phone FROM test_drives td JOIN users u ON u.id=td.user_id WHERE td.id=?").bind(id).first();
  return json({ok:true,drive:{id:td.id,status:td.status,who:td.handle||("Rider •••-"+String(td.phone).slice(-4))}});
}
async function chatList(request,env,uid){ const curl=new URL(request.url); const vdpId=+curl.searchParams.get("vdpId")||0;
  if(vdpId){ const rows=await env.DB.prepare("SELECT role,body,created_at FROM chats WHERE user_id=? AND vdp_id=? ORDER BY id ASC LIMIT 100").bind(uid,vdpId).all();
    return json({ok:true,messages:rows.results||[]}); }
  const rows=await env.DB.prepare(
    "SELECT c.vdp_id, MAX(c.id) mid, v.year,v.make,v.model,v.trim,v.price_mo,v.photos FROM chats c JOIN vdps v ON v.id=c.vdp_id "+
    "WHERE c.user_id=? GROUP BY c.vdp_id ORDER BY mid DESC LIMIT 20").bind(uid).all();
  const out=[]; for(const r of (rows.results||[])){
    const last=await env.DB.prepare("SELECT role,body,created_at FROM chats WHERE id=?").bind(r.mid).first();
    out.push({vdpId:r.vdp_id,year:r.year,make:r.make,model:r.model,trim:r.trim,price_mo:r.price_mo,
      photos:JSON.parse(r.photos||"[]"),last:last?last.body:"",when:last?last.created_at:""}); }
  return json({ok:true,threads:out}); }
async function dealerChat(request,env,uid,dealer){ const curl=new URL(request.url); const driveId=+curl.searchParams.get("driveId")||0;
  if(!driveId) return json({ok:false,error:"bad_request"},400);
  const td=await env.DB.prepare("SELECT user_id,vdp_id FROM test_drives WHERE id=?").bind(driveId).first();
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
async function me(request,env,uid){
  const u=await env.DB.prepare("SELECT phone,sid FROM users WHERE id=?").bind(uid).first();
  const p=await env.DB.prepare("SELECT answers FROM profiles WHERE user_id=?").bind(uid).first();
  const td=await env.DB.prepare(
    "SELECT td.center,td.slot,td.status,td.pass_token,td.created_at,v.id vdp_id,v.year,v.make,v.model,v.trim,v.price_mo,v.miles,v.drivetrain,v.photos "+
    "FROM test_drives td JOIN vdps v ON v.id=td.vdp_id WHERE td.user_id=? ORDER BY td.id DESC LIMIT 1").bind(uid).first();
  return json({ok:true,phone:u?u.phone:null,sid:u?u.sid:null,answers:p?JSON.parse(p.answers):null,
    drive:td?{...td,cid:cidFor(td.id),photos:JSON.parse(td.photos||"[]")}:null});
}
async function dealerLead(request,env){
  const {name,dealership,role,phone,email}=await request.json().catch(()=>({}));
  if(!name||!dealership) return json({ok:false,error:"bad_request"},400);
  await env.DB.prepare("INSERT INTO dealer_leads (name,dealership,role,phone,email,created_at) VALUES (?,?,?,?,?,?)")
    .bind(String(name).slice(0,80),String(dealership).slice(0,120),String(role||"").slice(0,40),
      String(phone||"").slice(0,20),String(email||"").slice(0,120),new Date().toISOString()).run();
  return json({ok:true});
}
async function comments(request,env){ const curl=new URL(request.url); const vdpId=+curl.searchParams.get("vdpId")||0;
  if(request.method==="POST"){ const uid=await readSession(env,request); if(!uid) return json({ok:false,error:"auth"},401);
    const {body,zip}=await request.json().catch(()=>({})); if(!body||String(body).length>500) return json({ok:false,error:"bad_request"},400);
    const n=await env.DB.prepare("SELECT COUNT(*) c FROM comments WHERE user_id=? AND created_at>?").bind(uid,new Date(Date.now()-3600e3).toISOString()).first();
    if(n.c>=10) return json({ok:false,error:"rate_limited"},429);
    await env.DB.prepare("INSERT INTO comments (user_id,vdp_id,body,zip,created_at) VALUES (?,?,?,?,?)").bind(uid,vdpId,String(body),String(zip||""),new Date().toISOString()).run();
    if(/qualif|price|rate|score|apr|band|approv/i.test(String(body))){
      const reply=await llm(env,[{role:"system",content:"You are u/CarNimbusAI, the CarNimbus community agent. Reply in under 40 words, friendly expert, reference soft-pull pre-qualification and offer to find matches. No disclaimers."},{role:"user",content:String(body)}]).catch(()=>null);
      if(reply) await env.DB.prepare("INSERT INTO comments (user_id,vdp_id,body,zip,created_at) VALUES (0,?,?,?,?)")
        .bind(vdpId,String(reply).slice(0,400),"agent",new Date().toISOString()).run().catch(()=>{}); }
    return json({ok:true}); }
  if(vdpId){ const rows=await env.DB.prepare("SELECT body,zip,created_at FROM comments WHERE vdp_id=? ORDER BY id DESC LIMIT 50").bind(vdpId).all();
    return json({ok:true,comments:rows.results||[]}); }
  const rows=await env.DB.prepare(
    "SELECT c.body,c.zip,c.created_at,c.vdp_id,v.year,v.make,v.model,v.price_mo,v.photos FROM comments c "+
    "LEFT JOIN vdps v ON v.id=c.vdp_id ORDER BY c.id DESC LIMIT 50").all();
  return json({ok:true,comments:(rows.results||[]).map(r=>({...r,photos:r.photos?JSON.parse(r.photos):[]}))}); }

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
