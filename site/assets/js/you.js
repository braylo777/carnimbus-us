document.addEventListener("DOMContentLoaded",function(){
  fetch("/api/me").then(function(r){if(r.status===401){document.getElementById("gate").style.display="block";throw 0;}return r.json();}).then(function(me){
    document.getElementById("acct").style.display="block";
    var l4=String(me.phone||"").slice(-4);
    document.getElementById("y-av").textContent="•"+l4.slice(-2);
    document.getElementById("y-phone").textContent="•••-"+l4;
    if(me.sid)document.getElementById("y-sid").textContent="ID · "+me.sid;
    if(me.answers){document.getElementById("y-preq").style.display="";
      if(me.answers.q9){var yb=document.getElementById("y-band");yb.style.display="";yb.textContent="FICO band "+me.answers.q9;}}
    if(me.drive){var d=me.drive;document.getElementById("y-up").style.display="block";
      document.getElementById("y-veh").textContent=d.year+" "+d.make+" "+d.model;
      document.getElementById("y-status").textContent=d.status;
      document.getElementById("y-center").textContent=d.center+" Test Drive Center";
      document.getElementById("y-slot").textContent=d.slot;
      document.getElementById("y-pass").href="/pass/"+d.pass_token;
      document.getElementById("y-chat").href="/app/car.html?id="+d.vdp_id;}
    fetch("/api/feed").then(function(r){return r.json();}).then(function(f){
      document.getElementById("y-matches").innerHTML=(f.cars||[]).slice(0,3).map(function(c){
        return '<a href="/app/car.html?id='+c.id+'" class="row" style="align-items:center;gap:10px;text-decoration:none;padding:6px 0">'+
        '<span style="width:52px;height:36px;border-radius:8px;overflow:hidden;flex:none">'+(c.photos&&c.photos[0]?'<img src="'+c.photos[0]+'" style="width:100%;height:100%;object-fit:cover">':'')+'</span>'+
        '<span style="flex:1"><span style="display:block;font:600 11px Manrope;color:#fff">'+c.year+' '+c.make+' '+c.model+'</span><span class="cy" style="font:700 10px Manrope">$'+c.price_mo+'/mo</span></span>'+(c.match!=null?'<span class="badge cyan">'+c.match+'%</span>':'')+'</a>';}).join('');}).catch(function(){});
  }).catch(function(){ if(document.getElementById("acct").style.display!=="block") document.getElementById("gate").style.display="block"; });
  document.getElementById("y-out").addEventListener("click",async function(){
    await fetch("/api/logout",{method:"POST"}); location.href="/";});
});
