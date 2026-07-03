/* CarNimbus component runtime v2 — every design-system node renders as a finished component. */
(function(){
  var LOGO='<svg class="wm-mark" viewBox="0 0 120 104" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="CarNimbus"><defs><linearGradient id="__LID__" x1="10" y1="52" x2="110" y2="52" gradientUnits="userSpaceOnUse"><stop stop-color="#1AD4FD"/><stop offset=".5" stop-color="#0FA0F9"/><stop offset="1" stop-color="#005FF0"/></linearGradient></defs><g stroke="url(#__LID__)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"><path d="M46 40 A19 19 0 1 0 40 71"/><path d="M45 41 A25 25 0 0 1 86 25 A21 21 0 0 1 96 64"/><circle cx="42" cy="75" r="12.5"/><circle cx="80" cy="75" r="12.5"/><path d="M54.5 75 H67.5"/></g></svg>';
  function logoHTML(cls){return '<img src="/assets/logo.png" alt="CarNimbus" class="'+(cls||'wm-mark')+'">';}
  var CAR_IMGS={
    'bmw':'https://upload.wikimedia.org/wikipedia/commons/thumb/f/ff/2019_BMW_330i_M_Sport_2.0_Front.jpg/960px-2019_BMW_330i_M_Sport_2.0_Front.jpg',
    'toyota':'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/2025_Toyota_Camry_Hybrid_XSE_%28United_States%29_front_view.png/960px-2025_Toyota_Camry_Hybrid_XSE_%28United_States%29_front_view.png',
    'lexus':'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/2022_Lexus_NX_350%2C_front_3.7.22.jpg/960px-2022_Lexus_NX_350%2C_front_3.7.22.jpg',
    'audi':'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/2017_Audi_Q5_S_Line_TFSi_Quattro_2.0_Front.jpg/960px-2017_Audi_Q5_S_Line_TFSi_Quattro_2.0_Front.jpg'
  };
  var DATA={
    matchObj:{value:97,size:96,thickness:9,label:'MATCH'},
    payObj:{vehicle:'2024 BMW 330i M Sport',price:33900,down:0,monthly:487,apr:6.4,term:72,qualified:true},
    dealerObj:{name:'Westside Test Drive Center',rating:4.8,reviews:980,distance:'3 mi',address:'Independent dealer · 1685 W Manchester Blvd, Inglewood',matches:6,cta:'Book a drive'}
  };
  function a(el,n,d){var v=el.getAttribute(n);return(v===null||v===undefined)?d:v;}
  function txt(el){return el.innerHTML.trim();}
  var CARFALL='<span class="ph-fallback"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13m-14 0h14m-14 0v5m14-5v5M7 18v1.5M17 18v1.5M8.5 15.5h.01M15.5 15.5h.01"/></svg></span>';
  var R={
    Wordmark:function(el){var s=+a(el,'size','19');return '<span class="wm">'+logoHTML()+'<b style="font-size:'+s+'px">CarNimbus</b></span>';},
    Button:function(el){var v=a(el,'variant','primary'),s=a(el,'size','md');return '<button class="btn '+(v==='primary'?'primary':'ghost')+' '+s+'">'+txt(el)+'</button>';},
    Eyebrow:function(el){return '<span class="eyebrow">'+txt(el)+'</span>';},
    GlassCard:function(el){var pad=a(el,'pad','true')!=='false';return '<div class="glass'+(pad?' pd':' hoverable')+'">'+el.innerHTML+'</div>';},
    Badge:function(el){var t=a(el,'tone','cyan');return '<span class="badge '+t+'">'+(txt(el)||t)+'</span>';},
    Avatar:function(el){var n=a(el,'name','?'),s=+a(el,'size','40');var i=n.split(' ').map(function(w){return w[0]||'';}).slice(0,2).join('').toUpperCase();return '<span class="avatar" style="width:'+s+'px;height:'+s+'px;font-size:'+Math.round(s*.38)+'px" title="'+n+'">'+i+'</span>';},
    Input:function(el){return '<input class="field" placeholder="'+a(el,'placeholder','')+'" type="'+a(el,'type','text')+'">';},
    SearchBar:function(el){return '<div class="searchbar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'+a(el,'placeholder','Search')+'</div>';},
    SegmentedControl:function(el){return '<div class="seg"><button class="on">EN</button><button>ES</button></div>';},
    ChatBubble:function(el){var you=/you/i.test(a(el,'dc-props',''));
      if(you)return '<div class="msg you"><div class="bubble you">'+txt(el)+'</div></div>';
      return '<div class="msg car"><span class="msg-av">'+logoHTML('msg-logo')+'</span><div class="bubble car">'+txt(el)+'</div></div>';},
    ImageSlot:function(el){var note=a(el,'note',a(el,'label',''));var icon=/old way/i.test(a(el,'label',''))?'<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M15 9h.01M15 13h.01M12 21v-4"/>':'<path d="M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm5 15h.01"/>';return '<div class="imgslot"><span class="big-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor">'+icon+'</svg></span><span class="n">'+note+'</span></div>';},
    StatusPill:function(el){var s=a(el,'status','confirmed');var ok=/confirm|approved|active|paid|ready/.test(s),mid=/pending|await|review/.test(s);var col=ok?'#5ee6a8':mid?'#18C8FF':'#fda4af';var bg=ok?'rgba(31,138,91,.16)':mid?'rgba(24,200,255,.12)':'rgba(239,68,68,.12)';return '<span class="statuspill" style="background:'+bg+';color:'+col+'"><span style="width:6px;height:6px;border-radius:50%;background:'+col+';box-shadow:0 0 8px '+col+'"></span>'+s+'</span>';},
    CidTag:function(el){return '<span class="cidtag"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 11a3 3 0 0 0-3 3c0 1.5.5 3 1 4m4-6.8A3 3 0 0 1 15 14c0 2-1 5-2.5 6.5M8.5 8.5A6 6 0 0 1 18 13c0 1-.2 3-.6 4.4M5.7 11A6 6 0 0 0 6 13c0 2.5-.5 4.5-1 5.5M12 5a8 8 0 0 1 8 8M4.6 8A8 8 0 0 1 12 5"/></svg>CID·'+a(el,'cid','')+'</span>';},
    MetricCard:function(el){var t=a(el,'trend','up');return '<div class="metric"><div class="v">'+a(el,'value','')+'</div><div class="l">'+a(el,'label','')+'</div><div class="d '+t+'">'+(t==='up'?'▲ ':'▼ ')+a(el,'delta','')+'</div></div>';},
    RangeSlider:function(el){var mn=+a(el,'min','0'),mx=+a(el,'max','100'),v=+a(el,'value','50');var p=((v-mn)/(mx-mn)*100);return '<div class="slider"><div class="fill" style="width:'+p+'%"></div><div class="knob" style="left:'+p+'%"></div></div>';},
    MatchMeter:function(el){var m=DATA.matchObj,s=m.size,r=s/2-m.thickness,c=2*Math.PI*r;return '<div class="meter" style="width:'+s+'px;height:'+s+'px"><svg width="'+s+'" height="'+s+'" style="transform:rotate(-90deg)"><circle cx="'+s/2+'" cy="'+s/2+'" r="'+r+'" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="'+m.thickness+'"/><circle class="arc" cx="'+s/2+'" cy="'+s/2+'" r="'+r+'" fill="none" stroke="#18C8FF" stroke-width="'+m.thickness+'" stroke-linecap="round" stroke-dasharray="'+c+'" stroke-dashoffset="'+c+'" data-final="'+(c*(1-m.value/100))+'"/></svg><b>'+m.value+'</b><small>'+m.label+'</small></div>';},
    PaymentEstimator:function(el){var p=DATA.payObj;return '<div class="payest"><div style="font:600 11px Manrope;color:#8ca0c4;margin-bottom:5px">Estimated payment</div><div class="big">$'+p.monthly+'<span style="font-size:14px;color:#8ca0c4;font-weight:500">/mo</span></div><div style="margin-top:13px"><div class="r"><span>Vehicle price</span><b style="color:#fff">$'+p.price.toLocaleString()+'</b></div><div class="r"><span>Down payment</span><b style="color:#fff">$'+p.down+'</b></div><div class="r"><span>APR · term</span><b style="color:#fff">'+p.apr+'% · '+p.term+' mo</b></div></div>'+(p.qualified?'<div class="badge green" style="margin-top:14px">Pre-qualified · 0 FICO impact</div>':'')+'</div>';},
    DealerCard:function(el){var d=DATA.dealerObj;return '<div class="glass pd"><div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px"><div><div class="disp" style="font-size:16px;font-weight:600">'+d.name+'</div><div style="font:500 11.5px Manrope;color:#8ca0c4;margin-top:3px">'+d.address+'</div></div><span class="badge cyan">★ '+d.rating+'</span></div><div class="row" style="gap:14px;margin-top:13px;font:600 11.5px Manrope;color:#aebfdf"><span>'+d.distance+'</span><span>'+d.reviews+' reviews</span><span class="cy">'+d.matches+' matches</span></div><button class="btn primary md" style="width:100%;margin-top:15px">'+d.cta+'</button></div>';},
    DriveNowPass:function(el){return '<div class="glass pd" style="border-color:rgba(94,230,168,.35)"><div class="row" style="justify-content:space-between;align-items:center"><span class="badge green">Drive Now pass</span><span class="cidtag">CID·'+a(el,'cid','')+'</span></div><div class="disp" style="font-size:18px;font-weight:600;margin:13px 0 3px">'+a(el,'vehicle','')+'</div><div style="font:700 14px Manrope;color:#18C8FF">$'+a(el,'price-per-mo','')+'/mo</div><div style="margin-top:13px;font:500 12.5px Manrope;color:#aebfdf;line-height:1.6"><div>'+a(el,'dealer','')+'</div><div>'+a(el,'address','')+'</div><div class="cy" style="margin-top:5px;font-weight:700">'+a(el,'datetime','')+'</div></div></div>';},
    VehicleCard:function(el){var mk=a(el,'make','').toLowerCase();var img=a(el,'image','')||CAR_IMGS[mk]||'';var cert=a(el,'certified','')==='true',best=a(el,'best-match','')==='true';
      return '<div class="glass vcard hoverable"><div class="vphoto">'+CARFALL+(img?'<img src="'+img+'" alt="'+a(el,'year','')+' '+a(el,'make','')+' '+a(el,'model','')+'" loading="lazy" style="position:relative;z-index:1" onerror="this.remove()">':'')+(cert?'<span class="vbadge cert">Certified</span>':'')+(best?'<span class="vbadge best">Best match</span>':'')+'</div><div class="vbody"><h4>'+a(el,'year','')+' '+a(el,'make','')+' '+a(el,'model','')+'</h4><div class="vtrim">'+(a(el,'trim','')||'&nbsp;')+'</div><div class="row vmeta"><span>'+a(el,'miles','')+' mi</span><span>'+a(el,'drivetrain','')+'</span></div><div class="row vprice"><b>$'+a(el,'price-per-mo','')+'<small>/mo</small></b><span class="vcta">'+a(el,'cta','Drive this')+' →</span></div></div></div>';},
    PhoneFrame:function(el){return '<div class="phone"><div class="notch"></div><div class="screen"><div class="statusbar"><span>'+a(el,'time','9:41')+'</span><span style="display:inline-flex;gap:5px;align-items:center"><svg width="15" height="11" viewBox="0 0 16 12" fill="#fff"><path d="M1 8h2v3H1zM4.5 6h2v5h-2zM8 3.5h2V11H8zM11.5 1h2v10h-2z"/></svg><svg width="20" height="11" viewBox="0 0 22 12" fill="none"><rect x=".8" y=".8" width="17" height="10.4" rx="2.4" stroke="#fff" opacity=".5"/><rect x="2.3" y="2.3" width="12" height="7.4" rx="1.2" fill="#fff"/><path d="M19.5 4v4a2 2 0 0 0 0-4Z" fill="#fff" opacity=".5"/></svg></span></div>'+el.innerHTML+'</div></div>';},
    BottomTabBar:function(el){var val=a(el,'value','discover');
      var I={discover:'<circle cx="12" cy="12" r="9"/><path d="m15 9-2 5-4 1 2-5 4-1Z"/',feed:'<path d="M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5"/',talk:'<path d="M8 9h8M8 13h5M21 12a8 8 0 1 1-3.6-6.7L21 4l-.8 3.6A8 8 0 0 1 21 12Z"/',you:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/'};
      return '<div class="tabbar">'+['discover','feed','talk','you'].map(function(t){return '<div class="tab'+(t===val?' on':'')+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+I[t]+'></svg>'+t+'</div>';}).join('')+'</div>';}
  };
  function upgrade(){
    var guard=0;
    while(document.querySelector('x-import') && guard++<20){
      document.querySelectorAll('x-import').forEach(function(el){
        var name=(a(el,'component-from-global-scope','')||'').split('.').pop();
        var fn=R[name];var d=document.createElement('div');
        d.innerHTML=fn?fn(el):('<div>'+el.innerHTML+'</div>');
        el.replaceWith.apply(el,[].slice.call(d.childNodes));
      });
    }
    // fix template-var srcs that survived
    document.querySelectorAll('img[src=""]').forEach(function(i){i.remove();});
    // motion: stagger-reveal every direct section + cards
    var targets=document.querySelectorAll('.glass,.metric,.payest,[data-reveal],.site>div>.z, .cv>div>.z');
    targets.forEach(function(t){t.classList.add('reveal');});
    var seen=0;
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){
      var d=Math.min((seen++%6)*70,350);
      setTimeout(function(){e.target.classList.add('in');},d);
      // animate meters
      e.target.querySelectorAll('.meter .arc').forEach(function(c){requestAnimationFrame(function(){c.style.strokeDashoffset=c.getAttribute('data-final');});});
      // chat feed sequencing — runs ONCE per thread (guarded), realistic pacing
      var msgs=[].slice.call(e.target.querySelectorAll('.msg'));
      if(msgs.length){
        var thread=msgs[0].parentNode;
        if(!thread.dataset.chatDone){
          thread.dataset.chatDone='1';
          msgs.forEach(function(m){m.style.opacity=0;m.style.transform='translateY(10px)';});
          var t=600; // let the card settle first
          msgs.forEach(function(m){
            var isCar=m.classList.contains('car');
            var words=(m.textContent||'').trim().split(/\s+/).length;
            if(isCar){
              // pause, then ONE typing indicator, held long enough to feel real
              t+=450;
              (function(mm,at){setTimeout(function(){
                if(thread.querySelector('.typing'))return; // never two at once
                var ty=document.createElement('div');
                ty.className='msg car typing';
                ty.innerHTML=mm.querySelector('.msg-av').outerHTML+'<div class="bubble car"><span class="tdots"><i></i><i></i><i></i></span></div>';
                thread.insertBefore(ty,mm);
              },at);})(m,t);
              var typeFor=Math.min(1900,Math.max(1000,words*220)); // longer replies "type" longer
              t+=typeFor;
              (function(mm,at){setTimeout(function(){
                var ty=thread.querySelector('.typing');if(ty)ty.remove();
                mm.style.transition='opacity .45s cubic-bezier(.22,1,.36,1),transform .45s cubic-bezier(.22,1,.36,1)';
                mm.style.opacity=1;mm.style.transform='none';
              },at);})(m,t);
              t+=550; // read time before user replies
            }else{
              t+=350;
              (function(mm,at){setTimeout(function(){
                mm.style.transition='opacity .45s cubic-bezier(.22,1,.36,1),transform .45s cubic-bezier(.22,1,.36,1)';
                mm.style.opacity=1;mm.style.transform='none';
              },at);})(m,t);
              t+=800; // pause before the car starts typing
            }
          });
          // single Delivered receipt, placed AFTER the last user row (never inside it)
          var lastYou=null;msgs.forEach(function(m){if(m.classList.contains('you'))lastYou=m;});
          if(lastYou){(function(mm,at){setTimeout(function(){
            if(thread.querySelector('.msg-meta'))return;
            var d=document.createElement('div');d.className='msg-meta';d.textContent='Delivered';
            mm.insertAdjacentElement('afterend',d);
            d.style.opacity=0;
            requestAnimationFrame(function(){d.style.transition='opacity .6s';d.style.opacity=1;});
          },at);})(lastYou,t+250);}
        }
      }
      // generic bubbles outside chat feeds
      var bs=e.target.querySelectorAll('.bubble');
      if(!msgs.length)bs.forEach(function(b,i){b.style.opacity=0;b.style.transform='translateY(8px)';setTimeout(function(){b.style.transition='opacity .45s cubic-bezier(.22,1,.36,1),transform .45s cubic-bezier(.22,1,.36,1)';b.style.opacity=1;b.style.transform='none';},250+i*420);});
      io.unobserve(e.target);}});},{threshold:.12});
    targets.forEach(function(t){io.observe(t);});
    // smooth-scroll nav links
    document.body.addEventListener('click',function(ev){var n=ev.target.closest('.navlink');if(!n)return;var id='#'+(n.textContent||'').trim().toLowerCase().replace(/[^a-z]+/g,'-');var t=document.querySelector(id);if(t)t.scrollIntoView({behavior:'smooth'});});
  }
  if(document.readyState!=='loading')upgrade();else document.addEventListener('DOMContentLoaded',upgrade);

  /* ===== CarNimbus interactivity + i18n ===== */
  var I18N = { es: {
   "How it works":"Cómo funciona","Browse":"Explorar","About":"Nosotros","Contact":"Contacto",
   "Join Waitlist":"Unirme a la lista","Get early access":"Acceso anticipado","Joining…":"Enviando…",
   "You're on the list ✓":"¡Estás en la lista ✓","You're already on the list ✓":"Ya estás en la lista ✓",
   "Please enter a valid email":"Ingresa un correo válido","Something went wrong — try again.":"Algo salió mal, inténtalo de nuevo.",
   "Your personal AI superagent":"Tu superagente de IA personal","Your personal AI superagent.":"Tu superagente de IA personal.",
   "Buy your dream car":"Compra el auto de tus sueños","on your terms.":"en tus términos.",
   "Get pre-qualified, then talk to the car you actually want. Skip the haggling, show up pre-approved — and just drive.":"Precalifica y habla con el auto que realmente quieres. Sin regateos, llega preaprobado y solo maneja.",
   "Trusted & secured data storage.":"Almacenamiento de datos seguro y confiable.",
   "$1,000 saved per car":"$1,000 ahorrados por auto","3 hours of your day, saved":"3 horas de tu día, ahorradas",
   "<10 min to book a drive":"<10 min para agendar","0 hard credit pulls":"0 consultas duras de crédito",
   "I don't do speed limits. Period.":"No respeto límites de velocidad. Punto.",
   "how fast can you actually go?":"¿qué tan rápido puedes ir realmente?","As fast as you want me to be 😏":"Tan rápido como quieras 😏",
   "could you lose a cop? 😏":"¿podrías perder a un policía? 😏",
   "0–60 in 5 seconds. Hypothetically. I don't judge. 😏":"0–100 en 5 segundos. Hipotéticamente. No juzgo. 😏",
   "ok, you're trouble. am I approved?":"ok, eres un problema. ¿estoy aprobado?",
   "30-sec soft check, no strings.":"Consulta suave de 30 seg, sin compromiso.",
   "BOOK A TEST DRIVE CENTER NEAR YOU — ACROSS LA COUNTY":"AGENDA UNA PRUEBA DE MANEJO CERCA DE TI — EN TODO EL CONDADO DE LA",
   "Three steps from scroll to keys":"Tres pasos: del scroll a las llaves",
   "1 · Talk to the car":"1 · Habla con el auto","2 · Get pre-qualified":"2 · Precalifica","3 · Show up & drive":"3 · Llega y maneja",
   "Every car has an AI personality. Ask it anything — it answers straight and sizes you up casually in chat.":"Cada auto tiene personalidad de IA. Pregúntale lo que sea: te responde directo y te evalúa en el chat.",
   "A soft pull returns a real monthly range in seconds. Zero FICO impact — no human, no pressure.":"Una consulta suave te da un rango mensual real en segundos. Cero impacto FICO, sin humanos, sin presión.",
   "We book you at a test drive center nearby. Walk in expected, terms already set. No 4-hour ordeal.":"Te agendamos en un centro de prueba cercano. Llegas esperado, con términos listos. Sin trámites de 4 horas.",
   "The shift":"El cambio","The old way vs. the CarNimbus way":"El método viejo vs. el método CarNimbus",
   "THE OLD WAY":"EL MÉTODO VIEJO","THE CARNIMBUS WAY":"EL MÉTODO CARNIMBUS",
   "Harassed the second you walk in":"Acosado apenas entras",
   "Surprise hard pull dings your credit":"Consulta dura sorpresa que daña tu crédito",
   "Murky numbers, 4-hour haggle":"Números turbios, regateo de 4 horas","Overpay $2,000–$4,000":"Pagas de más $2,000–$4,000",
   "Talk to the car — zero pressure":"Habla con el auto, sin presión","Soft pull — 0 FICO impact":"Consulta suave, 0 impacto FICO",
   "Clear monthly, set before you go":"Mensualidad clara, fijada antes de ir",
   "Save ~$1,000 — minutes, not hours":"Ahorra ~$1,000, en minutos, no horas",
   "Drive Now inventory":"Inventario Drive Now","Matched to your budget":"A la medida de tu presupuesto",
   "View all →":"Ver todo →","Certified":"Certificado","Best match":"Mejor opción","Drive this":"Maneja este",
   "Be first in line.":"Sé el primero en la fila.",
   "Join the waitlist and we'll text you the day CarNimbus is ready to use.":"Únete a la lista y te avisamos por mensaje el día que CarNimbus esté listo.",
   "Drive Now inventory · Los Angeles":"Inventario Drive Now · Los Ángeles",
   "Browse the cars. Talk when you're ready.":"Explora los autos. Habla cuando estés listo.",
   "Sedan":"Sedán","SUV":"SUV","EV":"Eléctrico",
   "Our story":"Nuestra historia","Power, back to the people.":"El poder, de vuelta a la gente.",
   "The buyer always had the least power in the room. We built CarNimbus to flip that.":"El comprador siempre tuvo el menor poder en la sala. Creamos CarNimbus para cambiarlo.",
   "Founder & CEO":"Fundador y CEO","Co-Founder & CMO":"Cofundador y CMO","Co-Founder & CTO":"Cofundador y CTO","THE TEAM":"EL EQUIPO",
   "Top Porsche rep":"Top vendedor Porsche","#3 U.S. Subaru rep":"#3 vendedor Subaru EE.UU.","Built 1M+ YouTube channel":"Creó canal de 1M+ en YouTube","2x serial entrepreneur":"Emprendedor en serie 2x",
   "Get in touch":"Contáctanos","We're in Los Angeles.":"Estamos en Los Ángeles.",
   "Questions, press, partnerships — we read everything.":"Dudas, prensa, alianzas: lo leemos todo.",
   "Are you a dealer?":"¿Eres concesionario?","Email the team":"Escríbenos",
   "you@email.com":"tu@correo.com","Search make, model, ZIP":"Busca marca, modelo, código postal"
  }};
  var CUR="en", ORIG=new WeakMap();
  function L(s){ return CUR==="es" && I18N.es[s] ? I18N.es[s] : s; }
  function go(href){ location.href=href; }
  function norm(t){ return (t||"").replace(/\s+/g," ").trim().toLowerCase().replace(/[→»]/g,"").trim(); }
  var NAV = { "how it works":"/index.html#how-it-works","browse":"/browse.html","about":"/about.html","contact":"/contact.html" };
  var CTA_WAIT = ["join waitlist","get early access","be first in line","join the waitlist"];

  function destFor(el){
    if(el.closest(".wl-form")) return null;
    var t=norm(el.textContent);
    if(NAV[t]) return NAV[t];
    if(CTA_WAIT.indexOf(t)>=0) return "/waitlist.html";
    if(t==="view all" || el.classList.contains("vcta")) return "/browse.html";
    if(t==="email the team") return "mailto:partner@carnimbus.com";
    return null;
  }
  function stampNav(){ // stamp BEFORE translation so routing is language-independent
    document.querySelectorAll(".navlink,.btn,.vcta,span,a").forEach(function(el){
      if(el.dataset.cngo) return;
      var d=destFor(el); if(d) el.dataset.cngo=d;
    });
  }
  function wireNav(){
    document.body.addEventListener("click", function(ev){
      var seg=ev.target.closest(".seg button");
      if(seg){ setLang(norm(seg.textContent)==="es"?"es":"en"); return; }
      var g=ev.target.closest("[data-cngo]");
      if(g){ ev.preventDefault(); go(g.dataset.cngo); }
    });
  }
  function wireForms(){
    document.querySelectorAll(".wl-form").forEach(function(f){
      if(f.dataset.wired) return; f.dataset.wired="1";
      f.addEventListener("submit", async function(e){
        e.preventDefault();
        var input=f.querySelector('input[type=email]'), email=(input&&input.value||"").trim();
        var btn=f.querySelector("button,.btn"); if(btn){ btn.disabled=true; btn.textContent=L("Joining…"); }
        try{
          var res=await fetch("/api/waitlist",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:email,lang:CUR})});
          var d=await res.json();
          f.innerHTML='<div class="badge '+(d.ok?"green":"red")+'" style="padding:12px 16px;font:600 12px Manrope">'+
            (d.ok?(d.already?L("You're already on the list ✓"):L("You're on the list ✓")):L("Please enter a valid email"))+'</div>';
        }catch(_){ if(btn){btn.disabled=false;btn.textContent="Get early access";} alert(L("Something went wrong — try again.")); }
      });
    });
  }
  function applyLang(lang){
    CUR=lang; try{localStorage.cn_lang=lang;}catch(_){}
    document.documentElement.lang=lang;
    var walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,null,false), nodes=[], n;
    while((n=walk.nextNode())) nodes.push(n);
    nodes.forEach(function(node){
      if(node.parentNode && /SCRIPT|STYLE/.test(node.parentNode.nodeName)) return;
      if(!ORIG.has(node)) ORIG.set(node, node.nodeValue);
      var orig=ORIG.get(node), key=orig.trim();
      node.nodeValue = (lang==="es" && key && I18N.es[key]) ? orig.replace(key, I18N.es[key]) : orig;
    });
    document.querySelectorAll("[placeholder]").forEach(function(el){
      if(!ORIG.has(el)) ORIG.set(el, el.getAttribute("placeholder"));
      var o=ORIG.get(el); el.setAttribute("placeholder",(lang==="es"&&I18N.es[o])?I18N.es[o]:o);
    });
  }
  function setLang(l){
    applyLang(l);
    document.querySelectorAll(".seg button").forEach(function(b){ b.classList.toggle("on", norm(b.textContent)===(l==="es"?"es":"en")); });
  }
  function initI18n(){
    var saved; try{saved=localStorage.cn_lang;}catch(_){}
    setLang(saved || ((navigator.language||"en").slice(0,2)==="es"?"es":"en"));
  }
  (function boot(){ var t=0, iv=setInterval(function(){
    if(!document.querySelector("x-import") || t++>150){ clearInterval(iv); stampNav(); wireNav(); wireForms(); initI18n(); }
  },30); })();

})();
