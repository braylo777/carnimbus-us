// Standalone Drive Now Pass page: draw the QR (external file so it passes CSP script-src 'self')
// and wire the print button. Token comes from the URL: /pass/<token>.
(function(){
  function draw(){
    var tok=(location.pathname.split("/")[2]||"").replace(/\.ics$/,"");
    var cv=document.getElementById("qr");
    if(cv&&window.qrcodegen){ try{
      var qr=qrcodegen.QrCode.encodeText(location.origin+"/pass/"+tok,qrcodegen.QrCode.Ecc.MEDIUM);
      var n=qr.size,s=Math.floor(118/(n+4)),b=2,g=cv.getContext("2d");
      g.fillStyle="#fff";g.fillRect(0,0,118,118);g.fillStyle="#06163b";
      for(var y=0;y<n;y++)for(var x=0;x<n;x++)if(qr.getModule(x,y))g.fillRect((x+b)*s,(y+b)*s,s,s);
    }catch(e){} }
    var p=document.getElementById("pm-print");
    if(p)p.addEventListener("click",function(){window.print();});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",draw); else draw();
})();
