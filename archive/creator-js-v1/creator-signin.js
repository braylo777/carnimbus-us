// Creator Network — sign in / sign up. External file: CSP forbids inline JS.
document.addEventListener("DOMContentLoaded",function(){
  var g=function(id){return document.getElementById(id);};
  var msg=function(el,t){var m=g(el);m.textContent=t;m.style.display=t?"block":"none";};
  var show=function(which){
    g("cr-login").style.display = which==="login"?"block":"none";
    g("cr-signup").style.display= which==="signup"?"block":"none";
  };
  g("cr-show-signup").addEventListener("click",function(){show("signup");});
  g("cr-show-login").addEventListener("click",function(){show("login");});

  g("cr-go").addEventListener("click",async function(){
    msg("cr-msg","");
    var r=await fetch("/api/creator/login",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({email:g("cr-email").value.trim(),password:g("cr-pass").value})});
    if(r.status===403) return msg("cr-msg","Your account is still pending review.");
    if(!r.ok) return msg("cr-msg","Wrong email or password.");
    location.href="/feed";
  });

  g("cr-s-go").addEventListener("click",async function(){
    msg("cr-s-msg","");
    var followers=parseInt(g("cr-s-followers").value.replace(/\D/g,""),10)||0;
    var handle=g("cr-s-handle").value.trim();
    if(!handle) return msg("cr-s-msg","Add the handle you post from.");
    if(g("cr-s-pass").value.length<8) return msg("cr-s-msg","Password needs at least 8 characters.");
    var r=await fetch("/api/creator/signup",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({email:g("cr-s-email").value.trim(),password:g("cr-s-pass").value,
        platform:g("cr-s-platform").value,handle:handle,followers_declared:followers})});
    if(r.status===409) return msg("cr-s-msg","That email already has an account.");
    var d=await r.json().catch(function(){return{};});
    if(!d.ok) return msg("cr-s-msg","Couldn't create the account — check your details and try again.");
    if(d.pending) return msg("cr-s-msg","You're in the queue. We review accounts under 10,000 followers by hand — we'll email you.");
    location.href="/feed";
  });
});
