document.addEventListener("DOMContentLoaded",function(){
  fetch("/api/me").then(function(r){if(r.status===401){document.getElementById("gate").style.display="block";throw 0;}return r.json();}).then(function(me){
    document.getElementById("acct").style.display="block";
    var name=me.handle||"CarNimbus rider";
    var initials=name.split(/\s+/).map(function(w){return w[0]||"";}).join("").slice(0,2).toUpperCase()||"CN";
    document.getElementById("y-av").textContent=initials;
    document.getElementById("y-name").textContent=name;
    document.getElementById("y-phone").textContent="•••-"+String(me.phone||"").slice(-4);
    if(me.cid)document.getElementById("y-cid").textContent="CID# "+me.cid;
    var a=me.answers||{};
    if(me.answers){document.getElementById("y-preq").style.display="";
      if(a.fico){var yb=document.getElementById("y-band");yb.style.display="";yb.textContent="FICO "+a.fico;}
      var bars=[];
      if(a.max_monthly)bars.push(["Budget","$"+a.max_monthly+"/mo"+(a.max_down?" · $"+a.max_down+" down":"")]);
      if(a.buy_method)bars.push(["Paying",a.buy_method]);
      if(a.income)bars.push(["Income",a.income]);
      if(a.reason)bars.push(["Why now",a.reason]);
      if(a.zip)bars.push(["Near",a.zip]);
      document.getElementById("y-summary").style.display="block";
      document.getElementById("y-bars").innerHTML=bars.map(function(b){
        return '<div class="row" style="justify-content:space-between;font:500 12px Manrope"><span style="color:#8ca0c4">'+b[0]+'</span><span style="color:#e2e9f2;font-weight:600;text-align:right">'+b[1]+'</span></div>';}).join('');
      document.getElementById("y-hobbies").innerHTML=(a.hobbies||[]).map(function(h){return '<span class="badge cyan">'+h+'</span>';}).join('');
    }
    if(me.drive){var d=me.drive;document.getElementById("y-up").style.display="block";
      document.getElementById("y-veh").textContent=d.year+" "+d.make+" "+d.model;
      document.getElementById("y-status").textContent=d.status;
      document.getElementById("y-center").textContent=d.center+" Test Drive Center";
      document.getElementById("y-slot").textContent=d.slot;
      document.getElementById("y-pass").href="/pass/"+d.pass_token;
      document.getElementById("y-chat").href="/app/car.html?id="+d.vdp_id;}
    fetch("/api/feed?lang="+(function(){try{return localStorage.cn_lang==="es"?"es":"en";}catch(_){return "en";}})()).then(function(r){return r.json();}).then(function(f){
      document.getElementById("y-matches").innerHTML=(f.cars||[]).slice(0,3).map(function(c){
        return '<a href="/app/car.html?id='+c.id+'" class="row" style="align-items:center;gap:10px;text-decoration:none;padding:6px 0">'+
        '<span style="width:52px;height:36px;border-radius:8px;overflow:hidden;flex:none">'+(c.photos&&c.photos[0]?'<img src="'+c.photos[0]+'" style="width:100%;height:100%;object-fit:cover">':'')+'</span>'+
        '<span style="flex:1"><span style="display:block;font:600 11px Manrope;color:#fff">'+c.year+' '+c.make+' '+c.model+'</span><span class="cy" style="font:700 10px Manrope">$'+c.price_mo+'/mo</span></span>'+(c.match!=null?'<span class="badge cyan">'+c.match+'%</span>':'')+'</a>';}).join('');}).catch(function(){});
  }).catch(function(){ if(document.getElementById("acct").style.display!=="block") document.getElementById("gate").style.display="block"; });
  document.getElementById("y-out").addEventListener("click",async function(){
    await fetch("/api/logout",{method:"POST"}); location.href="/";});
});
