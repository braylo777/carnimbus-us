document.addEventListener("DOMContentLoaded",function(){
  function step(id){["choice","buyer"].forEach(function(x){var e=document.getElementById(x); if(e)e.style.display=(x===id?"":"none");});}
  document.getElementById("pick-buyer").addEventListener("click",function(){step("buyer");});
  // N6: dealer entry points go to the dealer pitch page (dealer.carnimbus.com), not an in-page request form.
  var pd=document.getElementById("pick-dealer"); if(pd)pd.addEventListener("click",function(){location.href="https://dealer.carnimbus.com/";});
  var gd=document.getElementById("go-dealer"); if(gd)gd.addEventListener("click",function(e){e.preventDefault();location.href="https://dealer.carnimbus.com/";});
  step("buyer");
  var msg=function(el,t){el.textContent=t;el.style.display=t?"block":"none";};
  var phone="";
  // N2: remember the car a visitor clicked before signing in (the gate sends ?next=/talk/<slug>).
  try{ var _nx=new URLSearchParams(location.search).get("next"); if(_nx) localStorage.cn_next=_nx; }catch(_){}
  function digits(v){v=(v||"").replace(/\D/g,"");if(v.length===11&&v[0]==="1")v=v.slice(1);return v;}
  document.getElementById("au-send").addEventListener("click",async function(){
    phone=digits(document.getElementById("au-phone").value);
    if(!/^[2-9]\d{9}$/.test(phone))return msg(document.getElementById("au-msg"),"That number doesn't look right — 10 digits, US for now.");
    if(!document.getElementById("au-agree").checked)return msg(document.getElementById("au-msg"),"Please agree to the Privacy Policy to continue.");
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
    var who=await fetch("/api/whoami").then(function(x){return x.json();}).catch(function(){return{};});
    if(who.dealer)return location.href="https://dealer.carnimbus.com/console";
    var nx=""; try{ nx=localStorage.cn_next||""; }catch(_){}
    if(me.ok&&me.answers){ if(nx){ try{localStorage.removeItem("cn_next");}catch(_){} return location.href=nx; } return location.href="/feed"; }
    location.href="/edit-profile";   // new user → quiz; cn_next stays for post-quiz replay
  });
});
