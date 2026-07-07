document.addEventListener("DOMContentLoaded",function(){
  var grid=document.getElementById("grid");
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function card(c){
    var dm=(c.match!=null?c.match+'% Dream Match':'Top match');
    var meta='$'+c.price_mo+'/mo · '+esc(c.miles)+' mi · Certified · Los Angeles, CA';   // real dealer geo pending — no synthetic distances
    var why=c.why?'<div style="font:italic 500 12.5px/1.55 Manrope;color:#c4d2ea;margin:9px 0 12px">'+esc(c.why)+'</div>':'';
    return '<div class="glass vcard" style="display:block;padding:0;overflow:hidden">'+
      '<div class="vphoto">'+(c.photos&&c.photos[0]?'<img src="'+esc(c.photos[0])+'" alt="'+esc(c.year+' '+c.make+' '+c.model)+'" loading="lazy" onerror="this.remove()">':'')+
      '<span class="vbadge cert">Certified</span></div>'+
      '<div class="vbody" style="padding:15px">'+
        '<h4 style="margin:0">'+esc(c.year+' '+c.make+' '+c.model+(c.trim?' '+c.trim:''))+'</h4>'+
        '<div class="cy" style="font:700 13px Manrope;margin:3px 0 7px">'+esc(dm)+'</div>'+
        '<div style="font:600 11px Manrope;color:#8ca0c4">'+meta+'</div>'+
        why+
        '<div class="row" style="gap:8px">'+
          '<a class="btn primary sm" href="/car?id='+c.id+'" style="text-decoration:none;flex:1;text-align:center">Talk to this Car</a>'+
          '<a class="btn ghost sm" href="/car?id='+c.id+'&book=1" style="text-decoration:none;flex:1;text-align:center">Schedule Test Drive</a>'+
        '</div>'+
      '</div></div>';}
  fetch("/api/feed?lang="+(function(){try{return localStorage.cn_lang==="es"?"es":"en";}catch(_){return "en";}})()).then(function(r){return r.json();}).then(function(d){
    if(!d.ok)throw 0;
    if(d.authed===false){document.getElementById("m-gate").style.display="flex";}
    var cars=(d.cars||[]).slice(0,10);
    grid.innerHTML=cars.map(card).join('')||'<div style="grid-column:1/-1;text-align:center;font:600 12px Manrope;color:#aebfdf;padding:30px">No matches yet — finish your profile to rank inventory.</div>';
  }).catch(function(){grid.innerHTML='<div style="grid-column:1/-1;text-align:center;font:600 12px Manrope;color:#aebfdf;padding:30px">Matches unavailable — refresh to retry.</div>';});
});
