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
      return '<div class="glass vcard hoverable"><div class="vphoto">'+CARFALL+(img?'<img src="'+img+'" alt="'+a(el,'year','')+' '+a(el,'make','')+' '+a(el,'model','')+'" loading="lazy" style="position:relative;z-index:1" onerror="this.remove()">':'')+(cert?'<span class="vbadge cert">Certified</span>':'')+(best?'<span class="vbadge best">Best match</span>':'')+'</div><div class="vbody"><h4>'+a(el,'year','')+' '+a(el,'make','')+' '+a(el,'model','')+'</h4><div class="vtrim">'+(a(el,'trim','')||'&nbsp;')+'</div><div class="row vmeta"><span>'+a(el,'miles','')+' mi</span><span>'+a(el,'drivetrain','')+'</span></div><div style="font:600 10px Manrope;color:#8ca0c4;margin-top:2px">$0 down · 72-month term</div><div class="row vprice"><b>$'+a(el,'price-per-mo','')+'<small>/mo</small></b><span class="vcta">'+a(el,'cta','Drive this')+' →</span></div></div></div>';},
    PhoneFrame:function(el){return '<div class="phone"><div class="notch"></div><div class="screen"><div class="statusbar"><span>'+a(el,'time','9:41')+'</span><span style="display:inline-flex;gap:5px;align-items:center"><svg width="15" height="11" viewBox="0 0 16 12" fill="#fff"><path d="M1 8h2v3H1zM4.5 6h2v5h-2zM8 3.5h2V11H8zM11.5 1h2v10h-2z"/></svg><svg width="20" height="11" viewBox="0 0 22 12" fill="none"><rect x=".8" y=".8" width="17" height="10.4" rx="2.4" stroke="#fff" opacity=".5"/><rect x="2.3" y="2.3" width="12" height="7.4" rx="1.2" fill="#fff"/><path d="M19.5 4v4a2 2 0 0 0 0-4Z" fill="#fff" opacity=".5"/></svg></span></div>'+el.innerHTML+'</div></div>';},
    BottomTabBar:function(el){var val=a(el,'value','feed');
      var I={feed:'<path d="M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5"/',chat:'<path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z"/',profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/'};
      return '<div class="tabbar">'+['feed','chat','profile'].map(function(t){return '<div class="tab'+(t===val?' on':'')+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+I[t]+'></svg>'+t+'</div>';}).join('')+'</div>';}
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
  var I18N = { es: {"#3 U.S. Subaru rep": "#3 vendedor Subaru en EE.UU.", "$1,000 saved per car": "$1,000 ahorrados por auto", "0 hard credit pulls": "0 consultas duras de crédito", "0–60 in 5 seconds. Hypothetically. I don’t judge. 🏁": "0–100 en 5 segundos. Hipotéticamente. No juzgo.", "1 · Talk to the car": "1 · Habla con el auto", "2 · Get pre-qualified": "2 · Precalifica", "2x serial entrepreneur": "Emprendedor en serie 2x", "3 hours of your day, saved": "3 horas de tu día, ahorradas", "3 · Show up & drive": "3 · Llega y maneja", "30-sec soft check, no strings.": "Consulta suave de 30 seg, sin compromiso.", "<10 min to book a drive": "<10 min para agendar", "A soft pull returns a real monthly range in seconds. Zero FICO impact — no human, no pressure.": "Una consulta suave te da un rango mensual real en segundos. Cero impacto en tu FICO, sin humanos, sin presión.", "APPROVED": "APROBADO", "About": "Nosotros", "Are you a dealer?": "¿Eres concesionario?", "Back to CarNimbus": "Volver a CarNimbus", "Be first in line.": "Sé el primero en la fila.", "Browse": "Explorar", "Browse the cars. Talk when you’re ready.": "Explora los autos. Habla cuando estés listo.", "Built 1M+ YouTube channel": "Creó un canal de 1M+ en YouTube", "Buy your dream car": "Compra el auto de tus sueños", "COMING TO A TEST DRIVE CENTER NEAR YOU — ACROSS LA COUNTY": "PRÓXIMAMENTE EN UN CENTRO DE PRUEBA DE MANEJO CERCA DE TI — EN TODO EL CONDADO DE LA", "CarNimbus is buyer-first. If you run an independent rooftop and want vetted, pre-qualified buyers routed to you, email us — we’ll connect your inventory by API.": "CarNimbus prioriza al comprador. Si tienes un concesionario independiente y quieres recibir compradores verificados y precalificados, escríbenos: conectamos tu inventario por API.", "CarNimbus started with Cid. His first-ever video — a viral Audi commercial over a decade ago — grew into a 1M+ YouTube channel. When that chapter ended, he got into selling cars — and saw fast how rigged the game is: people walked in excited and left": "CarNimbus empezó con Cid. Su primer video —un comercial viral de Audi hace más de una década— se convirtió en un canal de más de 1M en YouTube. Cuando ese capítulo terminó, se metió a vender autos y vio rápido lo amañado que está el juego: la gente entraba emocionada y salía", "Clear monthly, set before you go": "Mensualidad clara, fijada antes de ir", "Co-Founder & CMO": "Cofundador y CMO", "Co-Founder & CTO": "Cofundador y CTO", "Contact": "Contacto", "DEALER": "CONCESIONARIO", "Drive Now inventory": "Inventario Drive Now", "Drive Now inventory · Los Angeles": "Inventario Drive Now · Los Ángeles", "Drive this": "Maneja este", "EV": "Eléctrico", "Early access": "Acceso anticipado", "Email the team": "Escríbenos", "Every car has an AI personality. Ask it anything — it answers straight and sizes you up casually in chat.": "Cada auto tiene una personalidad de IA. Pregúntale lo que sea: te responde directo y te evalúa de forma casual en el chat.", "Founder & CEO": "Fundador y CEO", "Get early access": "Acceso anticipado", "Sign Up": "Regístrate", "Skip the salesperson — the car answers for itself.": "Olvídate del vendedor — el auto responde por sí mismo.", "Pick any car you're interested in and ask it anything — price, condition, monthly payment. Our AI answers every question, instantly.": "Elige el auto que te interese y pregúntale lo que sea — precio, condición, mensualidad. Nuestra IA responde al instante.", "$0 down · 72-month term": "$0 de enganche · plazo de 72 meses", "Endless negotiations the second you walk in": "Negociaciones sin fin apenas entras", "Inconsistent numbers, 4-hour haggle": "Números inconsistentes, regateo de 4 horas", "~$487/mo — $0 down, 72-month term. 30-sec soft check, zero credit hit.": "~$487/mes — $0 de enganche, plazo de 72 meses. Consulta suave de 30 seg, cero impacto en tu crédito.", "The problem": "El problema", "Why buying a car feels rigged": "Por qué comprar un auto se siente amañado", "The harassment": "El acoso", "Walk in once, get called for months. Texts, follow-ups, \"just checking in\" — pressure before you've even picked a car.": "Entras una vez y te llaman por meses. Mensajes, seguimientos, presión antes de siquiera elegir un auto.", "The hard pull": "La consulta dura", "A surprise hard inquiry dings your FICO score before any deal even exists. Your credit pays first — you decide later.": "Una consulta dura sorpresa daña tu puntaje FICO antes de que exista un trato. Tu crédito paga primero — tú decides después.", "The murky math": "Las cuentas turbias", "Numbers that never sit still and a 4-hour haggle built to wear you down until you take whatever they recommend.": "Números que nunca se quedan quietos y un regateo de 4 horas diseñado para desgastarte hasta aceptar lo que te recomienden.", "Buyers already moved. The lots didn't.": "Los compradores ya cambiaron. Los lotes no.", "shop for cars on social": "buscan autos en redes", "trust creators over brand ads": "confían más en creadores que en anuncios", "of Gen Z bought their last car fully online": "de la Gen Z compró su último auto 100% en línea", "want AI to recommend the right car": "quieren que la IA les recomiende el auto correcto", "The fix": "La solución", "Get in touch": "Contáctanos", "Get pre-qualified, then talk to the car you actually want. Skip the haggling, show up pre-approved — and just drive.": "Precalifica y luego habla con el auto que realmente quieres. Olvídate del regateo, llega preaprobado y solo maneja.", "How it works": "Cómo funciona", "Join Waitlist": "Unirme a la lista", "Join the waitlist": "Únete a la lista", "Join the waitlist and we'll text you the day CarNimbus is ready to use.": "Únete a la lista y te avisamos por mensaje el día que CarNimbus esté listo.", "Join the waitlist and we’ll text you the day CarNimbus is ready to use.": "Únete a la lista y te avisamos por mensaje el día que CarNimbus esté listo.", "Lost a wheel.": "Se soltó una llanta.", "Matched to your budget": "A la medida de tu presupuesto", "No spam. One text when we launch.": "Sin spam. Un solo mensaje cuando lancemos.", "Our story": "Nuestra historia", "Overpay $2,000–$4,000": "Pagas de más $2,000–$4,000", "Questions, press, partnerships — we read everything.": "Dudas, prensa, alianzas: lo leemos todo.", "SUV": "SUV", "Save ~$1,000 — minutes, not hours": "Ahorra ~$1,000, en minutos, no horas", "Search make, model, ZIP": "Busca marca, modelo o código postal", "Sedan": "Sedán", "So he built the fix the industry never would —": "Así que construyó la solución que la industria nunca haría:", "Soft pull — 0 FICO impact": "Consulta suave, 0 impacto en FICO", "Surprise hard pull dings your credit": "Una consulta dura sorpresa daña tu crédito", "THE CARNIMBUS WAY": "EL MÉTODO CARNIMBUS", "THE OLD WAY": "EL MÉTODO VIEJO", "THE TEAM": "EL EQUIPO", "Talk to the car — zero pressure": "Habla con el auto, sin presión", "That page took a wrong turn. Let's get you back on the road.": "Esa página tomó un desvío. Volvamos al camino.", "The old way vs. the CarNimbus way": "El método viejo vs. el método CarNimbus", "The shift": "El cambio", "Three steps from scroll to keys": "Tres pasos: del scroll a las llaves", "Top Porsche rep": "Top vendedor Porsche", "Trusted & secured data storage.": "Almacenamiento de datos seguro y confiable.", "View all →": "Ver todo", "Want to talk to one?": "¿Quieres hablar con uno?", "We book you at a test drive center nearby. Walk in expected, terms already set. No 4-hour ordeal.": "Te agendamos en un centro de prueba cercano. Llegas esperado y con los términos ya listos. Sin trámites de 4 horas.", "We’re in Los Angeles.": "Estamos en Los Ángeles.", "Your personal AI superagent": "Tu superagente de IA personal", "Your personal AI superagent.": "Tu superagente de IA personal.", "what would I actually pay a month?": "¿cuánto pagaría al mes realmente?", "ok — am I approved?": "ok — ¿estoy aprobado?", "APPROVED ✅ Come drive me tomorrow.": "APROBADO ✅ Ven a manejarme mañana.", "Meet the team": "Conoce al equipo", "The power's in your hands.": "El poder está en tus manos.", "put the power in your hands.": "poner el poder en tus manos.", "HOW IT PLAYS OUT · MAYA, 26 · INGLEWOOD": "ASÍ FUNCIONA · MAYA, 26 · INGLEWOOD", "hard-pulled and overcharged $2,000–$4,000 a car.": "con consultas duras y pagando de más $2,000–$4,000 por auto.", "how fast can you actually go?": "¿qué tan rápido puedes ir realmente?", "on your terms.": "en tus términos.", "© 2026 CarNimbus, Inc. · Los Angeles, California": "© 2026 CarNimbus, Inc. · Los Ángeles, California", "— pre-qualify with a soft pull, 0 FICO impact.": "— precalifica con una consulta suave, 0 impacto en FICO.", "“I don’t do speed limits. Period.”": "\"No respeto los límites de velocidad. Punto.\"", "“The buyer always had the least power in the room. We built CarNimbus to flip that.”": "\"El comprador siempre tuvo el menor poder en la sala. Creamos CarNimbus para cambiar eso.\"", "Joining…": "Enviando…", "You're on the list ✓": "¡Estás en la lista! ✓", "You're already on the list ✓": "Ya estás en la lista ✓", "Please enter a valid email": "Ingresa un correo válido", "Something went wrong — try again.": "Algo salió mal, inténtalo de nuevo.", "Certified": "Certificado", "Best match": "Mejor opción",
"Meet the team →": "Conoce al equipo →",
"Founder & CEO · Top Porsche rep": "Fundador y CEO · Top vendedor Porsche",
"Questions, answered": "Preguntas, respondidas",
"Will this hurt my credit?": "¿Esto afecta mi crédito?",
"No. Pre-qualification uses a soft pull only — zero FICO impact. A hard pull only ever happens later, if you choose to finance, and you'll know first.": "No. La precalificación usa solo una consulta suave: cero impacto en tu FICO. Una consulta dura solo ocurre después, si decides financiar, y lo sabrás primero.",
"What does CarNimbus cost me?": "¿Cuánto me cuesta CarNimbus?",
"Nothing. CarNimbus is free for buyers — we're paid by partner dealers for delivering ready-to-drive customers, not by marking up your car.": "Nada. CarNimbus es gratis para compradores: nos pagan los concesionarios aliados por entregar clientes listos para manejar, no por encarecer tu auto.",
"How do test drives work?": "¿Cómo funcionan las pruebas de manejo?",
"Pick a car, pick a test drive center near you, pick a time. You show up expected, terms already set — no 4-hour dealership ordeal.": "Elige un auto, un centro de prueba cercano y una hora. Llegas esperado y con los términos listos: sin el calvario de 4 horas.",
"Are you a dealership?": "¿Son un concesionario?",
"No — we're buyer-first. Independent dealers plug their inventory into CarNimbus; you stay in control the whole way.": "No: priorizamos al comprador. Los concesionarios independientes conectan su inventario a CarNimbus; tú mantienes el control todo el camino.",
"What happens to my data?": "¿Qué pasa con mis datos?",
"Your email and pre-qual info stay with us — never sold. See the": "Tu correo y tu precalificación se quedan con nosotros, nunca se venden. Consulta la",
"Privacy Policy": "Política de Privacidad",
"for the plain-English version.": "para la versión en lenguaje claro.",
"When do you launch?": "¿Cuándo lanzan?",
"We're rolling out across LA County first. Join the waitlist — you'll get exactly one text the day it's ready.": "Primero llegamos a todo el condado de LA. Únete a la lista: recibirás exactamente un mensaje el día que esté listo.",
"I agree to the": "Acepto la",
"and to receive email/SMS updates — msg&data rates may apply, reply STOP to opt out.": "y recibir novedades por correo/SMS — pueden aplicar tarifas; responde STOP para salir.",
"and to receive email/SMS updates — reply STOP to opt out.": "y recibir novedades por correo/SMS — responde STOP para salir.",
"Please agree to the Privacy Policy to continue.": "Acepta la Política de Privacidad para continuar.",
"Too many attempts — please try again later.": "Demasiados intentos: inténtalo más tarde.",
"Bot check failed — please retry.": "Falló la verificación anti-bots: reintenta.",
"Request blocked. Refresh and try again.": "Solicitud bloqueada. Recarga e inténtalo de nuevo.",
"Mobile number":"Número de celular",
"Email (optional — for your receipt)":"Correo (opcional — para tu comprobante)",
"That number doesn't look right — 10 digits, US for now.":"Ese número no se ve bien: 10 dígitos, EE.UU. por ahora.",
"No spam. One text when we launch. Reply STOP anytime.":"Sin spam. Un mensaje cuando lancemos. Responde STOP cuando quieras.",
"and to receive the launch text + occasional updates — msg&data rates may apply, reply STOP to opt out.":"y recibir el mensaje de lanzamiento + novedades ocasionales — pueden aplicar tarifas; responde STOP para salir.",
"You're in. One text at launch.":"¡Estás dentro! Un mensaje al lanzar.",
"We'll text you the day CarNimbus goes live in LA. That's it — reply STOP anytime.":"Te mandamos un mensaje el día que CarNimbus llegue a LA. Eso es todo — responde STOP cuando quieras.",
"Browse the cars →":"Explora los autos →",
"Share with a friend":"Comparte con un amigo",
"Copied ✓":"Copiado ✓",
"Connection hiccup — check your signal and try again.":"Falló la conexión: revisa tu señal e inténtalo de nuevo.",
"Join the wait list and we'll text you.":"Únete a la lista y te mandamos un mensaje.",
"You're already on the list. We'll text you.":"Ya estás en la lista. Te mandaremos un mensaje.",
"I agree to the":"Acepto la",
"I agree to receive recurring marketing & waitlist texts from CarNimbus at the number provided (up to 4 msgs/mo). Consent is not a condition of purchase. Msg&data rates may apply. Reply STOP to cancel, HELP for help.":"Acepto recibir mensajes recurrentes de marketing y de la lista de espera de CarNimbus al número indicado (hasta 4 msjs/mes). El consentimiento no es condición de compra. Pueden aplicar tarifas. Responde STOP para cancelar, HELP para ayuda.",
"Please check the SMS consent box — that's how we text you.":"Marca la casilla de consentimiento SMS: así te enviamos mensajes.",
"No spam. One text when we launch. Reply STOP anytime.":"Sin spam. Un mensaje cuando lancemos. Responde STOP cuando quieras.",
"Ask me anything — I answer straight.":"Pregúntame lo que sea: respondo directo.",
"Send":"Enviar",
"Hey — I'm the":"Hola, soy el",
"Ask me anything, or tell me when you want to drive.":"Pregúntame lo que sea, o dime cuándo quieres manejar.",
"Sign in first so I remember you —":"Inicia sesión primero para recordarte:",
"create your profile":"crea tu perfil",
"Your Drive Now pass is ready →":"Tu pase Drive Now está listo →",
"Static on the line — try that again.":"Se cortó la señal: inténtalo de nuevo.",
"Your matches. Talk when you’re ready.":"Tus matches. Habla cuando estés listo.",
"Sign in":"Iniciar sesión","I'm buying a car":"Quiero comprar un auto","I'm a dealer":"Soy concesionario","Request access":"Solicitar acceso","Welcome to CarNimbus.":"Bienvenido a CarNimbus.","Buyers and dealers both drive here.":"Aquí manejan compradores y concesionarios.","Talk to this car →":"Habla con este auto →","My Deals":"Mis tratos","Account":"Cuenta","matches":"resultados","No Drive Now pass yet.":"Aún no tienes pase Drive Now.","Browse your matches":"Explora tus matches","Open full pass":"Abrir pase completo","Reschedule in chat":"Reagendar en el chat","Pre-qualified":"Precalificado","0 FICO impact":"0 impacto en FICO"
,"Following":"Siguiendo","For You":"Para ti","Browse all →":"Ver todo →","Talk to it":"Háblale","Post":"Publicar","Sign out":"Cerrar sesión","UPCOMING":"PRÓXIMO","YOUR MATCHES":"TUS MATCHES","Edit my 10 answers":"Editar mis 10 respuestas","Be the first — say something about a car you talked to.":"Sé el primero: comenta sobre un auto con el que hablaste.","Ask the community or an AI agent…":"Pregunta a la comunidad o a un agente de IA…","Sign in to see your account.":"Inicia sesión para ver tu cuenta.","Open pass":"Abrir pase","Reschedule":"Reagendar","Feed":"Comunidad","Hot":"Popular","New":"Nuevo",
"WHY IT FITS YOU":"POR QUÉ TE QUEDA","In budget":"En presupuesto","Top pick for your profile.":"La mejor opción para tu perfil.","Schedule Test Drive":"Agendar prueba de manejo","Schedule your test drive":"Agenda tu prueba de manejo","PICK A DAY":"ELIGE UN DÍA","PICK A TIME":"ELIGE UNA HORA","Confirm test drive":"Confirmar prueba de manejo","↺ Start over":"↺ Empezar de nuevo","Message the car":"Escríbele al auto","Send":"Enviar","See your pass →":"Ver tu pase →","Drive booked · pass ready":"Manejo agendado · pase listo","Soft check · 0 credit hit":"Consulta suave · 0 impacto al crédito","Ask me anything — I answer straight.":"Pregúntame lo que sea — respondo directo.","Fresh listing":"Recién publicado","Ask me anything":"Pregúntame lo que sea","Today":"Hoy","Tomorrow":"Mañana","Sunday":"Domingo","Monday":"Lunes","Tuesday":"Martes","Wednesday":"Miércoles","Thursday":"Jueves","Friday":"Viernes","Saturday":"Sábado","Pick a time to lock it in.":"Elige una hora para confirmar.","Couldn't book that slot — try another.":"No se pudo reservar ese horario — elige otro.","Sign in first so I remember you.":"Inicia sesión primero para que te recuerde.","Sign in →":"Iniciar sesión →","Static on the line — try that again.":"Se cortó la señal — inténtalo de nuevo.","Car not found.":"Auto no encontrado.","Couldn't load this car — refresh to retry.":"No se pudo cargar este auto — recarga para reintentar.","Back to browse":"Volver a explorar","your nearest CarNimbus center":"tu centro CarNimbus más cercano",
"Nimbus found your top matches.":"Nimbus encontró tus mejores opciones.","Ranked to your profile. Tap any car to talk to it — then pick the one you want to drive.":"Ordenados según tu perfil. Toca cualquier auto para hablar con él — luego elige el que quieras manejar.","Finish your profile to unlock ranked matches.":"Completa tu perfil para desbloquear tus opciones.","Answer a few questions →":"Responde unas preguntas →","Talk to this Car":"Habla con este auto","Certified":"Certificado","Top match":"Mejor opción","No matches yet — finish your profile to rank inventory.":"Aún no hay opciones — completa tu perfil para ordenar el inventario.","Matches unavailable — refresh to retry.":"Opciones no disponibles — recarga para reintentar.",
"Talk":"Hablar","Your conversations. Every car here talks back.":"Tus conversaciones. Cada auto aquí te responde.","Tap to talk to this car":"Toca para hablar con este auto","Tap to keep talking":"Toca para seguir hablando","Finish your profile to meet your matches.":"Completa tu perfil para conocer tus opciones.","See matches →":"Ver opciones →","Couldn't load your matches — refresh to retry.":"No se pudieron cargar tus opciones — recarga para reintentar.",
"Pick a car and book a test drive — your Drive Now pass shows up here.":"Elige un auto y agenda una prueba de manejo — tu pase Drive Now aparecerá aquí.","See your matches →":"Ver tus opciones →","DRIVE NOW PASS":"PASE DRIVE NOW","Dealer":"Concesionario","When":"Cuándo","Customer ID":"ID de cliente","Desk code:":"Código de mostrador:","Show this at the desk — you're expected. Terms already set, no 4-hour ordeal.":"Muéstralo en el mostrador — te esperan. Términos ya fijados, sin trámites de 4 horas.",
"browse everything →":"explorar todo →","Browse the full lot":"Explora todo el inventario","✓ Good price":"✓ Buen precio","✓ Trusted indie dealer":"✓ Concesionario independiente confiable","NEW":"NUEVO","No cars in your area yet — we're onboarding dealers now. 🚗":"Aún no hay autos en tu zona — estamos sumando concesionarios. 🚗","Couldn't load the feed — tap to retry.":"No se pudo cargar el feed — toca para reintentar.",
"Post to the community":"Publicar en la comunidad","Be the first — say something about a car you talked to.":"Sé el primero — comenta sobre un auto con el que hablaste.","Sign in to post — sign in →":"Inicia sesión para publicar — iniciar sesión →","View":"Ver","Feed unavailable — refresh to retry.":"Feed no disponible — recarga para reintentar.",
"Filters":"Filtros","BODY":"CARROCERÍA","MONTHLY":"MENSUAL","MAKE":"MARCA","All":"Todos","Sedan":"Sedán","SUV":"SUV","EV":"Eléctrico","Max monthly payment":"Pago mensual máximo","Search inventory":"Buscar inventario","Search make, model, ZIP":"Busca marca, modelo o código postal","Answer 10 quick questions to unlock ranked matches.":"Responde 10 preguntas rápidas para desbloquear tus opciones.","Your matches come to you on Discover — this is the whole lot.":"Tus opciones llegan a ti en Discover — esto es todo el inventario.","No cars match those filters.":"Ningún auto coincide con esos filtros.",
"YOUR PROFILE":"TU PERFIL","YOUR MATCHES":"TUS OPCIONES","Edit my profile":"Editar mi perfil","CarNimbus rider":"conductor CarNimbus","Budget":"Presupuesto","Paying":"Pagando","Income":"Ingresos","Why now":"Por qué ahora","Near":"Cerca de",
"Let's find your car.":"Encontremos tu auto.","Sign in with your number — we text you a code. No passwords, ever.":"Inicia sesión con tu número — te enviamos un código. Sin contraseñas, nunca.","Mobile number":"Número de celular","Text me a code":"Envíame un código","6-digit code":"Código de 6 dígitos","Verify":"Verificar","Let's build your profile.":"Construyamos tu perfil.","A few quick things — Nimbus matches you from here.":"Unas cosas rápidas — Nimbus te encuentra opciones desde aquí.","What's your name?":"¿Cómo te llamas?","Full name":"Nombre completo","Your ZIP code?":"¿Tu código postal?","Finds dealers near you.":"Encuentra concesionarios cerca de ti.","How are you buying?":"¿Cómo vas a comprar?","Cash":"Efectivo","Finance":"Financiar","Lease":"Arrendar","Max down payment?":"¿Enganche máximo?","Max monthly payment?":"¿Pago mensual máximo?","FICO range? (soft pull only, 0 impact)":"¿Rango FICO? (solo consulta suave, 0 impacto)","Under 580":"Menos de 580","Household income?":"¿Ingreso del hogar?","Under $50k":"Menos de $50k","Your dream car, in one line.":"Tu auto soñado, en una línea.","Dream car":"Auto soñado","Why are you looking now?":"¿Por qué buscas ahora?","Car broke down":"Se descompuso mi auto","Growing family":"Familia que crece","Upgrade":"Mejorar de auto","Lease ending":"Se acaba el arrendamiento","New job":"Nuevo trabajo","Other":"Otro","Tell us…":"Cuéntanos…","Your top hobbies? (pick up to 3)":"¿Tus pasatiempos favoritos? (elige hasta 3)","Weightlifting":"Pesas","Chess":"Ajedrez","Traveling":"Viajar","Filmmaking":"Cine","Gaming":"Videojuegos","Cooking":"Cocinar","Hiking":"Senderismo","Music":"Música","Sports":"Deportes","Reading":"Lectura","Cars":"Autos","Photography":"Fotografía","Back":"Atrás","Next":"Siguiente","Finish":"Finalizar","Profile locked in. 🔑":"Perfil guardado. 🔑","Your matches are being ranked right now.":"Tus opciones se están ordenando ahora mismo.","See my top matches →":"Ver mis mejores opciones →","That number doesn't look right — 10 digits, US for now.":"Ese número no se ve bien — 10 dígitos, EE.UU. por ahora.","Couldn't send the code — try again.":"No se pudo enviar el código — inténtalo de nuevo.","Wrong or expired code — try again.":"Código incorrecto o vencido — inténtalo de nuevo.","Fill this in to keep going.":"Completa esto para continuar.","Couldn't save — try again.":"No se pudo guardar — inténtalo de nuevo.",
"🚗 I'm buying a car":"🚗 Estoy comprando un auto","Ten quick questions, then your ranked matches.":"Diez preguntas rápidas y luego tus opciones.","🏢 I'm a dealer":"🏢 Soy concesionario","GM, manager, sales — everyone. Get Drive Now for your store.":"Gerente, vendedor — todos. Obtén Drive Now para tu tienda.","Log in":"Iniciar sesión","Enter your mobile number to continue.":"Ingresa tu número de celular para continuar.","Not a buyer?":"¿No eres comprador?","Dealer sign in →":"Acceso para concesionarios →","I agree to the Privacy Policy and to receive account & verification texts. Msg&data rates may apply.":"Acepto la Política de Privacidad y recibir mensajes de cuenta y verificación. Pueden aplicar tarifas de mensajes y datos.","Drive Now for your store.":"Drive Now para tu tienda.","Tell us who you are — we'll reach out.":"Cuéntanos quién eres — te contactaremos.","GM":"Gerente general","Manager":"Gerente","Sales":"Ventas","Owner":"Dueño","Your name":"Tu nombre","Dealership":"Concesionario","Dealership name":"Nombre del concesionario","Phone":"Teléfono","Email":"Correo","You're on the list. 🤝":"Estás en la lista. 🤝","We'll reach out about Drive Now for your store.":"Te contactaremos sobre Drive Now para tu tienda.","Back to CarNimbus":"Volver a CarNimbus","Please agree to the Privacy Policy to continue.":"Acepta la Política de Privacidad para continuar.","Name and dealership are required.":"El nombre y el concesionario son obligatorios.","Couldn't send — try again.":"No se pudo enviar — inténtalo de nuevo.",
"Sign in to see your deals.":"Inicia sesión para ver tus ofertas.","Talk to a car and tell it when you want to drive.":"Habla con un auto y dile cuándo quieres manejar.","MATCH":"COINCIDENCIA","Estimated payment":"Pago estimado","Vehicle price (est.)":"Precio del vehículo (aprox.)","Down payment":"Enganche","APR · term":"TAE · plazo","Pre-qualified · 0 FICO impact":"Precalificado · 0 impacto FICO","Soft-pull FICO band":"Banda FICO por consulta suave","Range only — your exact score is never shown or dinged.":"Solo un rango — tu puntaje exacto nunca se muestra ni se afecta.","Drive Now pass":"Pase Drive Now","Open your pass →":"Abre tu pase →",
"Console":"Consola","Sign in with your dealer number.":"Inicia sesión con tu número de concesionario.","Your access is pending.":"Tu acceso está pendiente.","Dashboard":"Panel","Scan QR · check in":"Escanear QR · registrar","Routed today":"Enviados hoy","Booked":"Agendados","Showed":"Asistieron","Closed":"Cerrados","APPOINTMENTS · SCAN QR TO ADVANCE":"CITAS · ESCANEA QR PARA AVANZAR","CONFIRMED → ARRIVED → SOLD":"CONFIRMADO → LLEGÓ → VENDIDO","TODAY'S SCHEDULE":"AGENDA DE HOY","YOUR LISTINGS":"TUS PUBLICACIONES","Jump into chat":"Entrar al chat","Add a listing":"Agregar publicación","Pull it in automatically, or add one by hand. CarNimbus does the rest.":"Impórtalo automáticamente o agrégalo a mano. CarNimbus hace el resto.","From your website":"Desde tu sitio web","We scrape & sync your live inventory":"Extraemos y sincronizamos tu inventario en vivo","Coming soon":"Próximamente","Upload CSV":"Subir CSV","Drop your DMS export":"Suelta tu exportación del DMS","Forward GM email":"Reenvía el correo del gerente","CSV PREVIEW · FIRST 10 ROWS":"VISTA PREVIA CSV · PRIMERAS 10 FILAS","OR ADD ONE BY HAND":"O AGRÉGALO A MANO","YEAR":"AÑO","PRICE/MO":"PRECIO/MES","MODEL":"MODELO","TRIM":"VERSIÓN","MILEAGE":"KILOMETRAJE","DRIVETRAIN":"TRACCIÓN","PHOTO URL":"URL DE FOTO","DESCRIPTION · GIVES THE CAR ITS PERSONALITY":"DESCRIPCIÓN · LE DA PERSONALIDAD AL AUTO","Cancel":"Cancelar","Publish":"Publicar","Scan the rider's pass":"Escanea el pase del cliente","Point at the rider's Drive Now Pass.":"Apunta al Pase Drive Now del cliente.","Desk code":"Código de mostrador","Check in":"Registrar","Console updating…":"Actualizando consola…","Year, make, model and price/mo are required.":"Año, marca, modelo y precio/mes son obligatorios.","Sign in first — use your dealer phone number.":"Inicia sesión primero — usa tu número de concesionario.","Couldn't publish — try again.":"No se pudo publicar — inténtalo de nuevo.","Empty CSV — need a header row plus data.":"CSV vacío — necesita una fila de encabezado más datos.","Console is for active Drive Now partners.":"La consola es para socios activos de Drive Now.",
"What are you driving now?":"¿Qué manejas ahora?","Skip if nothing — all optional.":"Omite si nada — todo es opcional.","Year":"Año","Make":"Marca","Model":"Modelo","Miles":"Millas","Trade it in?":"¿Lo das a cuenta?","Rough value? (your guess — we appraise later)":"¿Valor aproximado? (tu cálculo — lo tasamos después)","Yes":"Sí","Maybe":"Quizás","No":"No","When do you need it?":"¿Para cuándo lo necesitas?","This week":"Esta semana","This month":"Este mes","1–3 months":"1–3 meses","Just looking":"Solo mirando","Body style?":"¿Tipo de carrocería?","Surprise me":"Sorpréndeme","Must-haves? (up to 3)":"¿Imprescindibles? (hasta 3)","3rd row":"3ª fila","Panoramic roof":"Techo panorámico","Tow package":"Paquete de remolque","Heated seats":"Asientos calefaccionados","Low miles":"Pocas millas"} };
  var langS=(typeof signal==="function"?signal:function(v){var f=function(x){if(arguments.length)v=x;return v;};return f;})("en");
  var effectFn=(typeof effect==="function"?effect:function(fn){fn();});   // graceful fallback if signals.js absent
  var ORIG=new WeakMap(), BOOT=Date.now();
  function CUR(){ return langS(); }
  function L(s){ return CUR()==="es" && I18N.es[s] ? I18N.es[s] : s; }
  function go(href){ location.href=href; }
  function norm(t){ return (t||"").replace(/\s+/g," ").trim().toLowerCase().replace(/[→»]/g,"").trim(); }
  var NAV = { "how it works":"/#how-it-works","browse":"/browse","about":"/about","contact":"/contact","sign in":"https://app.carnimbus.com/signin" };
  var CTA_WAIT = ["join waitlist","get early access","be first in line","join the waitlist","sign up"];
  function destFor(el){
    if(el.closest(".wl-form")) return null;
    var t=norm(el.textContent);
    if(NAV[t]) return NAV[t];
    if(CTA_WAIT.indexOf(t)>=0) return "/waitlist";
    if(t==="view all" || el.classList.contains("vcta")) return "/browse";
    if(t==="email the team") return "mailto:partner@carnimbus.com";
    return null;
  }
  function stampNav(){ document.querySelectorAll(".navlink,.btn,.vcta,span,a").forEach(function(el){
    if(el.dataset.cngo) return; var d=destFor(el); if(d) el.dataset.cngo=d; }); }
  function wireNav(){ document.body.addEventListener("click", function(ev){
    var seg=ev.target.closest(".seg button");
    if(seg){ setLang(norm(seg.textContent)==="es"?"es":"en"); return; }
    var g=ev.target.closest("[data-cngo]"); if(g){ ev.preventDefault(); go(g.dataset.cngo); } }); }
  function wireBurger(){
    return;   // hamburger nav removed per design — header keeps Log in + EN/ES only
    var hdr=document.querySelector("header")||document.querySelector(".z.row"); if(!hdr||document.querySelector(".nav-burger")) return;
    var right=hdr.querySelector('[style*="margin-left:auto"]')||hdr;
    var b=document.createElement("button"); b.className="nav-burger"; b.setAttribute("aria-label","Menu"); b.setAttribute("aria-expanded","false");
    b.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
    right.appendChild(b);
    var d=document.createElement("div"); d.className="nav-drawer";
    d.innerHTML='<a class="navlink" data-cngo="/#how-it-works">'+L("How it works")+'</a><a class="navlink" data-cngo="/browse">'+L("Browse")+'</a><a class="navlink" data-cngo="/about">'+L("About")+'</a><a class="navlink" data-cngo="/contact">'+L("Contact")+'</a><div class="seg" style="margin:12px 0 0;align-self:flex-start"><button'+(CUR()==="en"?' class="on"':'')+'>EN</button><button'+(CUR()==="es"?' class="on"':'')+'>ES</button></div><a class="btn primary" data-cngo="https://app.carnimbus.com/signin" style="text-decoration:none">'+L("Sign in")+'</a>';
    document.body.appendChild(d);
    function close(){ d.classList.remove("open"); b.setAttribute("aria-expanded","false"); }
    b.addEventListener("click",function(e){ e.stopPropagation(); var o=d.classList.toggle("open"); b.setAttribute("aria-expanded",o?"true":"false"); });
    d.addEventListener("click",function(){ setTimeout(close,50); });
    document.addEventListener("click",function(e){ if(!d.contains(e.target)&&e.target!==b) close(); });
    document.addEventListener("keydown",function(e){ if(e.key==="Escape") close(); });
  }
  function initials(name){ return String(name||"").trim().split(/\s+/).map(function(w){return w[0]||"";}).join("").slice(0,2).toUpperCase()||"CN"; }
  function wireAppNav(){
    var el=document.getElementById("appnav"); if(!el) return;
    el.style.zIndex="70";   // lift the whole bar above sibling .z layers so the dropdown is actually clickable
    var here=location.pathname;
    el.innerHTML='<a href="https://app.carnimbus.com/feed" aria-label="CarNimbus home" style="display:inline-flex;align-items:center;gap:8px">'+
      '<img src="/assets/logo.png" alt="" style="width:26px;height:26px"><b style="font:700 14px \'Space Grotesk\';color:#fff">CarNimbus</b></a>'+
      '<div class="row" style="margin-left:auto;align-items:center;gap:10px">'+
      '<div class="seg"><button class="on">EN</button><button>ES</button></div>'+
      '<div style="position:relative"><button class="avatar" style="width:28px;height:28px;font-size:11px;border:none;cursor:pointer" id="appnav-av" aria-label="Account menu">·</button>'+
      '<div id="appnav-menu" style="display:none;position:absolute;right:0;top:34px;z-index:60;min-width:160px;background:rgba(6,16,40,.98);border:1px solid rgba(24,200,255,.2);border-radius:12px;padding:6px">'+
        '<a href="https://app.carnimbus.com/edit-profile" style="display:block;padding:9px 11px;font:600 12px Manrope;color:#e2e9f2;text-decoration:none">Edit my profile</a>'+
        '<button id="appnav-out" type="button" style="display:block;width:100%;text-align:left;padding:9px 11px;font:600 12px Manrope;color:#e2e9f2;background:none;border:none;cursor:pointer">Sign out</button>'+
      '</div></div></div>';
    function paintAv(d){ if(!d||!d.ok)return; var av=document.getElementById("appnav-av"); if(!av)return;
      if(d.avatar) av.innerHTML='<img src="'+d.avatar+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
      else av.textContent=initials(d.handle); }
    try{ var cme=sessionStorage.cn_me; if(cme)paintAv(JSON.parse(cme)); }catch(_){}   // instant paint from cache
    fetch("/api/me").then(function(r){return r.json();}).then(function(d){
      paintAv(d); try{ sessionStorage.cn_me=JSON.stringify({ok:d.ok,avatar:d.avatar,handle:d.handle}); }catch(_){}
    }).catch(function(){});
    var av=document.getElementById("appnav-av"), mn=document.getElementById("appnav-menu");
    if(av&&mn){ av.addEventListener("click",function(e){e.stopPropagation();mn.style.display=mn.style.display==="block"?"none":"block";});
      document.addEventListener("click",function(){mn.style.display="none";});
      // Delegate menu clicks: navigate explicitly so nothing (overlay, re-render, bubbling) can eat the tap.
      mn.addEventListener("click",function(e){ e.stopPropagation();
        var out=e.target.closest("#appnav-out");
        if(out){ var bye=function(){ try{sessionStorage.clear();}catch(_){ } location.replace("https://carnimbus.com/"); };
          fetch("/api/logout",{method:"POST"}).then(bye).catch(bye); return; }
        var a=e.target.closest("a"); if(a&&a.href){ e.preventDefault(); location.href=a.href; } }); }
  }
  function wireTabbar(){
    if(!document.getElementById("appnav")||document.querySelector(".tabbar")) return;
    var here=location.pathname;
    var T=[["Feed","https://app.carnimbus.com/feed","feed",'<path d="M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5"/>'],
           ["Chat","https://app.carnimbus.com/chat","chat",'<path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z"/>'],
           ["Profile","https://app.carnimbus.com/profile","profile",'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>']];
    var bar=document.createElement("nav"); bar.className="tabbar"; bar.setAttribute("aria-label","App");
    bar.innerHTML=T.map(function(t){ var key=t[2];
      var on=here.indexOf("/"+key)>-1||(key==="chat"&&(here.indexOf("/car")>-1||here.indexOf("/talk")>-1))||(key==="profile"&&here.indexOf("/you")>-1);
      return '<a class="tab'+(on?' on':'')+'" href="'+t[1]+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+t[3]+'</svg>'+t[0]+'</a>'; }).join('');
    document.body.appendChild(bar);
  }
  function wireForms(){ document.querySelectorAll(".wl-form").forEach(function(f){
    if(f.dataset.wired) return; f.dataset.wired="1";
    // returning visitor: show joined card instead of the form
    var joined; try{ joined=localStorage.cn_joined; }catch(_){ }
    if(joined){ renderDone(f,true,false); return; }
    f.addEventListener("submit", async function(e){ e.preventDefault();
      var pEl=f.querySelector('input[type=tel]');
      var phone=(pEl&&pEl.value||"").replace(/\D/g,""); if(phone.length===11&&phone[0]==="1")phone=phone.slice(1);
      var consentEl=f.querySelector(".wl-consent"), consent=consentEl?consentEl.checked===true:true;
      var privEl=f.querySelector(".wl-privacy"), priv=privEl?privEl.checked===true:true;
      clearErr(f);
      if(!/^[2-9]\d{9}$/.test(phone)){ return err(f,pEl,L("That number doesn't look right — 10 digits, US for now.")); }
      if(privEl && !priv){ var pl=privEl.closest(".consent"); if(pl)pl.classList.add("invalid"); privEl.focus();
        return err(f,null,L("Please agree to the Privacy Policy to continue.")); }
      if(consentEl && !consent){ var cl=consentEl.closest(".consent"); if(cl)cl.classList.add("invalid"); consentEl.focus();
        return err(f,null,L("Please check the SMS consent box — that's how we text you.")); }
      var token=(f.querySelector('[name=cf-turnstile-response]')||{}).value||"";
      var hp=(f.querySelector('[name=website]')||{}).value||"";
      var btn=f.querySelector("button[type=submit]");
      if(btn){ btn.dataset.orig=btn.dataset.orig||btn.textContent; btn.disabled=true; btn.classList.add("loading"); btn.textContent=L("Joining…"); }
      var ERR={invalid_phone:"That number doesn't look right — 10 digits, US for now.",consent_required:"Please agree to the Privacy Policy to continue.",rate_limited:"Too many attempts — please try again later.",captcha:"Bot check failed — please retry.",forbidden:"Request blocked. Refresh and try again."};
      try{
        var res=await fetch("/api/waitlist",{method:"POST",headers:{"content-type":"application/json"},
          body:JSON.stringify({phone:"+1"+phone,lang:CUR(),consent:consent,privacy:priv,token:token,hp:hp,t:Date.now()-BOOT})});
        var d=await res.json();
        if(d.ok){ try{localStorage.cn_joined="1";}catch(_){ } renderDone(f,!!d.already,true); }
        else { reset(btn); err(f, pEl, L(ERR[d.error]||"Something went wrong — try again.")); }
      }catch(_){ reset(btn); err(f,null,L("Connection hiccup — check your signal and try again.")); }
    });
    function reset(btn){ if(btn){btn.disabled=false;btn.classList.remove("loading");btn.textContent=btn.dataset.orig||"Join Waitlist";} }
    function clearErr(f2){ var m=f2.querySelector(".wl-msg"); if(m)m.remove();
      f2.querySelectorAll(".invalid").forEach(function(x){x.classList.remove("invalid");}); }
    function err(f2,input,msg){ clearErr(f2);
      if(input){ input.classList.add("invalid"); input.classList.add("wl-shake");
        setTimeout(function(){input.classList.remove("wl-shake");},400); input.focus(); }
      var m=document.createElement("div"); m.className="wl-msg"; m.setAttribute("role","alert"); m.textContent=msg;
      f2.appendChild(m); }
    function renderDone(f2,already,focus){
      f2.innerHTML='<div class="wl-done" role="status" aria-live="polite" tabindex="-1">'+
        '<div class="wl-done-h">'+(already?L("You're already on the list. We'll text you."):L("You're in. One text at launch."))+'</div>'+
        '<div class="wl-done-p">'+L("We'll text you the day CarNimbus goes live in LA. That's it — reply STOP anytime.")+'</div>'+
        '<div class="wl-done-row"><a class="btn ghost sm" href="/browse" style="text-decoration:none">'+L("Browse the cars →")+'</a>'+
        '<button type="button" class="btn ghost sm wl-share">'+L("Share with a friend")+'</button></div></div>';
      var card=f2.querySelector(".wl-done"); if(card&&focus)card.focus();
      var sh=f2.querySelector(".wl-share"); if(sh)sh.addEventListener("click",function(){
        var txt="Skip the dealership games — carnimbus.com";
        if(navigator.share){ navigator.share({text:txt,url:"https://carnimbus.com"}).catch(function(){}); }
        else { try{navigator.clipboard.writeText(txt+" https://carnimbus.com"); sh.textContent=L("Copied ✓");}catch(_){} }
      });
    }
  }); }
  var _applying=false, _moTimer=null, _mo=null;
  function _retranslate(){
    if(_applying || _moTimer) return;
    _moTimer=setTimeout(function(){ _moTimer=null; if(CUR()!=="es") return;   // EN needs no re-walk (injected DOM is authored English)
      _applying=true; if(_mo)_mo.disconnect();
      try{ applyLang("es"); } finally { if(_mo)_mo.observe(document.body,{childList:true,subtree:true}); _applying=false; }
    },0);
  }
  function startI18nObserver(){ if(_mo||!document.body) return;
    _mo=new MutationObserver(_retranslate);
    _mo.observe(document.body,{childList:true,subtree:true});
  }
  function applyLang(lang){
    try{localStorage.cn_lang=lang;}catch(_){}
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
    document.querySelectorAll(".seg button").forEach(function(b){ b.classList.toggle("on", norm(b.textContent)===(lang==="es"?"es":"en")); });
  }
  function setLang(l){ langS(l==="es"?"es":"en"); }         // write signal → effect re-patches DOM
  function initI18n(){ var s; try{s=localStorage.cn_lang;}catch(_){}
    langS(s || ((navigator.language||"en").slice(0,2)==="es"?"es":"en"));
    effectFn(function(){ applyLang(langS()); });               // signal-driven; runs once + on every change
    startI18nObserver(); }                                     // re-translate JS-injected DOM (feed/match/chat cards)
  /* ===== CNMB-302/305: matched feed + car-personality chat ===== */
  function wireFeed(){
    var feedEl=document.getElementById("feed"); if(!feedEl) return;
    var empty=document.getElementById("feed-empty"); if(empty)empty.style.display="block";
    fetch("/api/feed").then(function(r){return r.json();}).then(function(d){
      if(empty)empty.style.display="none";
      if(!d.ok||!d.cars||!d.cars.length){ if(empty){empty.style.display="block";empty.innerHTML='No cars yet — check back soon.';} return; }
      if(!d.authed){ var cta=document.createElement("div");
        cta.style.cssText="grid-column:1/-1;text-align:center;padding:10px;font:600 12px Manrope;color:#aebfdf";
        cta.innerHTML='Showing newest cars. <a href="https://app.carnimbus.com/edit-profile" style="color:#18C8FF">Answer 10 quick questions</a> to unlock your ranked matches.';
        feedEl.appendChild(cta); }
      d.cars.forEach(function(c){
        var card=document.createElement("div");
        card.className="glass"; card.style.cssText="border-radius:16px;overflow:hidden;cursor:pointer;border:1px solid rgba(24,200,255,.18)";
        card.innerHTML=(c.photos&&c.photos[0]?'<img src="'+c.photos[0]+'" alt="'+c.year+' '+c.make+' '+c.model+'" width="400" height="130" loading="lazy" style="width:100%;height:130px;object-fit:cover;display:block">':'')+
          '<div style="padding:11px 13px">'+
          (c.match!=null?'<span class="badge cyan" style="float:right">'+c.match+'% match</span>':'')+
          '<div style="font:700 13px Manrope;color:#fff">'+c.year+' '+c.make+' '+c.model+(c.trim?' '+c.trim:'')+'</div>'+
          '<div style="font:600 11px Manrope;color:#8ca0c4;margin-top:3px">$'+c.price_mo+'/mo · $0 down · 72 mo · '+c.miles+' mi</div>'+
          '<div style="font:700 11px Manrope;color:#18C8FF;margin-top:7px">Talk to this car →</div></div>';
        card.addEventListener("click",function(){ if(location.pathname.indexOf("/browse")===0){
          var sg=function(s){return String(s||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");};
          location.href="/used/"+c.year+"-"+sg(c.make)+"-"+sg(c.model)+"-"+c.id;
        } else openCarChat(c); });
        feedEl.appendChild(card);
      });
    }).catch(function(){ if(empty){empty.style.display="block";empty.textContent="Feed unavailable — refresh to retry.";} });
  }
  function openCarChat(c){
    var old=document.getElementById("cn-chat"); if(old)old.remove();
    var wrap=document.createElement("div"); wrap.id="cn-chat";
    wrap.style.cssText="position:fixed;inset:0;background:rgba(3,10,28,.72);z-index:60;display:flex;align-items:flex-end;justify-content:center";
    wrap.innerHTML='<div style="width:100%;max-width:480px;max-height:82vh;background:#081b46;border:1px solid rgba(24,200,255,.3);border-radius:18px 18px 0 0;display:flex;flex-direction:column">'+
      '<div style="display:flex;align-items:center;gap:10px;padding:13px 16px;border-bottom:1px solid rgba(24,200,255,.14)">'+
      '<div style="font:700 13px Manrope;color:#fff;flex:1">'+c.year+' '+c.make+' '+c.model+'</div>'+
      '<button id="cn-chat-x" class="btn ghost sm" type="button">Close</button></div>'+
      '<div id="cn-thread" style="flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px"></div>'+
      '<div style="display:flex;gap:8px;padding:12px;border-top:1px solid rgba(24,200,255,.14)">'+
      '<label class="vh" for="cn-chat-in">Message the car</label>'+
      '<input id="cn-chat-in" class="pill" style="flex:1" placeholder="'+L("Ask me anything — I answer straight.")+'">'+
      '<button id="cn-chat-send" class="btn primary" type="button">'+L("Send")+'</button></div></div>';
    document.body.appendChild(wrap);
    var hist=[],thread=document.getElementById("cn-thread");
    function bubble(who,txt){ var b=document.createElement("div");
      b.style.cssText="max-width:82%;padding:9px 12px;border-radius:13px;font:500 12.5px/1.5 Manrope;"+
        (who==="you"?"align-self:flex-end;background:#0B63E5;color:#fff":"align-self:flex-start;background:rgba(24,200,255,.12);color:#e2e9f2");
      b.textContent=txt; thread.appendChild(b); thread.scrollTop=thread.scrollHeight; }
    bubble("car",L("Hey — I'm the")+" "+c.year+" "+c.make+" "+c.model+". "+L("Ask me anything, or tell me when you want to drive."));
    async function send(){ var inEl=document.getElementById("cn-chat-in"),msg=inEl.value.trim(); if(!msg)return;
      inEl.value=""; bubble("you",msg); hist.push({role:"user",content:msg});
      var r=await fetch("/api/car-chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({vdpId:c.id,messages:hist})});
      if(r.status===401){ bubble("car",L("Sign in first so I remember you —"));
        var a=document.createElement("a"); a.href="https://app.carnimbus.com/edit-profile"; a.textContent=L("create your profile"); a.style.cssText="align-self:flex-start;color:#18C8FF;font:700 12px Manrope"; thread.appendChild(a); return; }
      var d=await r.json();
      if(d.ok){ hist.push({role:"assistant",content:d.reply}); bubble("car",d.reply);
        if(d.pass){ var p=document.createElement("a"); p.href=d.pass; p.textContent="🎟️ "+L("Your Drive Now pass is ready →");
          p.style.cssText="align-self:flex-start;color:#18C8FF;font:700 12px Manrope"; thread.appendChild(p); } }
      else bubble("car",L("Static on the line — try that again.")); }
    document.getElementById("cn-chat-send").addEventListener("click",send);
    document.getElementById("cn-chat-in").addEventListener("keydown",function(e){if(e.key==="Enter")send();});
    document.getElementById("cn-chat-x").addEventListener("click",function(){wrap.remove();});
  }

  (function boot(){ var t=0, iv=setInterval(function(){
    if(!document.querySelector("x-import") || t++>150){ clearInterval(iv); stampNav(); wireNav(); wireBurger(); wireAppNav(); wireTabbar(); wireForms(); initI18n(); wireFeed();
      if(location.pathname.replace(/\/$/,"")==="/waitlist"&&matchMedia("(pointer:fine)").matches){var pi=document.querySelector("input[type=tel]");if(pi)pi.focus();}
    } },30); })();

})();
