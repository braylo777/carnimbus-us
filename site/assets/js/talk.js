document.addEventListener("DOMContentLoaded",function(){
  fetch("/api/chats").then(function(r){if(r.status===401){location.href="/app/signin.html";throw 0;}return r.json();}).then(function(d){
    var t=d.threads||[];
    document.getElementById("t-list").innerHTML=t.map(function(c){
      return '<a href="/app/car.html?id='+c.vdpId+'" class="glass row" style="align-items:center;gap:12px;padding:12px;border-radius:14px;text-decoration:none">'+
      '<span style="width:56px;height:40px;border-radius:9px;overflow:hidden;flex:none">'+(c.photos[0]?'<img src="'+c.photos[0]+'" style="width:100%;height:100%;object-fit:cover">':'')+'</span>'+
      '<span style="flex:1;min-width:0"><span style="display:block;font:700 12px Manrope;color:#fff">'+c.year+' '+c.make+' '+c.model+'</span>'+
      '<span style="display:block;font:500 11px Manrope;color:#8ca0c4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></span></span>'+
      '<span class="cy" style="font:700 10px Manrope">$'+c.price_mo+'/mo</span></a>';}).join('')||
      '<div style="text-align:center;font:600 13px Manrope;color:#aebfdf;padding:50px 20px">No conversations yet — every car here talks back.<br><a class="cy" href="/app/discover.html">Find one on Discover →</a></div>';
    var lasts=document.querySelectorAll("#t-list a span span:last-child");
    t.forEach(function(c,i){ if(lasts[i]) lasts[i].textContent=c.last; });
  }).catch(function(){});
});
