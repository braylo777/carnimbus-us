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
    var body="Hi Cid,\n\n"+(t.car?("I've been looking for a "+t.car+", and CarNimbus matched me with the "+name):("CarNimbus matched me with the "+name))+(c.dealer_name?(" at "+c.dealer_name):"")+(c.price_mo?(" — about $"+c.price_mo+"/mo, which is right where I wanted to be"):"")+". I already have my numbers worked out ("+t.deal+", around $"+t.mo+"/mo with $"+t.dn+" down), and it's close to me near "+t.zip+", so this one really feels like the fit. I'd love to come see it and take it for a drive this week — no need for a long back-and-forth on my end; if it's as described, I'm ready to move. What day works best for you?\n\nThanks so much,";
    return "mailto:"+DEALER_EMAIL+"?cc="+encodeURIComponent(DEALER_CC)+"&subject="+encodeURIComponent(sub)+"&body="+encodeURIComponent(body); }
  var ZIPSET=null;   // AC2: all valid US 5-digit ZIPs (GeoNames), lazy-loaded on first submit
  async function zipOk(z){ if(!/^\d{5}$/.test(z)) return false;
    if(!ZIPSET){ try{ var r=await fetch("/assets/data/us-zips.json"); var s=await r.json(); ZIPSET=new Set(s.match(/.{5}/g)); }catch(_){ return true; } }
    return ZIPSET.has(z); }
  var MAKES=["acura","alfa romeo","aston martin","audi","bentley","bmw","buick","cadillac","chevrolet","chevy","chrysler","dodge","ferrari","fiat","ford","genesis","gmc","honda","hummer","hyundai","infiniti","jaguar","jeep","kia","lamborghini","land rover","range rover","lexus","lincoln","lotus","lucid","maserati","mazda","mclaren","mercedes","mercedes-benz","benz","mini","mitsubishi","nissan","polestar","pontiac","porsche","ram","rivian","rolls-royce","rolls royce","saab","saturn","scion","smart","subaru","suzuki","tesla","toyota","volkswagen","vw","volvo"];
  function carOk(s){ var q=" "+s.toLowerCase().replace(/[^a-z0-9 -]/g,"")+" ";
    return MAKES.some(function(m){ return q.indexOf(" "+m+" ")>-1||q.indexOf(" "+m+"-")>-1; }); }
  var CARS=[];
  var f=$("lead-form"); if(!f) return;
  async function runMatch(t,quiet){
    var msg=$("lead-msg"), go=$("lead-go");
    if(!quiet){ go.disabled=true; go.textContent=es()?"Buscando…":"Matching…"; msg.textContent=""; }
    try{ var r=await fetch("/api/search?src=scan&monthly="+t.mo+"&down="+t.dn+"&zip="+t.zip+"&radius="+t.rad+"&deal_type="+t.deal+"&q="+encodeURIComponent(t.car));
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
  function flag(el,on){ el.style.borderColor=on?"#ff5a6e":""; el.style.boxShadow=on?"0 0 0 3px rgba(255,90,110,.18)":""; }   // AC4: red ring on invalid entry
  ["lead-car","lead-zip"].forEach(function(id){ $(id).addEventListener("input",function(){ flag($(id),false); }); });
  f.addEventListener("submit",function(e){ e.preventDefault();
    var t=terms(), msg=$("lead-msg");
    flag($("lead-car"),false); flag($("lead-zip"),false);
    if(!t.car){ flag($("lead-car"),true); msg.textContent=es()?"Cuéntanos el auto de tus sueños.":"Tell us your dream car."; return; }
    if(!carOk(t.car)){ flag($("lead-car"),true); msg.textContent=es()?"Dinos un auto real — incluye la marca (p. ej. Toyota, BMW).":"Tell us a real car — include the make (e.g. Toyota, BMW)."; return; }
    zipOk(t.zip).then(function(ok){
      if(!ok){ flag($("lead-zip"),true); msg.textContent=es()?"Ingresa un código postal real de EE. UU.":"Enter a real US ZIP code."; return; }
      msg.textContent=""; runMatch(t,false); }); });
  document.addEventListener("click",function(e){ var b=e.target.closest(".lead-book"); if(!b)return;
    var c=CARS[+b.dataset.i]; if(!c)return; var t=terms();
    fetch("/api/webleads",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({dream_car:t.car,deal_type:t.deal,monthly:t.mo,down:t.dn,zip:t.zip,radius:t.rad,
        matched_car:c.year+" "+c.make+" "+c.model,website:$("lead-hp").value})}).catch(function(){});
  });
});
