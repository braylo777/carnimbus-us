document.addEventListener("DOMContentLoaded",function(){
  // ============ NIMBUS console — single page, flash-key custody, conversational ops brain ============
  // FLASH-ONLY custody: the key lives in MEMORY ONLY (never localStorage/sessionStorage). A 2s heartbeat re-reads
  // the keyfile via its live handle; losing the drive wipes the key + hard-refreshes. No re-key inside; the
  // browser Back button returns to the console (panels are in-page), it does not log you out.
  try{localStorage.removeItem("cn_admin");}catch(_){}
  function $(id){return document.getElementById(id);}
  function esc(s){return String(s==null?"":s).replace(/[<&>"]/g,function(c){return {"<":"&lt;","&":"&amp;",">":"&gt;","\"":"&quot;"}[c];});}
  function fmt(n){return (n==null)?"–":Number(n).toLocaleString();}
  var lock=$("nimbus-lock"), cons=$("console"), nlmsg=$("nl-msg");

  var memKey="", flashHandle=null, tether=null, reloading=false, tetherMiss=0;
  var panelTimers=[], CUR_PANEL=null, chatHistory=[], typing=null;

  function hdr(){return {"x-admin-key":memKey,"content-type":"application/json"};}
  function showLock(m){ lock.style.display="flex"; cons.style.display="none"; if(m!=null) nlmsg.textContent=m; }
  function hideLock(){ lock.style.display="none"; cons.style.display="block"; }
  function clearPanelTimers(){ panelTimers.forEach(clearInterval); panelTimers=[]; }
  function authOr(r){ if(r.status===403){ authFail(); return null; } return r; }
  function authFail(){ lockNow("Wrong key — try again."); }
  function lockNow(m){ memKey=""; flashHandle=null;
    if(tether){ clearInterval(tether); tether=null; } clearPanelTimers(); if(typing){ clearInterval(typing); typing=null; }
    try{localStorage.removeItem("cn_admin");}catch(_){}
    GN=[]; GE=[];
    showLock(m||"");
    if(!reloading){ reloading=true; setTimeout(function(){ location.replace(location.pathname+location.hash); },700); } }
  // heartbeat with one-retry tolerance: a single transient getFile() blip won't nuke the session; two in a row does
  function startTether(){ if(tether) clearInterval(tether); tetherMiss=0;
    tether=setInterval(function(){ if(!flashHandle) return;
      flashHandle.getFile().then(function(f){ return f.text(); }).then(function(t){
        tetherMiss=0; if(String(t||"").trim()!==memKey) lockNow("Key changed on flash — reinsert and unlock.");
      }).catch(function(){ tetherMiss++; if(tetherMiss>=2) lockNow("Flash disconnected — NIMBUS locked."); });
    },2000); }
  function unlockFlash(k,handle){ k=(k||"").trim(); if(!k){ nlmsg.textContent="That file is empty."; return; }
    memKey=k; flashHandle=handle||null; nlmsg.textContent="";
    if(flashHandle) startTether(); else nlmsg.textContent="Unlocked (no live handle — this browser can't watch the drive).";
    hideLock(); loadPulse();
    if(!chatHistory.length) greet();
    var h=(location.hash||"").replace("#",""); if(h && $("panel-"+h)) showPanel(h);
  }
  $("nl-file").addEventListener("click",function(){
    if(window.showOpenFilePicker){
      showOpenFilePicker({multiple:false}).then(function(hs){ var h=hs&&hs[0]; if(!h) return;
        h.getFile().then(function(f){ return f.text(); }).then(function(t){ unlockFlash(String(t||""),h); })
         .catch(function(){ nlmsg.textContent="Couldn't read that file."; });
      }).catch(function(){});
    } else { $("nl-fileinput").click(); }
  });
  $("nl-fileinput").addEventListener("change",function(e){ var f=e.target.files&&e.target.files[0]; if(!f) return;
    var rd=new FileReader(); rd.onload=function(){ unlockFlash(String(rd.result||""),null); }; rd.readAsText(f); });
  $("klock").addEventListener("click",function(){ lockNow("Locked."); });

  // ---------- metrics ----------
  function loadPulse(){ if(!memKey) return;
    fetch("/api/ai/pulse",{headers:hdr()}).then(authOr).then(function(r){ return r?r.json():null; }).then(function(d){
      if(!d||!d.ok) return;
      $("m-scans").textContent=fmt(d.scansToday);
      $("m-scans-s").textContent=(d.scansYesterday!=null?("yest "+fmt(d.scansYesterday)):"");
      $("m-drives").textContent=fmt(d.driveNowsToday);
      $("m-drives-s").textContent=(d.scansToday? d.convRate+"% of scans":"");
      $("m-inv").textContent=fmt(d.liveInventory);
      $("m-inv-s").textContent="+"+fmt(d.inToday)+" in · −"+fmt(d.outToday)+" out today";
      if(d.degraded){ $("m-inv-s").textContent="data degraded — some tables unavailable"; }
    }).catch(function(){});
  }

  // ---------- chat (talk to Nimbus) ----------
  function addMsg(role,text){ var d=document.createElement("div");
    if(role==="n"){ d.className="b n"; d.innerHTML='<div class="who">NIMBUS</div><span></span>'; d.lastChild.textContent=text; }
    else { d.className="b u"; d.textContent=text; }
    $("log").appendChild(d); $("log").scrollTop=$("log").scrollHeight; return d; }
  function think(on){ $("wave").classList.toggle("on",on); }
  function greet(){ addMsg("n","Nimbus online. Ask me about scans, drive-nows, inventory, or top models — or tell me to take an action (turn a dealer on/off, take a car in/out, reindex)."); }
  function typewriter(el,text){ if(typing) clearInterval(typing); el.textContent=""; var i=0;
    typing=setInterval(function(){ el.textContent=text.slice(0,++i); $("log").scrollTop=$("log").scrollHeight; if(i>=text.length){ clearInterval(typing); typing=null; } },12); }
  function renderConfirm(p){ var c=document.createElement("div"); c.className="confirm";
    c.innerHTML="Nimbus wants to run <b>"+esc(p.name)+"</b> "+esc(JSON.stringify(p.args))+
      '<div class="act"><button class="btn2 sm" data-yes>Confirm</button><button class="btn2 ghost sm" data-no>Dismiss</button></div>';
    $("log").appendChild(c); $("log").scrollTop=$("log").scrollHeight;
    c.querySelector("[data-yes]").onclick=function(){ c.remove(); act(p); };
    c.querySelector("[data-no]").onclick=function(){ c.remove(); addMsg("n","Okay, cancelled."); };
  }
  function ask(){ var inp=$("ask"), q=inp.value.trim(); if(!q||!memKey) return; inp.value="";
    addMsg("u",q); chatHistory.push({role:"user",content:q}); think(true);
    fetch("/api/ai/ask",{method:"POST",headers:hdr(),body:JSON.stringify({question:q,history:chatHistory})})
      .then(authOr).then(function(r){ return r?r.json():null; }).then(function(d){ think(false);
        if(!d){ return; } if(!d.ok){ addMsg("n","(couldn't reach the model — try again)"); return; }
        var el=addMsg("n",""); typewriter(el.lastChild,d.answer||"…"); chatHistory.push({role:"assistant",content:d.answer||""});
        if(d.proposed_action) setTimeout(function(){ renderConfirm(d.proposed_action); },300);
      }).catch(function(){ think(false); addMsg("n","(network error)"); });
  }
  function act(p){ addMsg("n","Working on it…"); think(true);
    fetch("/api/ai/act",{method:"POST",headers:hdr(),body:JSON.stringify({action:p.name,args:p.args,confirm:true})})
      .then(authOr).then(function(r){ return r?r.json():null; }).then(function(d){ think(false);
        if(!d){ return; } addMsg("n", d.ok? ("Done — "+d.result) : ("Couldn't do that: "+(d.error||"failed")) );
        loadPulse(); if(CUR_PANEL==="inventory") invLoad();
      }).catch(function(){ think(false); addMsg("n","(action failed — network)"); });
  }
  $("send").addEventListener("click",ask);
  $("ask").addEventListener("keydown",function(e){ if(e.key==="Enter") ask(); });

  // ---------- panels + back-button ----------
  function showPanel(name){ if(!memKey) return; clearPanelTimers(); CUR_PANEL=name;
    document.querySelectorAll(".panel").forEach(function(p){ p.classList.remove("on"); });
    var el=$("panel-"+name); if(!el) return; el.classList.add("on");
    try{ if(location.hash!=="#"+name) history.pushState({panel:name},"","#"+name); }catch(_){}
    ({inventory:invLoad,buyers:buyLoad,trends:trLoad,graph:graphOpen}[name]||function(){})();
    window.scrollTo(0,el.offsetTop-10);
  }
  function closePanels(){ clearPanelTimers(); CUR_PANEL=null; graphOn=false;
    document.querySelectorAll(".panel").forEach(function(p){ p.classList.remove("on"); });
    try{ if(location.hash) history.replaceState({},"",location.pathname); }catch(_){}
    window.scrollTo(0,0);
  }
  document.querySelectorAll("[data-panel]").forEach(function(b){ b.addEventListener("click",function(){ showPanel(b.dataset.panel); }); });
  document.querySelectorAll("[data-back]").forEach(function(b){ b.addEventListener("click",function(){ history.back(); }); });
  window.addEventListener("popstate",function(){ if(CUR_PANEL) closePanels(); });

  // ---------- INVENTORY ----------
  function parseCSV(text){ var rows=[],i=0,f="",row=[],q=false;
    var push=function(){row.push(f);f="";},end=function(){push();rows.push(row);row=[];};
    while(i<text.length){var c=text[i];
      if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}
      else if(c==='"')q=true;else if(c===",")push();else if(c==="\n")end();else if(c!=="\r")f+=c;i++;}
    if(f.length||row.length)end(); return rows; }
  function toObjects(rows){ var head=(rows.shift()||[]).map(function(h){return h.trim();});
    return rows.filter(function(r){return r.length>1;}).map(function(r){var o={};head.forEach(function(h,j){o[h]=(r[j]||"").trim();});return o;}); }
  var INV=[];
  function invRender(){ var f=($("inv-search").value||"").toLowerCase();
    var show=INV.filter(function(c){ return !f || (c.make+" "+c.model+" "+c.vin+" "+c.year).toLowerCase().indexOf(f)>-1; });
    $("inv-table").innerHTML="<tr><th>Year</th><th>Make</th><th>Model</th><th>$/mo</th><th>VIN</th><th></th></tr>"+
      show.slice(0,200).map(function(c){ return "<tr><td>"+esc(c.year)+"</td><td>"+esc(c.make)+"</td><td>"+esc(c.model)+"</td><td>"+esc(c.price_mo)+"</td><td>"+esc(c.vin)+"</td>"+
        "<td><button class='btn2 ghost sm' data-out='"+esc(c.vin)+"'>take out</button></td></tr>"; }).join("");
    $("inv-table").querySelectorAll("[data-out]").forEach(function(b){ b.onclick=function(){ if(confirm("Take "+b.dataset.out+" out of inventory?")) act({name:"deactivate_vin",args:{vin:b.dataset.out}}); }; });
  }
  function invLoad(){ $("inv-msg").textContent="Loading inventory…";
    fetch("/api/admin/export?pool=vdps",{headers:hdr()}).then(authOr).then(function(r){ if(!r)return null; if(!r.ok)throw r.status; return r.text(); }).then(function(csv){
      if(csv==null)return; INV=toObjects(parseCSV(csv)).filter(function(c){return (c.active==null||c.active==="1"||c.active==="");}); $("inv-msg").textContent=""; invRender();
    }).catch(function(e){ $("inv-msg").textContent=e===403?"Locked / bad key.":"Load failed."; });
    fetch("/api/ai/pulse",{headers:hdr()}).then(authOr).then(function(r){return r?r.json():null;}).then(function(d){ if(d&&d.ok) $("inv-io").textContent="+"+fmt(d.inToday)+" in · −"+fmt(d.outToday)+" out · "+fmt(d.liveInventory)+" live"; }).catch(function(){});
  }
  $("inv-search").addEventListener("input",invRender);
  $("inv-dl").addEventListener("click",function(){ fetch("/api/admin/export?pool=vdps",{headers:hdr()}).then(authOr).then(function(r){ if(!r)return null; if(!r.ok)throw 0; return r.blob(); }).then(function(bl){ if(!bl)return; var a=document.createElement("a"); a.href=URL.createObjectURL(bl); a.download="inventory.csv"; a.click(); }).catch(function(){ $("inv-msg").textContent="Download failed."; }); });
  $("inv-up").addEventListener("click",function(){ $("inv-file").click(); });
  $("inv-file").addEventListener("change",function(){ var file=$("inv-file").files[0]; if(!file)return; $("inv-file").value="";
    var rd=new FileReader(); rd.onload=async function(){ var recs=toObjects(parseCSV(rd.result)); if(!recs.length){ $("inv-msg").textContent="Empty CSV."; return; }
      var ok=0,sk=0,fa=0; for(var i=0;i<recs.length;i+=50){ var batch=recs.slice(i,i+50).map(function(c){ c.features=c.features?c.features.split("|"):[]; c.photos=c.photo?[c.photo]:[]; return c; });
        var r=await fetch("/api/vdp/ingest",{method:"POST",headers:hdr(),body:JSON.stringify(batch)}); if(r.status===403){ authFail(); return; }
        if(!r.ok){ $("inv-msg").textContent="Upload failed (HTTP "+r.status+")."; return; }
        var d=await r.json().catch(function(){return{};}); ok+=(d.count||0); sk+=(d.skipped||0); fa+=(d.failed||0); $("inv-msg").textContent="Saved "+ok+"…"; }
      $("inv-msg").textContent="Saved "+ok+(sk?", skipped "+sk:"")+(fa?", failed "+fa:"")+" — hit Reindex."; invLoad(); };
    rd.readAsText(file); });
  $("inv-reindex").addEventListener("click",function(){ $("inv-msg").textContent="Reindexing…";
    fetch("/api/admin/reindex",{method:"POST",headers:hdr()}).then(authOr).then(function(r){ if(!r)return null; if(!r.ok)throw r.status; return r.json(); }).then(function(d){ if(d) $("inv-msg").textContent="Indexed "+(d.indexed||0)+" items."; }).catch(function(e){ $("inv-msg").textContent=e===403?"Locked.":"Reindex failed."; }); });

  // ---------- BUYERS ----------
  var BUY=[];
  function buyLoad(){ $("buy-msg").textContent="Loading…";
    fetch("/api/admin/buyers",{headers:hdr()}).then(authOr).then(function(r){ return r?r.json():null; }).then(function(d){
      if(!d||!d.ok){ $("buy-msg").textContent="Load failed."; return; } BUY=d.buyers||[]; $("buy-count").textContent=BUY.length+" records"; $("buy-msg").textContent="";
      $("buy-table").innerHTML="<tr><th>Date</th><th>Zip</th><th>Type</th><th>Deal</th><th>$/mo</th><th>Down</th><th>Car picked</th><th>Email</th></tr>"+
        BUY.slice(0,300).map(function(b){ return "<tr><td>"+esc(String(b.created_at).slice(0,10))+"</td><td>"+esc(b.zip)+"</td><td>"+esc(b.dream_car)+"</td><td>"+esc(b.deal_type)+"</td><td>"+esc(b.monthly)+"</td><td>"+esc(b.down)+"</td><td>"+esc(b.matched_car)+"</td><td>"+esc(b.email||"—")+"</td></tr>"; }).join("");
    }).catch(function(){ $("buy-msg").textContent="Load failed."; });
  }
  $("buy-dl").addEventListener("click",function(){ if(!BUY.length)return;
    var cols=["created_at","zip","dream_car","deal_type","monthly","down","matched_car","email"];
    var csv=cols.join(",")+"\n"+BUY.map(function(b){ return cols.map(function(k){ return '"'+String(b[k]==null?"":b[k]).replace(/"/g,'""')+'"'; }).join(","); }).join("\n");
    var a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download="buyers.csv"; a.click(); });

  // ---------- TRENDS (inline SVG) ----------
  function barChart(data){ if(!data||!data.length) return '<div style="color:var(--mut);font:600 11px Manrope">No data yet.</div>';
    var max=Math.max.apply(null,data.map(function(d){return d.c;}).concat([1]));
    return data.slice(0,8).map(function(d){ var w=Math.max(3,Math.round(d.c/max*100));
      return '<div style="display:flex;align-items:center;gap:8px;margin:5px 0;font:600 11px Manrope"><span style="width:34%;color:#aebfdf;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(d.t||"—")+'</span>'+
        '<span style="flex:1;height:9px;background:rgba(24,200,255,.12);border-radius:5px;overflow:hidden"><span style="display:block;height:100%;width:'+w+'%;background:var(--cy)"></span></span>'+
        '<span style="width:34px;text-align:right;color:var(--cy)">'+d.c+'</span></div>'; }).join("");
  }
  function pieChart(data){ if(!data||!data.length) return '<div style="color:var(--mut);font:600 11px Manrope">No data yet.</div>';
    var total=data.reduce(function(a,b){return a+b.c;},0)||1, cols=["#18C8FF","#5ee6a8","#b98cff","#ffce54","#ff8f8f","#6ee7ff"], acc=0, segs="";
    data.slice(0,6).forEach(function(d,i){ var frac=d.c/total, a0=acc*2*Math.PI-Math.PI/2; acc+=frac; var a1=acc*2*Math.PI-Math.PI/2;
      var x0=50+40*Math.cos(a0),y0=50+40*Math.sin(a0),x1=50+40*Math.cos(a1),y1=50+40*Math.sin(a1),big=frac>0.5?1:0;
      segs+='<path d="M50 50 L'+x0.toFixed(1)+' '+y0.toFixed(1)+' A40 40 0 '+big+' 1 '+x1.toFixed(1)+' '+y1.toFixed(1)+' Z" fill="'+cols[i%6]+'"></path>'; });
    var legend=data.slice(0,6).map(function(d,i){ return '<div style="display:flex;align-items:center;gap:6px;font:600 10px Manrope;margin:2px 0"><span style="width:9px;height:9px;border-radius:2px;background:'+cols[i%6]+'"></span><span style="color:#aebfdf">'+esc(d.t||"—")+'</span><span style="color:var(--mut);margin-left:auto">'+d.c+'</span></div>'; }).join("");
    return '<div style="display:flex;gap:12px;align-items:center"><svg viewBox="0 0 100 100" width="96" height="96">'+segs+'</svg><div style="flex:1">'+legend+'</div></div>';
  }
  function sparkline(data){ if(!data||!data.length) return '<div style="color:var(--mut);font:600 11px Manrope">No data yet.</div>';
    var max=Math.max.apply(null,data.map(function(d){return d.c;}).concat([1])), n=data.length, W=600, H=90;
    var pts=data.map(function(d,i){ return (i/(Math.max(1,n-1))*W).toFixed(1)+","+(H-8-(d.c/max*(H-20))).toFixed(1); }).join(" ");
    return '<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="90" preserveAspectRatio="none"><polyline points="'+pts+'" fill="none" stroke="#18C8FF" stroke-width="2"></polyline></svg>'+
      '<div style="display:flex;justify-content:space-between;font:600 9px IBM Plex Mono;color:var(--mut)"><span>'+esc(String((data[0]||{}).d||"").slice(5))+'</span><span>'+esc(String((data[n-1]||{}).d||"").slice(5))+'</span></div>';
  }
  function trLoad(){ $("tr-msg").textContent="Loading…";
    fetch("/api/ai/trends",{headers:hdr()}).then(authOr).then(function(r){ return r?r.json():null; }).then(function(d){
      if(!d||!d.ok){ $("tr-msg").textContent="Load failed."; return; } $("tr-msg").textContent="";
      $("tr-type").innerHTML=pieChart(d.byType); $("tr-deal").innerHTML=pieChart(d.byDeal);
      $("tr-cars").innerHTML=barChart(d.topCars); $("tr-zip").innerHTML=barChart(d.byZip);
      $("tr-time").innerHTML=sparkline((d.overTime||[]).map(function(x){return {d:x.d,c:x.c};}));
    }).catch(function(){ $("tr-msg").textContent="Load failed."; });
  }

  // ---------- NEURAL NET (force-directed) ----------
  var ng=$("netgraph"), ngx=ng.getContext("2d"), GN=[], GE=[], graphOn=false, running=false;
  var COL={dealer:"#5ee6a8",car:"#18C8FF",rider:"#b98cff",profile:"#ffce54"};
  function ngsize(){ ng.width=ng.clientWidth||innerWidth; ng.height=ng.clientHeight||Math.round(innerHeight*0.6); }
  addEventListener("resize",function(){ if(graphOn){ ngsize(); } });
  function graphOpen(){ graphOn=true; ngsize(); loadGraph(); if(!running){ running=true; requestAnimationFrame(tick); } }
  function loadGraph(){ if(!memKey) return;
    fetch("/api/ai/graph",{headers:hdr()}).then(authOr).then(function(r){ return r?r.json():null; }).then(function(d){ if(!d||!d.ok||!d.nodes) return;
      var idx={}; GN=d.nodes.map(function(n,i){ idx[n.id]=i; return {type:n.type,label:n.label,val:n.val||1,
        x:ng.width/2+Math.cos(i)*140+(i%7-3)*22, y:ng.height/2+Math.sin(i)*140+(i%5-2)*22, vx:0, vy:0}; });
      GE=(d.edges||[]).map(function(e){ return {a:idx[e.a],b:idx[e.b],w:e.w||1}; }).filter(function(e){ return e.a!=null&&e.b!=null; });
    }).catch(function(){});
  }
  function tick(){ if(!graphOn){ running=false; return; } running=true;
    var i,j,n,m,dx,dy,dist,cx=ng.width/2,cy=ng.height/2;
    for(i=0;i<GN.length;i++){ n=GN[i]; for(j=i+1;j<GN.length;j++){ m=GN[j]; dx=n.x-m.x; dy=n.y-m.y; dist=Math.sqrt(dx*dx+dy*dy)||1;
      var rep=1400/(dist*dist); n.vx+=dx/dist*rep; n.vy+=dy/dist*rep; m.vx-=dx/dist*rep; m.vy-=dy/dist*rep; } }
    GE.forEach(function(e){ n=GN[e.a]; m=GN[e.b]; dx=m.x-n.x; dy=m.y-n.y; dist=Math.sqrt(dx*dx+dy*dy)||1;
      var f=(dist-90)*0.008; n.vx+=dx/dist*f; n.vy+=dy/dist*f; m.vx-=dx/dist*f; m.vy-=dy/dist*f; });
    GN.forEach(function(n){ n.vx+=(cx-n.x)*0.0016; n.vy+=(cy-n.y)*0.0016; n.vx*=0.86; n.vy*=0.86; n.x+=n.vx; n.y+=n.vy; });
    ngx.clearRect(0,0,ng.width,ng.height);
    GE.forEach(function(e){ n=GN[e.a]; m=GN[e.b]; ngx.beginPath(); ngx.moveTo(n.x,n.y); ngx.lineTo(m.x,m.y);
      ngx.strokeStyle="rgba(24,200,255,"+Math.min(0.5,0.08+e.w*0.06)+")"; ngx.lineWidth=Math.min(2.5,0.6+e.w*0.4); ngx.stroke(); });
    GN.forEach(function(n){ var rad=3+n.val*1.4; ngx.beginPath(); ngx.arc(n.x,n.y,rad,0,7);
      ngx.fillStyle=COL[n.type]||"#8ca0c4"; ngx.shadowColor=COL[n.type]||"#8ca0c4"; ngx.shadowBlur=12; ngx.fill(); ngx.shadowBlur=0;
      if(n.val>=6){ ngx.fillStyle="rgba(230,240,255,.85)"; ngx.font="9px Manrope"; ngx.fillText(n.label,n.x+rad+3,n.y+3); } });
    requestAnimationFrame(tick);
  }

  // ---------- boot ----------
  showLock("");
  setInterval(function(){ if(memKey && !CUR_PANEL) loadPulse(); },30000);
});
