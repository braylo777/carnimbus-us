document.addEventListener("DOMContentLoaded",function(){
  function show(id){["gate","empty","deal"].forEach(function(x){document.getElementById(x).style.display=(x===id?(x==="deal"?"flex":"block"):"none");});}
  fetch("/api/me").then(function(r){if(r.status===401){show("gate");throw 0;}return r.json();}).then(function(me){
    if(!me.drive){show("empty");return;}
    show("deal");var d=me.drive;
    document.getElementById("p-veh").textContent=d.year+" "+d.make+" "+d.model+(d.trim?" "+d.trim:"");
    document.getElementById("p-mo").textContent="$"+d.price_mo+"/mo";
    document.getElementById("p-center").textContent=d.center+" Test Drive Center";
    document.getElementById("p-slot").textContent=d.slot;
    document.getElementById("p-cid").textContent="CID·"+String(d.pass_token).slice(0,8);
    document.getElementById("p-open").href="/pass";
    document.getElementById("p-chat").href="/car?id="+d.vdp_id;
    document.getElementById("p-status").textContent=d.status;
    var est=Math.round(d.price_mo*72*0.88/100)*100;
    document.getElementById("pay-mo").textContent="$"+d.price_mo;
    document.getElementById("pay-price").textContent="$"+est.toLocaleString();
    var band={excellent:"740+",good:"700–739",building:"620–679"}[(me.answers||{}).q9]||"700–739";
    document.getElementById("fico").textContent=band;
    fetch("/api/feed").then(function(r){return r.json();}).then(function(f){
      var c=(f.cars||[]).filter(function(x){return x.id===d.vdp_id;})[0];
      var v=(c&&c.match!=null)?c.match:92; // 92 = MOCK fallback match % (B-04)
      document.getElementById("m-val").textContent=v;
      var arc=document.querySelector(".meter .arc");
      requestAnimationFrame(function(){arc.style.strokeDashoffset=arc.getAttribute("data-c")*(1-v/100);});
    });
  }).catch(function(){ if(document.getElementById("gate").style.display==="none"&&document.getElementById("deal").style.display==="none") show("gate"); });
});
