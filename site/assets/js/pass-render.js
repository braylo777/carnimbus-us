// Standalone Drive Now Pass page: draw the QR (external file so it passes CSP script-src 'self')
// and wire the print button. Token comes from the URL: /pass/<token>.
(function(){
  function draw(){
    var tok=(location.pathname.split("/")[2]||"").replace(/\.ics$/,"");
    var cv=document.getElementById("qr");
    if(cv&&window.qrcodegen){ try{
      var qr=qrcodegen.QrCode.encodeText(location.origin+"/pass/"+tok,qrcodegen.QrCode.Ecc.MEDIUM);
      var n=qr.size,b=2,s=6,W=(n+2*b)*s,g=cv.getContext("2d");
      cv.width=cv.height=W; cv.style.width=cv.style.height="118px";   // exact grid → crisp, fills the whole white box
      g.fillStyle="#fff";g.fillRect(0,0,W,W);g.fillStyle="#06163b";
      for(var y=0;y<n;y++)for(var x=0;x<n;x++)if(qr.getModule(x,y))g.fillRect((x+b)*s,(y+b)*s,s,s);
    }catch(e){} }
    var p=document.getElementById("pm-print");
    if(p)p.addEventListener("click",function(){
      // Standalone/home-screen webviews have no print UI — window.print() silently no-ops there.
      var standalone=(navigator.standalone===true)||(window.matchMedia&&matchMedia("(display-mode: standalone)").matches);
      if(standalone&&navigator.share){ navigator.share({title:document.title,url:location.href}).catch(function(){}); return; }
      try{ window.print(); }catch(e){ if(navigator.share)navigator.share({title:document.title,url:location.href}).catch(function(){}); }
    });
    var hint=document.getElementById("pm-hint");
    if(hint&&/iPhone|iPad/.test(navigator.userAgent)) hint.style.display="block";
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",draw); else draw();
})();
