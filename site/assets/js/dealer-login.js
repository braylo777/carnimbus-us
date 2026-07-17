// T-102: dealer email + password sign-in. Session is the HttpOnly cn_dlr cookie set by the server,
// so we always send credentials:"include". CSP forbids inline JS, so this lives in its own file.
document.addEventListener("DOMContentLoaded",function(){
  function $(id){return document.getElementById(id);}
  function msg(t){var m=$("dl-msg");m.textContent=t;m.style.display=t?"block":"none";}
  var btn=$("dl-go");
  async function submit(){
    var email=($("dl-email").value||"").trim();
    var password=$("dl-pass").value||"";
    if(!email||!password)return msg("Enter your email and password.");
    msg("");btn.classList.add("loading");
    try{
      var r=await fetch("/api/dealer/login",{method:"POST",credentials:"include",
        headers:{"content-type":"application/json"},body:JSON.stringify({email:email,password:password})});
      if(r.status===401){btn.classList.remove("loading");return msg("Wrong email or password.");}
      if(r.status===403){btn.classList.remove("loading");return msg("Your account is pending — we'll email you when it's live.");}
      var d=await r.json().catch(function(){return{};});
      if(d&&d.ok)return location.href="https://dealer.carnimbus.com/console";
      btn.classList.remove("loading");msg("Couldn't sign in — try again.");
    }catch(e){btn.classList.remove("loading");msg("Couldn't sign in — try again.");}
  }
  btn.addEventListener("click",submit);
  $("dl-pass").addEventListener("keydown",function(e){if(e.key==="Enter")submit();});
});
