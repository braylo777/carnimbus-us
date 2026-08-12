// app.carnimbus.us — the dealer's book. This is the landing page (app. root maps to /deals), so it
// answers one question on arrival: is anything waiting on me?
//
// ADJUDICATED rows are styled to stand out because they are the only state that is blocked on a
// human. Everything else is either moving or finished.
document.addEventListener("DOMContentLoaded", function () {
  function $(id) { return document.getElementById(id); }
  var msgEl = $("l-msg");
  function msg(t) { msgEl.textContent = t || ""; msgEl.style.display = t ? "block" : "none"; $("loading").style.display = "none"; }

  var CHIP = {
    DRAFT:       { bg: "rgba(255,255,255,.06)", bd: "rgba(255,255,255,.14)", fg: "#8ca0c4" },
    STAKED:      { bg: "rgba(24,200,255,.10)",  bd: "rgba(24,200,255,.40)",  fg: "#18C8FF" },
    TITLED:      { bg: "rgba(24,200,255,.10)",  bd: "rgba(24,200,255,.40)",  fg: "#18C8FF" },
    ADJUDICATED: { bg: "rgba(245,166,35,.14)",  bd: "rgba(245,166,35,.55)",  fg: "#f5a623" },
    SETTLED:     { bg: "rgba(52,199,123,.12)",  bd: "rgba(52,199,123,.45)",  fg: "#34c77b" },
    DISPUTED:    { bg: "rgba(224,64,64,.12)",   bd: "rgba(224,64,64,.45)",   fg: "#ff7a7a" }
  };
  var OPEN = { DRAFT: 1, STAKED: 1, TITLED: 1, ADJUDICATED: 1 };

  fetch("/api/app/deals", { credentials: "include" })
    .then(function (r) {
      if (r.status === 401) { location.href = "/signin?next=" + encodeURIComponent("/deals"); return null; }
      if (r.status === 403) { msg("Your account is pending — we'll email you when it's live."); return null; }
      return r.json();
    })
    .then(function (d) { if (d && d.ok) render(d.deals || []); else if (d) msg("Couldn't load your deals."); })
    .catch(function () { msg("Network problem — try again."); });

  function render(deals) {
    $("loading").style.display = "none";
    if (!deals.length) { $("empty").style.display = "block"; return; }

    var counts = {}, openValue = 0, waiting = 0;
    for (var i = 0; i < deals.length; i++) {
      counts[deals[i].state] = (counts[deals[i].state] || 0) + 1;
      if (OPEN[deals[i].state]) openValue += deals[i].offer_cents || 0;
      if (deals[i].state === "ADJUDICATED") waiting++;
    }

    var sum = $("summary");
    sum.style.display = "block";
    sum.textContent = "";
    var top = document.createElement("div");
    top.className = "row";
    top.style.cssText = "align-items:baseline";
    var lbl = document.createElement("div");
    lbl.className = "mono";
    lbl.style.cssText = "font-size:10px;color:#8ca0c4;letter-spacing:.20em";
    lbl.textContent = "OPEN VALUE";
    var val = document.createElement("div");
    val.className = "disp cy";
    val.style.cssText = "font-size:20px;font-weight:800;margin-left:auto";
    val.textContent = window.cnUsd(openValue);
    top.appendChild(lbl); top.appendChild(val);
    sum.appendChild(top);

    if (waiting) {
      var w = document.createElement("div");
      w.style.cssText = "font:700 12px Manrope;color:#f5a623;margin-top:8px";
      w.textContent = waiting + (waiting === 1 ? " deal is" : " deals are") + " waiting on your approval.";
      sum.appendChild(w);
    }

    var chips = document.createElement("div");
    chips.className = "row";
    chips.style.cssText = "gap:6px;flex-wrap:wrap;margin-top:10px";
    for (var st in counts) {
      if (!Object.prototype.hasOwnProperty.call(counts, st)) continue;
      var c = CHIP[st] || CHIP.DRAFT;
      var ch = document.createElement("div");
      ch.className = "mono";
      ch.style.cssText = "font-size:9px;letter-spacing:.12em;padding:3px 8px;border-radius:999px;background:" + c.bg + ";border:1px solid " + c.bd + ";color:" + c.fg;
      ch.textContent = st + " " + counts[st];
      chips.appendChild(ch);
    }
    sum.appendChild(chips);

    var list = $("list");
    list.textContent = "";
    for (var j = 0; j < deals.length; j++) list.appendChild(row(deals[j]));
  }

  function row(d) {
    var c = CHIP[d.state] || CHIP.DRAFT;
    var a = document.createElement("a");
    a.className = "glass";
    a.href = "/deal?id=" + d.id;
    a.style.cssText = "display:block;text-decoration:none;padding:13px 14px;border-radius:16px;margin-bottom:9px;" +
      (d.state === "ADJUDICATED" ? "border:1px solid rgba(245,166,35,.45)" : "");

    var t = document.createElement("div");
    t.className = "row";
    t.style.cssText = "align-items:baseline";
    var name = document.createElement("div");
    name.style.cssText = "font:700 14px Manrope;color:#e2e9f2";
    name.textContent = window.cnCarName({ year: d.year, make: d.make, model: d.model });
    var amt = document.createElement("div");
    amt.className = "disp";
    amt.style.cssText = "font-size:15px;font-weight:700;color:#e2e9f2;margin-left:auto";
    amt.textContent = window.cnUsd(d.offer_cents);
    t.appendChild(name); t.appendChild(amt);

    var b = document.createElement("div");
    b.className = "row";
    b.style.cssText = "align-items:center;margin-top:7px;gap:8px";
    var chip = document.createElement("div");
    chip.className = "mono";
    chip.style.cssText = "font-size:9px;letter-spacing:.12em;padding:3px 8px;border-radius:999px;background:" + c.bg + ";border:1px solid " + c.bd + ";color:" + c.fg;
    chip.textContent = d.state;
    var vin = document.createElement("div");
    vin.className = "mono";
    vin.style.cssText = "font-size:10px;color:#8ca0c4;letter-spacing:.08em";
    vin.textContent = "…" + String(d.vin || "").slice(-8);
    var when = document.createElement("div");
    when.className = "mono";
    when.style.cssText = "font-size:9px;color:#5c6f92;letter-spacing:.08em;margin-left:auto";
    when.textContent = String(d.created_at || "").slice(0, 10);
    b.appendChild(chip); b.appendChild(vin); b.appendChild(when);

    a.appendChild(t); a.appendChild(b);
    return a;
  }
});
