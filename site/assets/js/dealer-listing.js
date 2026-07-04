document.addEventListener("DOMContentLoaded",function(){
  var body="";
  document.querySelectorAll("#dl-body .opt").forEach(function(b){b.addEventListener("click",function(){
    document.querySelectorAll("#dl-body .opt").forEach(function(x){x.classList.remove("on");});b.classList.add("on");body=b.dataset.v;});});
  var msg=function(t){var m=document.getElementById("l-msg");m.textContent=t;m.style.display=t?"block":"none";};
  document.getElementById("l-pub").addEventListener("click",async function(){
    var g=function(id){return document.getElementById(id).value.trim();};
    var payload={year:+g("l-year"),make:g("l-make"),model:g("l-model"),trim:g("l-trim"),price_mo:+g("l-mo").replace(/\D/g,""),
      miles:g("l-miles"),drivetrain:g("l-dt"),body:body,photos:g("l-photo")?[g("l-photo")]:[],description:g("l-desc")};
    if(!payload.year||!payload.make||!payload.model||!payload.price_mo)return msg("Year, make, model and price/mo are required.");
    var r=await fetch("/api/dealer/listing",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
    if(r.status===401)return msg("Sign in first — use your dealer phone number.");
    if(r.status===403)return msg("This console is for Drive Now partners. Request access from the Sign in page.");
    var d=await r.json().catch(function(){return{};});
    if(!d.ok)return msg("Couldn't publish — try again.");
    document.getElementById("l-form").style.display="none";document.getElementById("l-done").style.display="block";
    setTimeout(function(){location.href="/dealer/";},1500);
  });
});
