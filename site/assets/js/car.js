document.addEventListener("DOMContentLoaded",function(){
  var id=+(new URLSearchParams(location.search).get("id")||0),CAR=null,hist=[];
  var thread=document.getElementById("thread");
  function $(x){return document.getElementById(x);}
  function setText(x,t){var e=$(x);if(e)e.textContent=t;}
  function setSrc(x,s){var e=$(x);if(e&&s)e.src=s;}
  function setFit(t){var e=$("fit-match");if(!e)return;var b=e.querySelector("b");if(b)b.textContent=t;}
  function fail(m){var v=$("vdp");if(v)v.innerHTML='<div style="padding:30px;font:600 13px Manrope;color:#aebfdf">'+m+' <a class="cy" href="/app/browse.html">Back to browse</a></div>';}
  function bubble(who,txt){if(!thread)return null;var m=document.createElement("div");m.className="msg "+who;
    m.innerHTML=(who==="car"?'<span class="msg-av"><img class="msg-logo" src="/assets/logo.png" alt=""></span>':'')+'<div class="bubble '+who+'"></div>';
    m.querySelector(".bubble").textContent=txt;thread.appendChild(m);thread.scrollTop=thread.scrollHeight;return m;}
  function typing(on){if(!thread)return;var t=thread.querySelector(".typing");if(t)t.remove();
    if(on){var m=document.createElement("div");m.className="msg car typing";
      m.innerHTML='<span class="msg-av"><img class="msg-logo" src="/assets/logo.png" alt=""></span><div class="bubble car"><span class="tdots"><i></i><i></i><i></i></span></div>';
      thread.appendChild(m);thread.scrollTop=thread.scrollHeight;}}
  function render(){
    setSrc("v-img",(CAR.photos&&CAR.photos[0])||"");
    setText("v-title",CAR.year+" "+CAR.make+" "+CAR.model+(CAR.trim?" "+CAR.trim:""));
    setText("v-price","$"+CAR.price_mo+"/mo");
    setText("v-meta",CAR.miles+" mi · "+CAR.drivetrain+" · Certified · Los Angeles, CA");
    setText("fit-budget","$"+CAR.price_mo+"/mo fits your range.");
    setFit(CAR.match!=null?CAR.match+"% match":"Fresh listing");
    setText("c-name",CAR.year+" "+CAR.make+" "+CAR.model);
    setText("c-tag","“"+((CAR.persona&&CAR.persona.tagline)||(CAR.description||"").split(".")[0]||"Ask me anything")+"”");
    setSrc("c-img",(CAR.photos&&CAR.photos[0])||"");
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
    setupBooking();
    if(new URLSearchParams(location.search).get("book")==="1"){var bp=$("book-panel");if(bp)bp.style.display="block";}
  }
  var bDay="Today",bTime=null;
  function setupBooking(){
    var where=$("book-where");if(where)where.textContent="at "+((CAR&&CAR.dealer)||"your nearest CarNimbus center");
    var days=$("book-days"),times=$("book-times");
    if(days&&!days.childElementCount){
      var wd=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],d2=new Date();d2.setDate(d2.getDate()+2);
      ["Today","Tomorrow",wd[d2.getDay()]].forEach(function(dn,i){var b=document.createElement("button");b.type="button";b.className="bopt"+(i===0?" on":"");b.textContent=dn;
        b.addEventListener("click",function(){days.querySelectorAll(".bopt").forEach(function(x){x.classList.remove("on");});b.classList.add("on");bDay=dn;});days.appendChild(b);});
    }
    if(times&&!times.childElementCount){
      ["10:00 AM","12:00 PM","2:00 PM","4:00 PM","6:00 PM"].forEach(function(tn){var b=document.createElement("button");b.type="button";b.className="bopt";b.textContent=tn;
        b.addEventListener("click",function(){times.querySelectorAll(".bopt").forEach(function(x){x.classList.remove("on");});b.classList.add("on");bTime=tn;});times.appendChild(b);});
    }
  }
  var bo=$("book-open");if(bo)bo.addEventListener("click",function(){var p=$("book-panel");if(!p)return;p.style.display=(p.style.display==="none"||!p.style.display)?"block":"none";if(p.style.display==="block")setupBooking();});
  var bc=$("book-confirm");if(bc)bc.addEventListener("click",async function(){
    var m=$("book-msg");if(!CAR)return;
    if(!bTime){if(m){m.style.display="block";m.textContent="Pick a time to lock it in.";}return;}
    var slot=(bDay||"Today")+", "+bTime;
    var r=await fetch("/api/book",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({vdpId:CAR.id,slot:slot})});
    if(r.status===401){if(m){m.style.display="block";m.innerHTML='Sign in to book — <a class="cy" href="/app/signin.html">sign in →</a>';}return;}
    var d=await r.json().catch(function(){return{};});
    if(d&&d.ok){if(m){m.style.display="block";m.textContent="Booked "+slot+" at "+d.center+" 🎟️";}
      var ok=$("approved");if(ok)ok.style.display="flex";
      var btn=$("pass-btn");if(btn){btn.style.display="inline-flex";btn.href=d.pass;btn.textContent="See your pass →";}
      bubble("car","Booked — "+slot+" at "+d.center+". Your Drive Now pass is ready. See you soon!");}
    else if(m){m.style.display="block";m.textContent="Couldn’t book that slot — try another.";}
  });
  fetch("/api/vdp?id="+id).then(function(r){return r.text();}).then(function(txt){
    var d=null; try{ d=JSON.parse(txt); }catch(e){ d=null; }
    CAR=d&&d.car;
    if(!CAR){ fail("Car not found."); return; }
    try{ render(); }catch(e){ /* never let a render hiccup hide the car */ }
  }).catch(function(){ fail("Couldn’t load this car — refresh to retry."); });
  async function send(){var inEl=$("chat-in"),msg=inEl?inEl.value.trim():"";if(!msg||!CAR)return;
    inEl.value="";bubble("you",msg);hist.push({role:"user",content:msg});typing(true);
    var r=await fetch("/api/car-chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({vdpId:CAR.id,messages:hist})});
    typing(false);
    if(r.status===401){bubble("car","Sign in first so I remember you.");
      if(thread){var a=document.createElement("a");a.href="/app/signin.html";a.textContent="Sign in →";
      a.style.cssText="align-self:flex-start;color:#18C8FF;font:700 12px Manrope;margin-left:34px";thread.appendChild(a);}return;}
    var d=await r.json().catch(function(){return{};});
    if(d.ok){hist.push({role:"assistant",content:d.reply});bubble("car",d.reply);
      if(d.pass){var ok=$("approved");if(ok)ok.style.display="flex";
        var btn=$("pass-btn");if(btn){btn.style.display="inline-flex";btn.href="/app/pass.html";btn.textContent="See your pass →";}}}
    else bubble("car","Static on the line — try that again.");}
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
