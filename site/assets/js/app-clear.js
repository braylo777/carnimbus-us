// app.carnimbus.us/clear — the dealer's queue, and app. root.
//
// One rule governs this whole screen: EVERY CARD SHOWS ITS EVIDENCE. A dealer told to drop $115/mo
// gets to see the 31 searches that produced the number. A recommendation that cannot show its work
// is one a dealer correctly ignores, and they decide whether to trust this surface exactly once.
document.addEventListener("DOMContentLoaded", function () {
  function $(id) { return document.getElementById(id); }
  function usd(n) { return "$" + Math.round(n).toLocaleString("en-US"); }
  function el(tag, css, text) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }
  var msgEl = $("c-msg");
  function msg(t) { msgEl.textContent = t || ""; msgEl.style.display = t ? "block" : "none"; }

  var DOT = { high: "●●●", medium: "●●○", low: "●○○" };
  var COL = { high: "#34c77b", medium: "#f5a623", low: "#8ca0c4" };

  function load() {
    fetch("/api/app/clear", { credentials: "include" })
      .then(function (r) {
        if (r.status === 401) { location.href = "/signin?next=" + encodeURIComponent("/clear"); return null; }
        if (r.status === 403) { msg("Your account is pending — we'll email you when it's live."); return null; }
        return r.json();
      })
      .then(function (d) {
        $("loading").style.display = "none";
        if (!d) return;
        if (!d.ok) { msg("Couldn't read demand right now."); return; }
        // The server explains an empty queue rather than leaving a blank screen — "not enough
        // searches yet" and "your units have no lot date" are different problems with different owners.
        if (!(d.recs || []).length && d.note) {
          var e = $("empty");
          e.textContent = "";
          e.appendChild(el("div", "font:700 17px Manrope;color:#e2e9f2", "Nothing to clear right now."));
          e.appendChild(el("div", "font:500 12px/1.7 Manrope;color:#8ca0c4;margin-top:8px;max-width:320px;margin-left:auto;margin-right:auto", d.note));
        }
        render(d.recs || []);
      })
      .catch(function () { $("loading").style.display = "none"; msg("Network problem — try again."); });
  }

  function render(recs) {
    var list = $("list");
    list.textContent = "";
    $("count").textContent = recs.length ? recs.length + (recs.length === 1 ? " UNIT" : " UNITS") : "";
    if (!recs.length) { $("empty").style.display = "block"; return; }
    $("empty").style.display = "none";
    for (var i = 0; i < recs.length; i++) list.appendChild(card(recs[i]));
  }

  function card(r) {
    var wrap = el("div", "border-radius:18px;margin-bottom:12px;padding:14px;background:rgba(255,255,255,.03);border:1px solid " +
      (r.confidence === "high" ? "rgba(52,199,123,.40)" : "rgba(24,200,255,.16)"));

    var name = el("div", "font:800 15px Manrope;color:#e2e9f2",
      [r.year, r.make, r.model, r.trim].filter(Boolean).join(" "));
    wrap.appendChild(name);

    var meta = el("div", "display:flex;align-items:center;gap:8px;margin-top:5px");
    var conf = el("div", "font:700 9px Manrope;letter-spacing:.12em;color:" + COL[r.confidence],
      DOT[r.confidence] + " " + String(r.confidence).toUpperCase());
    var age = el("div", "font:600 10px Manrope;color:#8ca0c4;margin-left:auto", "day " + r.age_days);
    meta.appendChild(conf); meta.appendChild(age);
    wrap.appendChild(meta);

    // THE EVIDENCE. Not a summary of it — the actual counts the number came from.
    var ev = el("div", "font:500 12px/1.7 Manrope;color:#aebfdf;margin-top:10px;padding:10px 12px;border-radius:12px;background:rgba(24,200,255,.05)");
    ev.appendChild(el("div", "color:#e2e9f2;font-weight:700",
      r.unserved + " unserved " + (r.unserved === 1 ? "search" : "searches") + " in " + r.zip3 + "xx this week"));
    ev.appendChild(el("div", null, r.segment + " · " + r.band + " · from " + r.cell_scans + " total searches"));
    wrap.appendChild(ev);

    var rows = [
      ["Their median", usd(r.p50) + "/mo"],
      ["You're listed at", usd(r.listed_mo) + "/mo"]
    ];
    for (var i = 0; i < rows.length; i++) {
      var row = el("div", "display:flex;align-items:baseline;margin-top:7px");
      row.appendChild(el("div", "font:500 12px Manrope;color:#8ca0c4", rows[i][0]));
      row.appendChild(el("div", "font:700 13px Manrope;color:#e2e9f2;margin-left:auto", rows[i][1]));
      wrap.appendChild(row);
    }

    var rec = el("div", "margin-top:11px;padding-top:11px;border-top:1px solid rgba(255,255,255,.08);font:600 12px/1.6 Manrope;color:#18C8FF",
      "→ " + usd(r.suggested_mo) + "/mo puts you in " + r.reachable + " of those " + r.unserved + " result sets");
    wrap.appendChild(rec);

    var actions = el("div", "display:flex;gap:8px;margin-top:12px");
    var repriceBtn = el("button", "flex:2");
    repriceBtn.className = "btn primary sm";
    repriceBtn.type = "button";
    repriceBtn.textContent = "Reprice " + usd(r.suggested_mo);
    var scanLink = el("a", "flex:1;text-decoration:none;justify-content:center");
    scanLink.className = "btn ghost sm";
    scanLink.href = "/offer?vin=" + encodeURIComponent(r.vin);
    scanLink.textContent = "Sell it";
    var skipBtn = el("button", "flex:0 0 auto");
    skipBtn.className = "btn ghost sm";
    skipBtn.type = "button";
    skipBtn.textContent = "Skip";
    actions.appendChild(repriceBtn); actions.appendChild(scanLink); actions.appendChild(skipBtn);
    wrap.appendChild(actions);

    // A skip without a reason is noise; with one it is training signal. So the reason is required.
    var skipBox = el("div", "display:none;margin-top:10px");
    var why = document.createElement("textarea");
    why.className = "field"; why.rows = 2; why.style.width = "100%";
    why.placeholder = "Why not? (sold, priced right, wrong segment…)";
    var skipGo = el("button", "width:100%;margin-top:8px");
    skipGo.className = "btn ghost sm"; skipGo.type = "button"; skipGo.textContent = "Submit";
    skipBox.appendChild(why); skipBox.appendChild(skipGo);
    wrap.appendChild(skipBox);

    skipBtn.addEventListener("click", function () {
      skipBox.style.display = skipBox.style.display === "none" ? "block" : "none";
    });
    skipGo.addEventListener("click", function () {
      var reason = (why.value || "").trim();
      if (!reason) return msg("Tell us why — it's how the recommendations get better.");
      skipGo.classList.add("loading");
      post("/api/app/rec-skip", { vdp_id: r.vdp_id, reason: reason }, skipGo, function () { wrap.remove(); bump(); });
    });
    repriceBtn.addEventListener("click", function () {
      repriceBtn.classList.add("loading");
      post("/api/app/reprice", { vdp_id: r.vdp_id, price_mo: r.suggested_mo }, repriceBtn, function () {
        wrap.style.borderColor = "rgba(52,199,123,.5)";
        actions.textContent = "";
        actions.appendChild(el("div", "font:700 12px Manrope;color:#34c77b", "Repriced to " + usd(r.suggested_mo) + "/mo · live now"));
        skipBox.style.display = "none";
      });
    });

    return wrap;
  }

  function bump() {
    var n = $("list").children.length;
    $("count").textContent = n ? n + (n === 1 ? " UNIT" : " UNITS") : "";
    if (!n) $("empty").style.display = "block";
  }

  function post(path, body, btn, ok) {
    msg("");
    fetch(path, {
      method: "POST", credentials: "include",
      headers: { "content-type": "application/json" }, body: JSON.stringify(body)
    }).then(function (r) {
      if (r.status === 401) { location.href = "/signin"; return null; }
      if (r.status === 403) { btn.classList.remove("loading"); msg("Your account is pending."); return null; }
      return r.json();
    }).then(function (d) {
      btn.classList.remove("loading");
      if (!d) return;
      if (d.ok) return ok();
      if (d.error === "reason_required") return msg("Tell us why — it's how the recommendations get better.");
      if (d.error === "not_found") return msg("That unit is no longer active.");
      msg("That didn't go through — try again.");
    }).catch(function () { btn.classList.remove("loading"); msg("Network problem — try again."); });
  }

  load();
});
