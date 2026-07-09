document.addEventListener("DOMContentLoaded",function(){
  var id=+(new URLSearchParams(location.search).get("id")||0),CAR=null,hist=[];
  var thread=document.getElementById("thread");
  function lang(){ try{return localStorage.cn_lang==="es"?"es":"en";}catch(_){return "en";} }
  function $(x){return document.getElementById(x);}
  function setText(x,t){var e=$(x);if(e)e.textContent=t;}
  function setSrc(x,s){var e=$(x);if(e&&s)e.src=s;}
  function setFit(t){var e=$("fit-match");if(!e)return;var b=e.querySelector("b");if(b)b.textContent=t;}
  function fail(m){var v=$("vdp");if(v)v.innerHTML='<div style="padding:30px;font:600 13px Manrope;color:#aebfdf">'+m+' <a class="cy" href="/matches">Back to matches</a></div>';}
  function bubble(who,txt){if(!thread)return null;var m=document.createElement("div");m.className="msg "+who;
    m.innerHTML=(who==="car"?'<span class="msg-av"><img class="msg-logo" src="/assets/logo.png" alt=""></span>':'')+'<div class="bubble '+who+'"></div>';
    m.querySelector(".bubble").textContent=txt;thread.appendChild(m);thread.scrollTop=thread.scrollHeight;return m;}
  function typing(on){if(!thread)return;var t=thread.querySelector(".typing");if(t)t.remove();
    if(on){var m=document.createElement("div");m.className="msg car typing";
      m.innerHTML='<span class="msg-av"><img class="msg-logo" src="/assets/logo.png" alt=""></span><div class="bubble car"><span class="tdots"><i></i><i></i><i></i></span></div>';
      thread.appendChild(m);thread.scrollTop=thread.scrollHeight;}}
  function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
  function renderSpecs(){
    var specs=[["Trim",CAR.trim||"—"],["Body",CAR.body||"—"],["Miles",CAR.miles!=null?Number(CAR.miles).toLocaleString():"—"],["Drivetrain",CAR.drivetrain||"—"]];
    var sp=$("v-specs"); if(sp)sp.innerHTML=specs.map(function(s){return '<div style="min-width:120px"><span style="font:700 8px Manrope;color:#8ca0c4;letter-spacing:.06em;text-transform:uppercase">'+esc(s[0])+'</span><br><span style="font:700 12px Manrope;color:#e2e9f2">'+esc(s[1])+'</span></div>';}).join("");
    var feats=(CAR.features||[]).slice(0,6);
    if(feats.length){ var fh=$("v-feats-h"); if(fh)fh.style.display=""; var fe=$("v-feats"); if(fe)fe.innerHTML=feats.map(function(f){return '<div style="font:600 11px Manrope;color:#cbd5e1"><span class="cy">•</span> '+esc(f)+'</div>';}).join(""); }
    // Wave E1: Inventory Intelligence Agent summary (pros/cons/ideal buyer), if enriched.
    var en=CAR.enrich; if(en&&(en.summary||(en.pros&&en.pros.length))){ var host=$("v-specs");
      if(host&&!document.getElementById("v-enrich")){ var box=document.createElement("div"); box.id="v-enrich"; box.style.cssText="margin-top:14px";
        var pros=(en.pros||[]).slice(0,3).map(function(p){return '<div style="font:600 11px Manrope;color:#cbd5e1"><span style="color:#5ee6a8">+</span> '+esc(p)+'</div>';}).join("");
        var cons=(en.cons||[]).slice(0,2).map(function(p){return '<div style="font:600 11px Manrope;color:#aebfdf"><span style="color:#f5a623">–</span> '+esc(p)+'</div>';}).join("");
        box.innerHTML='<div style="font:700 8px Manrope;color:#8ca0c4;letter-spacing:.06em;text-transform:uppercase;margin-bottom:5px">Nimbus take</div>'+
          (en.summary?'<div style="font:600 12px/1.5 Manrope;color:#e2e9f2;margin-bottom:7px">'+esc(en.summary)+'</div>':"")+
          pros+cons+(en.ideal_buyer?'<div style="font:600 10px Manrope;color:#8ca0c4;margin-top:6px">Ideal for: '+esc(en.ideal_buyer)+'</div>':"");
        host.parentNode.insertBefore(box,host.nextSibling); } }
    // Plain money line (no button — the soft check now happens in the chat). price_mo is the buyer's real monthly.
    (window.__me||Promise.resolve(null)).then(function(me){ var a=(me&&me.answers)||{};
      var down=a.max_down!=null?Number(a.max_down):0;
      var sp=a.softpull, apr=sp?(sp.apr+"%"):(({"800+":"6.4%","740-799":"7.1%","670-739":"9.3%","580-669":"13.5%","under 580":"17.9%"})[a.fico]||"—");
      var mm=$("v-money"); if(!mm)return;
      mm.innerHTML='<span class="cy" style="font-weight:800">$'+CAR.price_mo+'/mo</span> · $'+down.toLocaleString()+' down<br><span style="color:#8ca0c4;font-weight:500">'+apr+' '+(sp?"APR (soft-checked)":"est APR")+' · 72mo</span>';
    }).catch(function(){});
  }
  function render(){
    var P0=((CAR.photos&&CAR.photos[0])||"").split("?")[0];
    var PV=P0?(P0+"?v=6"):"";   // cache-bust past any stale image in the browser cache
    var vimg=$("v-img");
    if(vimg&&PV){ vimg.style.display="block";               // undo any earlier onerror hide
      vimg.onerror=function(){ if(!vimg.dataset.r){ vimg.dataset.r=1; vimg.src=P0+"?r="+Date.now(); } else vimg.style.display="none"; };
      // paint the photo onto the hero container too, so it shows even if the <img> is hidden by a transient onerror
      vimg.parentNode.style.backgroundImage="url('"+PV+"')"; vimg.parentNode.style.backgroundSize="cover"; vimg.parentNode.style.backgroundPosition="center";
      vimg.src=PV; }
    setText("v-title",CAR.year+" "+CAR.make+" "+CAR.model+(CAR.trim?" "+CAR.trim:""));
    setText("v-price","$"+CAR.price_mo+"/mo");
    setText("v-meta",CAR.miles+" mi · "+CAR.drivetrain+" · Certified · Los Angeles, CA");
    renderSpecs();
    setText("fit-budget","$"+CAR.price_mo+"/mo fits your range.");
    setFit(CAR.match!=null?CAR.match+"% match":"Fresh listing");
    setText("c-name",CAR.year+" "+CAR.make+" "+CAR.model);
    setText("c-tag","“"+((CAR.persona&&CAR.persona.tagline)||(CAR.description||"").split(".")[0]||"Ask me anything")+"”");
    setSrc("c-img",PV);
    var ci=$("chat-in"); if(ci&&CAR.persona&&CAR.persona.hint) ci.placeholder=CAR.persona.hint;
    fetch("/api/feed").then(function(r){return r.json();}).then(function(f){
      var m=((f&&f.cars)||[]).filter(function(c){return c.id===id;})[0];
      if(m&&m.match!=null)setFit(m.match+"% match");}).catch(function(){});
    fetch("/api/chats?vdpId="+id).then(function(r){return r.ok?r.json():{messages:[]};}).then(function(h){
      var ms=(h&&h.messages)||[];
      if(!ms.length){bubble("car",(CAR.persona&&CAR.persona.opener)||(CAR.model+" here. Ask me anything — or tell me when you want to drive."));return;}
      ms.forEach(function(m){bubble(m.role==="car"?"car":"you",m.body);
        if(m.role==="user")hist.push({role:"user",content:m.body});else hist.push({role:"assistant",content:m.body});});
    }).catch(function(){bubble("car",CAR.model+" here. Ask me anything — or tell me when you want to drive.");});
  }
  function showCongrats(passUrl){
    if($("congrats"))return;
    var P0=(CAR&&CAR.photos&&CAR.photos[0])||"";
    var o=document.createElement("div"); o.id="congrats";
    o.setAttribute("role","dialog"); o.setAttribute("aria-modal","true"); o.setAttribute("aria-label","Test drive booked");
    o.style.cssText="position:fixed;inset:0;z-index:90;background:rgba(3,8,20,.97);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:22px;gap:16px;overflow-y:auto";
    o.innerHTML='<div style="font:800 28px \'Space Grotesk\',Manrope;color:#fff">🎉 Congratulations!</div>'+
      '<div style="font:600 14px Manrope;color:#aebfdf;max-width:320px">Your test drive is scheduled.</div>'+
      '<div style="width:100%;max-width:400px;background:#0a1f4d;border:1px solid rgba(24,200,255,.3);border-radius:20px;overflow:hidden;text-align:left">'+
        (P0?'<div style="height:160px;background:#06163b url(\''+P0+'\') center/cover"></div>':'')+
        '<div style="display:flex;align-items:center;gap:8px;padding:11px 18px;background:rgba(6,16,40,.85);border-bottom:1px solid rgba(24,200,255,.18)"><img src="/assets/logo.png" alt="" style="width:20px;height:20px"><b style="font:700 13px \'Space Grotesk\',Manrope;color:#fff">CarNimbus</b><span class="mono" style="margin-left:auto;font-size:8px;color:#18C8FF;letter-spacing:.18em">DRIVE NOW</span></div>'+
        '<div style="padding:16px 18px">'+
        '<div class="mono" style="font-size:9px;color:#8ca0c4;letter-spacing:.2em">DRIVE NOW PASS</div>'+
        '<div style="font:800 18px Manrope;color:#fff;margin-top:4px" id="cg-car"></div>'+
        '<div style="font:700 11px Manrope;color:#18C8FF;margin-top:2px">Certified · Porsche South Bay · LA Car Guy</div>'+
        '<div style="font:600 12px Manrope;color:#e2e9f2;margin-top:8px" id="cg-slot"></div>'+
        '<div style="font:600 11px Manrope;color:#aebfdf;margin-top:4px" id="cg-fin"></div>'+
        '</div></div>'+
      '<a href="'+passUrl+'" target="_blank" rel="noopener" class="btn primary md" style="text-decoration:none;width:100%;max-width:400px">🎟️ View my Drive Now Pass</a>'+
      '<a href="https://app.carnimbus.com/profile" class="btn ghost md" style="text-decoration:none;width:100%;max-width:400px">Go to my profile →</a>';
    document.body.appendChild(o);
    var f=o.querySelector("a.btn"); if(f)f.focus();   // move focus into the dialog
    var cg=document.getElementById("cg-car"); if(cg&&CAR)cg.textContent=CAR.year+" "+CAR.make+" "+CAR.model;
    fetch("/api/me").then(function(r){return r.json();}).then(function(m){ var s=document.getElementById("cg-slot");
      if(s&&m&&m.drive&&window.fmtSlotCar)s.textContent=window.fmtSlotCar(m.drive.slot); }).catch(function(){});
  }
  function fmtSlotCar(s){ s=String(s||""); var m=s.match(/(\d{4})-(\d{2})-(\d{2})[ T]?(\d{2}:\d{2})?/);
    if(!m)return s; var dt=new Date(m[1]+"-"+m[2]+"-"+m[3]+"T"+(m[4]||"00:00")+":00");
    var wd=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],mo=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return wd[dt.getDay()]+" "+mo[dt.getMonth()]+" "+dt.getDate()+(m[4]?" · "+m[4]:""); }
  window.fmtSlotCar=fmtSlotCar;
  fetch("/api/vdp?id="+id+"&lang="+lang()).then(function(r){return r.text();}).then(function(txt){
    var d=null; try{ d=JSON.parse(txt); }catch(e){ d=null; }
    CAR=d&&d.car;
    if(!CAR){ fail("Car not found."); return; }
    try{ render(); }catch(e){ /* never let a render hiccup hide the car */ }
  }).catch(function(){ fail("Couldn’t load this car — refresh to retry."); });
  async function send(){var inEl=$("chat-in"),msg=inEl?inEl.value.trim():"";if(!msg||!CAR)return;
    inEl.value="";bubble("you",msg);hist.push({role:"user",content:msg});typing(true);
    var r=await fetch("/api/car-chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({vdpId:CAR.id,messages:hist,lang:lang()})});
    typing(false);
    if(r.status===401){bubble("car","Sign in first so I remember you.");
      if(thread){var a=document.createElement("a");a.href="/signin";a.textContent="Sign in →";
      a.style.cssText="align-self:flex-start;color:#18C8FF;font:700 12px Manrope;margin-left:34px";thread.appendChild(a);}return;}
    var d=await r.json().catch(function(){return{};});
    if(d.ok){hist.push({role:"assistant",content:d.reply});bubble("car",d.reply);
      if(d.slots&&d.slots.length)renderSlots(d.slots);
      if(d.pass){ setTimeout(function(){showCongrats(d.pass);},600); }}
    else bubble("car","Static on the line — try that again.");}
  function renderSlots(slots){ if(!thread)return; var w=document.createElement("div");
    w.className="msg car"; w.style.marginLeft="34px";
    w.innerHTML='<div class="row" style="flex-wrap:wrap;gap:7px">'+slots.map(function(s){
      return '<button type="button" class="bopt slot-chip" data-v="'+String(s.label).replace(/"/g,"")+'">'+String(s.label).replace(/[<&>]/g,"")+'</button>';}).join('')+'</div>';
    thread.appendChild(w); thread.scrollTop=thread.scrollHeight;
    w.querySelectorAll(".slot-chip").forEach(function(b){ b.addEventListener("click",function(){
      var ci=$("chat-in"); if(ci){ ci.value=b.dataset.v; send(); }
      w.querySelectorAll(".slot-chip").forEach(function(x){x.disabled=true;}); }); }); }
  var cs=$("chat-send");if(cs)cs.addEventListener("click",send);
  var ci=$("chat-in");if(ci)ci.addEventListener("keydown",function(e){if(e.key==="Enter")send();});
  var cr=$("chat-reset");if(cr)cr.addEventListener("click",async function(){
    if(thread)thread.innerHTML="";hist=[];
    var ok=$("approved");if(ok)ok.style.display="none";
    var btn=$("pass-btn");if(btn)btn.style.display="none";
    try{await fetch("/api/chats/clear",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({vdpId:id})});}catch(e){}
    if(CAR)bubble("car",(CAR.persona&&CAR.persona.opener)||("Hey — I'm the "+CAR.year+" "+CAR.make+" "+CAR.model+". Ask me anything."));
  });
});
