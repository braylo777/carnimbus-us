document.addEventListener("DOMContentLoaded",function(){
  function show(id){["gate401","gate403","console"].forEach(function(x){document.getElementById(x).style.display=(x===id?"":"none");});}
  function load(){fetch("/api/dealer/console").then(function(r){
    if(r.status===401){show("gate401");throw 0;} if(r.status===403){show("gate403");throw 0;} return r.json();
  }).then(function(d){ show("console");
    document.getElementById("dc-store").textContent=d.dealer.dealership;
    document.getElementById("dc-name").textContent=d.dealer.name;
    if(d.dealer.client_no)document.getElementById("dc-cn").textContent="CN · ••••-"+String(d.dealer.client_no).slice(-4);
    var K=d.kpis||{};["routed","booked","showed","closed"].forEach(function(k){document.getElementById("k-"+k).textContent=K[k]||0;});
    var next=(d.appointments||[]).filter(function(a){return a.status!=="sold";})[0];
    document.getElementById("do-now").style.display=next?"flex":"none";
    if(next){document.getElementById("dn-txt").innerHTML='Do now: <span class="cy">'+next.phone+'</span> — '+next.slot+' · '+next.year+' '+next.make+' '+next.model;}
    document.getElementById("appts").innerHTML=(d.appointments||[]).map(function(a){
      var adv=a.status==="sold"?'<span class="badge green">Sold ✓</span>':
        '<button class="btn primary sm" data-id="'+a.id+'" data-next="'+(a.status==="arrived"?"sold":"arrived")+'">'+(a.status==="arrived"?"Mark sold":"Check in")+'</button>';
      return '<div class="glass pd" style="padding:14px"><div class="row" style="align-items:center;gap:10px;flex-wrap:wrap">'+
        '<span style="width:52px;height:36px;border-radius:8px;overflow:hidden;flex:none">'+(a.photos&&a.photos[0]?'<img src="'+a.photos[0]+'" style="width:100%;height:100%;object-fit:cover">':'')+'</span>'+
        '<div style="flex:1;min-width:150px"><div style="font:700 12px Manrope">'+a.year+' '+a.make+' '+a.model+(a.trim?' '+a.trim:'')+'</div>'+
        '<div style="font:500 10px Manrope;color:#8ca0c4">'+a.phone+' · <span class="cidtag">CID·'+a.id+'</span> · $'+a.price_mo+'/mo · '+a.slot+' · '+a.center+'</div></div>'+
        '<span class="statuspill" style="background:rgba(24,200,255,.12);color:#18C8FF">'+a.status+'</span>'+adv+'</div></div>';}).join('')||
      '<div style="font:600 12px Manrope;color:#aebfdf;padding:20px;text-align:center">No routed buyers yet — they appear here the moment the AI books a drive.</div>';
    document.getElementById("lst").innerHTML=(d.listings||[]).map(function(l){
      return '<div class="row" style="align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(24,200,255,.08);font:600 11px Manrope">'+
      '<span style="flex:1">'+l.year+' '+l.make+' '+l.model+(l.trim?' '+l.trim:'')+'</span><span class="cy">$'+l.price_mo+'/mo</span>'+
      (l.active?'<span class="badge green">Live</span>':'<span class="badge red">Off</span>')+'</div>';}).join('');
  }).catch(function(){});}
  load();
  document.body.addEventListener("click",async function(e){var b=e.target.closest("[data-id]");if(!b)return;
    b.disabled=true;await fetch("/api/dealer/checkin",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({driveId:+b.dataset.id,status:b.dataset.next})});load();});
});
