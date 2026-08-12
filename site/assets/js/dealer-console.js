// T-102: mobile-first dealer portal. Two tabs (Inventory / Leads). Session = HttpOnly cn_dlr cookie,
// so every fetch uses credentials:"include". CSP forbids inline JS — everything lives here.
document.addEventListener("DOMContentLoaded",function(){
  // R3: inventory is bucketed by CREDIT BAND (the dealer's only job: drop a car into the buyer tier they want).
  var BANDS=["800+","740-799","670-739","580-669","under 580","Unplaced"];
  var LISTINGS=[],PLACEMENTS=[],ARCHIVED=[],DEALER={},LEADMAP={},AUTOBUCKETED=false;
  function $(id){return document.getElementById(id);}
  // R18: a missing node must never take down the whole panel again (see the lp-opener regression).
  // Used ONLY inside openLead — everywhere else a missing element should still fail loudly.
  function $s(id){ return document.getElementById(id) || {textContent:"",innerHTML:"",href:"",
    style:{},querySelector:function(){return null;},addEventListener:function(){}}; }
  function e(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
  function show(id){["gate401","gate403","console"].forEach(function(x){$(x).style.display=(x===id?"":"none");});}
  function opt(v){return '<option value="'+e(v)+'">'+e(v)+'</option>';}
  var F=function(u,o){o=o||{};o.credentials="include";return fetch(u,o);};

  // ---- TABS ----
  function tab(which){
    var inv=which==="inv";
    $("tab-inv").classList.toggle("on",inv);$("tab-leads").classList.toggle("on",!inv);
    $("pane-inv").style.display=inv?"":"none";$("pane-leads").style.display=inv?"none":"";
    try{localStorage.setItem("dc_tab",which);}catch(_){}   // R7: refresh keeps the current tab
    if(!inv)loadLeads();
    else if(!INV_LOADED){ INV_LOADED=true; loadConsole(); }   // R19: pay for inventory only when it's shown
  }
  $("tab-inv").addEventListener("click",function(){tab("inv");});
  $("tab-leads").addEventListener("click",function(){tab("leads");});

  // ---- SIGN OUT ---- (R23b: plain header button — store-economics gear removed per founder)
  // $s() not $() — cached-HTML/new-JS version skew must never kill the whole boot again.
  function signOut(){
    document.cookie="cn_dlr=; Max-Age=0; path=/; domain=.carnimbus.us";
    document.cookie="cn_dlr=; Max-Age=0; path=/";
    location.href="/signin";
  }
  $s("dc-out").addEventListener("click",signOut);
  $s("set-out").addEventListener("click",signOut);

  // R21: tap anywhere else closes an open status menu.
  document.addEventListener("click",function(){
    document.querySelectorAll(".stwrap.open").forEach(function(o){ o.classList.remove("open"); }); });

  // ---- CORE LOAD (auth + inventory) ----
  // R5: inventory = 5 stacked credit-band sections, each with its own search; tap a car → full edit sheet.
  var EDIT_ID=0, CBANDS=["800+","740-799","670-739","580-669","under 580"];
  function listingById(id){for(var i=0;i<LISTINGS.length;i++)if(String(LISTINGS[i].id)===String(id))return LISTINGS[i];return null;}
  function thumb(o){ var p=o.photos&&o.photos[0];
    return '<div class="th">'+(p?'<img src="'+e(p)+'" alt="">':'<span class="ph-ph">NO<br>PHOTO</span>')+'</div>'; }
  function moveSel(o){ return '<select class="movesel" data-vdp="'+e(o.id||o.vdp_id)+'">'+
    ['<option value="">Move ▾</option>'].concat(CBANDS.map(function(b){
      return '<option value="'+e(b)+'"'+(o.credit_band===b?' selected':'')+'>'+e(b)+'</option>';})).join('')+'</select>'; }
  function vspec(o){ var sp=[];
    var mi=o.mileage_exact?Number(o.mileage_exact).toLocaleString()+" mi":(o.miles?o.miles+" mi":"");
    if(mi)sp.push(mi);
    if(o.drivetrain_detail||o.drivetrain)sp.push(o.drivetrain_detail||o.drivetrain);
    if(o.body_style)sp.push(o.body_style);
    if(o.fuel_type)sp.push(o.fuel_type);
    if(o.exterior_color)sp.push(o.exterior_color);
    return sp.length?'<div class="vspec">'+e(sp.join(" · "))+'</div>':''; }
  function vrow(o,isTop){ var mo=o.monthly||o.price_mo||"";
    return '<div class="vrow" draggable="true" data-vdp="'+e(o.id||o.vdp_id)+'">'+thumb(o)+
      '<div class="info"><div class="ttl">'+e(o.year+" "+o.make+" "+o.model+(o.trim?" "+o.trim:""))+'</div>'+
      (mo?'<div class="mo">$'+e(mo)+'/mo</div>':'')+vspec(o)+
      (isTop?'<span class="toppick">TOP MATCH</span>':'')+'</div>'+moveSel(o)+'</div>'; }
  function placedFor(band){ return PLACEMENTS.filter(function(p){return p.credit_band===band;})
    .map(function(p){ return Object.assign({},listingById(p.vdp_id)||{},p,{id:p.vdp_id}); }); }
  // R6/R7: each bucket lands collapsed — ONE trending car + an always-visible search + "See all".
  function topPickSort(cars){ return cars.slice().sort(function(a,b){
    return (b.match_ct||0)-(a.match_ct||0) || (b.match_score||0)-(a.match_score||0) ||
           ((+b.monthly||+b.price_mo||0)-(+a.monthly||+a.price_mo||0)); }); }
  function rowList(cars){ return cars.map(function(c){return vrow(c);}).join(''); }
  function sectionHtml(label,cars,band){
    if(!band){ // Unplaced: flat list, no collapse/search (normally empty after auto-bucket)
      var rowsU=cars.length?rowList(cars):'<div class="empty">Empty</div>';
      return '<div class="bandsec" data-band=""><h4>'+e(label)+' <span class="ct">'+cars.length+'</span></h4><div class="rows">'+rowsU+'</div></div>';
    }
    var sorted=topPickSort(cars), top=sorted[0], rest=sorted.slice(1);
    var topHtml=top?vrow(top,true):'<div class="empty">Empty</div>';
    var more=rest.length?'<div class="morewrap">'+rowList(rest)+'</div>'+
      '<button class="seeall" type="button" data-n="'+cars.length+'">See all '+cars.length+' ▾</button>':'';
    return '<div class="bandsec" data-band="'+e(band)+'"><h4><span>'+e(label)+'</span><span class="ct">'+cars.length+' cars</span></h4>'+
      '<input class="sfilter" data-band="'+e(band)+'" placeholder="Search '+e(label)+'…">'+
      '<div class="rows toprow">'+topHtml+'</div>'+more+'</div>';
  }
  function renderSections(){
    var placed={}; PLACEMENTS.forEach(function(p){placed[String(p.vdp_id)]=1;});
    var unplaced=LISTINGS.filter(function(l){return !placed[String(l.id)];});
    var html="";
    if(unplaced.length) html+=sectionHtml("Unplaced ("+unplaced.length+")",unplaced,"");
    CBANDS.forEach(function(b){ html+=sectionHtml(b,placedFor(b),b); });
    // R7: archived (sold/removed) cars — restorable, tucked at the bottom.
    if(ARCHIVED.length){
      var arows=ARCHIVED.map(function(o){return '<div class="vrow arch" data-vdp="'+e(o.id)+'">'+thumb(o)+
        '<div class="info"><div class="ttl">'+e(o.year+" "+o.make+" "+o.model+(o.trim?" "+o.trim:""))+'</div></div>'+
        '<button class="restore" data-vdp="'+e(o.id)+'" type="button">Restore</button></div>';}).join('');
      html+='<div class="bandsec" data-band=""><h4><span>Archived</span><span class="ct">'+ARCHIVED.length+'</span></h4>'+
        '<div class="morewrap">'+arows+'</div><button class="seeall" type="button" data-n="'+ARCHIVED.length+'">See all '+ARCHIVED.length+' ▾</button></div>';
    }
    $("sections").innerHTML=html; wireSections();
  }
  function wireSections(){
    $("sections").querySelectorAll(".sfilter").forEach(function(inp){
      // R7: search is always visible; typing auto-expands the bucket, clearing collapses it back.
      inp.addEventListener("input",function(){ var q=inp.value.toLowerCase(), sec=inp.closest(".bandsec");
        var sa=sec.querySelector(".seeall");
        if(q){ sec.classList.add("open"); if(sa) sa.textContent="Show less ▴"; }
        else { sec.classList.remove("open"); if(sa) sa.textContent="See all "+sa.dataset.n+" ▾"; }
        sec.querySelectorAll(".vrow").forEach(function(r){
          r.style.display=r.querySelector(".ttl").textContent.toLowerCase().indexOf(q)>-1?"":"none"; }); });
    });
    $("sections").querySelectorAll(".seeall").forEach(function(b){
      b.addEventListener("click",function(){ var sec=b.closest(".bandsec"); var open=sec.classList.toggle("open");
        b.textContent=open?"Show less ▴":("See all "+b.dataset.n+" ▾"); });
    });
    $("sections").querySelectorAll(".restore").forEach(function(b){
      b.addEventListener("click",function(ev){ev.stopPropagation();
        F("/api/dealer/listing-status",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:b.dataset.vdp,active:1})})
          .then(function(){loadConsole();}); });
    });
    $("sections").querySelectorAll(".movesel").forEach(function(sel){
      sel.addEventListener("click",function(ev){ev.stopPropagation();});
      sel.addEventListener("change",function(){ if(sel.value) placeInstant(sel.dataset.vdp,sel.value); });
    });
    $("sections").querySelectorAll(".vrow").forEach(function(r){
      r.addEventListener("click",function(){ openEdit(r.dataset.vdp); });
      r.addEventListener("dragstart",function(ev){DRAG=r;ev.dataTransfer.effectAllowed="move";try{ev.dataTransfer.setData("text/plain",r.dataset.vdp);}catch(x){}});
      r.addEventListener("dragend",function(){DRAG=null;});
    });
    $("sections").querySelectorAll(".bandsec").forEach(function(sec){
      sec.addEventListener("dragover",function(ev){ev.preventDefault();sec.classList.add("drag");});
      sec.addEventListener("dragleave",function(){sec.classList.remove("drag");});
      sec.addEventListener("drop",function(ev){ev.preventDefault();sec.classList.remove("drag");
        if(DRAG&&sec.dataset.band) placeInstant(DRAG.dataset.vdp,sec.dataset.band); });
    });
  }
  function bandGuess(o){ var p=(+o.price)||((+o.price_mo||0)*72)||0;
    return p>=55000?"800+":p>=38000?"740-799":p>=25000?"670-739":p>=15000?"580-669":"under 580"; }
  function openEdit(vdp){ var o=listingById(vdp); if(!o) return; EDIT_ID=vdp;
    clearIngest(); $("ig-title").textContent="Edit listing"; $("ig-paste").style.display="none";
    $("ig-year").value=o.year||""; $("ig-make").value=o.make||""; $("ig-model").value=o.model||"";
    $("ig-trim").value=o.trim||""; $("ig-mo").value=o.price_mo||""; $("ig-miles").value=o.miles||"";
    $("ig-engine").value=o.engine||""; $("ig-dt").value=o.drivetrain||""; $("ig-ext").value=o.exterior_color||"";
    $("ig-int").value=o.interior_color||""; $("ig-wheels").value=o.wheels||""; $("ig-price").value=o.price||"";
    $("ig-cost").value=o.unit_cost||""; $("ig-lotdate").value=(o.lot_date||"").slice(0,10);
    // Cap the picker at today. A future lot date makes daysOnLot negative and holdingSaved
    // nonsense; stopping it in the picker beats rejecting it after the dealer has filled the sheet.
    $("ig-lotdate").max=new Date().toISOString().slice(0,10);
    $("ig-desc").value=o.description||""; $("ig-photos").value=(o.photos||[]).join("\n");
    $("ig-thumbs").innerHTML=(o.photos||[]).slice(0,8).map(function(u){return '<img src="'+e(u)+'" alt="">';}).join('');
    var pl=PLACEMENTS.filter(function(p){return String(p.vdp_id)===String(vdp);})[0];
    $("ig-band").value=(pl&&pl.credit_band)||bandGuess(o);
    $("ig-arch").style.display=""; $("ig-pub").textContent="Save changes";
    heroSet();titleSet();
    $("ingest-bg").style.display="flex";
  }
  var INV_LOADED=false;
  function loadConsole(metaOnly){
    F("/api/dealer/console"+(metaOnly?"?meta=1":"")).then(function(r){
      if(r.status===401){show("gate401");throw 0;}
      if(r.status===403){show("gate403");throw 0;}
      return r.json();
    }).then(function(d){
      show("console");DEALER=d.dealer||{};
      if(d.meta){ // R19: header only — skip the inventory pipeline entirely
        $("dc-store").textContent=DEALER.dealership||"Console";
        if(DEALER.logo){ var lg0=$("dc-logo"); lg0.src=DEALER.logo; lg0.style.display=""; }
        $("dc-demo").style.display=DEALER.is_demo?"":"none";
        return null; }
      LISTINGS=d.listings||[];ARCHIVED=d.archived||[];
      // v15: lot date is what the clearance engine runs on. Without it a car cannot be aged, cannot
      // be recommended for clearance, and its holding cost cannot be shown. Absent stays absent —
      // we never guess one. New listings now require a date; this nudge covers the existing backlog.
      if(d.no_lot_date>0){ var ln=$s("lotnudge");
        ln.innerHTML="<b>"+d.no_lot_date+" car"+(d.no_lot_date===1?"":"s")+" have no lot date.</b> "+
          "We can't tell you what those are costing you to hold, and they can't show up in Clearance. "+
          "Tap a car → Lot date.";
        ln.style.display=""; }
      $("dc-store").textContent=DEALER.dealership||"Console";
      if(DEALER.logo){ var lg=$("dc-logo"); lg.src=DEALER.logo; lg.style.display=""; }
      $("dc-demo").style.display=DEALER.is_demo?"":"none";   // R7-D: unambiguous DEMO chip on the test tenant
      return F("/api/dealer/placements").then(function(r){return r.ok?r.json():{};}).catch(function(){return{};});
    }).then(function(p){
      if(p===null) return;   // meta-only boot
      PLACEMENTS=Array.isArray(p)?p:(p.placements||p.items||[]);
      // R4: AI-native — auto-bucket any unplaced cars once per session, then re-render.
      var unplaced=LISTINGS.filter(function(l){return !PLACEMENTS.some(function(pp){return String(pp.vdp_id)===String(l.id);});});
      if(unplaced.length && !AUTOBUCKETED){ AUTOBUCKETED=true;
        F("/api/dealer/placements/auto",{method:"POST"}).then(function(){loadConsole();}).catch(function(){renderSections();});
        return;
      }
      renderSections();
    }).catch(function(){});
  }

  // ---- INGEST / EDIT SHEET (shared) ----
  function clearIngest(){
    ["ig-url","ig-year","ig-mo","ig-make","ig-model","ig-trim","ig-miles","ig-engine","ig-dt","ig-ext","ig-int","ig-wheels","ig-price","ig-desc","ig-photos","ig-cost","ig-lotdate"].forEach(function(id){$(id).value="";});
    $("ig-thumbs").innerHTML="";$("ig-msg").textContent="";$("ig-fmsg").style.display="none";$("ig-fmsg").textContent="";
    $("ig-arch").style.display="none";
    heroSet();titleSet();
  }
  // R8: photo hero + live big title + on-device photo upload (screenshot → Add photo → compressed data-URI).
  function heroSet(){ var ph=($("ig-photos").value.split("\n").map(function(s){return s.trim();}).filter(Boolean))[0];
    $("ig-hero").innerHTML=ph?'<img src="'+e(ph)+'" alt="">':'<span class="ph-ph">NO PHOTO</span>'; }
  function titleSet(){ $("ig-title-lg").textContent=[$("ig-year").value,$("ig-make").value,$("ig-model").value,$("ig-trim").value].filter(Boolean).join(" "); }
  ["ig-year","ig-make","ig-model","ig-trim"].forEach(function(id){ $(id).addEventListener("input",titleSet); });
  $("ig-photos").addEventListener("input",heroSet);
  $("ig-addphoto").addEventListener("click",function(){ $("ig-file").click(); });
  $("ig-file").addEventListener("change",function(){
    var f=$("ig-file").files[0]; $("ig-file").value=""; if(!f) return;
    var existing=$("ig-photos").value.split("\n").filter(function(s){return s.indexOf("data:")===0;}).length;
    if(existing>=3) return ($("ig-msg").textContent="Photo limit reached (3 uploads).");
    var img=new Image(), rd=new FileReader();
    rd.onload=function(){ img.onload=function(){
      var s=Math.min(1,1280/Math.max(img.width,img.height));
      var cv=document.createElement("canvas"); cv.width=Math.round(img.width*s); cv.height=Math.round(img.height*s);
      cv.getContext("2d").drawImage(img,0,0,cv.width,cv.height);
      var uri=cv.toDataURL("image/jpeg",0.82);
      $("ig-photos").value=(uri+"\n"+$("ig-photos").value).trim(); heroSet();
    }; img.src=rd.result; };
    rd.readAsDataURL(f);
  });
  function openIngest(){
    EDIT_ID=0; clearIngest();
    $("ig-title").textContent="New listing"; $("ig-paste").style.display="";
    $("ig-band").value=CBANDS[0]; $("ig-pub").textContent="Publish listing";
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
    heroSet();titleSet();
  }
  $("new-listing").addEventListener("click",openIngest);
  // R7: archive from the edit sheet — the car leaves buckets + all buyer surfaces instantly.
  $("ig-arch").addEventListener("click",function(){
    if(!EDIT_ID)return;
    F("/api/dealer/listing-status",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:EDIT_ID,active:0})})
      .then(function(){$("ingest-bg").style.display="none";loadConsole();});
  });
  $("ingest-x").addEventListener("click",function(){$("ingest-bg").style.display="none";});
  $("ig-fetch").addEventListener("click",function(){
    var url=$("ig-url").value.trim();if(!url)return;
    // R5: fill silently — only surface a message when the fetch genuinely fails.
    $("ig-fmsg").style.display="none";$("ig-fmsg").textContent="";
    $("ig-fetch").classList.add("loading");
    F("/api/dealer/ingest-url",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:url})})
      .then(function(r){return r.json();}).then(function(d){
        $("ig-fetch").classList.remove("loading");
        var dr=d.draft||d;fillDraft(dr);
        if(dr.price_mo && !$("ig-band").value) $("ig-band").value=bandGuess(dr);
        if(!((dr.make&&dr.model)||(dr.photos&&dr.photos.length))){
          $("ig-fmsg").textContent="Couldn't read much from this site — fill it in by hand.";$("ig-fmsg").style.display="";
        }
      }).catch(function(){$("ig-fetch").classList.remove("loading");
        $("ig-fmsg").textContent="Couldn't read that link — enter it by hand.";$("ig-fmsg").style.display="";});
  });
  $("ig-pub").addEventListener("click",function(){
    var num=function(id){return $(id).value.replace(/\D/g,"");};
    var photos=$("ig-photos").value.split("\n").map(function(s){return s.trim();}).filter(Boolean);
    var p={year:+num("ig-year"),make:$("ig-make").value.trim(),model:$("ig-model").value.trim(),
      trim:$("ig-trim").value.trim(),price_mo:+num("ig-mo"),price:+num("ig-price"),miles:$("ig-miles").value.trim(),
      engine:$("ig-engine").value.trim(),drivetrain:$("ig-dt").value.trim(),exterior_color:$("ig-ext").value.trim(),
      interior_color:$("ig-int").value.trim(),wheels:$("ig-wheels").value.trim(),description:$("ig-desc").value.trim(),photos:photos,
      source_url:$("ig-url").value.trim(),
      unit_cost:+num("ig-cost")||null,lot_date:$("ig-lotdate").value||null};   // R14: KPI economics   // R7: kept for auto sold-detection
    if(!p.make||!p.model)return($("ig-msg").textContent="Make and model are required.");   // price_mo optional → auto-bucket prices it
    // v15: lot date is required. The server rejects without it too — this is the friendly copy,
    // not the enforcement. Asking here keeps the dealer in the sheet instead of bouncing a 422.
    if(!/^\d{4}-\d{2}-\d{2}$/.test(p.lot_date||"")){
      $("ig-lotdate").focus();
      return($("ig-msg").textContent="Lot date is required — when did this unit land? It's on your aging report.");
    }
    if(EDIT_ID)p.id=EDIT_ID;                                     // R5: same sheet edits an existing car
    $("ig-msg").textContent=EDIT_ID?"Saving…":"Publishing…";
    F("/api/dealer/listing",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(p)})
      .then(function(r){return r.json().catch(function(){return{};});}).then(function(d){
        // Surface the server's own reason when it sends one. A validation rejection the dealer can
        // act on ("lot date is required") must not read as "try again", which invites the same
        // failing submit and teaches them the tool is flaky.
        if(!d.ok)return($("ig-msg").textContent=d.reason||"Couldn't save — try again.");
        // R5: on edit, apply the chosen credit bucket too (locks it as the dealer's choice).
        var done=function(){$("ingest-bg").style.display="none";loadConsole();};
        if(EDIT_ID){ F("/api/dealer/placements",{method:"POST",headers:{"content-type":"application/json"},
            body:JSON.stringify({vdp_id:EDIT_ID,credit_band:$("ig-band").value})}).then(done).catch(done); }
        else done();   // new listing: auto-bucket-on-load places it
      }).catch(function(){$("ig-msg").textContent="Couldn't save — try again.";});
  });

  // R3: drop into a credit bucket → place immediately; the server auto-prices monthly/down for that band.
  function placeInstant(vdp,band){
    F("/api/dealer/placements",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({vdp_id:vdp,credit_band:band})})
      .then(function(r){return r.json().catch(function(){return{};});})
      .then(function(d){ if(d.ok!==false) loadConsole(); })
      .catch(function(){});
  }
  var DRAG=null;   // drag state shared by wireSections

  // ---- LEADS ----
  function cidNum(c){ return String(c||"").replace(/^CN\s*/i,"").trim(); }
  function fmtSlot(s){ if(!s) return ""; var m=String(s).match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if(!m) return String(s);
    var d=new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5]);
    return d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})+" · "+d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}); }
  // R16: "Monday, July 20 · 10:00 AM – 10:30 AM PST" — 30-min test-drive block, no "Test Drive" prefix.
  function fmtSlotRange(s){ var m=String(s||"").match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/); if(!m) return "";
    var d=new Date(+m[1],+m[2]-1,+m[3],+m[4],+m[5]), e2=new Date(d.getTime()+30*60000);
    var t=function(x){return x.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"});};
    return d.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})+" · "+t(d)+" – "+t(e2)+" PST"; }
  function fmtPhone(p){ var d=String(p||"").replace(/\D/g,""); if(d.length===11&&d[0]==="1") d=d.slice(1);
    return d.length===10 ? "+1 ("+d.slice(0,3)+") "+d.slice(3,6)+"-"+d.slice(6) : String(p||""); }
  function leadPhoto(x){ return x.photo0?'<div class="lphoto"><img src="'+e(x.photo0)+'" alt=""></div>':'<div class="lphoto"><span class="ph-ph">NO PHOTO</span></div>'; }
  // R13: addresses read "… CA 90277 USA" — never the long "United States" tail.
  function usaAddr(a){ return String(a||"").replace(/,?\s*United States\s*$/i," USA").replace(/\s+/g," ").trim(); }
  var STATUS_ORDER=["confirmed","sold","no_show","cancelled"], STATUS_LABEL={confirmed:"CONFIRMED",sold:"SOLD",no_show:"NO SHOW",cancelled:"CANCELLED"};
  // R21: no naked OS <select> — a colored pill that opens a small owned menu. Same 3 values, same writer.
  function statusChip(x){ var st=STATUS_ORDER.indexOf(x.status)>-1?x.status:"confirmed";
    return '<div class="stwrap"><button type="button" class="stpill '+st+'" data-lead="'+e(x.id)+'">'+STATUS_LABEL[st]+'<i>▾</i></button>'+
      '<div class="stmenu">'+STATUS_ORDER.map(function(o){
        return '<button type="button" data-set="'+o+'" class="'+o+(o===st?' cur':'')+'">'+STATUS_LABEL[o]+'</button>'; }).join('')+'</div></div>'; }
  // R17: headline is year + make + model only — trim lives inside the panel.
  function carShort(x){ return String(x.car_short||x.matched_car||x.dream_car||"").trim()||"—"; }
  // R17: one status writer for card + panel. Never auto-advances; the dropdown IS the choice.
  function setStatus(el,leadId,next,after){
    F("/api/dealer/lead-status",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({lead_id:leadId,status:next})})
      .then(function(r){return r.json();}).then(function(d){
        if(!d||!d.ok) return;
        if(LEADMAP[leadId]) LEADMAP[leadId].status=next;
        el.className="stpill "+next; el.innerHTML=e(STATUS_LABEL[next]||next)+'<i>▾</i>';
        var row=el.closest(".trow");
        if(row){ row.style.transition="opacity .28s ease,transform .28s ease";
          row.style.opacity="0"; row.style.transform="translateX(14px)";
          setTimeout(function(){ if(after)after(next); },300); }
        else if(after) after(next);
      }).catch(function(){});
  }
  function money(n){ return "$"+Math.abs(+n||0).toLocaleString(); }
  // R13: THE DEAL — every number is computed server-side by the same engine that quoted the buyer, so the
  // salesman sees real math (payment at HIS down vs his ceiling), never AI-written approximations.
  function dealHtml(x){ var d=x.deal||{}, rows="";
    var row=function(k,v){ return '<div class="dr"><b>'+k+'</b><span>'+v+'</span></div>'; };
    if(d.wantsMo||d.wantsDown) rows+=row("He wants",money(d.wantsMo)+"/mo · "+money(d.wantsDown)+" down");
    if(d.moHis) rows+=row("His actual",money(d.moHis)+"/mo "+(d.delta<=0
      ? '<span class="ok">✓ '+money(d.delta)+' under</span>' : '<span class="warn">⚠ '+money(d.delta)+' over</span>'));
    if(d.bandMonthly) rows+=row("Advertised",money(d.bandMonthly)+"/mo @ "+money(d.bandDown)+" down");
    if(x.credit_band) rows+=row("Credit",e(x.credit_band)+(d.apr?" · "+d.apr+"% APR est":""));
    var miTxt=d.mileageExact?(Number(d.mileageExact).toLocaleString()+" mi"):(d.miles?e(d.miles)+" mi":"");
    if(d.price) rows+=row("Car",money(d.price)+(miTxt?" · "+miTxt:""));
    return rows; }

  // R14: TODAY — the salesman's day as 30-min calendar rows, filtered by the sticky outcome buckets.
  var LEADS_ALL=[], BUCKET="confirmed";
  function slotEnd(s){ var m=String(s||"").match(/T(\d{2}):(\d{2})/); if(!m) return "";
    var h=+m[1]+(m[2]==="30"?1:0), mm=m[2]==="30"?"00":"30"; return String(h).padStart(2,"0")+":"+mm; }
  function dayLabel(s){ var m=String(s||"").match(/(\d{4})-(\d{2})-(\d{2})/); if(!m) return "Unscheduled";
    var d=new Date(+m[1],+m[2]-1,+m[3]), today=new Date(); today.setHours(0,0,0,0);
    var diff=Math.round((d-today)/864e5);
    return diff===0?"Today":diff===1?"Tomorrow":diff===-1?"Yesterday":d.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"}); }
  function termsFor(x){ var t=[];
    if(x.deal_type)t.push(x.deal_type==="finance"?"Finance":x.deal_type==="cash"?"Cash":e(x.deal_type));
    if(x.monthly)t.push("$"+e(x.monthly)+"/mo"); if(x.down!=null&&x.down!=="")t.push("$"+e(x.down)+" down");
    if(x.credit_band)t.push(e(x.credit_band)); if(x.zip)t.push(e(x.zip));
    return t; }   // no car name here — it lives only on the cyan headline
  function renderLeads(leads){
    var counts={confirmed:0,sold:0,no_show:0,cancelled:0};
    leads.forEach(function(x){ if(counts[x.status]!=null)counts[x.status]++; });
    ["confirmed","sold","no_show","cancelled"].forEach(function(k){ var el=$("bk-"+k); if(el)el.textContent=counts[k]; });
    // R23: Confirmed = the future, soonest first. Past buckets = history, newest outcome first,
    // stamped with WHEN it happened — the same chronology NIMBUS reads from the ledger.
    var past=BUCKET!=="confirmed";
    var show=leads.filter(function(x){ return (x.status||"confirmed")===BUCKET; })
      .sort(past
        ? function(a,b){ return String(b.status_ts||"").localeCompare(String(a.status_ts||"")); }
        : function(a,b){ return String(a.appt_slot||"9999").localeCompare(String(b.appt_slot||"9999")); });
    if(!show.length){ $("leads").innerHTML='<div class="msgnone" style="text-align:center;padding:24px">'+
      (BUCKET==="confirmed"?"No matches yet — upload inventory and your matches appear here.":"Nothing in this bucket yet.")+'</div>'; return; }
    var html="", lastDay="";
    show.forEach(function(x){
      // R23: past buckets read on the OUTCOME timestamp, not the old slot.
      var when=past?(x.status_ts||x.appt_slot):x.appt_slot;
      var day=dayLabel(when);
      if(day!==lastDay){ html+='<div class="dayhead">'+e(day)+'</div>'; lastDay=day; }
      var tm=(String(when||"").match(/T(\d{2}:\d{2})/)||[])[1]||"—";
      // R20: time rail · 2/3 content (name cyan, car white, image) · slim right box.
      var img=x.photo0?'<div class="lcarimg"><img src="'+e(x.photo0)+'" alt="" loading="lazy" decoding="async"></div>':'<div class="lcarimg np">NO PHOTO</div>';
      // R21: right stack = three cemented blocks — credit, match, status — always present.
      // R22: credit block colored by band — red → yellow → lime → green.
      var cbCls=x.credit_band==="under 580"?"cb-r":x.credit_band==="580-669"?"cb-y":x.credit_band==="670-739"?"cb-l":x.credit_band?"cb-g":"";
      var band='<div class="rblk cb '+cbCls+'"><b>'+(x.credit_band?e(x.credit_band):"—")+'</b><small>CREDIT</small></div>';
      var prob='<div class="rblk mt"><b>'+((x.deal&&x.deal.closeProb)?x.deal.closeProb+"%":"—")+'</b><small>MATCH</small></div>';
      html+='<div class="trow"><div class="tslot"><span>'+e(tm)+'</span><i></i><span>'+(past?'<b class="tspast">'+e((STATUS_LABEL[BUCKET]||"").split(" ")[0])+'</b>':e(slotEnd(x.appt_slot)))+'</span></div>'+
        '<div class="lead'+(x.is_demo?' demo':'')+'" data-lead="'+e(x.id)+'">'+
        '<div class="linfo"><div class="nm">'+e(((x.first_name||"")+" "+(x.last_name||"")).trim()||"Buyer")+(x.is_demo?'<span class="sampletag">SAMPLE</span>':'')+'</div>'+
        '<div class="car">'+e(carShort(x))+'</div>'+img+'</div>'+
        '<div class="rstack">'+band+prob+statusChip(x)+'</div></div></div>';
    });
    $("leads").innerHTML=html;
    $("leads").querySelectorAll(".lead").forEach(function(c){
      c.addEventListener("click",function(){ var x=LEADMAP[c.dataset.lead]; if(x) openLead(x); });
    });
    // R21: pill opens its own menu; pick an option, it moves. Never opens the panel.
    $("leads").querySelectorAll(".stwrap").forEach(function(w){
      var pill=w.querySelector(".stpill");
      pill.addEventListener("click",function(ev){ ev.stopPropagation();
        var open=w.classList.contains("open");
        $("leads").querySelectorAll(".stwrap.open").forEach(function(o){ o.classList.remove("open"); });
        if(!open) w.classList.add("open"); });
      w.querySelectorAll(".stmenu button").forEach(function(b){
        b.addEventListener("click",function(ev){ ev.stopPropagation(); w.classList.remove("open");
          setStatus(pill,pill.dataset.lead,b.dataset.set,function(){ renderLeads(LEADS_ALL); }); }); });
    });
  }
  function loadLeads(){
    F("/api/dealer/leads").then(function(r){return r.ok?r.json():{leads:[]};}).then(function(d){
      LEADS_ALL=d.leads||[]; LEADMAP={};
      LEADS_ALL.forEach(function(x){ LEADMAP[x.id]=x; });
      renderLeads(LEADS_ALL);
    }).catch(function(){});
  }
  $("buckets").querySelectorAll(".bkt").forEach(function(b){
    b.addEventListener("click",function(){ BUCKET=b.dataset.bkt;
      $("buckets").querySelectorAll(".bkt").forEach(function(o){o.classList.toggle("on",o===b);});
      renderLeads(LEADS_ALL); });
  });
  // R20: page header removed — day dividers carry the date context.
  function openLead(x){
    $("lead-bg").style.display="flex";   // R18: show the sheet FIRST — no render error can hide it
    try{
    var d=x.deal||{};
    $s("lp-name").textContent=((x.first_name||"")+" "+(x.last_name||"")).trim()||"Buyer";
    $s("lp-sub").textContent=x.matched_car||x.dream_car||"";
    $s("lp-when").textContent=[fmtSlotRange(x.appt_slot), x.cid?("CID "+cidNum(x.cid)):""].filter(Boolean).join(" · ");
    // R14: the ONE number, then the two money tiles (only when the dealer entered cost/lot date).
    var estTag=d.econReal?"":" (EST)";
    // R21: no match% anywhere in the panel — it lives only on the card block.
    $s("lp-kpis").innerHTML=
      (d.holdingSaved?'<div class="kpi"><b>$'+(+d.holdingSaved).toLocaleString()+'</b><span>STORE SAVES'+estTag+'</span></div>':"")+
      (d.commission ?'<div class="kpi"><b>$'+(+d.commission).toLocaleString()+'</b><span>YOUR CUT'+estTag+'</span></div>':"");
    $s("lp-deal").innerHTML=dealHtml(x);
    // R19: one-paragraph customer profile — high-level read, real fields only.
    var pf=[];
    if(x.credit_band) pf.push((x.credit_band==="under 580"||x.credit_band==="580-669")?("Credit-constrained ("+x.credit_band+") — he is buying a payment, not a price.")
      :("Strong credit ("+x.credit_band+") — approval is not the obstacle; terms are."));
    if(d.wantsMo) pf.push("Ceiling is $"+d.wantsMo+"/mo with $"+(+d.wantsDown||0).toLocaleString()+" down.");
    if(x.trade_in) pf.push("Bringing a trade: "+String(x.trade_in).split("—")[0].trim()+".");
    if(x.zip) pf.push("Local to "+x.zip+".");
    $s("lp-profile").textContent=pf.join(" ");
    // R17: action items only — what he DOES, in order. Numbers stay behind "View numbers".
    // R21: the CarNimbus model — the deal closed online. No desk, no re-quote. Keys and the drive.
    var todo=[];
    todo.push("Have the "+carShort(x)+" out front and running — he came to drive, not shop.");
    if(x.trade_in) todo.push("His trade's already in the price. Don't reopen it — just confirm the "+String(x.trade_in).split("—")[0].trim()+" is what he described.");
    todo.push("Numbers are locked. Keys and the test drive, not the desk.");
    if(d.daysOnLot>60) todo.push("This unit has sat "+d.daysOnLot+" days — this is the one that moves it.");
    $s("lp-do").innerHTML=todo.map(function(t){return '<li>'+e(t)+'</li>';}).join('');
    // R16: SHOW THE WORK — the scored factors behind the close probability.
    $s("lp-trade").innerHTML=x.trade_in?'<div class="fact"><b>Trade</b><span>'+e(x.trade_in)+'</span></div>':'<div class="msgnone">No trade-in.</div>';
    $s("lp-contact").innerHTML='<div class="fact"><b>Phone</b><span>'+e(x.phone||"—")+'</span></div>'+
      '<div class="fact"><b>Email</b><span>'+e(x.email||"—")+'</span></div>'+
      '<div class="fact"><b>Address</b><span>'+e(usaAddr(x.address)||"—")+'</span></div>';
    var mm=String(x.appt_slot||"").match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if(mm){ var S=mm[1]+mm[2]+mm[3]+"T"+mm[4]+mm[5]+"00",
        eh=String(+mm[4]+(mm[5]==="30"?1:0)).padStart(2,"0"), em2=mm[5]==="30"?"00":"30",
        E=mm[1]+mm[2]+mm[3]+"T"+eh+em2+"00",
        nm2=encodeURIComponent("Test Drive — "+(((x.first_name||"")+" "+(x.last_name||"")).trim())+" — "+(x.matched_car||""));
      $s("lp-gcal").href="https://calendar.google.com/calendar/render?action=TEMPLATE&text="+nm2+"&dates="+S+"/"+E+
        "&details="+encodeURIComponent("CID "+cidNum(x.cid||"")+(x.trade_in?"\nTrade-in: "+x.trade_in:""));
      $s("lp-gcal").style.display=""; $s("lp-ics").style.display="";
      $s("lp-ics").href="/api/dealer/lead-ics?lead_id="+x.id; }
    else { $s("lp-gcal").style.display="none"; $s("lp-ics").style.display="none"; }
    F("/api/dealer/lead-brief",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({lead_id:x.id})})
      .then(function(r){return r.json();}).then(function(d){
        var b=d&&d.behavior, tr=x.trade_in?String(x.trade_in).split("—")[0].trim():"";
        // R21: SAY THIS — spoken, and true to the model: price is locked, trade already applied, drive and go.
        var fn=(x.first_name||"").trim();
        var phrases=[(fn?fn+" — car":"Car")+"'s out front, keys are ready. Let's get you in it."];
        phrases.push("Everything's handled on paper, so we're just here to make sure it drives right for you.");
        if(tr) phrases.push("The "+tr+" is already figured into your price — we'll square it away right after your drive.");
        $s("lp-say").innerHTML=phrases.map(function(t){return '<p>'+e(t)+'</p>';}).join('');
        // R20: HE IS — real chips only. Scans not "visits"; price-conscious; no "compared".
        var chips=[];
        if(x.credit_band) chips.push(x.credit_band+" credit");
        if(b&&b.scans) chips.push(b.scans+" scans on CarNimbus");
        if(b&&b.lines) b.lines.forEach(function(l){
          if(/calculator/i.test(l)) chips.push("Price-conscious");
          else if(/evening/i.test(l)) chips.push("Call after 6pm"); });
        if(b&&b.heat) chips.push("Heat "+b.heat.heat+"/100");
        $s("lp-heis").innerHTML=chips.slice(0,6).map(function(c){return '<span>'+e(c)+'</span>';}).join(''); })
      .catch(function(){});
    // R23: TIMELINE — the lifecycle ledger + follow-up texts, so the salesman sees where the machine left off.
    var tl=$s("lp-timeline"); tl.innerHTML='<div class="msgnone">Loading…</div>';
    F("/api/dealer/lead-history?lead_id="+encodeURIComponent(x.id)).then(function(r){return r.json();}).then(function(d){
      var ev=(d&&d.events)||[], fu=(d&&d.followups)||[];
      var fmt=function(t){return String(t||"").slice(0,16).replace("T"," ");};
      var rowsH=ev.map(function(o){ return '<div class="fact"><b>'+e(fmt(o.ts))+'</b><span>'+e((o.from_status?o.from_status+" → ":"")+o.to_status+" ("+o.source+")")+'</span></div>'; }).join('');
      var fuH=fu.map(function(o){ return '<div class="fact"><b>'+e(fmt(o.send_at))+'</b><span>'+e((o.sent?"sent — ":"queued — ")+o.body)+'</span></div>'; }).join('');
      tl.innerHTML=(rowsH||'<div class="msgnone">No history yet.</div>')+(fuH?'<div class="dayhead" style="margin-top:8px">FOLLOW-UP TEXTS</div>'+fuH:'');
    }).catch(function(){ tl.innerHTML='<div class="msgnone">History unavailable.</div>'; });
    var th=$s("lp-thread"); th.style.display="none"; th.innerHTML="";
    $s("lp-msgtoggle").textContent="▸ View messages";
    F("/api/dealer/lead-thread?lead_id="+encodeURIComponent(x.id)).then(function(r){return r.json();}).then(function(d){
      var m=(d&&d.thread)||[], hid=(d&&d.hidden)||0;
      $s("lp-msgtoggle").textContent="▸ View messages ("+m.length+")";
      // R13: say what was suppressed rather than hiding it silently — codes/passes are admin-side only.
      var note=hid?'<div class="msgnone">'+hid+' system '+(hid===1?"message":"messages")+' hidden (verification codes, pass links).</div>':'';
      th.innerHTML=(m.length? m.map(function(o){
        return '<div class="msg '+(o.direction==="in"?"in":"out")+'">'+e(o.body)+'<div class="t">'+e(String(o.created_at||"").slice(0,16).replace("T"," "))+'</div></div>';
      }).join('') : '<div class="msgnone">No messages yet — the AI conversation appears here once texting is live.</div>')+note;
    }).catch(function(){});
    }catch(err){ if(window.console&&console.error) console.error("openLead render:",err); }
  }
  document.querySelectorAll(".msgtoggle[data-tgl]").forEach(function(b){
    b.addEventListener("click",function(){ var t=$(b.dataset.tgl), open=t.style.display==="none";
      t.style.display=open?"":"none"; b.textContent=b.textContent.replace(open?"▸":"▾",open?"▾":"▸"); });
  });
  $("lp-msgtoggle").addEventListener("click",function(){
    var th=$("lp-thread"), open=th.style.display==="none", b=$("lp-msgtoggle");
    th.style.display=open?"":"none";
    b.textContent=(b.textContent||"").replace(open?"▸":"▾",open?"▾":"▸");
  });
  $("lp-x").addEventListener("click",function(){$("lead-bg").style.display="none";});

  // R20: store-economics settings sheet.
  (function(){ var bg=$("set-bg"); if(!bg) return;
    // R23b: gear removed from the header — sheet only opens if a future entry point exists.
    $s("dc-set").addEventListener("click",function(){ bg.style.display="flex";
      $("set-comm").value=(DEALER.commission_pct!=null?DEALER.commission_pct:"");
      $("set-hold").value=(DEALER.holding_per_day!=null?DEALER.holding_per_day:"");
      $("set-pack").value=(DEALER.pack_fee!=null?DEALER.pack_fee:""); });
    $("set-x").addEventListener("click",function(){ bg.style.display="none"; });
    $("set-save").addEventListener("click",function(){
      F("/api/dealer/settings",{method:"POST",headers:{"content-type":"application/json"},
        body:JSON.stringify({commission_pct:+$("set-comm").value||0,holding_per_day:+$("set-hold").value||0,pack_fee:+$("set-pack").value||0})})
        .then(function(r){return r.json();}).then(function(d){ if(d&&d.ok){
          DEALER.commission_pct=d.commission_pct; DEALER.holding_per_day=d.holding_per_day; DEALER.pack_fee=d.pack_fee;
          $("set-msg").textContent="Saved — numbers are now your store's."; loadLeads();
          setTimeout(function(){ bg.style.display="none"; $("set-msg").textContent=""; },1100); } }).catch(function(){}); });
  })();
  // R20: Ask-NIMBUS live filter over the lot + optional voice.
  (function(){ var inp=$("inv-ask"); if(!inp) return;
    inp.addEventListener("input",function(){ var q=inp.value.toLowerCase().trim();
      $("sections").querySelectorAll(".vrow").forEach(function(r){
        var spEl=r.querySelector(".vspec"); var t=(r.querySelector(".ttl").textContent+" "+(spEl?spEl.textContent:"")).toLowerCase();
        r.style.display=(!q||t.indexOf(q)>-1)?"":"none"; });
      if(q) $("sections").querySelectorAll(".bandsec").forEach(function(sec){ sec.classList.add("open"); }); });
    // R22: voice-first. Tap the mic, talk, results filter live as you speak. Typing stays as fallback.
    var mic=$("inv-mic"), SR=window.SpeechRecognition||window.webkitSpeechRecognition, rec=null, ph=inp.placeholder;
    if(!SR){ mic.style.display="none"; return; }
    function stopRec(){ if(rec){ try{rec.stop();}catch(_){} rec=null; }
      mic.classList.remove("listening"); inp.placeholder=ph; }
    mic.addEventListener("click",function(){
      if(rec){ stopRec(); return; }
      rec=new SR(); rec.lang="en-US"; rec.interimResults=true; rec.continuous=false;
      mic.classList.add("listening"); inp.value=""; inp.placeholder="Listening — say a make, model, color…";
      rec.onresult=function(ev){ var t="";
        for(var i=0;i<ev.results.length;i++) t+=ev.results[i][0].transcript;
        inp.value=t.trim(); inp.dispatchEvent(new Event("input")); };
      rec.onend=stopRec; rec.onerror=stopRec;
      try{ rec.start(); }catch(_){ stopRec(); } });
  })();

  // R12: Leads is the front door, always — the console opens on Leads on every load, never Inventory.
  tab("leads");
  loadConsole(true);
  // R22: prefetch the full inventory right after first paint — switching to INVENTORY is instant,
  // never a spinner. Matches still land first (meta boot above is tiny).
  setTimeout(function(){ if(!INV_LOADED){ INV_LOADED=true; loadConsole(); } },700);
  setInterval(function(){if($("console").style.display!=="none"&&$("pane-inv").style.display!=="none"&&INV_LOADED)loadConsole();},30000);
});
