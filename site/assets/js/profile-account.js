document.addEventListener("DOMContentLoaded",function(){
  function $(x){return document.getElementById(x);}
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
      if(a.fico){var yb=document.getElementById("y-band");yb.style.display="";yb.textContent="FICO "+a.fico;}
      function tc(s){return String(s||"").replace(/\b\w/g,function(m){return m.toUpperCase();});}
      var APR=(a.softpull&&a.softpull.apr!=null)?(a.softpull.apr+"%"):{"800+":"6.4%","740-799":"7.1%","670-739":"9.3%","580-669":"13.5%","under 580":"17.9%"}[a.fico];
      var bars=[];
      if(a.max_monthly)bars.push(["Monthly","$"+a.max_monthly+"/mo"]);
      if(a.max_down!=null)bars.push(["Down payment","$"+Number(a.max_down||0).toLocaleString()]);
      if(a.buy_method)bars.push(["Method",tc(a.buy_method)]);
      if(APR)bars.push(["Est. APR",APR+" · 72mo"]);
      if(a.income)bars.push(["Income",a.income]);
      if(a.reason)bars.push(["Why now",tc(a.reason)]);
      if(a.zip)bars.push(["Near",a.zip]);
      document.getElementById("y-summary").style.display="block";
      document.getElementById("y-bars").innerHTML=bars.map(function(b){
        return '<div class="row" style="justify-content:space-between;font:500 12px Manrope"><span style="color:#8ca0c4">'+b[0]+'</span><span style="color:#e2e9f2;font-weight:600;text-align:right">'+b[1]+'</span></div>';}).join('');
      document.getElementById("y-hobbies").innerHTML=(a.hobbies||[]).map(function(h){return '<span class="badge cyan">'+h+'</span>';}).join('');
    }
    if(me.drive){var d=me.drive;$("y-up").style.display="block";
      $("y-veh").textContent=d.year+" "+d.make+" "+d.model;
      $("y-status").textContent=d.status;
      $("y-center").textContent="Porsche South Bay · LA Car Guy";
      $("y-slot").textContent=fmtSlot(d.slot);
      if(d.photos&&d.photos[0])$("y-photo").innerHTML='<img src="'+d.photos[0]+'" style="width:100%;height:100%;object-fit:cover" alt="">';
      $("y-pass").addEventListener("click",function(e){e.preventDefault();openPass(d);});
      $("y-chat").href="/car?id="+d.vdp_id;}
    fetch("/api/feed?lang="+(function(){try{return localStorage.cn_lang==="es"?"es":"en";}catch(_){return "en";}})()).then(function(r){return r.json();}).then(function(f){
      document.getElementById("y-matches").innerHTML=(f.cars||[]).slice(0,3).map(function(c){
        return '<a href="/car?id='+c.id+'" class="row" style="align-items:center;gap:10px;text-decoration:none;padding:6px 0">'+
        '<span style="width:52px;height:36px;border-radius:8px;overflow:hidden;flex:none">'+(c.photos&&c.photos[0]?'<img src="'+c.photos[0]+'" style="width:100%;height:100%;object-fit:cover">':'')+'</span>'+
        '<span style="flex:1"><span style="display:block;font:600 11px Manrope;color:#fff">'+c.year+' '+c.make+' '+c.model+'</span><span class="cy" style="font:700 10px Manrope">$'+c.price_mo+'/mo</span></span>'+(c.match!=null?'<span class="badge cyan">'+c.match+'%</span>':'')+'</a>';}).join('');}).catch(function(){});
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
