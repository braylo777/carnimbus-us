document.addEventListener("DOMContentLoaded",function(){
  var ROWS=[];
  var HMAP={year:"year",make:"make",model:"model",trim:"trim",price_mo:"price_mo",price:"price_mo",monthly:"price_mo",
    miles:"miles",mileage:"miles",drivetrain:"drivetrain",body:"body",photo:"photo",photo_url:"photo",image:"photo",description:"description",desc:"description"};
  function parseCSV(t){var rows=[],row=[],cur="",q=false;
    for(var i=0;i<t.length;i++){var ch=t[i];
      if(q){ if(ch==='"'){ if(t[i+1]==='"'){cur+='"';i++;} else q=false; } else cur+=ch; }
      else if(ch==='"')q=true;
      else if(ch===","){row.push(cur);cur="";}
      else if(ch==="\n"||ch==="\r"){ if(ch==="\r"&&t[i+1]==="\n")i++; row.push(cur);cur="";
        if(row.length>1||row[0]!=="")rows.push(row); row=[]; }
      else cur+=ch; }
    if(cur!==""||row.length){row.push(cur);rows.push(row);} return rows;}
  function msgc(t){var m=document.getElementById("csv-msg");m.textContent=t;}
  document.getElementById("csv-tile").addEventListener("click",function(e){
    if(e.target.id!=="csv-file")document.getElementById("csv-file").click();});
  document.getElementById("csv-file").addEventListener("change",function(){
    var f=this.files[0]; if(!f)return;
    var rd=new FileReader();
    rd.onload=function(){ var rows=parseCSV(String(rd.result));
      document.getElementById("csv-panel").style.display="block";
      if(rows.length<2)return msgc("Empty CSV — need a header row plus data.");
      var head=rows[0].map(function(h){return HMAP[h.trim().toLowerCase()]||null;});
      ROWS=rows.slice(1).map(function(r){var o={};head.forEach(function(k,i){if(k&&r[i]!=null)o[k]=r[i].trim();});return o;})
        .filter(function(o){return o.year&&o.make&&o.model&&o.price_mo;});
      if(!ROWS.length)return msgc("No valid rows — required columns: year, make, model, price_mo.");
      var cols=["year","make","model","trim","price_mo","miles","body"];
      document.getElementById("csv-prev").innerHTML='<table style="border-collapse:collapse;width:100%"><tr>'+
        cols.map(function(c){return '<th style="text-align:left;padding:4px 8px;border-bottom:1px solid rgba(24,200,255,.2);color:#18C8FF">'+c+'</th>';}).join('')+'</tr>'+
        ROWS.slice(0,10).map(function(){return '<tr>'+cols.map(function(){return '<td style="padding:4px 8px;border-bottom:1px solid rgba(24,200,255,.08)"></td>';}).join('')+'</tr>';}).join('')+'</table>';
      var tds=document.querySelectorAll("#csv-prev td");
      ROWS.slice(0,10).forEach(function(o,r){cols.forEach(function(c,i){tds[r*cols.length+i].textContent=o[c]||"";});});
      document.getElementById("csv-pub").textContent="Publish "+ROWS.length+" listings";
      document.getElementById("csv-pub").disabled=false;
      msgc(ROWS.length+" valid rows ready."); };
    rd.readAsText(f);});
  document.getElementById("csv-pub").addEventListener("click",async function(){
    var b=this;b.disabled=true;var okN=0;
    for(var i=0;i<ROWS.length;i++){var o=ROWS[i];
      msgc((i+1)+"/"+ROWS.length+" publishing…");
      var r=await fetch("/api/dealer/listing",{method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({year:+o.year,make:o.make,model:o.model,trim:o.trim||"",price_mo:+String(o.price_mo).replace(/\D/g,""),
          miles:o.miles||"",drivetrain:o.drivetrain||"",body:o.body||"",photos:o.photo?[o.photo]:[],description:o.description||""})});
      if(r.status===401)return msgc("Sign in first — use your dealer phone number.");
      if(r.status===403)return msgc("Console is for active Drive Now partners.");
      var d=await r.json().catch(function(){return{};}); if(d.ok)okN++; }
    msgc(okN+" live. The AI can start selling them right now.");
    setTimeout(function(){location.href="/dealer/";},1600);});
});
