document.addEventListener("DOMContentLoaded",function(){
  try{ if(location.search) history.replaceState(null,"",location.pathname); }catch(_){}   // Z4: keep the URL bare carnimbus.com
  try{ if("scrollRestoration" in history) history.scrollRestoration="manual"; window.scrollTo(0,0); }catch(_){}   // AA1: always open at the top
  function $(id){return document.getElementById(id);}
  function esc(s){return String(s==null?"":s).replace(/[<&>"]/g,function(c){return {"<":"&lt;","&":"&amp;",">":"&gt;","\"":"&quot;"}[c];});}
  function es(){try{return localStorage.cn_lang==="es";}catch(_){return false;}}
  function distLabel(x){ var d=parseFloat(x); if(!isFinite(d)) return ""; var m=d<1?"<1 mi":Math.round(d)+" mi"; return m+(es()?" de ti":" away"); }
  var DEALER_EMAIL="cidsanchez@lacarguy.com";   // Y2: swap for Cid's CDK/calendar link when credentials exist
  var DEALER_CC="maxberger@lacarguy.com";   // Z: Max Berger CC'd on every auto-drafted lead email to Cid
  var dealButtons=document.querySelectorAll("#lead-deal button");
  function syncTerms(){ var on=document.querySelector("#lead-deal button.on"); var d=on?on.getAttribute("data-deal"):"finance";
    $("lead-finance-row").style.display=d==="cash"?"none":"flex"; $("lead-cash-row").style.display=d==="cash"?"block":"none";
    $("lead-terms-label").textContent=d==="cash"?(es()?"PASO 2 · ¿CUÁL ES TU PRESUPUESTO EN EFECTIVO?":"STEP 2 · WHAT'S YOUR CASH BUDGET?")
      :d==="lease"?(es()?"PASO 2 · MENSUALIDAD Y PAGO INICIAL":"STEP 2 · MONTHLY & DUE AT SIGNING")
      :(es()?"PASO 2 · MENSUALIDAD Y ENGANCHE":"STEP 2 · MONTHLY & DOWN PAYMENT"); }
  dealButtons.forEach(function(btn){ btn.addEventListener("click",function(){
    dealButtons.forEach(function(b){ b.classList.remove("on"); b.classList.remove("primary"); b.classList.add("ghost"); });
    btn.classList.add("on"); btn.classList.remove("ghost"); btn.classList.add("primary"); syncTerms(); }); });
  var typeButtons=document.querySelectorAll("#lead-type button");   // AI: TASK-002 — 4 fixed bubbles, no free text
  typeButtons.forEach(function(btn){ btn.addEventListener("click",function(){
    typeButtons.forEach(function(b){ b.classList.remove("on"); b.classList.remove("primary"); b.classList.add("ghost"); });
    btn.classList.add("on"); btn.classList.remove("ghost"); btn.classList.add("primary"); flagType(false); }); });
  function terms(){ var on=document.querySelector("#lead-deal button.on"), ty=document.querySelector("#lead-type button.on");
    return { type:ty?ty.getAttribute("data-type"):"", deal:on?on.getAttribute("data-deal"):"finance",
      mo:$("lead-monthly").value, dn:$("lead-down").value,
      zip:($("lead-zip").value||"").replace(/\D/g,""), rad:($("lead-radius").value||"").replace(/\D/g,"")||"25",
      budget:$("lead-budget").value }; }
  // AI/TASK-005: one ask, no back-and-forth. 71 → 44 words; the ask gets its own line and the buyer pre-commits
  // to the first slot so Cid's reply ends the thread.
  function mailtoFor(c,t){ var name=c.year+" "+c.make+" "+c.model;
    var sub=name+" — test drive this week (via CarNimbus)";
    var where=c.dealer_name?(" at "+c.dealer_name):"";
    var priceBit=t.deal==="cash"?(c.price?("$"+Number(c.price).toLocaleString()+" cash"):"my cash budget")
      :t.deal==="lease"?("$"+c.price_mo+"/mo lease, $"+t.dn+" at signing")
      :("$"+c.price_mo+"/mo, $"+t.dn+" down");
    var body="Hi Cid,\n\nCarNimbus matched me with the "+name+where+" and the numbers already work for me: "+priceBit+
      ". I'm near "+t.zip+" and I'm ready to drive it this week.\n\nWhat day and time works? I'll take the first slot you have.\n\nThanks,";
    return "mailto:"+DEALER_EMAIL+"?cc="+encodeURIComponent(DEALER_CC)+"&subject="+encodeURIComponent(sub)+"&body="+encodeURIComponent(body); }
  var ZIPSET=null;   // AC2: all valid US 5-digit ZIPs (GeoNames), lazy-loaded on first submit
  async function zipOk(z){ if(!/^\d{5}$/.test(z)) return false;
    if(!ZIPSET){ try{ var r=await fetch("/assets/data/us-zips.json"); var s=await r.json(); ZIPSET=new Set(s.match(/.{5}/g)); }catch(_){ return true; } }
    return ZIPSET.has(z); }
  var CARS=[];
  var f=$("lead-form"); if(!f) return;
  async function runMatch(t,quiet){
    var msg=$("lead-msg"), go=$("lead-go");
    if(!quiet){ go.disabled=true; go.textContent=es()?"Buscando…":"Matching…"; msg.textContent=""; }
    try{ var r=await fetch("/api/search?src=scan&monthly="+t.mo+"&down="+t.dn+(t.deal==="cash"?"&budget="+t.budget:"")+"&zip="+t.zip+"&radius="+t.rad+"&deal_type="+t.deal+"&type="+encodeURIComponent(t.type));
      var d=await r.json().catch(function(){return{};}); CARS=(d&&d.cars)||[];
      if(!quiet){ go.disabled=false; go.textContent=es()?"Ver mis matches":"Show My Matches"; }
      if(!CARS.length){ if(!quiet){ msg.textContent=es()?"No encontramos autos con esos términos — prueba un radio o presupuesto mayor.":"No matches with those terms — try a wider radius or higher monthly."; } $("lead-cars").innerHTML=""; $("lead-cars").style.display="none"; return; }
      // AI: honest disclosure when the chosen type has no inventory in range (mirrors widen_radius/over_budget).
      if(!quiet && d.reason==="no_type_match"){ msg.textContent=es()?"No hay de ese tipo cerca — esto es lo que sí encaja.":"Nothing of that type in range — here's what fits your budget nearby."; }
      $("lead-cars").style.display="flex";
      $("lead-cars").innerHTML=CARS.slice(0,12).map(function(c,i){
        return '<div style="flex:none;width:210px;background:#0a1f4d;border:1px solid rgba(24,200,255,'+(i===0?'.55':'.2')+');border-radius:14px;overflow:hidden">'+
          (i===0?'<div style="font:700 9px Manrope;letter-spacing:.08em;color:#06163b;background:#18C8FF;text-align:center;padding:3px 0">⭐ '+(es()?"TU MEJOR MATCH":"YOUR TOP MATCH")+'</div>':'')+
          '<div style="height:100px;background:#06163b '+(c.photos&&c.photos[0]?"url(\'"+esc(c.photos[0])+"\') center/cover":"")+'"></div>'+
          '<div style="padding:10px"><div style="display:flex;justify-content:space-between;gap:6px;align-items:baseline"><div style="font:700 11px Manrope;color:#fff;min-width:0">'+esc(c.year+" "+c.make+" "+c.model)+'</div><div style="font:700 12px Manrope;color:#18C8FF;flex:none">'+(t.deal==="cash"?"$"+esc(Number(c.price).toLocaleString()):"$"+esc(c.price_mo)+"/mo")+'</div></div>'+
          '<div style="display:flex;justify-content:space-between;gap:6px;margin-top:3px"><div style="font:600 9px Manrope;color:#8ca0c4;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(c.dealer_name||"LA Car Guy")+'</div>'+(c.dist!=null?'<div style="font:600 9px Manrope;color:#8ca0c4;flex:none">'+distLabel(c.dist)+'</div>':'')+'</div>'+
          ((c.reasons&&c.reasons.length)?'<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">'+c.reasons.slice(0,4).map(function(rz){return '<span style="font:600 8px Manrope;color:#18C8FF;background:rgba(24,200,255,.12);border-radius:8px;padding:2px 6px">'+esc(rz)+'</span>';}).join('')+'</div>':'')+
          '<a class="btn primary sm lead-book" data-i="'+i+'" href="'+mailtoFor(c,t).replace(/"/g,"&quot;")+'" style="width:100%;margin-top:8px;text-decoration:none;justify-content:center">'+(es()?"Conducir ya":"Drive Now")+'</a></div></div>';
      }).join('');
    }catch(_){ if(!quiet){ go.disabled=false; go.textContent=es()?"Ver mis matches":"Show My Matches";
      msg.textContent=es()?"No se pudo buscar — inténtalo de nuevo.":"Couldn't search — try again."; } }
  }
  function flag(el,on){ el.style.borderColor=on?"#ff5a6e":""; el.style.boxShadow=on?"0 0 0 3px rgba(255,90,110,.18)":""; }   // AC4: red ring on invalid entry
  function flagType(on){ var el=$("lead-type"); if(!el) return;   // AI: red ring on the bubble row (it's a div, not a .pill)
    el.style.outline=on?"2px solid #ff5a6e":""; el.style.outlineOffset="4px"; el.style.borderRadius="12px"; }
  ["lead-zip"].forEach(function(id){ $(id).addEventListener("input",function(){ flag($(id),false); }); });
  f.addEventListener("submit",function(e){ e.preventDefault();
    var t=terms(), msg=$("lead-msg");
    flag($("lead-zip"),false); flagType(false);
    if(!t.type){ flagType(true); msg.textContent=es()?"Elige un tipo de auto.":"Pick a car type."; return; }
    zipOk(t.zip).then(function(ok){
      if(!ok){ flag($("lead-zip"),true); msg.textContent=es()?"Ingresa un código postal real de EE. UU.":"Enter a real US ZIP code."; return; }
      msg.textContent=""; runMatch(t,false); }); });
  function cfToken(){ try{ return (window.turnstile&&document.querySelector(".cf-turnstile"))?(window.turnstile.getResponse()||""):""; }catch(_){ return ""; } }
  document.addEventListener("click",function(e){ var b=e.target.closest(".lead-book"); if(!b)return;
    var c=CARS[+b.dataset.i]; if(!c)return; var t=terms();
    fetch("/api/webleads",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({dream_car:t.type,deal_type:t.deal,monthly:t.mo,down:t.dn,zip:t.zip,radius:t.rad,
        vin:c.vin||"",vdp_id:c.id,budget:t.budget,matched_car:c.year+" "+c.make+" "+c.model,cf_token:cfToken(),website:$("lead-hp").value})}).catch(function(){});
    // AE4: real-signal groundwork — which ranked card the buyer actually clicked (rank = confidence).
    fetch("/api/events",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({events:[{action:"intent.match_click",vehicle_id:c.id,confidence:(+b.dataset.i)+1,source:"scanner"}]})}).catch(function(){});
  });
});
