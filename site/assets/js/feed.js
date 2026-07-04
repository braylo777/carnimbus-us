document.addEventListener("DOMContentLoaded",function(){
  var list=document.getElementById("posts");
  function rel(ts){var s=(Date.now()-Date.parse(ts))/1e3;if(s<3600)return Math.max(1,Math.round(s/60))+"m";if(s<86400)return Math.round(s/3600)+"h";return Math.round(s/86400)+"d";}
  function load(){fetch("/api/comments").then(function(r){return r.json();}).then(function(d){
    var cs=d.comments||[];
    if(!cs.length){list.innerHTML='<div style="text-align:center;font:600 12px Manrope;color:#aebfdf;padding:40px 20px">Be the first — say something about a car you talked to.</div>';return;}
    list.innerHTML=cs.map(function(c){
      var who=(c.zip==="agent")?"u/CarNimbusAI · agent":(c.zip?("u/•"+c.zip):"u/driver");
      var chip=c.year?('<a href="/app/car.html?id='+c.vdp_id+'" style="display:flex;align-items:center;gap:8px;margin-top:8px;background:rgba(6,16,40,.6);border:1px solid rgba(24,200,255,.18);border-radius:10px;padding:7px;text-decoration:none">'+
        '<span style="width:34px;height:24px;border-radius:6px;overflow:hidden;flex:none">'+(c.photos&&c.photos[0]?'<img src="'+c.photos[0]+'" style="width:100%;height:100%;object-fit:cover">':'')+'</span>'+
        '<span style="font:700 10px Manrope;flex:1;color:#fff">'+c.year+' '+c.make+' '+c.model+' · <span class="cy">$'+c.price_mo+'/mo</span></span>'+
        '<span style="font:700 9px Manrope;color:#18C8FF">View</span></a>'):'';
      return '<div class="post" style="padding:12px 14px;border-bottom:1px solid rgba(24,200,255,.08)">'+
        '<div class="row" style="align-items:center;gap:7px;font:600 9px Manrope;color:#8ca0c4"><span style="width:18px;height:18px;border-radius:50%;background:#3a4a63;display:grid;place-items:center;font:700 8px Manrope;color:#fff">'+who.slice(2,3).toUpperCase()+'</span>'+who+' · '+rel(c.created_at)+'</div>'+
        '<div class="post-body" style="font:600 12px/1.4 Manrope;margin-top:6px;color:#e2e9f2"></div>'+chip+'</div>';
    }).join('');
    var bodies=list.querySelectorAll(".post-body");
    cs.forEach(function(c,idx){ if(bodies[idx]) bodies[idx].textContent=c.body; });
  }).catch(function(){list.innerHTML='<div style="text-align:center;font:600 12px Manrope;color:#aebfdf;padding:40px 20px">Feed unavailable — refresh to retry.</div>';});}
  load();
  document.getElementById("post-send").addEventListener("click",async function(){
    var inEl=document.getElementById("post-in"),body=inEl.value.trim();if(!body)return;
    var r=await fetch("/api/comments?vdpId=0",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({body:body})});
    if(r.status===401){document.getElementById("post-msg").innerHTML='Sign in to post — <a class="cy" href="/app/signin.html">sign in →</a>';document.getElementById("post-msg").style.display="block";return;}
    var d=await r.json().catch(function(){return{};});
    if(d.ok){inEl.value="";document.getElementById("post-msg").style.display="none";load();}
  });
});
