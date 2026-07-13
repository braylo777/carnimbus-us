document.addEventListener("DOMContentLoaded",function(){
  // orbit canvas (unchanged aesthetic)
  var cv=document.getElementById("orbit"),g=cv.getContext("2d"),P=[];
  function size(){cv.width=innerWidth;cv.height=innerHeight;} size(); addEventListener("resize",size);
  for(var i=0;i<140;i++)P.push({r:0.20+0.13*(i%3)+Math.random()*0.03,a:Math.random()*Math.PI*2,
    s:(0.0016+Math.random()*0.0020)*((i%2)?1:-1),z:0.4+Math.random()*0.6});
  (function draw(){ g.clearRect(0,0,cv.width,cv.height);
    var cx=cv.width/2,cy=cv.height*0.30,R=Math.min(cv.width,cv.height);
    P.forEach(function(p){ p.a+=p.s;
      var x=cx+Math.cos(p.a)*R*p.r*1.35, y=cy+Math.sin(p.a)*R*p.r*0.55;
      g.beginPath(); g.arc(x,y,1.5*p.z,0,7);
      g.fillStyle="rgba(24,200,255,"+(0.22+0.5*p.z)+")"; g.fill(); });
    requestAnimationFrame(draw); })();

  var lock=document.getElementById("nimbus-lock"), msg=document.getElementById("nl-msg");
  var KEYS=["cars","scansToday","scansTotal","profiles","profilesToday","riders","ridersToday",
            "leadsToday","leadsTotal","drives","drivesToday","embeddings","chats","eventsToday","dealersOn","dealersActive"];
  function key(){ try{ return localStorage.getItem("cn_admin")||""; }catch(_){ return ""; } }
  function setKey(k){ try{ localStorage.setItem("cn_admin",k); }catch(_){} }
  function showLock(m){ lock.style.display="flex"; if(m) msg.textContent=m; }
  function hideLock(){ lock.style.display="none"; }
  function fmt(n){ return (n==null)?"–":Number(n).toLocaleString(); }
  function load(){ var k=key(); if(!k){ showLock(""); return; }
    fetch("/api/ai/pulse",{headers:{"x-admin-key":k}}).then(function(r){
      if(r.status===403){ try{localStorage.removeItem("cn_admin");}catch(_){}; showLock("Wrong key — try again."); return null; }
      return r.json();
    }).then(function(d){ if(!d||!d.ok) return; hideLock();
      KEYS.forEach(function(kk){ var el=document.getElementById("ai-"+kk); if(el) el.textContent=fmt(d[kk]); });
      var sub=function(id,pre,v){ var el=document.getElementById(id); if(el&&v!=null) el.textContent=pre+fmt(v); };
      sub("ai-scansTotal","total ",d.scansTotal); sub("ai-profilesToday","+",d.profilesToday);
      sub("ai-leadsTotal","total ",d.leadsTotal); sub("ai-drives","total ",d.drives);
      sub("ai-riders","total ",d.riders); sub("ai-dealersActive","paid ",d.dealersActive);
      var st=document.getElementById("ai-stamp"); if(st) st.textContent=(d.today||"")+" · LIVE";
    }).catch(function(){});
  }
  function unlock(k){ k=(k||"").trim(); if(!k){ msg.textContent="Enter your key."; return; } setKey(k); msg.textContent=""; load(); }
  document.getElementById("nl-go").addEventListener("click",function(){ unlock(document.getElementById("nl-key").value); });
  document.getElementById("nl-key").addEventListener("keydown",function(e){ if(e.key==="Enter") unlock(this.value); });
  document.getElementById("nl-file").addEventListener("click",function(){ document.getElementById("nl-fileinput").click(); });
  document.getElementById("nl-fileinput").addEventListener("change",function(e){ var f=e.target.files&&e.target.files[0]; if(!f) return;
    var rd=new FileReader(); rd.onload=function(){ unlock(String(rd.result||"")); }; rd.readAsText(f); });

  load(); setInterval(load,30000);
});
