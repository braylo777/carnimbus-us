document.addEventListener("DOMContentLoaded",function(){
  var CARS=[],F={body:"All",maxMo:800,makes:{},q:""};
  var grid=document.getElementById("grid"),count=document.getElementById("count");
  function card(c){return '<a class="glass vcard hoverable" href="/app/car.html?id='+c.id+'" style="text-decoration:none;display:block">'+
    '<div class="vphoto">'+(c.photos&&c.photos[0]?'<img src="'+c.photos[0]+'" alt="'+c.year+' '+c.make+' '+c.model+'" loading="lazy" onerror="this.remove()">':'')+
    '<span class="vbadge cert">Certified</span>'+(c.match!=null?'<span class="vbadge best">'+c.match+'% match</span>':'')+'</div>'+
    '<div class="vbody"><h4>'+c.year+' '+c.make+' '+c.model+'</h4><div class="vtrim">'+(c.trim||'&nbsp;')+'</div>'+
    '<div class="row vmeta"><span>'+c.miles+' mi</span><span>'+c.drivetrain+'</span></div>'+
    '<div class="row vprice"><b>$'+c.price_mo+'<small>/mo</small></b><span class="vcta">Talk to this car →</span></div></div></a>';}
  function render(){var out=CARS.filter(function(c){
      if(F.body!=="All"&&(c.body||"").toLowerCase()!==F.body.toLowerCase())return false;
      if(c.price_mo>F.maxMo)return false;
      if(Object.keys(F.makes).length&&!F.makes[c.make])return false;
      if(F.q&&((c.year+' '+c.make+' '+c.model+' '+(c.trim||'')).toLowerCase().indexOf(F.q)<0))return false;
      return true;});
    grid.innerHTML=out.map(card).join('')||'<div style="grid-column:1/-1;text-align:center;font:600 12px Manrope;color:#aebfdf;padding:30px">No cars match those filters.</div>';
    count.textContent=out.length+" matches";}
  fetch("/api/feed").then(function(r){return r.json();}).then(function(d){
    if(!d.ok)throw 0; CARS=d.cars;
    var mk=document.getElementById("makes");
    CARS.map(function(c){return c.make;}).filter(function(v,i,a){return a.indexOf(v)===i;}).forEach(function(m){
      var b=document.createElement("button");b.type="button";b.className="opt";b.style.cssText="padding:4px 9px;font-size:10px";b.textContent=m;
      b.addEventListener("click",function(){b.classList.toggle("on");if(b.classList.contains("on"))F.makes[m]=1;else delete F.makes[m];render();});
      mk.appendChild(b);});
    if(d.authed===false){document.getElementById("anon-cta").style.display="flex";}
    render();
  }).catch(function(){grid.innerHTML='<div style="grid-column:1/-1;text-align:center;font:600 12px Manrope;color:#aebfdf;padding:30px">Feed unavailable — refresh to retry.</div>';});
  document.querySelectorAll("#bodychips .opt").forEach(function(b){b.addEventListener("click",function(){
    document.querySelectorAll("#bodychips .opt").forEach(function(x){x.classList.remove("on");});
    b.classList.add("on");F.body=b.dataset.v;render();});});
  var rng=document.getElementById("mo-range"),lab=document.getElementById("mo-label");
  rng.addEventListener("input",function(){F.maxMo=+rng.value;lab.textContent="$200 – $"+rng.value+"/mo";render();});
  document.getElementById("q").addEventListener("input",function(e){F.q=e.target.value.trim().toLowerCase();render();});
});
