document.addEventListener("DOMContentLoaded",function(){
  function $(x){return document.getElementById(x);}
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function slug(c){return String(c.year+'-'+c.make+'-'+c.model).toLowerCase().replace(/[^a-z0-9]+/g,'-');}
  function lang(){try{return localStorage.cn_lang==="es"?"es":"en";}catch(_){return "en";}}
  var mobile=function(){return matchMedia("(max-width:700px)").matches;};
  function skipped(){try{return JSON.parse(localStorage.cn_skipped||"[]");}catch(_){return [];}}
  function rel(ts){var s=(Date.now()-Date.parse(ts))/1e3;if(!isFinite(s))return "";if(s<3600)return Math.max(1,Math.round(s/60))+"m ago";if(s<86400)return Math.round(s/3600)+"h ago";if(s<172800)return "yesterday";return new Date(ts).toLocaleDateString(undefined,{month:"short",day:"numeric"});}
  function skip(id){try{var s=skipped();if(s.indexOf(id)<0){s.push(id);localStorage.cn_skipped=JSON.stringify(s);}}catch(_){}}

  // New matches (ranked + affordable) as small talk/skip cards.
  fetch("/api/feed?lang="+lang()).then(function(r){return r.json();}).then(function(d){
    if(d.authed===false)$("m-gate").style.display="flex";
    var sk=skipped(), cars=(d.cars||[]).filter(function(c){return sk.indexOf(c.id)<0;}).slice(0,8);
    var el=$("m-new");
    el.innerHTML=cars.map(function(c){
      return '<div class="glass" data-id="'+c.id+'" style="flex:none;width:150px;border-radius:14px;overflow:hidden">'+
        '<div style="height:84px;background:#0a1f4d '+(c.photos&&c.photos[0]?"url(\'"+esc(c.photos[0])+"\') center/cover":"")+'"></div>'+
        '<div style="padding:9px 10px"><div style="font:700 11px Manrope;color:#fff">'+esc(c.year+" "+c.make+" "+c.model)+'</div>'+
        '<div class="cy" style="font:700 11px Manrope;margin:2px 0 4px">$'+esc(c.price_mo)+'/mo</div>'+
        '<div style="font:600 9px Manrope;color:#8ca0c4;margin-bottom:7px">Matched today</div>'+
        '<div class="row" style="gap:5px"><button class="btn primary sm mtalk" data-slug="'+slug(c)+'" data-id="'+c.id+'" style="flex:1;padding:0 8px">Talk</button>'+
        '<button class="btn ghost sm mskip" data-id="'+c.id+'" style="flex:none;padding:0 8px">✕</button></div></div></div>';
    }).join('')||'<div style="font:500 11px Manrope;color:#8ca0c4;padding:8px">No new matches — adjust your budget in Profile.</div>';
    el.addEventListener("click",function(e){
      var t=e.target.closest(".mtalk"); if(t){ openChat(+t.dataset.id, t.dataset.slug); return; }
      var s=e.target.closest(".mskip"); if(s){ skip(+s.dataset.id); var card=s.closest(".glass"); if(card)card.remove(); } });
  }).catch(function(){});

  // Conversations (existing threads).
  fetch("/api/chats").then(function(r){return r.ok?r.json():{threads:[]};}).then(function(d){
    var el=$("m-threads"), th=(d&&d.threads)||[];
    if(!th.length){ el.innerHTML='<div style="font:500 11px Manrope;color:#8ca0c4">No conversations yet — talk to a match to start one.</div>'; return; }
    el.innerHTML=th.map(function(t){
      return '<button class="thread row" data-id="'+t.vdpId+'" data-slug="'+String(t.year+'-'+t.make+'-'+t.model).toLowerCase().replace(/[^a-z0-9]+/g,'-')+'" style="align-items:center;gap:9px;width:100%;text-align:left;background:none;border:none;border-radius:10px;padding:8px;cursor:pointer">'+
        '<span style="width:44px;height:32px;border-radius:7px;overflow:hidden;flex:none;background:#0a1f4d">'+(t.photos&&t.photos[0]?'<img src="'+esc(t.photos[0])+'" style="width:100%;height:100%;object-fit:cover">':'')+'</span>'+
        '<span style="flex:1;min-width:0"><span style="display:block;font:700 11px Manrope;color:#e2e9f2">'+esc(t.year+" "+t.make+" "+t.model)+(t.price_mo?' · <span class="cy">$'+esc(t.price_mo)+'/mo</span>':'')+'</span>'+
        '<span style="display:block;font:500 10px Manrope;color:#8ca0c4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(t.last||"")+(t.when?' · '+rel(t.when):'')+'</span>'+
        (t.matched_at?'<span style="display:block;font:600 9px Manrope;color:#5f7397;margin-top:2px">Matched '+rel(t.matched_at)+'</span>':'')+'</span></button>';
    }).join('');
    el.addEventListener("click",function(e){ var b=e.target.closest(".thread"); if(b)openChat(+b.dataset.id,b.dataset.slug); });
  }).catch(function(){});

  // Inline chat surface in the right pane (compact reuse of /api/chats + /api/car-chat).
  function openChat(id, cslug){
    if(mobile()){ location.href="/talk/"+cslug; return; }   // mobile: full car page
    var pane=$("m-chat"), hist=[];
    pane.innerHTML='<div class="row" style="align-items:center;gap:9px;padding:11px 14px;border-bottom:1px solid rgba(24,200,255,.12)">'+
      '<span style="width:30px;height:30px;border-radius:50%;overflow:hidden;flex:none;border:1px solid rgba(24,200,255,.3)"><img src="/assets/logo-96.png" style="width:100%;height:100%;object-fit:cover"></span>'+
      '<div id="mc-name" style="font:700 12px Manrope;color:#fff;flex:1">Loading…</div>'+
      '<a class="btn ghost sm" href="/talk/'+cslug+'">Open full →</a></div>'+
      '<div id="mc-thread" class="col" style="flex:1;padding:13px 14px;gap:8px;overflow-y:auto;min-height:0"></div>'+
      '<div class="row" style="padding:12px 14px;border-top:1px solid rgba(24,200,255,.12)"><input id="mc-in" class="pill" style="flex:1;height:42px" placeholder="Message the car…"><button id="mc-send" class="btn primary md" style="margin-left:8px">Send</button></div>';
    var thread=$("mc-thread");
    function bubble(who,txt){var m=document.createElement("div");m.className="msg "+who;
      m.innerHTML=(who==="car"?'<span class="msg-av"><img class="msg-logo" src="/assets/logo-96.png" alt=""></span>':'')+'<div class="bubble '+who+'"></div>';
      m.querySelector(".bubble").textContent=txt;thread.appendChild(m);thread.scrollTop=thread.scrollHeight;}
    fetch("/api/vdp?id="+id).then(function(r){return r.json();}).then(function(d){ if(d&&d.car)$("mc-name").textContent=d.car.year+" "+d.car.make+" "+d.car.model; }).catch(function(){});
    fetch("/api/chats?vdpId="+id).then(function(r){return r.ok?r.json():{messages:[]};}).then(function(h){
      var ms=(h&&h.messages)||[];
      if(!ms.length)bubble("car","Ask me anything — or tell me when you want to drive.");
      ms.forEach(function(m){bubble(m.role==="car"?"car":"you",m.body); hist.push({role:m.role==="user"?"user":"assistant",content:m.body});});
    }).catch(function(){});
    function send(){var inEl=$("mc-in"),msg=inEl.value.trim();if(!msg)return;inEl.value="";bubble("you",msg);hist.push({role:"user",content:msg});
      fetch("/api/car-chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({vdpId:id,messages:hist,lang:lang()})})
        .then(function(r){return r.json();}).then(function(x){ if(x&&x.ok){hist.push({role:"assistant",content:x.reply});bubble("car",x.reply);
          if(x.pass){bubble("car","🎉 You're booked — see your pass in Profile.");}} }).catch(function(){}); }
    $("mc-send").addEventListener("click",send);
    $("mc-in").addEventListener("keydown",function(e){if(e.key==="Enter")send();});
  }
});
