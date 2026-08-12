// Creator Network — profile. Shows only this creator's own numbers; no buyer data reaches this surface.
document.addEventListener("DOMContentLoaded",function(){
  var g=function(id){return document.getElementById(id);};
  var esc=function(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");};

  function row(label,value){
    return '<div class="row" style="justify-content:space-between;font:400 12px/1.9 Manrope;color:#b9c8dd">'+
           '<span>'+esc(label)+'</span><span style="color:#e2e9f2">'+esc(value)+'</span></div>';
  }

  (async function load(){
    var fr=await fetch("/api/creator/feed");
    if(fr.status===401){ location.href="/"; return; }
    var f=await fr.json().catch(function(){return{};});
    var e=await (await fetch("/api/creator/earnings")).json().catch(function(){return{};});
    if(!e.ok) return;

    var handle=(f.creator&&f.creator.handle)||"—";
    g("p-handle").textContent=handle;
    g("p-status").textContent="Approved · NIMBUS score "+(e.score||0)+"/100";

    var s=e.stats||{};
    var ctr=(s.reach>0)?((s.clicks/s.reach)*100).toFixed(1)+"%":"—";
    g("p-stats").innerHTML=
      row("Posts submitted",s.posts||0)+
      row("Approved",s.approved||0)+
      row("Rejected",s.rejected||0)+
      row("Link clicks",s.clicks||0)+
      row("Click-through",ctr)+
      row("Leads produced",s.leads||0);

    g("p-payout").textContent = e.payouts_enabled
      ? "Verified. Approved earnings can be sent to you."
      : e.connected
        ? "Setup started but not finished — money can't move until Stripe verifies your details."
        : "Not set up yet. Earnings accrue either way; you just can't be paid until it's connected.";
  })();
});
