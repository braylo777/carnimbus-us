document.addEventListener("DOMContentLoaded",function(){
  var KEY=localStorage.cn_admin||"";
  function $(x){return document.getElementById(x);}
  function hdr(){return {"x-admin-key":KEY,"content-type":"application/json"};}
  function msg(t){var m=$("p-msg");m.textContent=t;m.style.display=t?"block":"none";}
  var kIn=$("pk");if(kIn){kIn.value=KEY;kIn.addEventListener("change",function(){KEY=kIn.value.trim();try{localStorage.cn_admin=KEY;}catch(_){}load(CUR);});}
  var CUR="buyers";
  var HEADS={buyers:["phone","full_name","zip","max_monthly","fico","dream_car","timeline","body_pref"],
             vdps:["vin","year","make","model","price_mo","body","mileage","dealer_id","active"]};
  function parseCSV(text){ var rows=[],i=0,f="",row=[],q=false;
    var push=function(){row.push(f);f="";},end=function(){push();rows.push(row);row=[];};
    while(i<text.length){var c=text[i];
      if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}
      else if(c==='"')q=true;else if(c===",")push();else if(c==="\n")end();else if(c!=="\r")f+=c;i++;}
    if(f.length||row.length)end();
    return rows;}
  function load(pool){ CUR=pool;
    document.querySelectorAll(".ptab").forEach(function(b){b.classList.toggle("on",b.dataset.pool===pool);});
    if(!KEY){msg("Enter the admin key to load pools.");return;}
    fetch("/api/admin/export?pool="+pool,{headers:hdr()}).then(function(r){if(!r.ok)throw r.status;return r.text();}).then(function(csv){
      var rows=parseCSV(csv); var head=(rows.shift()||[]).map(function(h){return h.trim();});
      rows=rows.filter(function(r){return r.length>1;});
      var idx=HEADS[pool].map(function(h){return head.indexOf(h);});
      $("p-count").textContent=rows.length+" rows";
      $("pool-table").innerHTML="<tr>"+HEADS[pool].map(function(h){return "<th>"+h+"</th>";}).join("")+"</tr>"+
        rows.slice(0,100).map(function(r){return "<tr>"+idx.map(function(i){var c=(i>-1?(r[i]||""):"").replace(/&/g,"&amp;").replace(/</g,"&lt;");return "<td>"+c+"</td>";}).join("")+"</tr>";}).join("");
      msg("");
    }).catch(function(e){msg(e===401||e===403?"Bad admin key.":"Load failed — check key & retry.");});}
  document.querySelectorAll(".ptab").forEach(function(b){b.addEventListener("click",function(){load(b.dataset.pool);});});
  function toObjects(rows){ var head=(rows.shift()||[]).map(function(h){return h.trim();});
    return rows.filter(function(r){return r.length>1;}).map(function(r){var o={};head.forEach(function(h,j){o[h]=(r[j]||"").trim();});return o;});}
  function upload(pool,file){ var rd=new FileReader();
    rd.onload=async function(){ var recs=toObjects(parseCSV(rd.result)), url=pool==="vdps"?"/api/vdp/ingest":"/api/admin/profiles/ingest", done=0;
      if(!recs.length){msg("Empty CSV — need a header row plus data.");return;}
      for(var i=0;i<recs.length;i+=50){ var batch=recs.slice(i,i+50);
        if(pool==="vdps") batch=batch.map(function(c){c.features=c.features?c.features.split("|"):[];c.photos=c.photo?[c.photo]:[];return c;});
        var r=await fetch(url,{method:"POST",headers:hdr(),body:JSON.stringify(batch)});
        var d=await r.json().catch(function(){return{};}); done+=(d.count||d.ingested||0);
        msg("Uploaded "+done+"/"+recs.length+"…"); }
      msg("Uploaded "+done+" — now hit Reindex so they match."); load(pool); };
    rd.readAsText(file); }
  ["buyers","vdps"].forEach(function(pool){ var inp=$("up-"+pool+"-file"),btn=$("up-"+pool);
    if(btn&&inp){btn.addEventListener("click",function(){inp.click();});inp.addEventListener("change",function(){if(inp.files[0])upload(pool,inp.files[0]);inp.value="";});}});
  ["buyers","vdps"].forEach(function(pool){ var b=$("dl-"+pool); if(b)b.addEventListener("click",function(){
    fetch("/api/admin/export?pool="+pool,{headers:hdr()}).then(function(r){if(!r.ok)throw 0;return r.blob();}).then(function(bl){
      var a=document.createElement("a");a.href=URL.createObjectURL(bl);a.download=pool+".csv";a.click();}).catch(function(){msg("Download failed — check key.");});});});
  var rx=$("reindex"); if(rx)rx.addEventListener("click",function(){ msg("Reindexing…");
    fetch("/api/admin/reindex",{method:"POST",headers:hdr()}).then(function(r){return r.json();}).then(function(d){msg("Indexed "+(d.indexed||0)+" items.");}).catch(function(){msg("Reindex failed.");});});
  load("buyers");
});
