document.addEventListener("DOMContentLoaded",function(){
  var A={hobbies:[]},cur=0,secs=[].slice.call(document.querySelectorAll("#quiz section"));
  var msg=function(el,t){el.textContent=t;el.style.display=t?"block":"none";};
  // Edit mode: if already signed in, skip the phone-auth gate entirely and open the quiz prefilled.
  fetch("/api/me").then(function(r){ if(r.status===401)throw 0; return r.json(); }).then(function(d){ if(!d||!d.ok)return;
    document.getElementById("ph-auth").style.display="none";
    document.getElementById("ph-quiz").style.display="block";
    dots();
    if(!d.answers)return; var a=d.answers; for(var k in a)A[k]=a[k];
    var map={full_name:"f-name",zip:"f-zip",dream_car:"f-dream",current_year:"f-cyear",current_make:"f-cmake",current_model:"f-cmodel",current_miles:"f-cmiles"};
    for(var m in map){var el=document.getElementById(map[m]);if(el&&a[m]!=null)el.value=a[m];}
    document.querySelectorAll("#quiz .opts").forEach(function(o){ var sec=o.closest("section"),key=o.dataset.q2||sec.dataset.q,val=a[key];
      o.querySelectorAll(".opt").forEach(function(b){ if(Array.isArray(val)?val.indexOf(b.dataset.v)>-1:val===b.dataset.v) b.classList.add("on"); }); });
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
    document.getElementById("ph-auth").style.display="none";document.getElementById("ph-quiz").style.display="block";dots();
  });
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
  function readText(sec){var t=sec.querySelector(".tin");return t?t.value.trim():"";}
  function dots(){var d=document.getElementById("qz-dots");d.innerHTML="";secs.forEach(function(_,i){var s=document.createElement("span");s.className="dot2"+(i===cur?" on":"");d.appendChild(s);});
    document.getElementById("qz-prev").style.visibility=cur?"visible":"hidden";
    document.getElementById("qz-next").textContent=(cur===secs.length-1)?"Finish":"Next";}
  function show(i){secs[cur].classList.remove("on");cur=i;secs[cur].classList.add("on");dots();}
  document.getElementById("qz-prev").addEventListener("click",function(){if(cur>0)show(cur-1);});
  document.getElementById("qz-next").addEventListener("click",async function(){
    var sec=secs[cur],key=sec.dataset.q;
    if(!sec.querySelector(".opts")&&sec.querySelector(".tin")&&key!=="current_car")A[key]=readText(sec);
    if(key==="current_car"){ A.current_year=(document.getElementById("f-cyear").value||"").trim();
      A.current_make=(document.getElementById("f-cmake").value||"").trim();
      A.current_model=(document.getElementById("f-cmodel").value||"").trim();
      A.current_miles=(document.getElementById("f-cmiles").value||"").trim(); }
    if(key==="reason"&&A.reason==="other"){var ot=sec.querySelector(".other-in");if(ot&&ot.value.trim())A.reason=ot.value.trim();}
    var val=A[key];
    var OPTIONAL={current_car:1,trade_in:1,timeline:1,body_pref:1};
    var ok=OPTIONAL[key]?true:(key==="hobbies")?(val&&val.length>0):(val&&String(val).length>0);
    if(!ok)return msg(document.getElementById("qz-msg"),"Fill this in to keep going.");
    msg(document.getElementById("qz-msg"),"");
    if(cur<secs.length-1)return show(cur+1);
    var r=await fetch("/api/profile",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({answers:A})});
    var d=await r.json();
    if(!d.ok)return msg(document.getElementById("qz-msg"),"Couldn't save — try again.");
    document.getElementById("ph-quiz").style.display="none";document.getElementById("ph-done").style.display="block";
  });
});
