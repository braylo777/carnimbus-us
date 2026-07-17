// T-102: mobile-first dealer portal. Two tabs (Inventory / Leads). Session = HttpOnly cn_dlr cookie,
// so every fetch uses credentials:"include". CSP forbids inline JS — everything lives here.
document.addEventListener("DOMContentLoaded",function(){
  var CATS=["$500/mo","$450/mo","$400/mo","$350/mo","Unplaced"];
  var LISTINGS=[],PLACEMENTS=[],DEALER={};
  function $(id){return document.getElementById(id);}
  function e(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
  function show(id){["gate401","gate403","console"].forEach(function(x){$(x).style.display=(x===id?"":"none");});}
  function opt(v){return '<option value="'+e(v)+'">'+e(v)+'</option>';}
  var F=function(u,o){o=o||{};o.credentials="include";return fetch(u,o);};

  // ---- TABS ----
  function tab(which){
    var inv=which==="inv";
    $("tab-inv").classList.toggle("on",inv);$("tab-leads").classList.toggle("on",!inv);
    $("pane-inv").style.display=inv?"":"none";$("pane-leads").style.display=inv?"none":"";
    if(!inv)loadLeads();
  }
  $("tab-inv").addEventListener("click",function(){tab("inv");});
  $("tab-leads").addEventListener("click",function(){tab("leads");});

  // ---- SIGN OUT ----
  $("dc-out").addEventListener("click",function(){
    document.cookie="cn_dlr=; Max-Age=0; path=/; domain=.carnimbus.com";
    document.cookie="cn_dlr=; Max-Age=0; path=/";
    location.href="/signin";
  });

  // ---- CORE LOAD (auth + inventory) ----
  function bandsFor(vdp){var s={};PLACEMENTS.forEach(function(p){if(String(p.vdp_id)===String(vdp)&&p.credit_band)s[p.credit_band]=1;});return Object.keys(s);}
  function synopsis(o){
    var bits=[o.engine,o.wheels,o.exterior_color||o.color,o.interior_color||o.interior].filter(Boolean);
    if(!bits.length&&o.drivetrain)bits.push(o.drivetrain);
    return bits.join(" · ");
  }
  function photo(o){var p=o.photos&&o.photos[0];return p?'<div class="ph"><img src="'+e(p)+'" alt=""></div>':'';}
  function vcard(o,placement){
    var pills=bandsFor(o.id||o.vdp_id).map(function(b){return '<span class="bandpill">'+e(b)+'</span>';}).join('');
    var syn=synopsis(o);
    return '<div class="vcard" draggable="true"'+
      ' data-vdp="'+e(o.id||o.vdp_id)+'"'+
      (placement?' data-pid="'+e(placement.id)+'" data-cat="'+e(placement.category)+'" data-band="'+e(placement.credit_band)+'" data-mo="'+e(placement.monthly)+'" data-down="'+e(placement.down)+'" data-rate="'+e(placement.rate_markup)+'"':'')+
      ' data-mohint="'+e(o.price_mo||"")+'">'+
      photo(o)+
      '<div class="ttl">'+e(o.year+" "+o.make+" "+o.model+(o.trim?" "+o.trim:""))+'</div>'+
      (syn?'<div class="syn">'+e(syn)+'</div>':'')+
      (pills?'<div class="bandpills">'+pills+'</div>':'')+'</div>';
  }
  function listingById(id){for(var i=0;i<LISTINGS.length;i++)if(String(LISTINGS[i].id)===String(id))return LISTINGS[i];return null;}
  function renderLanes(){
    var placedIds={};PLACEMENTS.forEach(function(p){placedIds[String(p.vdp_id)]=1;});
    var html=CATS.map(function(cat){
      var cards="";
      if(cat==="Unplaced"){
        LISTINGS.forEach(function(l){if(!placedIds[String(l.id)])cards+=vcard(l,null);});
      }else{
        PLACEMENTS.filter(function(p){return p.category===cat;}).forEach(function(p){
          var l=listingById(p.vdp_id)||{};
          cards+=vcard(Object.assign({},l,p,{id:p.vdp_id}),p);
        });
      }
      var n=(cards.match(/class="vcard"/g)||[]).length;
      return '<div class="lane" data-cat="'+e(cat)+'"><h4>'+e(cat)+' <span class="ct">'+n+'</span></h4>'+
        (cards||'<div style="font:600 10px Manrope;color:#7f93b8;padding:8px 2px">Empty</div>')+'</div>';
    }).join('');
    $("lanes").innerHTML=html;
    wireLanes();
  }
  function loadConsole(){
    F("/api/dealer/console").then(function(r){
      if(r.status===401){show("gate401");throw 0;}
      if(r.status===403){show("gate403");throw 0;}
      return r.json();
    }).then(function(d){
      show("console");DEALER=d.dealer||{};LISTINGS=d.listings||[];
      $("dc-store").textContent=DEALER.dealership||"Console";
      return F("/api/dealer/placements").then(function(r){return r.ok?r.json():{};}).catch(function(){return{};});
    }).then(function(p){
      PLACEMENTS=Array.isArray(p)?p:(p.placements||p.items||[]);
      renderLanes();
    }).catch(function(){});
  }

  // ---- INGEST SHEET ----
  var IG={year:"ig-year",mo:"ig-mo",make:"ig-make",model:"ig-model",trim:"ig-trim",miles:"ig-miles",engine:"ig-engine",dt:"ig-dt",ext:"ig-ext",int:"ig-int",wheels:"ig-wheels",price:"ig-price"};
  function openIngest(){
    ["ig-url","ig-year","ig-mo","ig-make","ig-model","ig-trim","ig-miles","ig-engine","ig-dt","ig-ext","ig-int","ig-wheels","ig-price","ig-desc","ig-photos"].forEach(function(id){$(id).value="";});
    $("ig-thumbs").innerHTML="";$("ig-msg").textContent="";$("ig-fmsg").textContent="";
    $("ingest-bg").style.display="flex";
  }
  function fillDraft(dr){
    dr=dr||{};
    $("ig-year").value=dr.year||"";$("ig-make").value=dr.make||"";$("ig-model").value=dr.model||"";
    $("ig-trim").value=dr.trim||"";$("ig-miles").value=dr.miles||"";$("ig-engine").value=dr.engine||"";
    $("ig-dt").value=dr.drivetrain||"";$("ig-ext").value=dr.exterior_color||"";$("ig-int").value=dr.interior_color||"";
    $("ig-wheels").value=dr.wheels||"";$("ig-price").value=dr.price||"";$("ig-mo").value=dr.price_mo||"";
    $("ig-desc").value=dr.description||"";
    var ph=dr.photos||[];
    $("ig-photos").value=ph.join("\n");
    $("ig-thumbs").innerHTML=ph.slice(0,8).map(function(u){return '<img src="'+e(u)+'" alt="">';}).join('');
  }
  $("new-listing").addEventListener("click",openIngest);
  $("ingest-x").addEventListener("click",function(){$("ingest-bg").style.display="none";});
  $("ig-cancel").addEventListener("click",function(){$("ingest-bg").style.display="none";});
  $("ig-fetch").addEventListener("click",function(){
    var url=$("ig-url").value.trim();if(!url)return;
    $("ig-fmsg").textContent="Fetching…";
    F("/api/dealer/ingest-url",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:url})})
      .then(function(r){return r.json();}).then(function(d){
        var dr=d.draft||d;fillDraft(dr);$("ig-fmsg").textContent="Filled — check and edit below.";
      }).catch(function(){$("ig-fmsg").textContent="Couldn't read that link — enter it by hand.";});
  });
  $("ig-pub").addEventListener("click",function(){
    var num=function(id){return $(id).value.replace(/\D/g,"");};
    var photos=$("ig-photos").value.split("\n").map(function(s){return s.trim();}).filter(Boolean);
    var p={year:+num("ig-year"),make:$("ig-make").value.trim(),model:$("ig-model").value.trim(),
      trim:$("ig-trim").value.trim(),price_mo:+num("ig-mo"),price:+num("ig-price"),miles:$("ig-miles").value.trim(),
      engine:$("ig-engine").value.trim(),drivetrain:$("ig-dt").value.trim(),exterior_color:$("ig-ext").value.trim(),
      interior_color:$("ig-int").value.trim(),wheels:$("ig-wheels").value.trim(),description:$("ig-desc").value.trim(),photos:photos};
    if(!p.year||!p.make||!p.model||!p.price_mo)return($("ig-msg").textContent="Year, make, model and price/mo are required.");
    $("ig-msg").textContent="Publishing…";
    F("/api/dealer/listing",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(p)})
      .then(function(r){return r.json().catch(function(){return{};});}).then(function(d){
        if(!d.ok)return($("ig-msg").textContent="Couldn't publish — try again.");
        $("ingest-bg").style.display="none";loadConsole();
      }).catch(function(){$("ig-msg").textContent="Couldn't publish — try again.";});
  });

  // ---- PLACEMENT POPUP ----
  $("pl-cat").innerHTML=CATS.filter(function(c){return c!=="Unplaced";}).map(opt).join('');
  function openPlace(o){
    // o: {vdp,title,pid,cat,band,mo,down,rate,mohint}
    $("place-car").textContent=o.title||"";
    $("pl-band").value=o.band||"800+";
    $("pl-cat").value=o.cat&&o.cat!=="Unplaced"?o.cat:CATS[0];
    $("pl-mo").value=o.mo||o.mohint||"";$("pl-down").value=o.down||"";$("pl-rate").value=o.rate||"";
    $("pl-msg").textContent="";
    $("pl-save").dataset.vdp=o.vdp;$("pl-save").dataset.pid=o.pid||"";
    $("pl-del").style.display=o.pid?"":"none";$("pl-del").dataset.pid=o.pid||"";
    $("place-bg").style.display="flex";
  }
  $("place-x").addEventListener("click",function(){$("place-bg").style.display="none";});
  $("pl-save").addEventListener("click",function(){
    var num=function(id){return $(id).value.replace(/[^\d.]/g,"");};
    var body={vdp_id:$("pl-save").dataset.vdp,credit_band:$("pl-band").value,category:$("pl-cat").value,
      monthly:+num("pl-mo"),down:+num("pl-down"),rate_markup:+num("pl-rate")};
    var pid=$("pl-save").dataset.pid;if(pid)body.id=pid;
    $("pl-msg").textContent="Saving…";
    F("/api/dealer/placements",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)})
      .then(function(r){return r.json().catch(function(){return{};});}).then(function(d){
        if(d.ok===false)return($("pl-msg").textContent="Couldn't save — try again.");
        $("place-bg").style.display="none";loadConsole();
      }).catch(function(){$("pl-msg").textContent="Couldn't save — try again.";});
  });
  $("pl-del").addEventListener("click",function(){
    var pid=$("pl-del").dataset.pid;if(!pid)return;
    $("pl-msg").textContent="Removing…";
    F("/api/dealer/placements?id="+encodeURIComponent(pid),{method:"DELETE"})
      .then(function(){$("place-bg").style.display="none";loadConsole();})
      .catch(function(){$("pl-msg").textContent="Couldn't remove — try again.";});
  });

  function cardToPlace(el,forceCat){
    var vdp=el.dataset.vdp,l=listingById(vdp)||{};
    openPlace({vdp:vdp,title:(l.year||"")+" "+(l.make||"")+" "+(l.model||"")+(l.trim?" "+l.trim:""),
      pid:el.dataset.pid,cat:forceCat||el.dataset.cat,band:el.dataset.band,mo:el.dataset.mo,
      down:el.dataset.down,rate:el.dataset.rate,mohint:el.dataset.mohint});
  }

  // ---- DRAG + TAP on lanes ----
  var DRAG=null;
  function wireLanes(){
    $("lanes").querySelectorAll(".vcard").forEach(function(c){
      c.addEventListener("click",function(){cardToPlace(c);});
      c.addEventListener("dragstart",function(ev){DRAG=c;ev.dataTransfer.effectAllowed="move";try{ev.dataTransfer.setData("text/plain",c.dataset.vdp);}catch(x){}});
      c.addEventListener("dragend",function(){DRAG=null;});
    });
    $("lanes").querySelectorAll(".lane").forEach(function(ln){
      ln.addEventListener("dragover",function(ev){ev.preventDefault();ln.classList.add("drag");});
      ln.addEventListener("dragleave",function(){ln.classList.remove("drag");});
      ln.addEventListener("drop",function(ev){ev.preventDefault();ln.classList.remove("drag");
        if(!DRAG)return;var cat=ln.dataset.cat;cardToPlace(DRAG,cat==="Unplaced"?null:cat);});
    });
  }

  // ---- LEADS ----
  function loadLeads(){
    F("/api/dealer/leads").then(function(r){return r.ok?r.json():{leads:[]};}).then(function(d){
      var leads=(d.leads||[]).slice().sort(function(a,b){return String(b.created_at||"").localeCompare(String(a.created_at||""));});
      if(!leads.length){$("leads").innerHTML='<div style="font:600 12px Manrope;color:#aebfdf;padding:24px;text-align:center">No leads yet — they\'ll roll in here.</div>';return;}
      $("leads").innerHTML=leads.map(function(x){
        var name=((x.first_name||"")+" "+(x.last_name||"")).trim()||"Buyer";
        var car=x.matched_car||x.dream_car||"—";
        var meta=[];
        if(x.monthly)meta.push("$"+e(x.monthly)+"/mo");
        if(x.down!=null&&x.down!=="")meta.push("$"+e(x.down)+" down");
        if(x.deal_type)meta.push(e(x.deal_type));
        var line2=[];
        if(x.zip)line2.push("ZIP "+e(x.zip));
        if(x.appt_slot)line2.push("Slot "+e(x.appt_slot));
        var acts="";
        if(x.phone)acts+='<a href="tel:'+e(x.phone)+'">Call</a><a href="sms:'+e(x.phone)+'">Text</a>';
        if(x.email)acts+='<a href="mailto:'+e(x.email)+'">Email</a>';
        return '<div class="lead"><div class="nm">'+e(name)+'</div><div class="car">'+e(car)+'</div>'+
          '<div class="meta">'+meta.join(" · ")+(line2.length?'<br>'+line2.join(" · "):'')+'</div>'+
          (acts?'<div class="acts">'+acts+'</div>':'')+'</div>';
      }).join('');
    }).catch(function(){});
  }

  loadConsole();
  setInterval(function(){if($("console").style.display!=="none"&&$("pane-inv").style.display!=="none")loadConsole();},30000);
});
