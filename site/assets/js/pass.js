document.addEventListener("DOMContentLoaded",function(){
  fetch("/api/me").then(function(r){if(r.status===401){location.href="/app/signin.html";throw 0;}return r.json();}).then(function(me){
    if(!me.drive){document.getElementById("p-empty").style.display="block";return;}
    var d=me.drive;document.getElementById("p-card").style.display="block";
    document.getElementById("p-car").textContent=d.year+" "+d.make+" "+d.model+(d.trim?" "+d.trim:"");
    document.getElementById("p-mo").textContent="$"+d.price_mo+"/mo";
    document.getElementById("p-dealer").textContent=d.center+" Test Drive Center";
    document.getElementById("p-when").textContent=d.slot;
    document.getElementById("p-cid").textContent="CID# "+(d.cid||"");
    document.getElementById("p-code").textContent=String(d.pass_token).slice(0,6).toUpperCase();
    var qr=qrcodegen.QrCode.encodeText("https://carnimbus.com/pass/"+d.pass_token,qrcodegen.QrCode.Ecc.MEDIUM);
    var cv=document.getElementById("p-qr"),s=6,b=2,n=qr.size;cv.width=cv.height=(n+2*b)*s;var g=cv.getContext("2d");
    g.fillStyle="#fff";g.fillRect(0,0,cv.width,cv.height);g.fillStyle="#06163b";
    for(var y=0;y<n;y++)for(var x=0;x<n;x++)if(qr.getModule(x,y))g.fillRect((x+b)*s,(y+b)*s,s,s);
  }).catch(function(){});
});
