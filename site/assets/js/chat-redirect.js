document.addEventListener("DOMContentLoaded",function(){
  function show(){ var l=document.getElementById("chat-load"),e=document.getElementById("chat-empty");
    if(l)l.style.display="none"; if(e)e.style.display="flex"; }
  fetch("/api/chats/recent").then(function(r){ if(r.status===401){ location.replace("/signin"); throw 0; } return r.json(); })
    .then(function(d){ if(d&&d.vdp_id){ location.replace("/car?id="+d.vdp_id); } else { show(); } })
    .catch(function(){ show(); });
});
