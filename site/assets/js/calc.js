document.addEventListener("DOMContentLoaded",function(){
  function $(id){return document.getElementById(id);}
  function esc(s){return String(s==null?"":s).replace(/[<&>"]/g,function(c){return {"<":"&lt;","&":"&amp;",">":"&gt;","\"":"&quot;"}[c];});}
  function slug(c){return String(c.year+"-"+c.make+"-"+c.model).toLowerCase().replace(/[^a-z0-9]+/g,"-");}
  function run(){ var mo=$("calc-mo").value.replace(/[^0-9]/g,""), dn=$("calc-down").value.replace(/[^0-9]/g,""), z=$("calc-zip").value.replace(/[^0-9]/g,""), rad=($("calc-radius")?$("calc-radius").value:"");
    $("calc-out").innerHTML='<div style="color:#8ca0c4;font:600 12px Manrope;padding:14px">Finding your cars…</div>';
    fetch("/api/search?monthly="+mo+"&down="+dn+"&zip="+z+"&radius="+rad).then(function(r){return r.json();}).then(function(d){
      var cars=(d.cars||[]);
      if(d.reason==="need_inputs"){ $("calc-out").innerHTML='<div style="color:#8ca0c4;font:600 12px Manrope;padding:14px">Enter a monthly budget and a valid ZIP to see cars in your range.</div>'; return; }
      if(!cars.length){ $("calc-out").innerHTML='<div style="color:#8ca0c4;font:600 12px Manrope;padding:14px">No cars in that range yet — try a higher monthly or a larger down payment.</div>'; return; }
      $("calc-out").innerHTML='<div style="font:600 11px Manrope;color:#8ca0c4;margin:2px 0 8px">'+(d.count!=null?d.count:cars.length)+' cars in your range'+((d.count||0)>cars.length?' · showing top '+cars.length:'')+' →</div>'+
        '<div style="display:flex;gap:12px;overflow-x:auto;padding:4px 0">'+cars.map(function(c){
        return '<a href="https://app.carnimbus.com/talk/'+slug(c)+'" style="text-decoration:none;flex:none;width:180px"><div style="background:#0a1f4d;border:1px solid rgba(24,200,255,.2);border-radius:14px;overflow:hidden">'+
          '<div style="height:100px;background:#06163b '+(c.photos&&c.photos[0]?"url(\'"+esc(c.photos[0])+"\') center/cover":"")+'"></div>'+
          '<div style="padding:10px"><div style="font:700 12px Manrope;color:#fff">'+esc(c.year+" "+c.make+" "+c.model)+'</div>'+
          '<div style="font:700 13px Manrope;color:#18C8FF;margin-top:3px">$'+esc(c.price_mo)+'/mo</div>'+
          '<div style="font:700 10px Manrope;color:#18C8FF;margin-top:6px">Talk to it →</div></div></div></a>';
      }).join('')+'</div>';
    }).catch(function(){ $("calc-out").innerHTML=""; }); }
  var b=$("calc-go"); if(b) b.addEventListener("click",run);
  ["calc-mo","calc-down","calc-zip"].forEach(function(id){var e=$(id); if(e)e.addEventListener("keydown",function(ev){if(ev.key==="Enter")run();});});
});
