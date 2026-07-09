/* Nimbus sensor — first-party behavioral capture. Append-only event beacons to /api/events.
   No deps, no cookies of its own (server sets cn_anon). CSP-safe: sendBeacon to 'self'. */
(function(){
  "use strict";
  var Q=[], SID=(function(){ try{ var k=sessionStorage.cn_sid; if(!k){ k="S-"+Date.now().toString(36)+"-"+Math.floor(Math.random()*1e6).toString(36); sessionStorage.cn_sid=k; } return k; }catch(_){ return "S-0"; } })();
  var DEV=/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)?"mobile":"desktop";
  function push(action,extra){ if(!action) return; var e={action:action,session_id:SID,device:DEV,source:location.pathname};
    if(extra){ for(var k in extra) e[k]=extra[k]; } Q.push(e); if(Q.length>=8) flush(); }
  function flush(sync){ if(!Q.length) return; var batch=Q.splice(0,Q.length); var payload=JSON.stringify({events:batch});
    try{ if(sync && navigator.sendBeacon){ navigator.sendBeacon("/api/events", new Blob([payload],{type:"application/json"})); return; } }catch(_){}
    fetch("/api/events",{method:"POST",headers:{"content-type":"application/json"},body:payload,keepalive:true,credentials:"same-origin"}).catch(function(){});
  }
  // Page view on load.
  var T0=Date.now();
  push("discovery.viewed_page",{location:location.pathname});
  // Dwell on hide/unload (sendBeacon so it survives navigation).
  function dwell(){ push("discovery.dwell",{duration_ms:Date.now()-T0,location:location.pathname}); flush(true); }
  document.addEventListener("visibilitychange",function(){ if(document.visibilityState==="hidden") dwell(); });
  window.addEventListener("pagehide",dwell);
  // Declarative capture: any element with data-nimbus-event="prefix.verb".
  document.addEventListener("click",function(ev){ var t=ev.target&&ev.target.closest?ev.target.closest("[data-nimbus-event]"):null;
    if(!t) return; var a=t.getAttribute("data-nimbus-event"); var vid=t.getAttribute("data-nimbus-vehicle");
    push(a, vid?{vehicle_id:+vid}:null); },true);
  // Idle flush so short sessions still report.
  setInterval(function(){ flush(false); }, 15000);
  window.NimbusSensor={ track:push, flush:flush };
})();
