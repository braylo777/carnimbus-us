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
  function loadChat(a){ if(!a)return; CUR=a.id;
    document.getElementById("dcc-head").textContent="CarNimbus AI ↔ "+a.who;
    document.getElementById("dcc-sub").textContent=a.year+" "+a.make+" "+a.model+" · buyer only sees \"the car\"";
    document.getElementById("dcc-cid").textContent="AI BOOKED THIS APPOINTMENT · CID "+a.cid;
    fetch("/api/dealer/chat?driveId="+a.id).then(function(r){return r.json();}).then(function(d){
      document.getElementById("dc-chat").innerHTML=(d.messages||[]).map(function(m){
        return '<div class="bubble '+(m.role==="car"?"car":"you")+'" style="max-width:90%;align-self:'+(m.role==="car"?"flex-start":"flex-end")+'"></div>';
      }).join('')||'<div style="font:600 11px Manrope;color:#7f93b8;text-align:center;padding:20px">No conversation yet.</div>';
      var bs=document.querySelectorAll("#dc-chat .bubble");(d.messages||[]).forEach(function(m,i){if(bs[i])bs[i].textContent=m.body;});
    }).catch(function(){});
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
    var K=d.kpis||{};
    document.getElementById("k-routed").textContent=K.routed||0;
    document.getElementById("k-booked").textContent=K.booked||0;
    document.getElementById("k-showed").textContent=K.showed||0;
    document.getElementById("k-closed").textContent=K.closed||0;
    var dd=(d.deltas||{}),dv=(dd.today||0)-(dd.yesterday||0);
    document.getElementById("k-routed-sub").textContent=(dv>=0?"+":"")+dv+" vs yesterday";
    document.getElementById("k-booked-sub").textContent=pct(K.booked,K.routed)+"% of routed";
    document.getElementById("k-showed-sub").textContent=pct(K.showed,K.booked)+"% show rate";
    document.getElementById("k-closed-sub").textContent=pct(K.closed,K.showed)+"% of shows";
    var live=(d.appointments||[]).filter(function(a){return a.status!=="sold";});
    var soon=document.getElementById("dc-soon");
    soon.style.display=live.length?"":"none"; soon.textContent="● "+live.length+" arriving within the hour";
    var next=live[0];
    document.getElementById("do-now").style.display=next?"flex":"none";
    if(next){var e=function(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");};
      document.getElementById("dn-txt").innerHTML='Do now: <span class="cy">'+e(next.who)+'</span> arrives '+e(next.slot)+' — scan their QR to check them in.';}
    document.getElementById("appts").innerHTML=(d.appointments||[]).map(card).join('')||
      '<div style="grid-column:1/-1;font:600 12px Manrope;color:#aebfdf;padding:20px;text-align:center">No routed buyers yet — they appear here the moment the AI books a drive.</div>';
    document.getElementById("sched").innerHTML=(d.appointments||[]).slice().sort(function(a,b){return String(a.slot).localeCompare(String(b.slot));}).map(function(a){
      var pill={confirmed:"#18C8FF",arrived:"#b18cff",sold:"#54d699",requested:"#8ca0c4"}[a.status]||"#8ca0c4";
      return '<div class="row" style="align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(24,200,255,.08);font:600 11px Manrope">'+
      '<span class="mono" style="font-size:9px;color:#8ca0c4;min-width:74px">'+a.slot+'</span>'+
      '<span class="avatar" style="width:20px;height:20px;font-size:8px">'+ini(a.who)+'</span>'+
      '<span style="min-width:110px">'+a.who+'</span><span style="flex:1;color:#8ca0c4">'+a.year+' '+a.make+' '+a.model+(a.trim?' '+a.trim:'')+'</span>'+
      '<span class="mono" style="font-size:7px;color:'+pill+';border:1px solid '+pill+'55;border-radius:99px;padding:3px 7px">'+a.status.toUpperCase()+'</span></div>';}).join('');
    document.getElementById("lst").innerHTML=(d.listings||[]).map(function(l){
      return '<div class="row" style="align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(24,200,255,.08);font:600 11px Manrope">'+
      '<span style="flex:1">'+l.year+' '+l.make+' '+l.model+(l.trim?' '+l.trim:'')+'</span><span class="cy">$'+l.price_mo+'/mo</span>'+
      (l.active?'<span class="badge green">Live</span>':'<span class="badge red">Off</span>')+'</div>';}).join('');
    var sel=(d.appointments||[]).filter(function(a){return a.id===CUR;})[0]||next||(d.appointments||[])[0];
    loadChat(sel);
    document.getElementById("appts").querySelectorAll("[data-drive]").forEach(function(el){
      el.addEventListener("click",function(e){ if(e.target.closest("a"))return;
        var a=(d.appointments||[]).filter(function(x){return x.id===+el.dataset.drive;})[0]; loadChat(a); });});
  }).catch(function(){});}
  load(); setInterval(load,30000);
  document.getElementById("dcc-open").addEventListener("click",function(){
    var c=document.getElementById("dc-chat"); c.style.maxHeight=(c.style.maxHeight==="none"?"420px":"none");});
});
