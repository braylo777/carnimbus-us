(function(){
  var KEY=null, timer=null;
  var COLORS={discovery:"#18C8FF",intent:"#8b5cf6",finance:"#5ee6a8",action:"#f5a623",social:"#ff8f8f",ai:"#6ee7ff",dealer:"#c9d6ef"};
  function $(id){return document.getElementById(id);}
  function esc(s){return String(s==null?"":s).replace(/[<&>]/g,function(c){return {"<":"&lt;","&":"&amp;",">":"&gt;"}[c];});}
  function draw(evs){
    $("rows").innerHTML=(evs||[]).map(function(e){
      var pfx=String(e.action||"").split(".")[0], col=COLORS[pfx]||"#8ca0c4";
      var t=e.ts?new Date(e.ts).toLocaleTimeString():"";
      return "<tr><td class='mono'>"+esc(t)+"</td>"+
        "<td><span class='pfx' style='background:"+col+"22;color:"+col+"'>"+esc(e.action)+"</span></td>"+
        "<td class='mono'>"+esc(e.cid||e.anon_id||"")+"</td>"+
        "<td class='mono'>"+esc(e.vehicle_id||"")+"</td>"+
        "<td class='mono'>"+esc(e.source||"")+"</td></tr>";
    }).join("");
  }
  function poll(){
    fetch("/api/admin/events/tail?n=60",{headers:{"x-admin-key":KEY}})
      .then(function(r){ if(r.status===403){$("status").textContent="bad key";$("status").style.color="#ff8f8f";clearInterval(timer);return null;} return r.json(); })
      .then(function(d){ if(!d)return; $("status").textContent="live · "+(d.events?d.events.length:0)+" recent"; $("status").style.color="#5ee6a8"; draw(d.events); })
      .catch(function(){ $("status").textContent="offline"; });
  }
  function start(){ KEY=$("key").value.trim(); if(!KEY)return; if(timer)clearInterval(timer); poll(); timer=setInterval(poll,4000); }
  $("go").addEventListener("click",start);
  $("key").addEventListener("keydown",function(e){ if(e.key==="Enter")start(); });
})();
