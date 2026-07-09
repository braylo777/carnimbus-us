document.addEventListener("DOMContentLoaded",function(){
  function $(x){return document.getElementById(x);}
  // Mirror of worker.js segOf — picks which self-hosted garage image to show for the user's current car.
  function segForCar(mk,md){ mk=(mk||"").toLowerCase(); md=(md||"").toLowerCase();
    if(/lexus|bmw|mercedes|audi|genesis|acura|infiniti|volvo|porsche|cadillac/.test(mk))return "luxury";
    if(/f-150|silverado|ram|tundra|tacoma|sierra|ranger|frontier/.test(md))return "truck";
    if(/tesla|ioniq|mach-e|leaf|bolt|ev\b/.test(mk+" "+md))return "ev";
    if(/jeep|grand cherokee|cherokee|wrangler|bronco|4runner|land cruiser|tahoe|yukon|suburban|expedition|sequoia|telluride|palisade|wagoneer|explorer|pilot|highlander|suv|rav4|cr-v|crv/.test(mk+" "+md))return "suv";
    return "sedan"; }
  var ME=null;
  (window.__me||fetch("/api/me").then(function(r){return r.json();})).then(function(me){if(!me||!me.ok){$("gate").style.display="block";throw 0;}return me;}).then(function(me){
    ME=me;
    $("acct").style.display="block";
    var name=me.handle||"CarNimbus rider";
    var initials=name.split(/\s+/).map(function(w){return w[0]||"";}).join("").slice(0,2).toUpperCase()||"CN";
    if(me.avatar)$("y-av").innerHTML='<img src="'+me.avatar+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
    else $("y-av").textContent=initials;
    $("y-name").textContent=name;
    $("y-phone").textContent="•••-"+String(me.phone||"").slice(-4);
    if(me.sid)$("y-cid").textContent="CID# "+String(me.sid).replace(/^(SID|CID)-?/,"");   // label carries CID#, so strip the prefix from the code
    else if(me.cid)$("y-cid").textContent="CID# "+me.cid;
    var a=me.answers||{};
    if(me.answers){document.getElementById("y-preq").style.display="";
      // (FICO badge removed — the "FICO range" row in YOUR FINANCES is the single source.)
      function tc(s){return String(s||"").replace(/\b\w/g,function(m){return m.toUpperCase();});}
      var aprNum=(a.softpull&&a.softpull.apr!=null)?a.softpull.apr:({"800+":6.4,"740-799":7.1,"670-739":9.3,"580-669":13.5,"under 580":17.9}[a.fico]);
      // Financial dashboard only — numbers, in priority order. No "Why now", no "Near".
      var bars=[];
      if(a.buy_method)bars.push(["Method",tc(a.buy_method)]);
      if(a.max_down!=null)bars.push(["Down payment","$"+Number(a.max_down||0).toLocaleString()]);
      if(a.max_monthly)bars.push(["Max monthly","$"+a.max_monthly+"/mo"]);
      if(a.income)bars.push(["Income range",a.income]);
      if(a.fico)bars.push(["FICO range",a.fico]);
      // L4: Garage — current car + a specific trade-in estimate (replaces the old range row).
      if(a.current_year&&a.current_make){ $("y-garage").style.display="block";
        $("y-car").textContent=a.current_year+" "+a.current_make+" "+(a.current_model||"")+(a.current_color?(" · "+a.current_color):"")+(a.current_miles?(" · "+Number(String(a.current_miles).replace(/\D/g,"")||0).toLocaleString()+" mi"):"");
        // M9: mock car image chosen by body/segment (self-hosted — CSP forbids external hosts).
        var img=$("y-img"); if(img){ var seg=segForCar(a.current_make,a.current_model); img.onload=function(){img.style.display="block";}; img.onerror=function(){img.style.display="none";}; img.src="/assets/img/garage/"+seg+".webp"; }
        if(me.trade){ $("y-trade").textContent="Est. trade-in $"+me.trade.point.toLocaleString()+"  ($"+me.trade.low.toLocaleString()+"–$"+me.trade.high.toLocaleString()+")";
          $("y-trade-basis").textContent=me.trade.basis; } }
      document.getElementById("y-summary").style.display="block";
      document.getElementById("y-bars").innerHTML=bars.map(function(b){
        return '<div class="row" style="justify-content:space-between;font:500 12px Manrope"><span style="color:#8ca0c4">'+b[0]+'</span><span style="color:#e2e9f2;font-weight:600;text-align:right">'+b[1]+'</span></div>';}).join('');
      // Hobbies now render in their own top block.
      var hb=(a.hobbies||[]);
      if(hb.length){document.getElementById("y-hobwrap").style.display="block";
        document.getElementById("y-hobbies").innerHTML=hb.map(function(h){return '<span class="badge cyan">'+h+'</span>';}).join('');}
      // Computed estimate box — its own card. Each label is its own text node so the ES observer can translate it.
      var est=document.getElementById("y-estimate");
      if(est&&aprNum!=null){ est.style.display="block";
        // Est. loan principal: buyer's max monthly implies a financed amount at their APR/term (honest, budget-derived).
        var r=aprNum/1200, term=72, mo=+a.max_monthly||0, principal=r?Math.round(mo*(1-Math.pow(1+r,-term))/r):mo*term;
        var loanStr=principal?("$"+principal.toLocaleString()):"—";
        est.innerHTML='<div class="mono" style="font-size:9px;color:#8ca0c4;letter-spacing:.1em;margin-bottom:8px"><span>YOUR ESTIMATE</span>'+(a.softpull?'<span> · SOFT-CHECKED</span>':"")+'</div>'+
          '<div class="row" style="justify-content:space-between;font:600 13px Manrope"><span style="color:#8ca0c4">Est. APR</span><span class="cy" style="font-weight:800">'+aprNum+'% · 72 mo</span></div>'+
          '<div class="row" style="justify-content:space-between;font:600 13px Manrope;margin-top:5px"><span style="color:#8ca0c4">Est. loan amount</span><span style="color:#e2e9f2;font-weight:700">'+loanStr+'</span></div>'+
          '<div style="font:500 10px Manrope;color:#8ca0c4;margin-top:6px"><span>Loan partners:</span> <span style="color:#c9d6ef">Chase Auto · Ally · Capital One</span> <span style="opacity:.6">(sample)</span></div>'+
          '<div style="font:500 9px/1.5 Manrope;color:#7f93b8;margin-top:9px;border-top:1px solid rgba(24,200,255,.12);padding-top:8px"><span>These are estimates based only on the information you provided. CarNimbus isn\'t responsible for inaccurate details you enter — we estimate your rate from your inputs and our dealer &amp; lender partners. Your final terms are confirmed at signing.</span></div>'; }
    }
    // YOUR PASSES — the scheduled drive as a pass card (empty state otherwise).
    if(me.drive){var d=me.drive;$("y-up").style.display="block";
      $("y-veh").textContent=d.year+" "+d.make+" "+d.model;
      $("y-status").textContent=d.status;
      $("y-center").textContent=(d.center||"your CarNimbus center");
      $("y-slot").textContent=fmtSlot(d.slot);
      if(d.photos&&d.photos[0])$("y-photo").innerHTML='<img src="'+d.photos[0]+'" style="width:100%;height:100%;object-fit:cover" alt="">';
      $("y-pass").addEventListener("click",function(e){e.preventDefault();openPass(d);});
      $("y-chat").href="/car?id="+d.vdp_id;
    } else { var np=$("y-nopass"); if(np)np.style.display="block"; }
  }).catch(function(){ if(document.getElementById("acct").style.display!=="block") document.getElementById("gate").style.display="block"; });
  var yo=$("y-out");
  if(yo)yo.addEventListener("click",async function(){
    await fetch("/api/logout",{method:"POST"}); try{sessionStorage.clear();}catch(_){ } location.replace("https://carnimbus.com/");});

  // avatar upload → resize 256² → data-URL → /api/avatar
  var fi=$("y-av-file");
  if(fi) fi.addEventListener("change",function(){ var f=fi.files[0]; if(!f)return;
    var rd=new FileReader(); rd.onload=function(){ var img=new Image();   // data: URL, not blob: — CSP img-src allows it
      img.onload=function(){ var c=document.createElement("canvas");c.width=c.height=256;var g=c.getContext("2d");
        var m=Math.min(img.width,img.height),sx=(img.width-m)/2,sy=(img.height-m)/2; g.drawImage(img,sx,sy,m,m,0,0,256,256);
        var data=c.toDataURL("image/webp",0.8); if(data.length>80000)data=c.toDataURL("image/jpeg",0.7);
        fetch("/api/avatar",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({avatar:data})})
          .then(function(r){return r.json();}).then(function(x){ if(x.ok){ $("y-av").innerHTML='<img src="'+data+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'; try{sessionStorage.removeItem("cn_me");}catch(_){}} }); };
      img.src=rd.result; };
    rd.readAsDataURL(f); });
  var avc=$("y-av"); if(avc)avc.addEventListener("click",function(){ if(fi)fi.click(); });

  // Format a slot like "2025-07-08 18:00" → "Tue Jul 8 · 18:00" (24h). Falls back to raw text.
  function fmtSlot(s){ s=String(s||""); var m=s.match(/(\d{4})-(\d{2})-(\d{2})[ T]?(\d{2}:\d{2})?/);
    if(!m)return s; var dt=new Date(m[1]+"-"+m[2]+"-"+m[3]+"T"+(m[4]||"00:00")+":00");
    var wd=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],mo=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return wd[dt.getDay()]+" "+mo[dt.getMonth()]+" "+dt.getDate()+(m[4]?" · "+m[4]:""); }
  window.fmtSlot=fmtSlot;
  // Drive Now Pass modal
  function openPass(d){
    $("pm-car").innerHTML=d.year+" "+d.make+" "+d.model+'<div style="font:600 10px Manrope;color:#18C8FF;margin-top:2px">Certified · Porsche South Bay · LA Car Guy</div><div style="font:600 11px Manrope;color:#e2e9f2;margin-top:4px">'+fmtSlot(d.slot)+"</div>";
    $("pm-code").textContent=(d.cid||String(d.pass_token).slice(0,6).toUpperCase());
    var qr=qrcodegen.QrCode.encodeText("https://carnimbus.com/pass/"+d.pass_token,qrcodegen.QrCode.Ecc.MEDIUM);
    var cv=$("pm-qr"),s=5,b=2,n=qr.size;cv.width=cv.height=(n+2*b)*s;var g=cv.getContext("2d");
    g.fillStyle="#fff";g.fillRect(0,0,cv.width,cv.height);g.fillStyle="#06163b";
    for(var y=0;y<n;y++)for(var x=0;x<n;x++)if(qr.getModule(x,y))g.fillRect((x+b)*s,(y+b)*s,s,s);
    $("pass-modal").style.display="flex";
    $("pm-cal").onclick=function(){ location.href="/pass/"+d.pass_token+".ics"; };   // server .ics → reliable on iOS
    $("pm-share").onclick=function(){ var u="https://carnimbus.com/pass/"+d.pass_token;
      if(navigator.share)navigator.share({title:"My CarNimbus Drive Now pass",text:d.year+" "+d.make+" "+d.model+" — "+fmtSlot(d.slot),url:u});
      else if(navigator.clipboard){navigator.clipboard.writeText(u);alert("Pass link copied.");} };
    $("pm-pdf").onclick=function(){ var lg=(function(){try{return localStorage.cn_lang==="es"?"?lang=es":"";}catch(_){return "";}})(); window.open("/pass/"+d.pass_token+lg,"_blank"); };
    var ph=$("pm-home"); if(ph)ph.onclick=function(){ $("home-sheet").style.display="flex"; };
    $("pm-close").onclick=function(){ $("pass-modal").style.display="none"; };
    var hc=$("hs-close"); if(hc)hc.onclick=function(){ $("home-sheet").style.display="none"; };
    document.addEventListener("keydown",function(e){ if(e.key==="Escape"){ $("pass-modal").style.display="none"; var hs=$("home-sheet"); if(hs)hs.style.display="none"; } });
    var pc=$("pm-close"); if(pc)pc.focus();   // move focus into the dialog
  }
  window.openPass=openPass;
});
