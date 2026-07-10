// T5: dealer-branded sign-in. Same OTP backend as buyers (/api/auth/start + /verify); routes verified partners to the
// console and tells non-partners how to become one. CSP forbids inline JS, so this is its own file.
document.addEventListener("DOMContentLoaded",function(){
  function $(id){return document.getElementById(id);}
  var msg=function(el,t){el.textContent=t;el.style.display=t?"block":"none";};
  var phone="";
  function digits(v){v=(v||"").replace(/\D/g,"");if(v.length===11&&v[0]==="1")v=v.slice(1);return v;}
  $("au-send").addEventListener("click",async function(){
    phone=digits($("au-phone").value);
    if(!/^[2-9]\d{9}$/.test(phone))return msg($("au-msg"),"That number doesn't look right — 10 digits, US for now.");
    if(!$("au-agree").checked)return msg($("au-msg"),"Please agree to the Privacy Policy to continue.");
    msg($("au-msg"),"");
    var r=await fetch("/api/auth/start",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({phone:phone})});
    var d=await r.json();
    if(!d.ok)return msg($("au-msg"),"Couldn't send the code — try again.");
    $("au-step1").style.display="none";$("au-step2").style.display="block";
    if(d.dev)$("au-code").value=d.dev;
  });
  $("au-verify").addEventListener("click",async function(){
    var r=await fetch("/api/auth/verify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({phone:phone,code:$("au-code").value})});
    var d=await r.json();
    if(!d.ok)return msg($("au-msg"),"Wrong or expired code — try again.");
    var who=await fetch("/api/whoami").then(function(x){return x.json();}).catch(function(){return{};});
    if(who&&who.dealer)return location.href="https://dealer.carnimbus.com/console";
    // Verified, but this phone isn't on an active dealer account.
    msg($("au-msg"),"You're signed in, but this number isn't on a partner account yet. Book a demo and we'll set your store up.");
  });
});
