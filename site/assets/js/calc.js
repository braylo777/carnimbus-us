document.addEventListener("DOMContentLoaded",function(){
  function $(id){return document.getElementById(id);}
  function esc(s){return String(s==null?"":s).replace(/[<&>"]/g,function(c){return {"<":"&lt;","&":"&amp;",">":"&gt;","\"":"&quot;"}[c];});}
  function slug(c){return String(c.year+"-"+c.make+"-"+c.model).toLowerCase().replace(/[^a-z0-9]+/g,"-");}
  function run(){
    var dealActive = document.querySelector("#calc-deal button.on");
    var deal_type = dealActive ? dealActive.getAttribute("data-deal") : "finance";
    var mo=$("calc-mo").value.replace(/[^0-9]/g,""), dn=$("calc-down").value.replace(/[^0-9]/g,""), z=$("calc-zip").value.replace(/[^0-9]/g,""), rad=($("calc-radius")?$("calc-radius").value:"");
    try{localStorage.cn_calc=JSON.stringify({mo:mo,dn:dn,z:z});}catch(_){}   // R21: remember calc inputs for signup prefill
    var es = (function(){try{return localStorage.cn_lang==="es";}catch(_){return false;}})();
    $("calc-out").innerHTML='<div style="color:#8ca0c4;font:600 12px Manrope;padding:14px">'+(es?"Buscando tus autos…":"Finding your cars…")+'</div>';
    if (window.NimbusTelemetry) {
      window.NimbusTelemetry.log("discovery.surf", { location: z, source: "marketing-calc" });
    }
    fetch("/api/search?monthly="+mo+"&down="+dn+"&zip="+z+"&radius="+rad+"&deal_type="+deal_type).then(function(r){return r.json();}).then(function(d){
      var cars=(d.cars||[]);
      if(d.reason==="need_inputs"){ $("calc-out").innerHTML='<div style="color:#8ca0c4;font:600 12px Manrope;padding:14px">'+(es?"Ingresa un presupuesto mensual y un código postal válido para ver autos en tu rango.":"Enter a monthly budget and a valid ZIP to see cars in your range.")+'</div>'; return; }
      if(!cars.length){
        var fallbackText = es ? "No pudimos encontrar autos — intenta con una mensualidad más alta o un radio mayor." : "No cars we can place yet — try a higher monthly or a wider radius.";
        $("calc-out").innerHTML='<div style="color:#8ca0c4;font:600 12px Manrope;padding:14px">'+fallbackText+'</div>';
        return;
      }
      var banner=d.reason==="widen_radius"?(es?'Nada dentro de tu radio para ese presupuesto — aquí están los más cercanos.':'Nothing within your radius at that budget — here are the nearest.')
        :d.reason==="over_budget"?(es?'Nada para esa mensualidad cerca de ti — aquí están los más cercanos en presupuesto.':'Nothing at that monthly nearby — here are the closest in range.'):'';
      var bHtml=banner?'<div style="font:600 12px Manrope;color:#F5D90A;background:rgba(245,217,10,.08);border:1px solid rgba(245,217,10,.25);border-radius:12px;padding:9px 12px;margin-bottom:10px">'+banner+'</div>':'';
      var countText = es ? " autos en tu rango" : " cars in your range";
      var showingText = es ? " · mostrando los mejores " : " · showing top ";
      $("calc-out").innerHTML=bHtml+'<div style="font:600 11px Manrope;color:#8ca0c4;margin:2px 0 8px">'+(d.count!=null?d.count:cars.length)+countText+((d.count||0)>cars.length?showingText+cars.length:'')+' →</div>'+
        '<div style="display:flex;gap:12px;overflow-x:auto;padding:4px 0">'+cars.map(function(c){
        return '<a href="/used/'+slug(c)+'-'+c.id+'" style="text-decoration:none;flex:none;width:180px"><div style="background:#0a1f4d;border:1px solid rgba(24,200,255,.2);border-radius:14px;overflow:hidden">'+
          '<div style="height:100px;background:#06163b '+(c.photos&&c.photos[0]?"url(\'"+esc(c.photos[0])+"\') center/cover":"")+'"></div>'+
          '<div style="padding:10px"><div style="font:700 12px Manrope;color:#fff">'+esc(c.year+" "+c.make+" "+c.model)+'</div>'+
          '<div style="font:700 13px Manrope;color:#18C8FF;margin-top:3px">$'+esc(c.price_mo)+'/mo</div>'+
          '<div style="font:700 10px Manrope;color:#18C8FF;margin-top:6px">'+(es?"Conducir ya →":"Drive Now →")+'</div></div></div></a>';
      }).join('')+'</div>';
    }).catch(function(){ $("calc-out").innerHTML=""; }); }
  var b=$("calc-go"); if(b) b.addEventListener("click",run);
  ["calc-mo","calc-down","calc-zip"].forEach(function(id){var e=$(id); if(e)e.addEventListener("keydown",function(ev){if(ev.key==="Enter")run();});});
  var dealButtons = document.querySelectorAll("#calc-deal button");
  dealButtons.forEach(function(btn){
    btn.addEventListener("click", function(){
      dealButtons.forEach(function(b){ b.classList.remove("on"); b.classList.remove("primary"); b.classList.add("ghost"); });
      btn.classList.add("on"); btn.classList.remove("ghost"); btn.classList.add("primary");
    });
  });
});
