// Creator Network — earnings, payout onboarding, and the creator's own NIMBUS score.
// The score shows its factors because that's the house contract: a number a person acts on always
// ships the reasons that sum to it (same as closeProb on the dealer side).
document.addEventListener("DOMContentLoaded",function(){
  var g=function(id){return document.getElementById(id);};
  var msg=function(t){var m=g("e-msg");m.textContent=t;m.style.display=t?"block":"none";};
  var esc=function(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");};
  var usd=function(c){return "$"+((c||0)/100).toFixed(2);};

  var LABEL={accrued:"In review",approved:"Approved",paid:"Paid",clawed_back:"Reversed"};
  var COLOR={accrued:"#8fa3bf",approved:"#18c8ff",paid:"#3ddc84",clawed_back:"#ff7a7a"};

  (async function load(){
    var r=await fetch("/api/creator/earnings");
    if(r.status===401){ location.href="/"; return; }
    var d=await r.json().catch(function(){return{};});
    if(!d.ok) return;

    g("e-pending").textContent = usd(d.totals.accrued);
    g("e-approved").textContent= usd(d.totals.approved);
    g("e-paid").textContent    = usd(d.totals.paid);

    g("e-score-n").textContent = (d.score||0)+"/100";
    g("e-score-why").innerHTML = (d.score_why||[]).map(function(w){
      return '<div class="row" style="justify-content:space-between;font:400 11px/1.8 Manrope;color:#b9c8dd">'+
             '<span>'+esc(w.f)+'</span><span style="color:'+(w.pts<0?"#ff7a7a":"#18c8ff")+'">'+(w.pts>0?"+":"")+esc(w.pts)+'</span></div>';
    }).join("") || '<div style="font:400 11px/1.6 Manrope;color:#7b8fab">Nothing measured yet — post your first drop.</div>';

    if(!d.payouts_enabled){
      g("e-connect").style.display="block";
      g("e-connect-body").textContent = d.connected
        ? "You started setting up payouts but haven't finished. Money can't move until your details are verified."
        : "We pay through Stripe. You'll verify your identity and add a bank account — that's Stripe's step, not ours.";
      g("e-connect-go").textContent = d.connected ? "Finish payout setup" : "Connect payouts";
    }

    g("e-rows").innerHTML = (d.rows||[]).length ? d.rows.map(function(x){
      var car=[x.year,x.make,x.model].filter(Boolean).join(" ")||"—";
      return '<div class="glass pd" style="border-radius:13px;margin-bottom:9px">'+
        '<div class="row" style="justify-content:space-between;align-items:baseline;gap:10px">'+
          '<div style="min-width:0"><div style="font:600 12px/1.4 Manrope">'+esc(car)+'</div>'+
          '<div style="font:500 10px/1.5 Manrope;color:'+(COLOR[x.status]||"#7b8fab")+';margin-top:2px">'+esc(LABEL[x.status]||x.status)+'</div></div>'+
          '<div class="disp" style="font-size:14px;flex:0 0 auto">'+usd(x.amount_cents)+'</div>'+
        '</div></div>';
    }).join("") : '<div style="font:400 12px/1.6 Manrope;color:#7b8fab">No earnings yet.</div>';
  })();

  g("e-connect-go").addEventListener("click",async function(){
    msg("");
    g("e-connect-go").disabled=true;
    var r=await fetch("/api/creator/connect/start",{method:"POST",headers:{"content-type":"application/json"},body:"{}"});
    g("e-connect-go").disabled=false;
    if(r.status===503) return msg("Payouts aren't switched on yet on our side. Your earnings keep accruing in the meantime.");
    var d=await r.json().catch(function(){return{};});
    if(!d.ok||!d.url) return msg("Couldn't open payout setup — try again shortly.");
    location.href=d.url;
  });

  // Coming back from Stripe onboarding: refresh the verified flags, then drop the query string.
  if(new URLSearchParams(location.search).get("connected")==="1"){
    fetch("/api/creator/connect/return").then(function(){ location.replace("/earnings"); });
  }
});
