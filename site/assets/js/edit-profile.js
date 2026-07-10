document.addEventListener("DOMContentLoaded",function(){
  var A={hobbies:[]};
  var msg=function(el,t){el.textContent=t;el.style.display=t?"block":"none";};
  // The Worker's page gate guarantees a session — just prefill the list from the profile.
  (window.__me||fetch("/api/me").then(function(r){return r.json();})).then(function(d){ if(!d||!d.ok)return;
    var a=d.answers||{}; for(var k in a)A[k]=a[k];   // R21: brand-new users (no answers yet) still get the calc prefill below
    var map={full_name:"f-name",zip:"f-zip",dream_car:"f-dream",current_year:"f-cyear",current_make:"f-cmake",current_model:"f-cmodel",current_miles:"f-cmiles",current_color:"f-ccolor",current_details:"f-cdetails"};
    for(var m in map){var el=document.getElementById(map[m]);if(el&&a[m]!=null)el.value=a[m];}
    document.querySelectorAll("#quiz .opts").forEach(function(o){ var sec=o.closest("section"),key=o.dataset.q2||sec.dataset.q,val=a[key];
      var hit=false;
      o.querySelectorAll(".opt").forEach(function(b){ if(Array.isArray(val)?val.indexOf(b.dataset.v)>-1:val===b.dataset.v){ b.classList.add("on"); hit=true; } });
      // Free-text answers (e.g. a custom "reason") → light the "other" chip and show the text.
      if(!hit&&val&&!Array.isArray(val)){ var ob=o.querySelector('.opt[data-v="other"]');
        if(ob){ ob.classList.add("on"); var oi=sec.querySelector(".other-in"); if(oi){ oi.value=val; oi.style.display="block"; } } }
    });
    // R21: first-run prefill from the website calculator (only when the profile is still empty on these).
    try{ var cc=JSON.parse(localStorage.cn_calc||"null");
      if(cc){ var snap=function(n,vals){ n=+n||0; var best=vals[0]; vals.forEach(function(v){ if(Math.abs(v-n)<Math.abs(best-n)) best=v; }); return String(best); };
        if(!a.max_monthly&&cc.mo){ var mv=snap(cc.mo,[150,300,500,700,900]); var mb=document.querySelector('[data-q="max_monthly"] .opt[data-v="'+mv+'"]'); if(mb){ mb.classList.add("on"); A.max_monthly=mv; } }
        if(a.max_down==null&&cc.dn){ var dv=snap(cc.dn,[0,500,1000,2000,3000,5000]); var db=document.querySelector('[data-q="max_down"] .opt[data-v="'+dv+'"]'); if(db){ db.classList.add("on"); A.max_down=dv; } }
        if(!a.zip&&cc.z){ var zf=document.getElementById("f-zip"); if(zf&&!zf.value) zf.value=cc.z; }
        localStorage.removeItem("cn_calc"); } }catch(_){}
  }).catch(function(){});
  // Chip selection (single + multi) — same data model, no wizard.
  document.querySelectorAll("#quiz .opts").forEach(function(o){o.addEventListener("click",function(e){
    var b=e.target.closest(".opt");if(!b)return;
    var sec=o.closest("section"),key=o.dataset.q2||sec.dataset.q;
    if(o.hasAttribute("data-multi")){
      var arr=A[key]||[];
      if(b.classList.contains("on")){b.classList.remove("on");arr=arr.filter(function(x){return x!==b.dataset.v;});}
      else{ var max=parseInt(o.dataset.max,10)||3; if(arr.length>=max)return; b.classList.add("on");arr.push(b.dataset.v); }
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
    A.current_color=(document.getElementById("f-ccolor").value||"").trim();
    A.current_details=(document.getElementById("f-cdetails").value||"").trim();
    if(A.reason==="other"){var ot=document.querySelector('[data-q="reason"] .other-in');if(ot&&ot.value.trim())A.reason=ot.value.trim();}
    var m=document.getElementById("qz-msg");
    if(!A.full_name)return msg(m,"Add your name so the cars know who they're talking to.");
    if(!A.max_monthly)return msg(m,"Pick a max monthly — it drives your matches.");
    msg(m,"");
    var btn=this; btn.textContent="Saved ✓"; btn.disabled=true;
    // M9: optimistic save — the write is a single upsert (matching runs on cron), so fire it with keepalive and
    // go straight to the Garage instead of blocking on the round-trip. keepalive guarantees the POST still completes.
    fetch("/api/profile",{method:"POST",keepalive:true,headers:{"content-type":"application/json"},body:JSON.stringify({answers:A})}).catch(function(){});
    // N2: if they came in on a clicked car, drop them straight into that chat; otherwise land in matches.
    var nx=""; try{ nx=localStorage.cn_next||""; }catch(_){}
    if(nx){ try{localStorage.removeItem("cn_next");}catch(_){} location.replace(/^https?:/.test(nx)?nx:("https://app.carnimbus.com"+nx)); }
    else location.replace("https://app.carnimbus.com/matches");
  });
});
