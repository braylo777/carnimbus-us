(function(){
  var KEY=null;
  function $(id){return document.getElementById(id);}
  function esc(s){return String(s==null?"":s).replace(/[<&>]/g,function(c){return {"<":"&lt;","&":"&amp;",">":"&gt;"}[c];});}
  function tile(v,l){ return '<div class="tile"><div class="v">'+esc(v)+'</div><div class="l">'+esc(l)+'</div></div>'; }
  function load(){
    fetch("/api/admin/growth",{headers:{"x-admin-key":KEY}})
      .then(function(r){ if(r.status===403){$("status").textContent="bad key";$("status").style.color="#ff8f8f";return null;} return r.json(); })
      .then(function(d){ if(!d)return; var g=d.rollup;
        if(!g){ $("status").textContent="no rollup yet"; $("tiles").innerHTML='<div class="tile"><div class="l">The growth agent writes its first snapshot within 24h of events flowing.</div></div>'; return; }
        $("status").textContent="as of "+(g.created_at||g.at||"").slice(0,16).replace("T"," "); $("status").style.color="#5ee6a8";
        $("tiles").innerHTML=tile(g.new_users||0,"New users · 7d")+tile(g.matches||0,"Matches · 7d")+tile(g.drives||0,"Test drives · 7d");
        var bp=g.by_prefix||{}, keys=Object.keys(bp), max=Math.max.apply(null,keys.map(function(k){return bp[k];}).concat([1]));
        $("bars").innerHTML=keys.sort(function(a,b){return bp[b]-bp[a];}).map(function(k){
          return '<div class="brow"><span class="k">'+esc(k)+'</span><span class="bar" style="width:'+Math.max(4,Math.round(bp[k]/max*100))+'%"></span><span style="color:#8ca0c4">'+bp[k]+'</span></div>';
        }).join('')||'<div style="font:600 11px Manrope;color:#8ca0c4">No events in window yet.</div>';
      }).catch(function(){ $("status").textContent="offline"; });
  }
  function start(){ KEY=$("key").value.trim(); if(!KEY)return; load(); }
  $("go").addEventListener("click",start);
  $("key").addEventListener("keydown",function(e){ if(e.key==="Enter")start(); });
})();
