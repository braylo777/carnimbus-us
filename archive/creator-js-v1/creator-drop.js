// Creator Network — one drop: the tracked link, and the "I posted it" submission.
// The disclosure checkbox is a hard requirement, not a nudge: the server 400s without it (FTC 16 CFR 255).
document.addEventListener("DOMContentLoaded",function(){
  var g=function(id){return document.getElementById(id);};
  var msg=function(t){var m=g("cr-msg");m.textContent=t;m.style.display=t?"block":"none";};
  var esc=function(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");};
  var id=parseInt(new URLSearchParams(location.search).get("id"),10)||0;
  var drop=null;

  function renderUnit(d){
    var title=[d.year,d.make,d.model,d.trim].filter(Boolean).join(" ");
    var photo=(d.photos&&d.photos[0])||"";
    g("cr-unit").innerHTML=''+
      '<div class="glass pd" style="border-radius:16px">'+
        (photo?'<img src="'+esc(photo)+'" alt="" style="width:100%;height:180px;object-fit:cover;border-radius:12px">':'')+
        '<div class="row" style="justify-content:space-between;align-items:flex-start;margin-top:12px;gap:12px">'+
          '<div><div style="font:700 17px/1.3 Manrope">'+esc(title)+'</div>'+
          '<div style="font:500 11px/1.5 Manrope;color:#7b8fab;margin-top:4px">'+esc(d.claims||0)+' creator'+((d.claims||0)===1?'':'s')+' on this unit</div></div>'+
          '<div style="text-align:right;flex:0 0 auto"><div style="font:700 20px/1 Manrope;color:#18c8ff">$'+Math.round((d.rate_cents||0)/100)+'</div>'+
          '<div style="font:500 10px/1.4 Manrope;color:#7b8fab">per post</div></div>'+
        '</div>'+
        ((d.rate_why||[]).length?'<div style="font:400 10px/1.5 Manrope;color:#6b7f9b;margin-top:9px">'+
          esc(d.rate_why.map(function(w){return w.f;}).join(" + "))+'</div>':'')+
      '</div>';
  }

  (async function load(){
    var r=await fetch("/api/creator/feed");
    if(r.status===401){ location.href="/"; return; }
    var d=await r.json().catch(function(){return{};});
    if(!d.ok) return;
    drop=(d.drops||[]).filter(function(x){return x.id===id;})[0];
    if(!drop){ g("cr-unit").innerHTML='<div class="glass pd" style="border-radius:16px">That drop is no longer open. <a class="navlink" href="/feed">Back to drops</a></div>'; return; }
    renderUnit(drop);
    if(drop.claimed&&drop.link){
      g("cr-linkbox").style.display="block";
      g("cr-link").value=drop.link;
      if(drop.post_status){
        g("cr-done").style.display="block";
        g("cr-done-body").textContent = drop.post_status==="approved"
          ? "Approved. Your earning is queued for payout."
          : drop.post_status==="rejected"
            ? "This post was rejected, so nothing was paid for it."
            : "We're reviewing it. Earnings show as pending until it clears.";
      } else {
        g("cr-postbox").style.display="block";
      }
    }
  })();

  g("cr-copy").addEventListener("click",async function(){
    try{ await navigator.clipboard.writeText(g("cr-link").value); g("cr-copy").textContent="Copied"; }
    catch(_){ g("cr-link").select(); g("cr-copy").textContent="Press ⌘C"; }
    setTimeout(function(){g("cr-copy").textContent="Copy link";},1600);
  });

  g("cr-submit").addEventListener("click",async function(){
    msg("");
    if(!drop||!drop.claim_id) return msg("Claim this drop first.");
    if(!g("cr-disc").checked) return msg("Tick the disclosure box — we can't pay for an unlabelled paid post.");
    var url=g("cr-url").value.trim();
    if(!/^https?:\/\//i.test(url)) return msg("Paste the full link to your post.");
    var r=await fetch("/api/creator/post",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({claim_id:drop.claim_id,post_url:url,
        reach_declared:parseInt(g("cr-reach").value.replace(/\D/g,""),10)||0,
        disclosure_confirmed:true})});
    if(r.status===401){ location.href="/"; return; }
    if(r.status===409) return msg("You already submitted a post for this drop.");
    var d=await r.json().catch(function(){return{};});
    if(d.error==="disclosure_required") return msg("Disclosure is required before we can pay.");
    if(!d.ok) return msg("Couldn't submit that — check the link and try again.");
    g("cr-postbox").style.display="none";
    g("cr-done").style.display="block";
    g("cr-done-body").textContent = d.verdict==="approve"
      ? "Looks good on our checks. It's in the payout queue for final approval."
      : "In review. We check the disclosure and the click-through before releasing payment.";
  });
});
