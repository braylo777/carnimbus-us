document.addEventListener("DOMContentLoaded",function(){
  try{ if(location.search) history.replaceState(null,"",location.pathname); }catch(_){}   // Z4: keep the URL bare carnimbus.com
  try{ if("scrollRestoration" in history) history.scrollRestoration="manual"; window.scrollTo(0,0); }catch(_){}   // AA1: always open at the top
  function $(id){return document.getElementById(id);}
  function esc(s){return String(s==null?"":s).replace(/[<&>"]/g,function(c){return {"<":"&lt;","&":"&amp;",">":"&gt;","\"":"&quot;"}[c];});}
  function es(){try{return localStorage.cn_lang==="es";}catch(_){return false;}}
  function distLabel(x){ var d=parseFloat(x); if(!isFinite(d)) return ""; var m=d<1?"<1 mi":Math.round(d)+" mi"; return m+(es()?" de ti":" away"); }
  // AJ: fixed 3 pills on every card — Condition · Exact miles · Est. APR. Replaces the old reason-pills, which
  // were up to 4, differed per car, and mostly restated the buyer's own inputs (type / in budget / distance).
  var COND_ES={"Brand New":"Nuevo","Like New":"Como nuevo","Low Miles":"Pocas millas","Well Kept":"Bien cuidado","Higher Miles":"Más millas"};
  // No deal-type param needed: apr_est is null from the worker for cash deals only, so the fallbacks below are
  // reachable only on a cash card.
  function pillsFor(c){ var p=[];
    if(c.cond_label) p.push(es()?(COND_ES[c.cond_label]||c.cond_label):c.cond_label);
    if(c.mileage_exact!=null) p.push(Number(c.mileage_exact).toLocaleString()+" mi");
    if(c.apr_est!=null) p.push((es()?"aprox. ":"est. ")+c.apr_est+"% APR");
    // Cash has no APR — nothing to estimate. Best remaining third fact, in order of strength. 3/100 cars carry
    // neither and honestly render 2 pills; inventing a filler would defeat the point of the other two.
    else if(c.certified) p.push(es()?"Certificado":"Certified");
    else if(/clean|carfax/i.test(String(c.title_status||""))) p.push(es()?"Título limpio":"Clean title");
    return p.slice(0,3); }
  var dealButtons=document.querySelectorAll("#lead-deal button");
  function syncTerms(){ var on=document.querySelector("#lead-deal button.on"); var d=on?on.getAttribute("data-deal"):"finance";
    $("lead-finance-row").style.display=d==="cash"?"none":"flex"; $("lead-cash-row").style.display=d==="cash"?"block":"none";
    var fs=document.getElementById("lead-fico-step"); if(fs) fs.style.display=d==="cash"?"none":"block";   // T-101: cash skips FICO
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
  var ficoButtons=document.querySelectorAll("#lead-fico button");   // T-101: STEP 4 credit band (finance/lease only)
  ficoButtons.forEach(function(btn){ btn.addEventListener("click",function(){
    ficoButtons.forEach(function(b){ b.classList.remove("on"); b.classList.remove("primary"); b.classList.add("ghost"); });
    btn.classList.add("on"); btn.classList.remove("ghost"); btn.classList.add("primary"); }); });
  function terms(){ var on=document.querySelector("#lead-deal button.on"), ty=document.querySelector("#lead-type button.on"),
      fc=document.querySelector("#lead-fico button.on");
    return { type:ty?ty.getAttribute("data-type"):"", deal:on?on.getAttribute("data-deal"):"finance",
      fico:fc?fc.getAttribute("data-fico"):"670-739",
      mo:$("lead-monthly").value, dn:$("lead-down").value,
      zip:($("lead-zip").value||"").replace(/\D/g,""), rad:($("lead-radius").value||"").replace(/\D/g,"")||"25",
      budget:$("lead-budget").value }; }
  var ZIPSET=null;   // AC2: all valid US 5-digit ZIPs (GeoNames), lazy-loaded on first submit
  async function zipOk(z){ if(!/^\d{5}$/.test(z)) return false;
    if(!ZIPSET){ try{ var r=await fetch("/assets/data/us-zips.json"); var s=await r.json(); ZIPSET=new Set(s.match(/.{5}/g)); }catch(_){ return true; } }
    return ZIPSET.has(z); }
  var CARS=[];
  var f=$("lead-form"); if(!f) return;
  async function runMatch(t,quiet){
    var msg=$("lead-msg"), go=$("lead-go");
    if(!quiet){ go.disabled=true; go.textContent=es()?"Buscando…":"Matching…"; msg.textContent=""; }
    try{ var r=await fetch("/api/search?src=scan&monthly="+t.mo+"&down="+t.dn+(t.deal==="cash"?"&budget="+t.budget:"&fico="+encodeURIComponent(t.fico))+"&zip="+t.zip+"&radius="+t.rad+"&deal_type="+t.deal+"&type="+encodeURIComponent(t.type));
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
          (function(pz){ return pz.length?'<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">'+pz.map(function(rz){return '<span style="font:600 8px Manrope;color:#18C8FF;background:rgba(24,200,255,.12);border-radius:8px;padding:2px 6px">'+esc(rz)+'</span>';}).join('')+'</div>':''; })(pillsFor(c))+
          '<button class="btn primary sm lead-book" data-i="'+i+'" type="button" style="width:100%;margin-top:8px;justify-content:center">'+(es()?"Conducir ya":"Drive Now")+'</button></div></div>';
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
  // T-101 steps 9–12: Drive Now opens the inline capture panel; its own submit does the enriched, persisted POST.
  var driveCar=null;
  function driveSlots(){ var out=[], d=new Date(), added=0;
    while(added<8){ d.setDate(d.getDate()+1); var wd=d.getDay();          // ~2 weeks of Mon–Thu (8 days × 4 times = 32 options). 1=Mon … 4=Thu
      if(wd>=1&&wd<=4){ [["10:00","10am"],["12:00","12pm"],["14:00","2pm"],["16:00","4pm"]].forEach(function(hm){
        var lbl=d.toLocaleDateString(es()?"es-ES":undefined,{weekday:"short",month:"short",day:"numeric"})+" · "+hm[1];
        out.push({value:d.toISOString().slice(0,10)+"T"+hm[0],label:lbl}); }); added++; } }
    return out; }
  function icsHref(c,slotValue){ var dt=slotValue.replace(/[-:]/g,"")+"00";   // 20260721T100000
    var body=["BEGIN:VCALENDAR","VERSION:2.0","BEGIN:VEVENT","SUMMARY:CarNimbus test drive — "+c.year+" "+c.make+" "+c.model,
      "DTSTART:"+dt,"DURATION:PT45M","LOCATION:"+(c.dealer_address||c.dealer_name||"CarNimbus"),"END:VEVENT","END:VCALENDAR"].join("\r\n");
    return "data:text/calendar;charset=utf-8,"+encodeURIComponent(body); }
  document.addEventListener("click",function(e){ var b=e.target.closest(".lead-book"); if(!b)return;
    var c=CARS[+b.dataset.i]; if(!c)return; driveCar=c;
    // AE4: real-signal groundwork — which ranked card the buyer actually clicked (rank = confidence).
    fetch("/api/events",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({events:[{action:"intent.match_click",vehicle_id:c.id,confidence:(+b.dataset.i)+1,source:"scanner"}]})}).catch(function(){});
    var sel=$("dn-slot"); sel.innerHTML=driveSlots().map(function(s){return '<option value="'+s.value+'">'+esc(s.label)+'</option>';}).join('');
    $("dn-msg").textContent="";
    $("dn-panel").style.display="block"; $("dn-panel").scrollIntoView({behavior:"smooth",block:"nearest"}); });
  var dnSubmit=$("dn-submit"); if(dnSubmit) dnSubmit.addEventListener("click",function(){
    var t=terms(), c=driveCar; if(!c) return; var msg=$("dn-msg");
    var fn=$("dn-first").value.trim(), ln=$("dn-last").value.trim(), em=$("dn-email").value.trim(),
        ph=$("dn-phone").value.replace(/\D/g,""), ad=$("dn-addr").value.trim(), zp=String(t.zip||"").replace(/\D/g,"");
    if(!fn||!ln){ msg.textContent=es()?"Escribe tu nombre.":"Enter your name."; return; }
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)){ msg.textContent=es()?"Correo inválido.":"Enter a valid email."; return; }
    if(!/^[2-9]\d{9}$/.test(ph)){ msg.textContent=es()?"Teléfono inválido.":"Enter a valid US mobile."; return; }
    if(!ad){ msg.textContent=es()?"Escribe tu dirección.":"Enter your address (for the tax estimate)."; return; }
    if(!$("dn-consent").checked){ msg.textContent=es()?"Acepta ser contactado.":"Please agree to be contacted."; return; }
    var slot=$("dn-slot").value, slotText=$("dn-slot").selectedOptions[0].text; dnSubmit.disabled=true; msg.textContent=es()?"Agendando…":"Scheduling…";
    fetch("/api/webleads",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({first_name:fn,last_name:ln,email:em,phone:ph,address:ad,zip:zp,appt_slot:slot,consent:true,
        dream_car:t.type,deal_type:t.deal,monthly:t.mo,down:t.dn,radius:t.rad,fico:t.fico,
        vin:c.vin||"",vdp_id:c.id,budget:t.budget,matched_car:c.year+" "+c.make+" "+c.model,
        cf_token:cfToken(),website:$("lead-hp").value})})
      .then(function(r){return r.json();}).then(function(d){ dnSubmit.disabled=false;
        if(d&&d.ok){ msg.textContent=""; var carName=c.year+" "+c.make+" "+c.model;
          $("dnm-msg").textContent=(es()?("Tu "+carName+" — prueba de manejo agendada para "+slotText+". Te enviaremos los detalles por texto y correo.")
            :("Your "+carName+" test drive is set for "+slotText+". We'll text + email you the details."));
          var a=$("dnm-ics"); a.href=icsHref(c,slot); a.download="carnimbus-drive.ics";
          $("dn-modal").style.display="flex"; }
        else { msg.textContent=es()?"Revisa tus datos e inténtalo de nuevo.":"Please check your details and try again."; } })
      .catch(function(){ dnSubmit.disabled=false; msg.textContent=es()?"No se pudo enviar.":"Couldn't submit — try again."; }); });
  // Confirmation pop-up: close on "Done" or on backdrop click.
  var dnClose=$("dnm-close"); if(dnClose) dnClose.addEventListener("click",function(){ $("dn-modal").style.display="none"; location.reload(); });
  var dnModal=$("dn-modal"); if(dnModal) dnModal.addEventListener("click",function(e){ if(e.target===dnModal) dnModal.style.display="none"; });
});
