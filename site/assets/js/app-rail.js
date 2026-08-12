// Shared five-step settlement rail. Used by /title and /deal so the dealer sees the same object in
// the same shape on both screens — a progress indicator that changes appearance between pages reads
// as two different processes.
//
// Exposed on window because this codebase has no module loader on the client side (no build step).
(function () {
  var STEPS = ["DRAFT", "STAKED", "TITLED", "ADJUDICATED", "SETTLED"];
  var LABEL = { DRAFT: "Draft", STAKED: "Staked", TITLED: "Titled", ADJUDICATED: "Reviewed", SETTLED: "Settled" };

  // DISPUTED is terminal and is NOT a step on the rail. Rendering it as "step 6" would imply the
  // deal is progressing toward something; it is not.
  window.cnRenderRail = function (el, state) {
    if (!el) return;
    el.textContent = "";
    if (state === "DISPUTED") {
      var d = document.createElement("div");
      d.style.cssText = "flex:1;padding:8px 10px;border-radius:10px;background:rgba(224,64,64,.12);border:1px solid rgba(224,64,64,.45);font:800 11px Manrope;color:#ff7a7a;letter-spacing:.10em;text-align:center";
      d.textContent = "DISPUTED — FUNDS RELEASED BACK";
      el.appendChild(d);
      return;
    }
    var at = STEPS.indexOf(state);
    if (at < 0) at = 0;
    for (var i = 0; i < STEPS.length; i++) {
      var s = document.createElement("div");
      var done = i < at, now = i === at;
      s.style.cssText = "flex:1;padding:6px 2px;border-radius:8px;text-align:center;font:700 9px Manrope;letter-spacing:.06em;" +
        (now ? "background:rgba(24,200,255,.18);border:1px solid rgba(24,200,255,.6);color:#18C8FF;"
             : done ? "background:rgba(24,200,255,.06);border:1px solid rgba(24,200,255,.20);color:#6f8bb0;"
                    : "background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);color:#4e5f7d;");
      s.textContent = LABEL[STEPS[i]];
      el.appendChild(s);
    }
  };

  window.cnUsd = function (cents) {
    if (cents == null) return "—";
    return "$" + Math.round(cents / 100).toLocaleString("en-US");
  };

  window.cnCarName = function (dec) {
    dec = dec || {};
    var n = [dec.year, dec.make, dec.model, dec.trim].filter(function (x) { return x; }).join(" ");
    return n || "Unidentified unit";
  };
})();
