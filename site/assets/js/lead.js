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
  dealButtons.forEach(function(btn){ btn.addEventListener("click",function(){
    dealButtons.forEach(function(b){ b.classList.remove("on"); b.classList.remove("primary"); b.classList.add("ghost"); });
    btn.classList.add("on"); btn.classList.remove("ghost"); btn.classList.add("primary"); }); });
  function terms(){ var on=document.querySelector("#lead-deal button.on");
    return { car:($("lead-car").value||"").trim(), deal:on?on.getAttribute("data-deal"):"finance",
      mo:$("lead-monthly").value, dn:$("lead-down").value,
      zip:($("lead-zip").value||"").replace(/\D/g,""), rad:($("lead-radius").value||"").replace(/\D/g,"")||"25" }; }
  function mailtoFor(c,t){ var name=c.year+" "+c.make+" "+c.model;
    var sub=name+" — test drive this week (via CarNimbus)";
    var body="Hi Cid,\n\nI found the exact car I want on CarNimbus: the "+name+(c.dealer_name?(" at "+c.dealer_name):"")+(c.price_mo?(" — about $"+c.price_mo+"/mo, right in my range"):"")+".\n\nI already know my numbers: "+t.deal+", ~$"+t.mo+"/mo, $"+t.dn+" down, near ZIP "+t.zip+" (within "+t.rad+" miles). "+(t.car?("This matches what I set out to find ("+t.car+").\n\n"):"\n\n")+"I'm not looking to negotiate or spend the day at a dealership — I'd like to come drive it this week, and if it's as described, I'm ready to move.\n\nWhat times work?\n\nThanks,";
    return "mailto:"+DEALER_EMAIL+"?cc="+encodeURIComponent(DEALER_CC)+"&subject="+encodeURIComponent(sub)+"&body="+encodeURIComponent(body); }
  var CARS=[];
  var f=$("lead-form"); if(!f) return;
  async function runMatch(t,quiet){
    var msg=$("lead-msg"), go=$("lead-go");
    if(!quiet){ go.disabled=true; go.textContent=es()?"Buscando…":"Matching…"; msg.textContent=""; }
    try{ var r=await fetch("/api/search?monthly="+t.mo+"&down="+t.dn+"&zip="+t.zip+"&radius="+t.rad+"&deal_type="+t.deal+"&q="+encodeURIComponent(t.car));
      var d=await r.json().catch(function(){return{};}); CARS=(d&&d.cars)||[];
      if(!quiet){ go.disabled=false; go.textContent=es()?"Ver mis matches":"Show My Matches"; }
      if(!CARS.length){ if(!quiet){ msg.textContent=es()?"No encontramos autos con esos términos — prueba un radio o presupuesto mayor.":"No matches with those terms — try a wider radius or higher monthly."; } $("lead-cars").innerHTML=""; $("lead-cars").style.display="none"; return; }
      $("lead-cars").style.display="flex";
      $("lead-cars").innerHTML=CARS.slice(0,12).map(function(c,i){
        return '<div style="flex:none;width:210px;background:#0a1f4d;border:1px solid rgba(24,200,255,'+(i===0?'.55':'.2')+');border-radius:14px;overflow:hidden">'+
          (i===0?'<div style="font:700 9px Manrope;letter-spacing:.08em;color:#06163b;background:#18C8FF;text-align:center;padding:3px 0">⭐ '+(es()?"TU MEJOR MATCH":"YOUR TOP MATCH")+'</div>':'')+
          '<div style="height:100px;background:#06163b '+(c.photos&&c.photos[0]?"url(\'"+esc(c.photos[0])+"\') center/cover":"")+'"></div>'+
          '<div style="padding:10px"><div style="display:flex;justify-content:space-between;gap:6px;align-items:baseline"><div style="font:700 11px Manrope;color:#fff;min-width:0">'+esc(c.year+" "+c.make+" "+c.model)+'</div><div style="font:700 12px Manrope;color:#18C8FF;flex:none">$'+esc(c.price_mo)+'/mo</div></div>'+
          '<div style="display:flex;justify-content:space-between;gap:6px;margin-top:3px"><div style="font:600 9px Manrope;color:#8ca0c4;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(c.dealer_name||"LA Car Guy")+'</div>'+(c.dist!=null?'<div style="font:600 9px Manrope;color:#8ca0c4;flex:none">'+distLabel(c.dist)+'</div>':'')+'</div>'+
          '<a class="btn primary sm lead-book" data-i="'+i+'" href="'+mailtoFor(c,t).replace(/"/g,"&quot;")+'" style="width:100%;margin-top:8px;text-decoration:none;justify-content:center">'+(es()?"Conducir ya":"Drive Now")+'</a></div></div>';
      }).join('');
    }catch(_){ if(!quiet){ go.disabled=false; go.textContent=es()?"Ver mis matches":"Show My Matches";
      msg.textContent=es()?"No se pudo buscar — inténtalo de nuevo.":"Couldn't search — try again."; } }
  }
  f.addEventListener("submit",function(e){ e.preventDefault();
    var t=terms(), msg=$("lead-msg");
    if(!t.car){ msg.textContent=es()?"Cuéntanos el auto de tus sueños.":"Tell us your dream car."; return; }
    if(!/^\d{5}$/.test(t.zip)){ msg.textContent=es()?"Ingresa un código postal válido.":"Enter a valid 5-digit ZIP."; return; }
    runMatch(t,false); });
  document.addEventListener("click",function(e){ var b=e.target.closest(".lead-book"); if(!b)return;
    var c=CARS[+b.dataset.i]; if(!c)return; var t=terms();
    fetch("/api/webleads",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({dream_car:t.car,deal_type:t.deal,monthly:t.mo,down:t.dn,zip:t.zip,radius:t.rad,
        matched_car:c.year+" "+c.make+" "+c.model,website:$("lead-hp").value})}).catch(function(){});
  });
});
