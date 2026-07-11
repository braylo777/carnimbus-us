document.addEventListener("DOMContentLoaded",function(){
  function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
  var k=localStorage.getItem("cn_admin")||"";document.getElementById("a-key").value=k;
  async function load(){var key=document.getElementById("a-key").value.trim();if(!key)return;
    localStorage.setItem("cn_admin",key);
    var r=await fetch("/api/admin/stats",{headers:{"x-admin-key":key}});
    if(!r.ok){document.getElementById("a-msg").textContent="Wrong key or no access.";document.getElementById("a-msg").style.display="block";return;}
    var d=await r.json();document.getElementById("a-msg").style.display="none";document.getElementById("stats").style.display="";
    ["waitlist","users","profiles","drives","activeCars","comments","activeSessions","recentDrives","convRate"].forEach(function(p){
      document.getElementById("s-"+p).textContent=d[p];});
    document.getElementById("leads").innerHTML=(d.dealerLeads||[]).map(function(l){
      var base = l.base_fee != null ? l.base_fee : 1500;
      var prem = l.slot_premium != null ? l.slot_premium : 0;
      var baseStr = "$" + (base / 100).toFixed(2);
      var premStr = "$" + (prem / 100).toFixed(2);
      var totStr = "$" + ((base + prem) / 100).toFixed(2);
      var slotStr = l.ad_slot ? "Slot " + l.ad_slot : "No slot";
      return '<div class="row" style="gap:10px;padding:7px 0;border-bottom:1px solid rgba(24,200,255,.08);font:600 11px Manrope;flex-wrap:wrap">'+
      '<span style="min-width:110px">'+esc(l.name)+'</span><span style="min-width:140px;color:#8ca0c4">'+esc(l.dealership)+'</span>'+
      '<span class="badge cyan">'+esc(l.role||'—')+'</span><span style="color:#8ca0c4">'+esc(l.phone||'')+' '+esc(l.email||'')+'</span>'+
      '<span style="color:#FFB27A;font-weight:700">'+slotStr+' ('+premStr+') · Total: '+totStr+'</span>'+
      (l.status==="active"?'<span class="badge green">'+esc(l.client_no||'')+'</span>':'<button class="btn primary sm" data-act="'+(+l.id)+'" type="button">Activate → issue #</button>')+
      '<span class="mono" style="font-size:9px;color:#7f93b8;margin-left:auto">'+String(l.created_at).slice(0,10)+'</span></div>';}).join('')||
      '<div style="font:600 12px Manrope;color:#aebfdf">No dealer requests yet.</div>';}
  document.getElementById("a-load").addEventListener("click",load);
  document.getElementById("leads").addEventListener("click",async function(e){
    var b=e.target.closest("[data-act]");if(!b)return;b.disabled=true;
    await fetch("/api/admin/dealer/activate",{method:"POST",headers:{"content-type":"application/json","x-admin-key":localStorage.getItem("cn_admin")||""},body:JSON.stringify({leadId:+b.dataset.act})});
    load();});
  setInterval(load,60000);
  if(k)load();
});
