// O1: briefly highlight a tapped city chip in the trust-band marquee (pause-on-hover is pure CSS). External for CSP.
document.addEventListener("click",function(e){ var c=e.target.closest(".citychip"); if(!c)return;
  c.classList.add("flash"); setTimeout(function(){ c.classList.remove("flash"); },600); });
