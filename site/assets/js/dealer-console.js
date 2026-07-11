document.addEventListener("DOMContentLoaded",function(){
  var CUR=null;
  function show(id){["gate401","gate403","console"].forEach(function(x){document.getElementById(x).style.display=(x===id?"":"none");});}
  function pct(a,b){return b?Math.round(a/b*100):0;}
  function aprFor(mo){return mo>=550?"6.1":mo>=520?"6.8":mo>=480?"6.4":"5.9";}
  function ini(w){return (w||"R").split(" ").map(function(x){return x[0]||"";}).join("").slice(0,2).toUpperCase();}
  function card(a){
    var act=a.status==="sold"?'<span class="badge green" style="width:100%;justify-content:center">✓ Sold today</span>'
      :a.status==="arrived"?'<a class="btn primary sm" href="/scan?sold=1" style="text-decoration:none;width:100%;justify-content:center">Scan QR · mark sold</a>'
      :a.status==="confirmed"?'<a class="btn primary sm" href="/scan" style="text-decoration:none;width:100%;justify-content:center">Scan QR · check in</a>'
      :'<span style="display:flex;justify-content:center;font:600 10px Manrope;color:#7f93b8;border:1px dashed rgba(24,200,255,.25);border-radius:10px;padding:8px">🔒 AI still chatting</span>';
    var pill={confirmed:"#18C8FF",arrived:"#b18cff",sold:"#54d699",requested:"#8ca0c4"}[a.status]||"#8ca0c4";
    return '<div class="glass" data-drive="'+a.id+'" style="border-radius:14px;padding:11px;cursor:pointer">'+
      '<div class="row" style="align-items:center;gap:8px"><span class="avatar" style="width:26px;height:26px;font-size:9px">'+ini(a.who)+'</span>'+
      '<span style="flex:1;min-width:0"><span style="display:block;font:700 11px Manrope;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+a.who+'</span>'+
      '<span class="mono" style="font-size:8px;color:#18C8FF">CID# '+a.cid+'</span></span>'+
      '<span class="mono" style="font-size:7px;color:'+pill+';border:1px solid '+pill+'55;border-radius:99px;padding:3px 7px">'+a.status.toUpperCase()+'</span></div>'+
      '<div style="height:64px;border-radius:9px;overflow:hidden;margin:9px 0">'+(a.photos&&a.photos[0]?'<img src="'+a.photos[0]+'" style="width:100%;height:100%;object-fit:cover">':'')+'</div>'+
      '<div style="font:700 11px Manrope">'+a.year+' '+a.make+' '+a.model+(a.trim?' '+a.trim:'')+'</div>'+
      '<div class="row" style="justify-content:space-between;font:600 9px Manrope;color:#8ca0c4;margin:3px 0 8px"><span>$'+a.price_mo+'/mo · $0 down</span><span>'+aprFor(a.price_mo)+'% APR · 72 mo</span></div>'+
      '<div class="row" style="justify-content:space-between;font:600 8px Manrope;color:#7f93b8;margin-bottom:8px"><span class="mono" style="color:#18C8FF">FICO 700-739</span><span>'+a.slot+'</span></div>'+act+'</div>';
  }
  function load(){fetch("/api/dealer/console").then(function(r){
    if(r.status===401){show("gate401");throw 0;} if(r.status===403){show("gate403");throw 0;} return r.json();
  }).then(function(d){ show("console");
    document.getElementById("dc-store").textContent=d.dealer.dealership;
    document.getElementById("dc-name").textContent=d.dealer.name;
    document.getElementById("dc-role").textContent=d.dealer.role||"";
    document.getElementById("dc-av").textContent=ini(d.dealer.name);
    document.getElementById("dc-today").textContent="TODAY · "+new Date().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}).toUpperCase();
    if(d.dealer.client_no)document.getElementById("dc-cn").textContent="CN · ••••-"+String(d.dealer.client_no).slice(-4);
    var live=(d.appointments||[]).filter(function(a){return a.status!=="sold";});
    var soon=document.getElementById("dc-soon");
    soon.style.display=live.length?"":"none"; soon.textContent="● "+live.length+" arriving within the hour";
    var next=live[0];
    document.getElementById("do-now").style.display=next?"flex":"none";
    if(next){var e=function(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");};
      document.getElementById("dn-txt").innerHTML='Do now: <span class="cy">'+e(next.who)+'</span> arrives '+e(next.slot)+' — scan their QR to check them in.';}
    CUR=d;   // S1: keep the payload so tapping an appointment can preview its Drive-Now pass
    var rolling=(d.appointments||[]).slice().sort(function(a,b){return String(a.slot).localeCompare(String(b.slot));});
    document.getElementById("appts").innerHTML=rolling.map(card).join('')||
      '<div style="grid-column:1/-1;font:600 12px Manrope;color:#aebfdf;padding:20px;text-align:center">No routed buyers yet — they appear here the moment the AI books a drive.</div>';
    // S1: rolling schedule — a 4-hour window from now glows so you can see what's coming at a glance.
    // Slots are stored as LA wall-clock strings — the window must be computed in the same clock, never UTC.
    var laFmt=function(d){return d.toLocaleString("sv-SE",{timeZone:"America/Los_Angeles"}).slice(0,16);};
    var now=new Date(), lo=laFmt(now), hi=laFmt(new Date(now.getTime()+4*3600e3));
    document.getElementById("sched").innerHTML=rolling.map(function(a){
      var pill={confirmed:"#18C8FF",arrived:"#b18cff",sold:"#54d699",requested:"#8ca0c4"}[a.status]||"#8ca0c4";
      var inWindow=String(a.slot)>=lo&&String(a.slot)<=hi;
      return '<div class="row" data-drive="'+a.id+'" style="align-items:center;gap:10px;padding:7px 8px;border-bottom:1px solid rgba(24,200,255,.08);font:600 11px Manrope;cursor:pointer;border-radius:8px'+(inWindow?';background:rgba(24,200,255,.08)':'')+'">'+
      '<span class="mono" style="font-size:9px;color:'+(inWindow?'#18C8FF':'#8ca0c4')+';min-width:74px">'+a.slot+'</span>'+
      '<span class="avatar" style="width:20px;height:20px;font-size:8px">'+ini(a.who)+'</span>'+
      '<span style="min-width:110px">'+a.who+'</span><span style="flex:1;color:#8ca0c4">'+a.year+' '+a.make+' '+a.model+(a.trim?' '+a.trim:'')+'</span>'+
      '<span class="mono" style="font-size:7px;color:'+pill+';border:1px solid '+pill+'55;border-radius:99px;padding:3px 7px">'+a.status.toUpperCase()+'</span></div>';}).join('');
    document.getElementById("lst").innerHTML=(d.listings||[]).map(function(l){
      return '<div class="row" style="align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(24,200,255,.08);font:600 11px Manrope">'+
      '<span style="flex:1">'+l.year+' '+l.make+' '+l.model+(l.trim?' '+l.trim:'')+'</span><span class="cy">$'+l.price_mo+'/mo</span>'+
      (l.active?'<span class="badge green">Live</span>':'<span class="badge red">Off</span>')+'</div>';}).join('');
  }).catch(function(){});}
  load(); setInterval(load,30000);
  // S1: tap any appointment (card or schedule row) → Drive-Now pass preview (who, params, what they'll drive).
  document.addEventListener("click",function(e){
    var el=e.target.closest("[data-drive]"); if(!el||e.target.closest("a,button"))return;
    var a=((CUR&&CUR.appointments)||[]).filter(function(x){return String(x.id)===el.dataset.drive;})[0]; if(!a)return;
    var esc2=function(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");};
    document.getElementById("ap-body").innerHTML=
      '<div class="row" style="align-items:center;gap:9px"><span class="avatar" style="width:30px;height:30px;font-size:11px">'+ini(a.who)+'</span>'+
      '<span><span style="display:block;font:700 13px Manrope;color:#fff">'+esc2(a.who)+'</span><span class="mono" style="font-size:8px;color:#18C8FF">CID# '+esc2(a.cid)+'</span></span></div>'+
      (a.photos&&a.photos[0]?'<div style="height:110px;border-radius:10px;overflow:hidden;margin:10px 0"><img src="'+esc2(a.photos[0])+'" style="width:100%;height:100%;object-fit:cover"></div>':'')+
      '<div style="font:700 13px Manrope;color:#fff">'+esc2(a.year+" "+a.make+" "+a.model+(a.trim?" "+a.trim:""))+'</div>'+
      '<div class="row" style="justify-content:space-between;font:600 10px Manrope;color:#8ca0c4;margin-top:4px"><span>$'+esc2(a.price_mo)+'/mo · soft-screened</span><span>'+esc2(a.slot)+'</span></div>'+
      '<div class="mono" style="font-size:8px;color:#7f93b8;margin-top:8px">STATUS · '+esc2(String(a.status).toUpperCase())+' — scan their QR to advance</div>';
    document.getElementById("ap-preview").style.display="flex";
  });
  var apx=document.getElementById("ap-x"); if(apx)apx.onclick=function(){ document.getElementById("ap-preview").style.display="none"; };
  document.addEventListener("keydown",function(e){ if(e.key==="Escape"){var p=document.getElementById("ap-preview"); if(p)p.style.display="none";} });
  // N7: dealer voice feedback — record → POST → transcribe (Whisper) → store + list.
  (function(){
    var recBtn=document.getElementById("fb-rec"); if(!recBtn) return;
    var statusEl=document.getElementById("fb-status"), listEl=document.getElementById("fb-list");
    var mediaRec=null, chunks=[], recording=false;
    function refresh(){ fetch("/api/dealer/feedback").then(function(r){return r.ok?r.json():{notes:[]};}).then(function(d){
      listEl.innerHTML=((d&&d.notes)||[]).map(function(n){
        return '<div class="glass" style="border-radius:10px;padding:9px 11px"><div style="font:500 12px/1.45 Manrope;color:#e2e9f2"></div>'+
               '<div class="mono" style="font-size:8px;color:#7f93b8;margin-top:4px">'+(n.created_at||"").slice(0,16).replace("T"," ")+'</div></div>';
      }).join('');
      var bodies=listEl.querySelectorAll("div>div:first-child");((d&&d.notes)||[]).forEach(function(n,i){ if(bodies[i])bodies[i].textContent=n.transcript||"(no transcript)"; });
    }).catch(function(){}); }
    recBtn.addEventListener("click",function(){
      if(recording){ mediaRec&&mediaRec.stop(); return; }
      navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
        chunks=[]; mediaRec=new MediaRecorder(stream); recording=true; recBtn.textContent="■ Stop"; statusEl.textContent="recording…";
        mediaRec.ondataavailable=function(e){ if(e.data.size)chunks.push(e.data); };
        mediaRec.onstop=function(){ recording=false; recBtn.textContent="🎙 Record"; statusEl.textContent="transcribing…";
          stream.getTracks().forEach(function(t){t.stop();});
          var blob=new Blob(chunks,{type:"audio/webm"}); var fr=new FileReader();
          fr.onload=function(){ var b64=String(fr.result).split(",")[1];
            fetch("/api/dealer/feedback",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({audio_b64:b64})})
              .then(function(r){return r.json();}).then(function(x){ statusEl.textContent=x&&x.ok?"saved ✓":"couldn't save"; refresh(); })
              .catch(function(){ statusEl.textContent="couldn't save"; }); };
          fr.readAsDataURL(blob); };
        mediaRec.start();
      }).catch(function(){ statusEl.textContent="mic blocked — allow access to record"; });
    });
    refresh();
  })();
});
