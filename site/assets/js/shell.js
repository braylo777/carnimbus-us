/* L8 (HTML→JS migration, tranche 1): shared app-page chrome rendered from JS instead of duplicated inline HTML.
   A page opts in with a single <div id="app-shell" data-glow="..."></div> + this script; the repeated cine grid,
   glow, #appnav container, and split scaffold are emitted here. Shrinks per-page HTML, grows the JS share.
   Rollout: convert site/app/*.html chrome one page at a time to `renderShell()` calls; runtime.js wireAppNav()
   still populates #appnav. No behavior change — same DOM, authored once in JS. */
(function(){
  function renderShell(opts){
    opts=opts||{};
    var host=document.getElementById("app-shell"); if(!host) return null;
    var glow=opts.glow||"rgba(24,200,255,.12)";
    host.innerHTML=
      '<div class="cine"><div class="cine-grid"></div><div class="glow" style="width:300px;height:300px;background:'+glow+';top:-80px;right:-40px"></div><div class="cine-vig"></div></div>'+
      '<div class="z row" id="appnav" style="height:52px;align-items:center;padding:0 18px;border-bottom:1px solid rgba(24,200,255,.12);gap:16px"></div>'+
      '<div class="z" id="app-body" style="flex:1;min-height:0"></div>';
    return document.getElementById("app-body");
  }
  window.renderShell=renderShell;
})();
