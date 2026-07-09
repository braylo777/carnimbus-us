document.addEventListener("DOMContentLoaded",function(){
  var status=+(new URLSearchParams(location.search).get("sold")||0)?"sold":"arrived";
  var v=document.getElementById("cam"),cv=document.createElement("canvas"),g=cv.getContext("2d",{willReadFrequently:true}),on=true;
  function done(d){on=false;((v.srcObject&&v.srcObject.getTracks())||[]).forEach(function(t){t.stop();});
    document.getElementById("s-live").style.display="none";var ok=document.getElementById("s-ok");ok.style.display="block";
    document.getElementById("s-who").textContent="✓ "+d.who+(status==="sold"?" — marked sold. 🏁":" checked in — keys ready.");
    setTimeout(function(){location.href="/dealer/";},1800);}
  function fail(t){var m=document.getElementById("s-msg");m.textContent=t;m.style.display="block";}
  async function submit(tok){var payload={token:tok,status:status};
    if(status==="sold"){ var sp=prompt("Sale price? (optional — leave blank to skip)"); var n=parseInt(String(sp||"").replace(/[^0-9]/g,""),10); if(Number.isFinite(n))payload.sale_price=n; }
    var r=await fetch("/api/dealer/checkin",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
    var d=await r.json().catch(function(){return{};}); if(d.ok)done(d.drive); else fail("Pass not found — check the code.");}
  navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}}).then(function(st){
    v.srcObject=st;v.setAttribute("playsinline","");v.play();
    (function tick(){ if(!on)return;
      if(v.readyState===v.HAVE_ENOUGH_DATA){ cv.width=v.videoWidth;cv.height=v.videoHeight;g.drawImage(v,0,0);
        var img=g.getImageData(0,0,cv.width,cv.height),q=jsQR(img.data,img.width,img.height);
        if(q&&q.data){var m=q.data.match(/\/pass\/([A-Za-z0-9]+)/);if(m){submit(m[1]);return;}} }
      requestAnimationFrame(tick); })();
  }).catch(function(){document.getElementById("s-live").style.display="none";fail("Camera blocked — type the desk code below.");});
  document.getElementById("s-go").addEventListener("click",function(){var c=document.getElementById("s-code").value.trim();if(c)submit(c);});
});
