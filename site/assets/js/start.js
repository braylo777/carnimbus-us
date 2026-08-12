document.addEventListener("DOMContentLoaded",function(){
  function $(id){return document.getElementById(id);}
  function esc(s){return String(s==null?"":s).replace(/[<&>"]/g,function(c){return {"<":"&lt;","&":"&amp;",">":"&gt;","\"":"&quot;"}[c];});}
  function slug(c){return String(c.year+"-"+c.make+"-"+c.model).toLowerCase().replace(/[^a-z0-9]+/g,"-");}
  var state={buy_method:"",max_down:"0",max_monthly:"",zip:"",fico:""}, step=1;
  // Same ZIP set and the same lazy load as lead.js:48 — one list of valid US ZIPs, fetched on first
  // submit, never on page load. A second validator here would be a second thing to keep true.
  var ZIPSET=null;
  function zipOk(z){ if(!/^\d{5}$/.test(z)) return Promise.resolve(false);
    if(ZIPSET) return Promise.resolve(ZIPSET.has(z));
    return fetch("/assets/data/us-zips.json").then(function(r){return r.json();}).then(function(s){
      ZIPSET=new Set(s.match(/.{5}/g)); return ZIPSET.has(z);
    }).catch(function(){ return true; }); }   // network failure must not block a real shopper
  
  function show(n){
    step=n;
    var el=$("s"+n);
    if(el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // IntersectionObserver for active step indicator
  if (window.IntersectionObserver) {
    var obs = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var n = parseInt(entry.target.id.slice(1), 10);
          if (Number.isFinite(n)) {
            step = n;
            var dots = $("dots").children;
            for (var i = 0; i < dots.length; i++) {
              dots[i].classList.toggle("on", i < n);
            }
          }
        }
      });
    }, { threshold: 0.5 });
    document.querySelectorAll(".step").forEach(function(el) { obs.observe(el); });
  }

  // step 1 + 2: chip selects auto-advance
  document.querySelectorAll('[data-k]').forEach(function(b){ b.addEventListener("click",function(){
    var k=b.dataset.k; state[k]=b.dataset.v;
    document.querySelectorAll('[data-k="'+k+'"]').forEach(function(x){x.classList.remove("on");}); b.classList.add("on");
    if(k==="buy_method") setTimeout(function(){show(2);},160);
    if(k==="max_down") setTimeout(function(){show(3);},160);
  }); });
  $("mo").addEventListener("keydown",function(e){ if(e.key==="Enter") $("zip").focus(); });
  $("zip").addEventListener("keydown",function(e){ if(e.key==="Enter") $("s3-go").click(); });
  function zipMsg(t){ var m=$("zip-msg"); m.textContent=t||""; m.style.display=t?"block":"none"; }
  $("s3-go").addEventListener("click",function(){
    state.max_monthly=$("mo").value.replace(/[^0-9]/g,""); if(!state.max_monthly){ $("mo").focus(); return; }
    var z=($("zip").value||"").replace(/\D/g,"");
    zipMsg("");
    zipOk(z).then(function(ok){
      if(!ok){ zipMsg("Enter a valid 5-digit US ZIP so we can find cars near you."); $("zip").focus(); return; }
      state.zip=z;
      load();
      setTimeout(function(){show(4);},100);
    });
  });
  $("s4-back").addEventListener("click",function(){ show(3); });
  function load(){
    $("results").innerHTML='<div style="color:#8ca0c4;font:600 12px Manrope;padding:14px">Finding your cars…</div>';
    if (window.NimbusTelemetry) {
      // `location` is the event spine's GEOGRAPHY field. This used to pass state.max_down into
      // it, writing a dollar amount where every reader expects a ZIP — corrupting any map or
      // regional read of discovery.surf. The ZIP is what belongs here, and now we have one.
      window.NimbusTelemetry.log("discovery.surf", { location: state.zip, source: "onboarding-wizard" });
    }
    // src=scan marks this as a real shopper search so worker.js:1392 records it in `scans`. Without
    // it this page was invisible to demandRollup, and the demand board was reading one of three
    // public entry points.
    // EVERY control on this page now reaches the server. Until 2026-08-06 three were dropped:
    //   deal_type — step 1 collected Finance/Lease/Cash into state.buy_method and NEVER sent it,
    //               so the server defaulted to finance and one third of this wizard was a placebo;
    //   fico      — server defaulted to 670-739 @ 9.3% APR, a ~$180/mo swing on a $30k car versus
    //               a 580-669 buyer, so `/` and `/start` quoted the SAME car at different prices;
    //   radius    — absent means 0, i.e. unlimited, while `/` defaults to 15 miles — different
    //               inventory for the same ZIP.
    // No visual change: these controls already exist and are already answered.
    var dealType=String(state.buy_method||"finance").toLowerCase();
    fetch("/api/search?src=scan&monthly="+state.max_monthly+"&down="+state.max_down
      +"&zip="+encodeURIComponent(state.zip)
      +"&radius=15"
      +"&deal_type="+encodeURIComponent(dealType)
      +"&fico="+encodeURIComponent(state.fico||"670-739")).then(function(r){return r.json();}).then(function(d){
      var cars=(d.cars||[]);
      $("s4-sub").textContent=cars.length? (cars.length+" cars fit $"+state.max_monthly+"/mo — pick one to schedule a drive.") : "";
      if(!cars.length){ $("results").innerHTML='<div style="color:#8ca0c4;font:600 12px Manrope;padding:14px">Nothing under that budget yet — raise your monthly and try again.</div>'; return; }
      $("results").innerHTML='<div class="col" style="gap:10px">'+cars.map(function(c){
        return '<a href="/used/'+slug(c)+'-'+c.id+'" style="text-decoration:none"><div class="glass" style="border-radius:14px;padding:11px;display:flex;gap:11px;align-items:center">'+
          '<span style="width:64px;height:46px;border-radius:9px;overflow:hidden;flex:none;background:#0a1f4d '+(c.photos&&c.photos[0]?"url(\'"+esc(c.photos[0])+"\') center/cover":"")+'"></span>'+
          '<span style="flex:1;min-width:0"><span style="display:block;font:700 12px Manrope;color:#fff">'+esc(c.year+" "+c.make+" "+c.model)+'</span>'+
          '<span style="display:block;font:700 12px Manrope;color:#18C8FF;margin-top:2px">$'+esc(c.price_mo)+'/mo</span></span>'+
          '<span class="cy" style="font:700 11px Manrope;flex:none">Schedule →</span></div></a>';
      }).join('')+'</div>';
    }).catch(function(){ $("results").innerHTML='<div style="color:#8ca0c4;font:600 12px Manrope;padding:14px">Something hiccuped — try again.</div>'; });
  }
});
