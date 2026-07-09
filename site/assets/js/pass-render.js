// Standalone Drive Now Pass page: render the QR as an <img> (iOS print rasterizes <canvas> as a
// black box), wire Save/Print to a clean ?print=1 view that auto-prints. External file for CSP.
(function(){
  function draw(){
    var tok=(location.pathname.split("/")[2]||"").replace(/\.ics$/,"");
    var isPrint=/[?&]print=1/.test(location.search);
    var cv=document.getElementById("qr");
    if(cv&&window.qrcodegen){ try{
      var qr=qrcodegen.QrCode.encodeText(location.origin+"/pass/"+tok,qrcodegen.QrCode.Ecc.MEDIUM);
      var n=qr.size,b=2,s=6,W=(n+2*b)*s,off=document.createElement("canvas");
      off.width=off.height=W; var g=off.getContext("2d");
      g.fillStyle="#fff";g.fillRect(0,0,W,W);g.fillStyle="#06163b";
      for(var y=0;y<n;y++)for(var x=0;x<n;x++)if(qr.getModule(x,y))g.fillRect((x+b)*s,(y+b)*s,s,s);
      var img=document.createElement("img");
      img.src=off.toDataURL("image/png"); img.alt="Check-in QR";
      img.style.cssText="width:118px;height:118px;background:#fff;border-radius:10px;flex:none;display:block";
      cv.parentNode.replaceChild(img,cv);
    }catch(e){} }
    var p=document.getElementById("pm-print");
    if(p)p.addEventListener("click",function(){
      var lg=/[?&]lang=es/.test(location.search)?"&lang=es":""; location.href=location.pathname+"?print=1"+lg;   // clean print view, keep lang
    });
    if(isPrint){ setTimeout(function(){ try{ window.print(); }catch(e){} },400); }
    // O4: buyer-initiated cancel — frees the dealer slot + clears the drive so they can book again.
    var cb=document.getElementById("pm-cancel");
    if(cb)cb.addEventListener("click",function(){
      if(!confirm(cb.dataset.confirm||"Cancel this test drive?"))return;
      cb.disabled=true;
      fetch("/api/drive/cancel",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:cb.dataset.token})})
        .then(function(r){return r.json();}).then(function(d){
          if(d&&d.ok){ var done=document.getElementById("pm-cancelled"); if(done)done.style.display="block";
            if(cb.parentNode)cb.parentNode.style.display="none"; }
          else cb.disabled=false; }).catch(function(){ cb.disabled=false; });
    });
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",draw); else draw();
})();
