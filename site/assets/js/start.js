document.addEventListener("DOMContentLoaded",function(){
  function $(id){return document.getElementById(id);}
  function esc(s){return String(s==null?"":s).replace(/[<&>"]/g,function(c){return {"<":"&lt;","&":"&amp;",">":"&gt;","\"":"&quot;"}[c];});}
  function slug(c){return String(c.year+"-"+c.make+"-"+c.model).toLowerCase().replace(/[^a-z0-9]+/g,"-");}
  var state={buy_method:"",max_down:"0",max_monthly:""}, step=1;
  function show(n){ step=n;
    ["s1","s2","s3","s4"].forEach(function(id,i){ var el=$(id); if(el)el.classList.toggle("on",i+1===n); });
    var dots=$("dots").children; for(var i=0;i<dots.length;i++) dots[i].classList.toggle("on",i<n);
  }
  // step 1 + 2: chip selects auto-advance
  document.querySelectorAll('[data-k]').forEach(function(b){ b.addEventListener("click",function(){
    var k=b.dataset.k; state[k]=b.dataset.v;
    document.querySelectorAll('[data-k="'+k+'"]').forEach(function(x){x.classList.remove("on");}); b.classList.add("on");
    if(k==="buy_method") setTimeout(function(){show(2);},160);
    if(k==="max_down") setTimeout(function(){show(3);},160);
  }); });
  $("mo").addEventListener("keydown",function(e){ if(e.key==="Enter") $("s3-go").click(); });
  $("s3-go").addEventListener("click",function(){
    state.max_monthly=$("mo").value.replace(/[^0-9]/g,""); if(!state.max_monthly){ $("mo").focus(); return; }
    show(4); load();
  });
  $("s4-back").addEventListener("click",function(){ show(3); });
  function load(){
    $("results").innerHTML='<div style="color:#8ca0c4;font:600 12px Manrope;padding:14px">Finding your cars…</div>';
    fetch("/api/search?monthly="+state.max_monthly+"&down="+state.max_down).then(function(r){return r.json();}).then(function(d){
      var cars=(d.cars||[]);
      $("s4-sub").textContent=cars.length? (cars.length+" cars fit $"+state.max_monthly+"/mo — pick one to schedule a drive.") : "";
      if(!cars.length){ $("results").innerHTML='<div style="color:#8ca0c4;font:600 12px Manrope;padding:14px">Nothing under that budget yet — raise your monthly and try again.</div>'; return; }
      $("results").innerHTML='<div class="col" style="gap:10px">'+cars.map(function(c){
        return '<a href="https://app.carnimbus.com/talk/'+slug(c)+'" style="text-decoration:none"><div class="glass" style="border-radius:14px;padding:11px;display:flex;gap:11px;align-items:center">'+
          '<span style="width:64px;height:46px;border-radius:9px;overflow:hidden;flex:none;background:#0a1f4d '+(c.photos&&c.photos[0]?"url(\'"+esc(c.photos[0])+"\') center/cover":"")+'"></span>'+
          '<span style="flex:1;min-width:0"><span style="display:block;font:700 12px Manrope;color:#fff">'+esc(c.year+" "+c.make+" "+c.model)+'</span>'+
          '<span style="display:block;font:700 12px Manrope;color:#18C8FF;margin-top:2px">$'+esc(c.price_mo)+'/mo</span></span>'+
          '<span class="cy" style="font:700 11px Manrope;flex:none">Schedule →</span></div></a>';
      }).join('')+'</div>';
    }).catch(function(){ $("results").innerHTML='<div style="color:#8ca0c4;font:600 12px Manrope;padding:14px">Something hiccuped — try again.</div>'; });
  }
});
