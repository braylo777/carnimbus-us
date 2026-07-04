document.addEventListener("DOMContentLoaded",function(){
  function step(id){["choice","buyer","dealer","dealer-done"].forEach(function(x){document.getElementById(x).style.display=(x===id?"":"none");});}
  document.getElementById("pick-buyer").addEventListener("click",function(){step("buyer");});
  document.getElementById("pick-dealer").addEventListener("click",function(){step("dealer");});
  var msg=function(el,t){el.textContent=t;el.style.display=t?"block":"none";};
  var phone="";
  function digits(v){v=(v||"").replace(/\D/g,"");if(v.length===11&&v[0]==="1")v=v.slice(1);return v;}
  document.getElementById("au-send").addEventListener("click",async function(){
    phone=digits(document.getElementById("au-phone").value);
    if(!/^[2-9]\d{9}$/.test(phone))return msg(document.getElementById("au-msg"),"That number doesn't look right — 10 digits, US for now.");
    msg(document.getElementById("au-msg"),"");
    var r=await fetch("/api/auth/start",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({phone:phone})});
    var d=await r.json();
    if(!d.ok)return msg(document.getElementById("au-msg"),"Couldn't send the code — try again.");
    document.getElementById("au-step1").style.display="none";document.getElementById("au-step2").style.display="block";
    if(d.dev)document.getElementById("au-code").value=d.dev;
  });
  document.getElementById("au-verify").addEventListener("click",async function(){
    var r=await fetch("/api/auth/verify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({phone:phone,code:document.getElementById("au-code").value})});
    var d=await r.json();
    if(!d.ok)return msg(document.getElementById("au-msg"),"Wrong or expired code — try again.");
    var me=await fetch("/api/me").then(function(x){return x.json();}).catch(function(){return{};});
    location.href=(me.ok&&me.answers)?"/app/browse.html":"/app/profile.html";
  });
  var role="";
  document.querySelectorAll("#roles .opt").forEach(function(b){b.addEventListener("click",function(){
    document.querySelectorAll("#roles .opt").forEach(function(x){x.classList.remove("on");});
    b.classList.add("on");role=b.dataset.v;});});
  document.getElementById("dl-send").addEventListener("click",async function(){
    var name=document.getElementById("dl-name").value.trim(),dealership=document.getElementById("dl-store").value.trim();
    if(!name||!dealership)return msg(document.getElementById("dl-msg"),"Name and dealership are required.");
    var r=await fetch("/api/dealer",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({name:name,dealership:dealership,role:role,phone:document.getElementById("dl-phone").value.trim(),email:document.getElementById("dl-email").value.trim()})});
    var d=await r.json().catch(function(){return{};});
    if(!d.ok)return msg(document.getElementById("dl-msg"),"Couldn't send — try again.");
    step("dealer-done");
  });
});
