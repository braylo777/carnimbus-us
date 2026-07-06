document.addEventListener("DOMContentLoaded",function(){
  var grid=document.getElementById("grid");
  function card(c){return '<a class="glass vcard hoverable" href="/app/car.html?id='+c.id+'" style="text-decoration:none;display:block">'+
    '<div class="vphoto">'+(c.photos&&c.photos[0]?'<img src="'+c.photos[0]+'" alt="'+c.year+' '+c.make+' '+c.model+'" loading="lazy" onerror="this.remove()">':'')+
    '<span class="vbadge cert">Certified</span>'+(c.match!=null?'<span class="vbadge best">'+c.match+'% match</span>':'')+'</div>'+
    '<div class="vbody"><h4>'+c.year+' '+c.make+' '+c.model+'</h4><div class="vtrim">'+(c.trim||'&nbsp;')+'</div>'+
    '<div class="row vmeta"><span>'+c.miles+' mi</span><span>'+c.drivetrain+'</span></div>'+
    '<div style="font:600 9px Manrope;color:#8ca0c4">$0 down · 72 mo</div><div class="row vprice"><b>$'+c.price_mo+'<small>/mo</small></b><span class="vcta">Talk to this car →</span></div></div></a>';}
  fetch("/api/feed").then(function(r){return r.json();}).then(function(d){
    if(!d.ok)throw 0;
    if(d.authed===false){document.getElementById("m-gate").style.display="flex";}
    var cars=(d.cars||[]).slice(0,10);
    grid.innerHTML=cars.map(card).join('')||'<div style="grid-column:1/-1;text-align:center;font:600 12px Manrope;color:#aebfdf;padding:30px">No matches yet — finish your profile to rank inventory.</div>';
  }).catch(function(){grid.innerHTML='<div style="grid-column:1/-1;text-align:center;font:600 12px Manrope;color:#aebfdf;padding:30px">Matches unavailable — refresh to retry.</div>';});
});
