document.addEventListener("DOMContentLoaded",function(){
  function $(id){return document.getElementById(id);}
  function es(){try{return localStorage.cn_lang==="es";}catch(_){return false;}}
  var dealButtons=document.querySelectorAll("#lead-deal button");
  dealButtons.forEach(function(btn){ btn.addEventListener("click",function(){
    dealButtons.forEach(function(b){ b.classList.remove("on"); b.classList.remove("primary"); b.classList.add("ghost"); });
    btn.classList.add("on"); btn.classList.remove("ghost"); btn.classList.add("primary"); }); });
  var f=$("lead-form"); if(!f) return;
  f.addEventListener("submit",async function(e){ e.preventDefault();
    var msg=$("lead-msg"), go=$("lead-go");
    var car=($("lead-car").value||"").trim(), zip=($("lead-zip").value||"").replace(/\D/g,"");
    var rad=($("lead-radius").value||"").replace(/\D/g,""), ph=($("lead-phone").value||"").replace(/\D/g,"");
    if(ph.length===11&&ph[0]==="1")ph=ph.slice(1);
    var on=document.querySelector("#lead-deal button.on"), deal=on?on.getAttribute("data-deal"):"finance";
    if(!car){ msg.textContent=es()?"Cuéntanos el auto de tus sueños.":"Tell us your dream car."; return; }
    if(!/^\d{5}$/.test(zip)){ msg.textContent=es()?"Ingresa un código postal válido.":"Enter a valid 5-digit ZIP."; return; }
    if(!/^[2-9]\d{9}$/.test(ph)){ msg.textContent=es()?"Ingresa un número de celular válido.":"Enter a valid mobile number so a dealer can text you."; return; }
    go.disabled=true; go.textContent=es()?"Enviando…":"Sending…";
    try{ var r=await fetch("/api/webleads",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({dream_car:car,deal_type:deal,monthly:$("lead-monthly").value,down:$("lead-down").value,zip:zip,radius:rad||"25",phone:ph,website:$("lead-hp").value})});
      var d=await r.json().catch(function(){return{};});
      if(d&&d.ok){ f.innerHTML='<div style="font:700 16px Manrope;color:#5ee6a8;padding:18px 0">✓ '+(es()?"Solicitud enviada — un concesionario te enviará tus opciones de prueba de manejo por mensaje.":"Request sent — a dealer will text you your test-drive options.")+'</div>'; return; }
    }catch(_){ }
    go.disabled=false; go.textContent=es()?"Agendar prueba de manejo":"Schedule Test Drive";
    msg.textContent=es()?"No se pudo enviar — inténtalo de nuevo.":"Couldn't send — try again.";
  });
});
