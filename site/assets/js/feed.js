document.addEventListener("DOMContentLoaded",function(){
  var list=document.getElementById("posts");
  var ZIPS={ "90045":[33.9585,-118.3970],"90066":[34.0,-118.43],"90230":[33.997,-118.396],"90232":[34.019,-118.391],"90291":[33.991,-118.465],"90501":[33.836,-118.298],"90504":[33.872,-118.326],"90277":[33.836,-118.39],"90266":[33.892,-118.411],"90254":[33.862,-118.4],"90245":[33.917,-118.402],"90802":[33.768,-118.193],"90740":[33.757,-118.079],"90803":[33.759,-118.129],"90731":[33.736,-118.292] };
  var GEO=null;
  function lang(){ try{return localStorage.cn_lang==="es"?"es":"en";}catch(_){return "en";} }
  function feedUrl(){ return "/api/comments?lang="+lang()+(GEO?("&lat="+GEO[0]+"&lng="+GEO[1]+"&radius=40"):""); }
  function saveGeo(){ try{localStorage.cn_geo=JSON.stringify(GEO);}catch(_){} }
  function storedGeo(){ try{var g=JSON.parse(localStorage.cn_geo||"null");return (Array.isArray(g)&&g.length===2)?g:null;}catch(_){return null;} }
  function live(){ var el=document.getElementById("nm-live"); if(el)el.style.display="inline-flex"; }
  function scope(v){ try{localStorage.cn_feedscope=v;}catch(_){} }
  function getScope(){ try{return localStorage.cn_feedscope||"";}catch(_){return "";} }
  var nl=document.getElementById("nm-loc");
  function toNear(p){ GEO=[p.coords.latitude,p.coords.longitude]; saveGeo(); if(nl)nl.textContent="📍 Near you  ✕"; live(); scope("near"); load(); }
  function toMaster(){ GEO=null; try{delete localStorage.cn_geo;}catch(_){} if(nl)nl.textContent="🌎 Everyone"; scope("master"); load(); }
  if(nl)nl.addEventListener("click",function(){
    if(GEO){ toMaster(); return; }                                   // ✕ → global master feed
    if(!navigator.geolocation)return; nl.textContent="Locating…";
    navigator.geolocation.getCurrentPosition(toNear,function(){ nl.textContent="📍 Use my location"; }); });
  // Near-me on load: stored coords win — no permission re-prompt on refresh. Only ask on the first-ever visit.
  var sg=storedGeo();
  if(getScope()!=="master"){
    if(sg){ GEO=sg; if(nl)nl.textContent="📍 Near you  ✕"; live(); }
    else if(navigator.geolocation){ navigator.geolocation.getCurrentPosition(toNear,function(){}); }
  }
  var nz=document.getElementById("nm-zip");
  if(nz)nz.addEventListener("input",function(e){ var z=e.target.value.replace(/\D/g,""); var g=ZIPS[z]||(window.ZIP3&&window.ZIP3(z.slice(0,3))); if(g&&z.length>=5){ GEO=g; saveGeo(); scope("near"); live(); load(); } });
  function rel(ts){var s=(Date.now()-Date.parse(ts))/1e3;if(s<3600)return Math.max(1,Math.round(s/60))+"m";if(s<86400)return Math.round(s/3600)+"h";return Math.round(s/86400)+"d";}
  function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
  function mono(name){var s=String(name||"R"),h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))%360;
    return '<span style="width:100%;height:100%;display:grid;place-items:center;background:linear-gradient(135deg,hsl('+h+',58%,46%),hsl('+((h+42)%360)+',58%,34%));font:700 9px Manrope;color:#fff">'+s.trim().charAt(0).toUpperCase().replace(/[<&>]/g,"")+'</span>';}
  // O6: thread agent critic replies under their parent post (children ordered oldest-first below the post).
  function threadOrder(cs){ var byId={},kids={},tops=[];
    cs.forEach(function(c){ byId[c.id]=c; });
    cs.forEach(function(c){ var pid=+c.parent_id||0; if(pid&&byId[pid]){ (kids[pid]=kids[pid]||[]).push(c); } else tops.push(c); });
    var out=[]; tops.forEach(function(t){ out.push(t); (kids[t.id]||[]).slice().reverse().forEach(function(ch){ ch._child=true; out.push(ch); }); });
    return out; }
  function paint(cs){
    if(!cs.length){list.innerHTML='<div style="text-align:center;font:600 12px Manrope;color:#aebfdf;padding:40px 20px">Be the first — say something about a car you talked to.</div>';return;}
    cs=threadOrder(cs);
    list.innerHTML=cs.map(function(c){
      var agent=(c.zip==="agent");
      var av=agent?(c.dealer_logo?'<img src="'+esc(c.dealer_logo)+'" style="width:100%;height:100%;object-fit:cover">':(c.dealer_name?mono(c.dealer_name):'<img src="/assets/logo-96.png" style="width:100%;height:100%;object-fit:cover">'))
        :(c.avatar?'<img src="'+esc(c.avatar)+'" style="width:100%;height:100%;object-fit:cover">':mono(c.handle));
      var score=(c.upvotes||0)-(c.downvotes||0), mine=c.myvote||0;
      var rail='<div class="col" style="align-items:center;gap:1px;flex:none;width:34px;padding-top:2px">'+
        '<button class="vote" data-id="'+(+c.id)+'" data-dir="1" aria-label="Upvote" style="background:none;border:none;cursor:pointer;font-size:13px;line-height:1;color:'+(mine>0?"#18C8FF":"#8ca0c4")+'">▲</button>'+
        '<span style="font:700 11px Manrope;color:'+(mine>0?"#18C8FF":mine<0?"#ff8f8f":"#c9d6ef")+'">'+score+'</span>'+
        '<button class="vote" data-id="'+(+c.id)+'" data-dir="-1" aria-label="Downvote" style="background:none;border:none;cursor:pointer;font-size:13px;line-height:1;color:'+(mine<0?"#ff8f8f":"#8ca0c4")+'">▼</button></div>';
      var gallery=(c.images&&c.images.length)?'<div class="row" style="gap:6px;margin-top:8px;overflow-x:auto">'+c.images.slice(0,4).map(function(u){return '<img src="'+esc(u)+'" loading="lazy" style="height:120px;border-radius:10px;flex:none;object-fit:cover">';}).join('')+'</div>':'';
      var chip=(c.vdp_id&&c.year)?('<a href="/talk/'+String(c.year+"-"+c.make+"-"+c.model).toLowerCase().replace(/[^a-z0-9]+/g,"-")+'" style="text-decoration:none;display:block;margin-top:9px">'+
        '<div class="row hoverable" style="align-items:center;gap:8px;background:rgba(6,16,40,.6);border:1px solid rgba(24,200,255,.18);border-radius:10px;padding:7px">'+
        '<span style="width:38px;height:26px;border-radius:6px;overflow:hidden;flex:none">'+(c.photos&&c.photos[0]?'<img src="'+esc(c.photos[0])+'" loading="lazy" style="width:100%;height:100%;object-fit:cover">':'')+'</span>'+
        '<span style="font:700 10px Manrope;flex:1;color:#fff">'+esc(c.year)+' '+esc(c.make)+' '+esc(c.model)+' · <span class="cy">$'+esc(c.price_mo)+'/mo</span></span>'+
        '<span class="cy" style="font:700 10px Manrope;flex:none">Talk →</span></div></a>'):'';
      var actions='<div class="row" style="gap:16px;margin-top:9px;font:600 10px Manrope;color:#8ca0c4"><span class="act-share" data-id="'+(+c.id)+'" style="cursor:pointer">↗ Share</span>'+(agent?"":'<span class="act-reply" data-h="'+esc(c.handle||"")+'" style="cursor:pointer">💬 Reply</span>')+'</div>';
      return '<div class="post row" style="align-items:flex-start;gap:8px;padding:12px 14px;border-bottom:1px solid rgba(24,200,255,.08)'+(c._child?';margin-left:24px;border-left:2px solid rgba(24,200,255,.18);background:rgba(24,200,255,.03)':'')+'">'+rail+
        '<div style="flex:1;min-width:0">'+
        '<div class="row" style="align-items:center;gap:7px;font:600 9px Manrope;color:#8ca0c4"><span style="width:20px;height:20px;border-radius:50%;overflow:hidden;background:#3a4a63;display:grid;place-items:center;flex:none">'+av+'</span><span class="post-meta"></span>'+(c.sponsored?'<span style="font:700 8px Manrope;letter-spacing:.08em;color:#8ca0c4;border:1px solid rgba(24,200,255,.25);border-radius:6px;padding:1px 5px">Sponsored</span>':'')+'</div>'+
        '<div class="post-body" style="font:600 12px/1.4 Manrope;margin-top:6px;color:#e2e9f2"></div>'+gallery+chip+actions+'</div></div>';
    }).join('');
    var metas=list.querySelectorAll(".post-meta"), bodies=list.querySelectorAll(".post-body");
    cs.forEach(function(c,idx){ var agent=(c.zip==="agent"),name=agent?(c.dealer_name||"CarNimbus AI"):(c.synthetic?(c.zip||"a rider"):(c.handle||c.full_name||"a rider")),body=c.body||"";
      // R2: agent bodies may be stored "Name — body"; show ONE identity (CarNimbus AI) and strip the stored prefix.
      if(agent){ var m=body.match(/^(.{2,40}?) — ([\s\S]+)$/); if(m){ body=m[2]; } }
      // S4: Nimbus Score — the research agent ends with "Score: NN/100"; surface it as a chip in the byline.
      var sc=agent?body.match(/Score:\s*(\d{1,3})\s*\/\s*100\.?\s*$/):null; if(sc){ body=body.replace(/Score:\s*\d{1,3}\s*\/\s*100\.?\s*$/,"").trim(); }
      if(metas[idx])metas[idx].textContent=name+" · "+rel(c.created_at)+(sc?" · ⚡ "+Math.min(100,+sc[1])+"/100 fit":"")+(c.visible_to?" · 🔒 Only you":"");
      if(bodies[idx]){ bodies[idx].textContent=body;
        // C2: structured verdict card (verdict + pros/cons + fit score) rendered as ✓/✗ lists when present.
        if(c.card){ try{ var cd=JSON.parse(c.card); if(cd&&(cd.pros||cd.cons||cd.verdict)){
          var mk=function(arr,sym,col){return (arr||[]).slice(0,3).map(function(x){return '<div style="font:600 11px Manrope;color:'+col+'">'+sym+' '+esc(String(x))+'</div>';}).join('');};
          var vd=cd.verdict?'<div style="font:700 11px Manrope;color:#18C8FF;margin-bottom:4px">'+esc(String(cd.verdict))+(cd.score!=null?' · ⚡ '+Math.min(100,+cd.score||0)+'/100 fit':'')+'</div>':'';
          var box=document.createElement("div"); box.style.cssText="margin-top:8px;background:rgba(6,16,40,.5);border:1px solid rgba(24,200,255,.16);border-radius:10px;padding:9px";
          box.innerHTML=vd+mk(cd.pros,"✓","#5ee6a8")+mk(cd.cons,"✗","#ff9f9f");
          bodies[idx].appendChild(box); } }catch(_){}} } });
  }
  function load(){fetch(feedUrl()).then(function(r){return r.json();}).then(function(d){
    var cs=d.comments||[];
    try{ if(!GEO)sessionStorage.cn_feed2=JSON.stringify(cs.slice(0,30)); }catch(_){}
    paint(cs);
  }).catch(function(){ if(!list.childElementCount)list.innerHTML='<div style="text-align:center;font:600 12px Manrope;color:#aebfdf;padding:40px 20px">Feed unavailable — refresh to retry.</div>';});}
  // Instant paint from session cache, then refresh from network.
  try{ var cf=sessionStorage.cn_feed2; if(cf)paint(JSON.parse(cf)); }catch(_){}
  load();
  // EN/ES toggle → refetch so agent posts come back in the chosen language.
  document.addEventListener("click",function(e){ if(e.target.closest("#appnav .seg button")) setTimeout(load,60); });
  document.getElementById("post-send").addEventListener("click",async function(){
    var inEl=document.getElementById("post-in"),body=inEl.value.trim();if(!body)return;
    var r=await fetch("/api/comments?vdpId=0",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({body:body})});
    if(r.status===401){document.getElementById("post-msg").innerHTML='Sign in to post — <a class="cy" href="/signin">sign in →</a>';document.getElementById("post-msg").style.display="block";return;}
    var d=await r.json().catch(function(){return{};});
    if(d.ok){inEl.value="";document.getElementById("post-msg").style.display="none";load();}
  });
  // Vote + share (delegated).
  list.addEventListener("click",function(e){
    var v=e.target.closest(".vote");
    if(v){ fetch("/api/comments/vote",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({commentId:+v.dataset.id,dir:+v.dataset.dir})})
      .then(function(r){ if(r.status===401){document.getElementById("post-msg").innerHTML='Sign in to vote — <a class="cy" href="/signin">sign in →</a>';document.getElementById("post-msg").style.display="block";return null;} return r.json(); })
      .then(function(x){ if(x&&x.ok)load(); }).catch(function(){}); return; }
    var sh=e.target.closest(".act-share");
    if(sh){ var body=(sh.closest(".post").querySelector(".post-body")||{}).textContent||"", u=location.origin+"/feed";
      if(navigator.share)navigator.share({title:"CarNimbus",text:body,url:u}).catch(function(){});
      else if(navigator.clipboard){navigator.clipboard.writeText(body+" — "+u);var pm=document.getElementById("post-msg");if(pm){pm.textContent="Copied to share.";pm.style.display="block";setTimeout(function(){pm.style.display="none";},1500);}} return; }
    var rp=e.target.closest(".act-reply");
    if(rp){ var inEl=document.getElementById("post-in"); if(inEl){ var at=rp.dataset.h?("@"+String(rp.dataset.h).split(" ")[0]+" "):""; inEl.value=at; inEl.focus(); inEl.scrollIntoView({block:"center"}); } }
  });
  setInterval(function(){ if(document.visibilityState!=="hidden") load(); }, 20000);   // live refresh
});
