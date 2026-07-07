document.addEventListener("DOMContentLoaded",function(){
  var A={hobbies:[]};
  var msg=function(el,t){el.textContent=t;el.style.display=t?"block":"none";};
  // Signed-in buyers skip the phone gate and land straight on the prefilled list.
  fetch("/api/me").then(function(r){ if(r.status===401)throw 0; return r.json(); }).then(function(d){ if(!d||!d.ok)return;
    document.getElementById("ph-auth").style.display="none";
    document.getElementById("ph-quiz").style.display="block";
    if(!d.answers)return; var a=d.answers; for(var k in a)A[k]=a[k];
    var map={full_name:"f-name",zip:"f-zip",dream_car:"f-dream",current_year:"f-cyear",current_make:"f-cmake",current_model:"f-cmodel",current_miles:"f-cmiles"};
    for(var m in map){var el=document.getElementById(map[m]);if(el&&a[m]!=null)el.value=a[m];}
    document.querySelectorAll("#quiz .opts").forEach(function(o){ var sec=o.closest("section"),key=o.dataset.q2||sec.dataset.q,val=a[key];
      var hit=false;
      o.querySelectorAll(".opt").forEach(function(b){ if(Array.isArray(val)?val.indexOf(b.dataset.v)>-1:val===b.dataset.v){ b.classList.add("on"); hit=true; } });
      // Free-text answers (e.g. a custom "reason") → light the "other" chip and show the text.
      if(!hit&&val&&!Array.isArray(val)){ var ob=o.querySelector('.opt[data-v="other"]');
        if(ob){ ob.classList.add("on"); var oi=sec.querySelector(".other-in"); if(oi){ oi.value=val; oi.style.display="block"; } } }
    });
  }).catch(function(){});
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
    document.getElementById("ph-auth").style.display="none";document.getElementById("ph-quiz").style.display="block";
  });
  // Chip selection (single + multi) — same data model, no wizard.
  document.querySelectorAll("#quiz .opts").forEach(function(o){o.addEventListener("click",function(e){
    var b=e.target.closest(".opt");if(!b)return;
    var sec=o.closest("section"),key=o.dataset.q2||sec.dataset.q;
    if(o.hasAttribute("data-multi")){
      var arr=A[key]||[];
      if(b.classList.contains("on")){b.classList.remove("on");arr=arr.filter(function(x){return x!==b.dataset.v;});}
      else{ if(arr.length>=3)return; b.classList.add("on");arr.push(b.dataset.v); }
      A[key]=arr;
    } else {
      o.querySelectorAll(".opt").forEach(function(x){x.classList.remove("on");});b.classList.add("on");
      A[key]=b.dataset.v;
      var other=sec.querySelector(".other-in");
      if(other)other.style.display=(b.dataset.v==="other")?"block":"none";
    }
  });});
  // One save: read every text field, keep chip state from A, post once.
  document.getElementById("qz-save").addEventListener("click",async function(){
    A.full_name=(document.getElementById("f-name").value||"").trim();
    A.zip=(document.getElementById("f-zip").value||"").trim();
    A.dream_car=(document.getElementById("f-dream").value||"").trim();
    A.current_year=(document.getElementById("f-cyear").value||"").trim();
    A.current_make=(document.getElementById("f-cmake").value||"").trim();
    A.current_model=(document.getElementById("f-cmodel").value||"").trim();
    A.current_miles=(document.getElementById("f-cmiles").value||"").trim();
    if(A.reason==="other"){var ot=document.querySelector('[data-q="reason"] .other-in');if(ot&&ot.value.trim())A.reason=ot.value.trim();}
    var m=document.getElementById("qz-msg");
    if(!A.full_name)return msg(m,"Add your name so the cars know who they're talking to.");
    if(!A.max_monthly)return msg(m,"Pick a max monthly — it drives your matches.");
    msg(m,"");
    var btn=this; btn.textContent="Saving…"; btn.disabled=true;
    var r=await fetch("/api/profile",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({answers:A})});
    var d=await r.json().catch(function(){return{};});
    btn.textContent="Save my profile"; btn.disabled=false;
    if(!d.ok)return msg(m,"Couldn't save — try again.");
    location.replace("https://app.carnimbus.com/profile");   // straight back to the account — no interstitial
  });
});
