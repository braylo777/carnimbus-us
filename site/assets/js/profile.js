document.addEventListener("DOMContentLoaded",function(){
  var A={},cur=0,secs=[].slice.call(document.querySelectorAll("#quiz section"));
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
    document.getElementById("ph-auth").style.display="none";document.getElementById("ph-quiz").style.display="block";dots();
  });
  document.querySelectorAll("#quiz .opts").forEach(function(o){o.addEventListener("click",function(e){
    var b=e.target.closest(".opt");if(!b)return;
    o.querySelectorAll(".opt").forEach(function(x){x.classList.remove("on");});b.classList.add("on");
    A[o.closest("section").dataset.q]=b.dataset.v;});});
  function dots(){var d=document.getElementById("qz-dots");d.innerHTML="";secs.forEach(function(_,i){var s=document.createElement("span");s.className="dot2"+(i===cur?" on":"");d.appendChild(s);});
    document.getElementById("qz-prev").style.visibility=cur?"visible":"hidden";
    document.getElementById("qz-next").textContent=(cur===secs.length-1)?"Finish":"Next";}
  function show(i){secs[cur].classList.remove("on");cur=i;secs[cur].classList.add("on");dots();}
  document.getElementById("qz-prev").addEventListener("click",function(){if(cur>0)show(cur-1);});
  document.getElementById("qz-next").addEventListener("click",async function(){
    var q=secs[cur].dataset.q;
    if(q==="q10")A.q10=document.getElementById("q10-in").value.trim();
    if(!A[q])return msg(document.getElementById("qz-msg"),"Pick one to keep going.");
    msg(document.getElementById("qz-msg"),"");
    if(cur<secs.length-1)return show(cur+1);
    var r=await fetch("/api/profile",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({answers:A})});
    var d=await r.json();
    if(!d.ok)return msg(document.getElementById("qz-msg"),"Couldn't save — try again.");
    document.getElementById("ph-quiz").style.display="none";document.getElementById("ph-done").style.display="block";
  });
});
