document.addEventListener("DOMContentLoaded",function(){
  // ---------- living orbit + spark filaments ----------
  var cv=document.getElementById("orbit"),g=cv.getContext("2d"),P=[],F=[];
  function size(){cv.width=innerWidth;cv.height=innerHeight;} size(); addEventListener("resize",size);
  for(var i=0;i<140;i++)P.push({r:0.20+0.13*(i%3)+Math.random()*0.03,a:Math.random()*Math.PI*2,
    s:(0.0016+Math.random()*0.0020)*((i%2)?1:-1),z:0.4+Math.random()*0.6});
  for(var j=0;j<24;j++)F.push({a:Math.random()*Math.PI*2,life:Math.random()});
  (function draw(){ g.clearRect(0,0,cv.width,cv.height);
    var cx=cv.width/2,cy=cv.height*0.30,R=Math.min(cv.width,cv.height);
    P.forEach(function(p){ p.a+=p.s;
      var x=cx+Math.cos(p.a)*R*p.r*1.35, y=cy+Math.sin(p.a)*R*p.r*0.55;
      g.beginPath(); g.arc(x,y,1.5*p.z,0,7);
      g.fillStyle="rgba(24,200,255,"+(0.22+0.5*p.z)+")"; g.fill(); });
    F.forEach(function(f){ f.life+=0.012; if(f.life>=1){ f.life=0; f.a=Math.random()*Math.PI*2; }
      var flare=Math.sin(f.life*Math.PI), r0=R*0.06, r1=R*(0.06+0.13*flare);
      g.beginPath(); g.moveTo(cx+Math.cos(f.a)*r0,cy+Math.sin(f.a)*r0*0.6);
      g.lineTo(cx+Math.cos(f.a)*r1,cy+Math.sin(f.a)*r1*0.6);
      g.strokeStyle="rgba(120,225,255,"+(0.5*flare)+")"; g.lineWidth=1.4; g.stroke(); });
    requestAnimationFrame(draw); })();

  // ---------- unlock / auth ----------
  // Two custody modes:
  //  * FLASH (tethered): key loaded from the drive via a live FileSystemFileHandle. Key lives in MEMORY ONLY
  //    (never persisted); a 4s heartbeat re-reads the file — unplugging the drive kills the read → instant lock.
  //  * TYPED (fallback): key typed by hand → localStorage, untethered (also used where the File System Access
  //    API doesn't exist, e.g. Safari/mobile file-picker loads — no handle survives, so no tether possible).
  var lock=document.getElementById("nimbus-lock"), msg=document.getElementById("nl-msg");
  var KEYS=["cars","scansToday","scansTotal","profiles","profilesToday","riders","ridersToday",
            "leadsToday","leadsTotal","drives","drivesToday","embeddings","chats","eventsToday","dealersOn","dealersActive"];
  var memKey="", flashHandle=null, tether=null;
  function key(){ if(memKey) return memKey; try{ return localStorage.getItem("cn_admin")||""; }catch(_){ return ""; } }
  function showLock(m){ lock.style.display="flex"; if(m) msg.textContent=m; }
  function hideLock(){ lock.style.display="none"; }
  function fmt(n){ return (n==null)?"–":Number(n).toLocaleString(); }
  function lockNow(m){ memKey=""; flashHandle=null; if(tether){ clearInterval(tether); tether=null; }
    try{localStorage.removeItem("cn_admin");}catch(_){}
    GN=[]; GE=[]; if(graphOn) setView(false);
    showLock(m||""); }
  function authFail(){ lockNow("Wrong key — try again."); }
  function startTether(){ if(tether) clearInterval(tether);
    tether=setInterval(function(){ if(!flashHandle) return;
      flashHandle.getFile().then(function(f){ return f.text(); }).then(function(t){
        if(String(t||"").trim()!==memKey) lockNow("Key changed on flash — reinsert and unlock.");
      }).catch(function(){ lockNow("Flash disconnected — NIMBUS locked."); });
    },4000); }
  function load(){ var k=key(); if(!k){ showLock(""); return; }
    fetch("/api/ai/pulse",{headers:{"x-admin-key":k}}).then(function(r){
      if(r.status===403){ authFail(); return null; } return r.json();
    }).then(function(d){ if(!d||!d.ok) return; hideLock();
      KEYS.forEach(function(kk){ var el=document.getElementById("ai-"+kk); if(el) el.textContent=fmt(d[kk]); });
      var sub=function(id,pre,v){ var el=document.getElementById(id); if(el&&v!=null) el.textContent=pre+fmt(v); };
      sub("ai-scansTotal","total ",d.scansTotal); sub("ai-profilesToday","+",d.profilesToday);
      sub("ai-leadsTotal","total ",d.leadsTotal); sub("ai-drives","total ",d.drives);
      sub("ai-riders","total ",d.riders); sub("ai-dealersActive","paid ",d.dealersActive);
      var st=document.getElementById("ai-stamp"); if(st) st.textContent=(d.today||"")+" · LIVE"+(flashHandle?" · TETHERED":"");
    }).catch(function(){});
  }
  function unlockTyped(k){ k=(k||"").trim(); if(!k){ msg.textContent="Enter your key."; return; }
    memKey=""; flashHandle=null; if(tether){ clearInterval(tether); tether=null; }
    try{ localStorage.setItem("cn_admin",k); }catch(_){}
    msg.textContent=""; load(); if(graphOn) loadGraph(); }
  function unlockFlash(k,handle){ k=(k||"").trim(); if(!k){ msg.textContent="That file is empty."; return; }
    memKey=k; flashHandle=handle||null;
    try{localStorage.removeItem("cn_admin");}catch(_){}   // flash sessions never persist the key
    msg.textContent=""; if(flashHandle) startTether();
    load(); if(graphOn) loadGraph(); }
  document.getElementById("nl-go").addEventListener("click",function(){ unlockTyped(document.getElementById("nl-key").value); });
  document.getElementById("nl-key").addEventListener("keydown",function(e){ if(e.key==="Enter") unlockTyped(this.value); });
  document.getElementById("nl-file").addEventListener("click",function(){
    if(window.showOpenFilePicker){
      showOpenFilePicker({multiple:false}).then(function(hs){ var h=hs&&hs[0]; if(!h) return;
        h.getFile().then(function(f){ return f.text(); }).then(function(t){ unlockFlash(String(t||""),h); })
         .catch(function(){ msg.textContent="Couldn't read that file."; });
      }).catch(function(){});                              // picker dismissed
    } else { document.getElementById("nl-fileinput").click(); }
  });
  document.getElementById("nl-fileinput").addEventListener("change",function(e){ var f=e.target.files&&e.target.files[0]; if(!f) return;
    var rd=new FileReader(); rd.onload=function(){ unlockFlash(String(rd.result||""),null); }; rd.readAsText(f); });

  // ---------- neural-net graph (vanilla force-directed) ----------
  var ng=document.getElementById("netgraph"), ngx=ng.getContext("2d"), hud=document.querySelector(".hud");
  var GN=[], GE=[], graphOn=false, running=false;
  var COL={dealer:"#5ee6a8",car:"#18C8FF",rider:"#b98cff",profile:"#ffce54"};
  function ngsize(){ ng.width=innerWidth; ng.height=innerHeight; } addEventListener("resize",ngsize); ngsize();
  function loadGraph(){ var k=key(); if(!k){ showLock(""); return; }
    fetch("/api/ai/graph",{headers:{"x-admin-key":k}}).then(function(r){
      if(r.status===403){ authFail(); return null; } return r.json();
    }).then(function(d){ if(!d||!d.ok||!d.nodes) return;
      var idx={}; GN=d.nodes.map(function(n,i){ idx[n.id]=i;
        return {type:n.type,label:n.label,val:n.val||1,
          x:innerWidth/2+Math.cos(i)*140+(i%7-3)*22, y:innerHeight/2+Math.sin(i)*140+(i%5-2)*22, vx:0, vy:0}; });
      GE=(d.edges||[]).map(function(e){ return {a:idx[e.a],b:idx[e.b],w:e.w||1}; })
                      .filter(function(e){ return e.a!=null&&e.b!=null; });
    }).catch(function(){});
  }
  function tick(){ if(!graphOn){ running=false; return; } running=true;
    var i,j,n,m,dx,dy,dist,cx=innerWidth/2,cy=innerHeight/2;
    for(i=0;i<GN.length;i++){ n=GN[i];
      for(j=i+1;j<GN.length;j++){ m=GN[j]; dx=n.x-m.x; dy=n.y-m.y; dist=Math.sqrt(dx*dx+dy*dy)||1;
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
  function setView(graph){ graphOn=graph;
    document.getElementById("v-graph").classList.toggle("on",graph);
    document.getElementById("v-metrics").classList.toggle("on",!graph);
    ng.style.display=graph?"block":"none"; if(hud) hud.style.display=graph?"none":"block";
    if(graph){ loadGraph(); if(!running){ running=true; requestAnimationFrame(tick); } }
  }
  document.getElementById("v-graph").addEventListener("click",function(){ setView(true); });
  document.getElementById("v-metrics").addEventListener("click",function(){ setView(false); });

  // ---------- boot + 30s poll ----------
  load(); setInterval(function(){ load(); if(graphOn) loadGraph(); },30000);
});
