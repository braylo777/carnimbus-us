// T-102: dealer email + password sign-in / sign-up. Session is the HttpOnly cn_dlr cookie set by the server,
// so we always send credentials:"include". CSP forbids inline JS, so this lives in its own file.
document.addEventListener("DOMContentLoaded",function(){
  function $(id){return document.getElementById(id);}
  function msg(t){var m=$("dl-msg");m.textContent=t;m.style.display=t?"block":"none";}
  var loginBtn=$("dl-go"), signupBtn=$("dl-signup");
  async function go(path){
    var email=($("dl-email").value||"").trim();
    var password=$("dl-pass").value||"";
    if(!email||!password) return msg("Enter your email and password.");
    if(path==="signup" && password.length<8) return msg("Pick a password with at least 8 characters.");
    msg(""); loginBtn.classList.add("loading"); signupBtn.classList.add("loading");
    function done(){ loginBtn.classList.remove("loading"); signupBtn.classList.remove("loading"); }
    try{
      var r=await fetch("/api/dealer/"+path,{method:"POST",credentials:"include",
        headers:{"content-type":"application/json"},body:JSON.stringify({email:email,password:password})});
      if(r.status===401){done();return msg("Wrong email or password.");}
      if(r.status===403){done();return msg("Your account is pending — we'll email you when it's live.");}
      if(r.status===409){done();return msg("That email already has an account — log in instead.");}
      if(r.status===400){done();return msg("Check your email and use an 8+ character password.");}
      var d=await r.json().catch(function(){return{};});
      // Honor ?next=. worker.js:170 bounces a signed-out dealer here with the page they wanted, and
      // every app-*.js builds one — this line used to throw it away, so a dealer who clicked a link
      // to their clearance queue landed on the legacy console instead. The regex requires a single
      // leading slash, which rejects "//evil.com" and "\\evil.com"; without it, next= is an open
      // redirect. Default is /clear, the app root (worker.js:208), not /console.
      if(d&&d.ok){ var n=new URLSearchParams(location.search).get("next");
                   return location.href=(n&&/^\/[A-Za-z0-9/_-]*$/.test(n))?n:"/clear"; }
      done(); msg("Something went wrong — try again.");
    }catch(e){ done(); msg("Something went wrong — try again."); }
  }
  loginBtn.addEventListener("click",function(){go("login");});
  signupBtn.addEventListener("click",function(){go("signup");});
  $("dl-pass").addEventListener("keydown",function(e){if(e.key==="Enter")go("login");});
});
