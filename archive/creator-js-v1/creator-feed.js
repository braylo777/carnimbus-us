// Creator Network — the drop feed. This is slide-4 step 2.
// Ordering comes from the server (dropFit), and every card carries the `why` behind its rank so a
// creator can always see what put a unit where. External file: CSP forbids inline JS.
document.addEventListener("DOMContentLoaded",function(){
  var listEl=document.getElementById("cr-list");
  var msg=function(t){var m=document.getElementById("cr-msg");m.textContent=t;m.style.display=t?"block":"none";};
  var esc=function(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");};
  var money=function(c){return "$"+Math.round((c||0)/100);};

  function card(d){
    var title=[d.year,d.make,d.model,d.trim].filter(Boolean).join(" ");
    var photo=(d.photos&&d.photos[0])||"";
    var best=d.fit>=70;
    var whyLine=(d.fit_why||[]).filter(function(w){return w.pts>0&&w.f!=="open drop";})
      .map(function(w){return w.f;}).slice(0,2).join(" · ");
    var rateWhy=(d.rate_why||[]).map(function(w){return w.f;}).join(" + ");
    return ''+
      '<div class="glass pd" style="border-radius:16px;margin-bottom:12px;'+(best?'border:1px solid rgba(24,200,255,.35)':'')+'">'+
        (best?'<div class="badge cyan" style="margin-bottom:8px">★ BEST FIT</div>':'')+
        '<div class="row" style="gap:12px;align-items:flex-start">'+
          (photo?'<img src="'+esc(photo)+'" alt="" style="width:84px;height:63px;object-fit:cover;border-radius:10px;flex:0 0 auto">':
                 '<div style="width:84px;height:63px;border-radius:10px;background:rgba(24,200,255,.08);flex:0 0 auto"></div>')+
          '<div style="flex:1;min-width:0">'+
            '<div style="font:600 14px/1.35 Manrope;color:#e2e9f2">'+esc(title)+'</div>'+
            '<div style="font:500 11px/1.5 Manrope;color:#7b8fab;margin-top:3px">'+
              (d.claims?esc(d.claims+" creator"+(d.claims===1?"":"s")+" on it"):"be the first")+'</div>'+
            (whyLine?'<div style="font:400 11px/1.5 Manrope;color:#18c8ff;margin-top:4px">'+esc(whyLine)+'</div>':'')+
          '</div>'+
          '<div style="text-align:right;flex:0 0 auto">'+
            '<div style="font:700 18px/1 Manrope;color:#18c8ff">'+money(d.rate_cents)+'</div>'+
            '<div style="font:500 10px/1.4 Manrope;color:#7b8fab">per post</div>'+
          '</div>'+
        '</div>'+
        (rateWhy?'<div style="font:400 10px/1.5 Manrope;color:#6b7f9b;margin-top:8px">'+esc(rateWhy)+'</div>':'')+
        '<div style="margin-top:12px">'+
          (d.claimed
            ? '<a class="btn ghost md" style="width:100%" href="/drop?id='+d.id+'">Open &mdash; you claimed this</a>'
            : '<button class="btn primary md cr-claim" data-id="'+d.id+'" style="width:100%">Claim &mdash; '+money(d.rate_cents)+'</button>')+
        '</div>'+
      '</div>';
  }

  function wire(){
    listEl.querySelectorAll(".cr-claim").forEach(function(b){
      b.addEventListener("click",async function(){
        b.disabled=true; b.textContent="Claiming…";
        var r=await fetch("/api/creator/claim",{method:"POST",headers:{"content-type":"application/json"},
          body:JSON.stringify({drop_id:+b.dataset.id})});
        if(r.status===401){ location.href="/"; return; }
        if(r.status===409){ b.disabled=false; b.textContent="Closed"; return msg("That drop just closed."); }
        var d=await r.json().catch(function(){return{};});
        if(!d.ok){ b.disabled=false; b.textContent="Try again"; return msg("Couldn't claim that one."); }
        location.href="/drop?id="+b.dataset.id;
      });
    });
  }

  (async function load(){
    var r=await fetch("/api/creator/feed");
    if(r.status===401){ location.href="/"; return; }
    if(r.status===403){ listEl.innerHTML='<div class="glass pd" style="border-radius:16px">Your account is still pending review. We\'ll email you when it opens up.</div>'; return; }
    var d=await r.json().catch(function(){return{};});
    if(!d.ok) return msg("Couldn't load drops.");
    var n=(d.drops||[]).length;
    document.getElementById("cr-count").textContent=n?(n+" open"):"";
    listEl.innerHTML = n ? d.drops.map(card).join("")
      : '<div class="glass pd" style="border-radius:16px;color:#8fa3bf;font:400 13px/1.6 Manrope">No open drops right now. New units land here the moment a dealer uploads them.</div>';
    wire();
  })();
});
