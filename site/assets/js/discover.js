document.addEventListener("DOMContentLoaded",function(){
  var CARS=[],i=0;
  function show(){var c=CARS[i];if(!c)return;
    var im=document.getElementById("d-img");im.style.display="block";im.src=(c.photos&&c.photos[0])||"";
    document.getElementById("d-thumb").src=(c.photos&&c.photos[0])||"";
    document.getElementById("d-title").innerHTML=c.year+" "+c.make+" "+c.model+" · <span class='cy'>$"+c.price_mo+"/mo</span>";
    document.getElementById("d-talk").href="/app/car.html?id="+c.id;
    // MOCK DISPLAY (B-04): like-count is framework data, not live engagement. Replace when real.
    document.getElementById("d-likes").textContent=(3+((c.id*7)%9))+"."+((c.id*3)%10)+"K";
    document.getElementById("d-match").textContent=(c.match!=null?c.match+"%":"NEW");}
  function dEmpty(t,retry){var e=document.getElementById("d-empty");if(!e)return;
    e.textContent=t;e.style.display="grid";
    if(retry)e.onclick=function(){e.style.display="none";e.onclick=null;retry();};}
  function loadFeed(){
    fetch("/api/feed").then(function(r){return r.json();}).then(function(d){
      CARS=d.cars||[];
      if(!CARS.length)return dEmpty("No cars in your area yet — we're onboarding dealers now. 🚗");
      show();
    }).catch(function(){dEmpty("Couldn't load the feed — tap to retry.",loadFeed);});
  }
  loadFeed();
  function step(n){if(!CARS.length)return;i=(i+n+CARS.length)%CARS.length;show();}
  document.getElementById("d-prev").addEventListener("click",function(){step(-1);});
  document.getElementById("d-next").addEventListener("click",function(){step(1);});
  var x0=null,el=document.getElementById("disc");
  el.addEventListener("touchstart",function(e){x0=e.touches[0].clientX;},{passive:true});
  el.addEventListener("touchend",function(e){if(x0===null)return;var dx=e.changedTouches[0].clientX-x0;
    if(Math.abs(dx)>50)step(dx<0?1:-1);x0=null;},{passive:true});
});
