document.addEventListener("DOMContentLoaded",function(){
  var k=new URLSearchParams(location.search).get("k")||localStorage.getItem("cn_admin")||"";
  if(new URLSearchParams(location.search).get("k"))localStorage.setItem("cn_admin",k);
  function tick(){document.getElementById("w-time").textContent=new Date().toLocaleTimeString();}
  setInterval(tick,1000);tick();
  function load(){ if(!k)return;
    fetch("/api/admin/stats",{headers:{"x-admin-key":k}}).then(function(r){return r.json();}).then(function(d){
      if(!d.ok)return;
      ["waitlist","users","profiles","drives","activeCars","comments"].forEach(function(p){
        var el=document.getElementById("w-"+p); if(el)el.textContent=d[p];});
    }).catch(function(){});}
  load(); setInterval(load,30000);
});
