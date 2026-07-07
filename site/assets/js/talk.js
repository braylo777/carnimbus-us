document.addEventListener("DOMContentLoaded",function(){
  var list=document.getElementById("t-list");
  function carCard(c,sub){
    return '<a href="/car?id='+(c.id||c.vdpId)+'" class="glass row" style="align-items:center;gap:12px;padding:12px;border-radius:14px;text-decoration:none">'+
    '<span style="width:56px;height:40px;border-radius:9px;overflow:hidden;flex:none">'+(c.photos&&c.photos[0]?'<img src="'+c.photos[0]+'" style="width:100%;height:100%;object-fit:cover">':'')+'</span>'+
    '<span style="flex:1;min-width:0"><span style="display:block;font:700 12px Manrope;color:#fff">'+c.year+' '+c.make+' '+c.model+'</span>'+
    '<span style="display:block;font:500 11px Manrope;color:#8ca0c4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+sub+'</span></span>'+
    '<span class="cy" style="font:700 10px Manrope">$'+c.price_mo+'/mo</span></a>';
  }
  function showRecommended(){
    fetch("/api/feed?lang="+(function(){try{return localStorage.cn_lang==="es"?"es":"en";}catch(_){return "en";}})()).then(function(r){return r.json();}).then(function(f){
      var cars=(f.cars||[]).slice(0,5);
      list.innerHTML=cars.map(function(c){return carCard(c,"Tap to talk to this car"+(c.match!=null?" · "+c.match+"% match":""));}).join('')||
        '<div style="text-align:center;font:600 13px Manrope;color:#aebfdf;padding:50px 20px">Finish your profile to meet your matches.<br><a class="cy" href="/matches">See matches →</a></div>';
    }).catch(function(){list.innerHTML='<div style="text-align:center;font:600 13px Manrope;color:#aebfdf;padding:50px 20px">Couldn’t load your matches — refresh to retry.</div>';});
  }
  fetch("/api/chats").then(function(r){if(r.status===401){location.href="/signin";throw 0;}return r.json();}).then(function(d){
    var t=d.threads||[];
    if(!t.length){ showRecommended(); return; }
    list.innerHTML=t.map(function(c){return carCard(c,"");}).join('');
    var lasts=list.querySelectorAll("a span span:last-child");
    t.forEach(function(c,i){ if(lasts[i]) lasts[i].textContent=c.last||"Tap to keep talking"; });
  }).catch(function(){});
});
