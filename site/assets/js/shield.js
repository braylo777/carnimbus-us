/* CarNimbus shield — copy/screenshot deterrents + per-session tracing watermark.
   Honest scope: this raises effort and traces leaks; it cannot stop a phone photo or PrintScreen. */
(function(){
  "use strict";
  function inField(t){ return t && (t.closest && t.closest("input,textarea,select,[contenteditable]")); }
  ["contextmenu","dragstart","copy","cut"].forEach(function(ev){
    document.addEventListener(ev,function(e){ if(!inField(e.target)) e.preventDefault(); }, {capture:true});
  });
  document.addEventListener("selectstart",function(e){ if(!inField(e.target)) e.preventDefault(); }, {capture:true});

  // user-select off for non-form content + print blocker + veil styles
  var st=document.createElement("style");
  st.textContent="body{-webkit-user-select:none;user-select:none}"+
    "input,textarea,select,[contenteditable]{-webkit-user-select:text;user-select:text}"+
    "img{-webkit-user-drag:none;user-drag:none}"+
    "@media print{body{display:none!important}}"+
    "#cn-wm{position:fixed;inset:0;z-index:2147483000;pointer-events:none;opacity:.04;overflow:hidden}";
  document.head.appendChild(st);

  // per-session diagonal watermark id (the one genuinely useful anti-leak layer).
  // cn_anon is HttpOnly (unreadable to JS by design), so mint a stable client-side trace id instead.
  function anon(){ try{ var k=localStorage.cn_wm; if(k) return k;
      var g=(self.crypto&&crypto.getRandomValues)?[].slice.call(crypto.getRandomValues(new Uint8Array(6))).map(function(b){return(b%36).toString(36);}).join(""):String(Date.now().toString(36));
      localStorage.cn_wm=g; return g; }catch(_){ return "session"; } }
  var wm=document.createElement("div"); wm.id="cn-wm";
  var tag="CarNimbus · "+anon();
  var rows=[]; for(var i=0;i<40;i++){ rows.push('<div style="white-space:nowrap;transform:rotate(-30deg);'+
    'font:700 20px system-ui;letter-spacing:2px;color:#18C8FF;line-height:120px">'+
    (tag+" &nbsp; ").repeat(12)+'</div>'); }
  wm.innerHTML=rows.join("");
  (document.body||document.documentElement).appendChild(wm);

  // (removed) devtools veil: the window-size heuristic false-positives on mobile browser chrome
  // (top status bar + bottom URL bar exceed the threshold), bricking real phone users, and devtools
  // detection is trivially bypassed anyway. Copy/drag deterrents + the leak watermark stay.

  // invisible Turnstile widget — only when a sitekey is configured
  var sk=(document.querySelector('meta[name="cf-turnstile-sitekey"]')||{}).content||"";
  if(sk){ var d=document.createElement("div"); d.className="cf-turnstile";
    d.setAttribute("data-sitekey",sk); d.setAttribute("data-size","invisible");
    var f=document.getElementById("lead-form"); if(f) f.appendChild(d); }
})();
