document.addEventListener("DOMContentLoaded",function(){
  var id=+(new URLSearchParams(location.search).get("id")||0),CAR=null,hist=[];
  var thread=document.getElementById("thread");
  function bubble(who,txt){var m=document.createElement("div");m.className="msg "+who;
    m.innerHTML=(who==="car"?'<span class="msg-av"><img class="msg-logo" src="/assets/logo.png" alt=""></span>':'')+'<div class="bubble '+who+'"></div>';
    m.querySelector(".bubble").textContent=txt;thread.appendChild(m);thread.scrollTop=thread.scrollHeight;return m;}
  function typing(on){var t=thread.querySelector(".typing");if(t)t.remove();
    if(on){var m=document.createElement("div");m.className="msg car typing";
      m.innerHTML='<span class="msg-av"><img class="msg-logo" src="/assets/logo.png" alt=""></span><div class="bubble car"><span class="tdots"><i></i><i></i><i></i></span></div>';
      thread.appendChild(m);thread.scrollTop=thread.scrollHeight;}}
  fetch("/api/feed").then(function(r){return r.json();}).then(function(d){
    CAR=(d.cars||[]).filter(function(c){return c.id===id;})[0];
    if(!CAR){document.getElementById("vdp").innerHTML='<div style="padding:30px;font:600 13px Manrope;color:#aebfdf">Car not found. <a class="cy" href="/app/browse.html">Back to browse</a></div>';return;}
    document.getElementById("v-img").src=(CAR.photos&&CAR.photos[0])||"";
    document.getElementById("v-title").textContent=CAR.year+" "+CAR.make+" "+CAR.model+(CAR.trim?" "+CAR.trim:"");
    document.getElementById("v-price").textContent="$"+CAR.price_mo+"/mo";
    document.getElementById("v-meta").textContent=CAR.miles+" mi · "+CAR.drivetrain+" · Certified · Los Angeles, CA";
    document.getElementById("fit-budget").textContent="$"+CAR.price_mo+"/mo fits your range.";
    var fm=document.getElementById("fit-match");
    fm.querySelector("b").textContent=(CAR.match!=null?CAR.match+"% match":"Fresh listing");
    document.getElementById("c-name").textContent=CAR.year+" "+CAR.make+" "+CAR.model;
    document.getElementById("c-tag").textContent="“"+((CAR.description||"").split(".")[0]||"Ask me anything")+".”";
    document.getElementById("c-img").src=(CAR.photos&&CAR.photos[0])||"";
    fetch("/api/chats?vdpId="+id).then(function(r){return r.ok?r.json():{messages:[]};}).then(function(h){
      var ms=(h&&h.messages)||[];
      if(!ms.length){bubble("car",CAR.model+" here. "+(((CAR.description||"").split(".")[0])?(CAR.description.split(".")[0]+"."):"Ask me anything — or tell me when you want to drive."));return;}
      ms.forEach(function(m){bubble(m.role==="car"?"car":"you",m.body);
        if(m.role==="user")hist.push({role:"user",content:m.body});else hist.push({role:"assistant",content:m.body});});
    }).catch(function(){bubble("car",CAR.model+" here. Ask me anything — or tell me when you want to drive.");});
  }).catch(function(){document.getElementById("vdp").innerHTML='<div style="padding:30px;font:600 13px Manrope;color:#aebfdf">Couldn’t load this car — refresh to retry. <a class="cy" href="/app/browse.html">Back to browse</a></div>';});
  async function send(){var inEl=document.getElementById("chat-in"),msg=inEl.value.trim();if(!msg||!CAR)return;
    inEl.value="";bubble("you",msg);hist.push({role:"user",content:msg});typing(true);
    var r=await fetch("/api/car-chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({vdpId:CAR.id,messages:hist})});
    typing(false);
    if(r.status===401){bubble("car","Sign in first so I remember you.");
      var a=document.createElement("a");a.href="/app/signin.html";a.textContent="Sign in →";
      a.style.cssText="align-self:flex-start;color:#18C8FF;font:700 12px Manrope;margin-left:34px";thread.appendChild(a);return;}
    var d=await r.json().catch(function(){return{};});
    if(d.ok){hist.push({role:"assistant",content:d.reply});bubble("car",d.reply);
      if(d.pass){var ok=document.getElementById("approved");ok.style.display="flex";
        var btn=document.getElementById("pass-btn");btn.style.display="inline-flex";btn.href="/app/pass.html";btn.textContent="See your pass →";}}
    else bubble("car","Static on the line — try that again.");}
  document.getElementById("chat-send").addEventListener("click",send);
  document.getElementById("chat-in").addEventListener("keydown",function(e){if(e.key==="Enter")send();});
});
