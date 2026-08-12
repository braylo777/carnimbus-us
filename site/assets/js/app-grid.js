// app.carnimbus.us/grid — the v15 board. Every active unit, placed by down payment × monthly.
//
// TAP TO PLACE, NOT DRAG. This is a 440px phone surface used standing on a lot, and HTML5 drag is
// unusable there — no touch support without a polyfill, and a long-press drag fights the browser's
// own scroll. Tap a unit to pick it up, tap a cell to drop it. Two taps, no gesture to learn.
//
// The board never prices anything. It shows where a unit sits and moves it where the dealer says.
// Per v15: mispricing is the dealer's, and this screen makes it visible rather than preventing it.
document.addEventListener("DOMContentLoaded", function () {
  function $(id) { return document.getElementById(id); }
  function usd(n) { return "$" + Math.round(n).toLocaleString("en-US"); }
  function el(tag, css, text) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;   // textContent, never innerHTML — these are dealer strings
    return e;
  }
  var msgEl = $("g-msg");
  function msg(t) { msgEl.textContent = t || ""; msgEl.style.display = t ? "block" : "none"; }

  var DATA = null;      // last /api/dealer/grid payload
  var HOLDING = null;   // the unit picked up, waiting for a cell
  var OPEN = null;      // which cell's unit list is expanded

  // Age drives the whole product, so it drives the color. Absent is its own state — a unit with no
  // lot date is not "new", it is unknown, and saying so is the only honest option.
  function ageColor(d) {
    if (d == null) return "#8ca0c4";
    return d >= 90 ? "#ff6b6b" : d >= 60 ? "#f5a623" : d >= 30 ? "#e2e9f2" : "#34c77b";
  }
  function ageLabel(d) { return d == null ? "no date" : d + "d"; }

  function cellKey(c) { return c.down + "x" + c.monthly; }

  function render() {
    var board = $("board");
    board.textContent = "";
    if (!DATA) return;

    var total = 0;
    for (var i = 0; i < DATA.cells.length; i++) total += DATA.cells[i].units.length;
    $("count").textContent = total + (total === 1 ? " UNIT" : " UNITS");
    if (!total) { $("empty").style.display = ""; return; }
    $("empty").style.display = "none";

    // `approx` is how many units are in a cell only because the server rounded them there. Saying so
    // is the difference between a board a dealer trusts and one they quietly stop believing.
    var ax = $("approx");
    if (DATA.approx > 0) {
      ax.textContent = DATA.approx + " of " + total + " units are placed by rounding, not by you. " +
        "Their listed payment is whatever it was before — tap one and drop it in a cell to make it real.";
      ax.style.display = "";
    } else { ax.style.display = "none"; }

    // Header row: monthly across the top.
    var grid = el("div", "display:grid;grid-template-columns:44px repeat(" + DATA.monthly.length + ",1fr);gap:6px");
    grid.appendChild(el("div", ""));
    DATA.monthly.forEach(function (m) {
      grid.appendChild(el("div", "font:700 11px Manrope;color:#8ca0c4;text-align:center;padding-bottom:2px", usd(m) + "/mo"));
    });

    DATA.down.forEach(function (d) {
      grid.appendChild(el("div", "font:700 11px Manrope;color:#8ca0c4;display:flex;align-items:center", usd(d)));
      DATA.monthly.forEach(function (m) {
        var cell = DATA.cells.filter(function (c) { return c.down === d && c.monthly === m; })[0] || { down: d, monthly: m, units: [] };
        var k = cellKey(cell);
        var live = HOLDING ? "border-color:rgba(24,200,255,.55);background:rgba(24,200,255,.10)" : "";
        var isOpen = OPEN === k;
        var b = el("button",
          "appearance:none;cursor:pointer;border:1px solid rgba(24,200,255,.18);border-radius:10px;" +
          "background:" + (isOpen ? "rgba(24,200,255,.14)" : "rgba(255,255,255,.03)") + ";" +
          "color:#e2e9f2;padding:10px 4px;min-height:56px;display:flex;flex-direction:column;" +
          "align-items:center;justify-content:center;gap:2px;" + live);
        b.type = "button";
        b.appendChild(el("div", "font:700 17px Manrope;line-height:1", String(cell.units.length)));
        // Oldest unit in the cell is the reason to look at the cell at all.
        var oldest = null;
        cell.units.forEach(function (u) { if (u.days_on_lot != null && (oldest == null || u.days_on_lot > oldest)) oldest = u.days_on_lot; });
        b.appendChild(el("div", "font:600 9.5px Manrope;color:" + ageColor(oldest), cell.units.length ? ageLabel(oldest) : "—"));
        b.setAttribute("aria-label", usd(d) + " down, " + usd(m) + " a month — " + cell.units.length + " units");
        b.addEventListener("click", function () { onCell(cell); });
        grid.appendChild(b);
      });
    });
    board.appendChild(grid);

    if (HOLDING) {
      var bar = el("div", "margin-top:12px;padding:10px 12px;border:1px solid rgba(24,200,255,.45);" +
        "background:rgba(24,200,255,.10);border-radius:10px;display:flex;align-items:center;gap:10px");
      bar.appendChild(el("div", "font:600 12px Manrope;color:#e2e9f2;flex:1",
        "Moving " + [HOLDING.year, HOLDING.make, HOLDING.model].filter(Boolean).join(" ") + " — tap a cell."));
      var cancel = el("button", "appearance:none;cursor:pointer;background:none;border:none;color:#8ca0c4;font:600 11px Manrope;text-decoration:underline", "Cancel");
      cancel.type = "button";
      cancel.addEventListener("click", function () { HOLDING = null; render(); });
      bar.appendChild(cancel);
      board.appendChild(bar);
    }

    renderPick();
  }

  // The expanded cell's units, oldest first — the order a dealer actually works in.
  function renderPick() {
    var wrap = $("pick");
    wrap.textContent = "";
    if (!OPEN || HOLDING) { wrap.style.display = "none"; return; }
    var cell = DATA.cells.filter(function (c) { return cellKey(c) === OPEN; })[0];
    if (!cell) { wrap.style.display = "none"; return; }
    wrap.style.display = "";

    wrap.appendChild(el("div", "font:700 13px Manrope;color:#e2e9f2;margin-bottom:8px",
      usd(cell.down) + " down · " + usd(cell.monthly) + "/mo"));
    if (!cell.units.length) {
      wrap.appendChild(el("div", "font:500 12px/1.6 Manrope;color:#8ca0c4", "Nothing here yet. Tap a unit in another cell, then tap this one."));
      return;
    }
    cell.units.forEach(function (u) {
      var row = el("button",
        "appearance:none;cursor:pointer;width:100%;text-align:left;border:1px solid rgba(24,200,255,.14);" +
        "border-radius:10px;background:rgba(255,255,255,.03);color:#e2e9f2;padding:10px 12px;margin-bottom:8px;" +
        "display:flex;align-items:center;gap:10px");
      row.type = "button";
      var left = el("div", "flex:1;min-width:0");
      left.appendChild(el("div", "font:600 12.5px Manrope;white-space:nowrap;overflow:hidden;text-overflow:ellipsis",
        [u.year, u.make, u.model, u.trim].filter(Boolean).join(" ")));
      var sub = usd(u.listed_down || 0) + " down · " + usd(u.listed_monthly || 0) + "/mo";
      if (!u.exact) sub += " · rounded here";
      left.appendChild(el("div", "font:500 10.5px Manrope;color:#8ca0c4;margin-top:2px", sub));
      row.appendChild(left);
      row.appendChild(el("div", "font:700 11px Manrope;color:" + ageColor(u.days_on_lot), ageLabel(u.days_on_lot)));
      row.addEventListener("click", function () { HOLDING = u; OPEN = null; msg(""); render(); window.scrollTo(0, 0); });
      wrap.appendChild(row);
    });
  }

  function onCell(cell) {
    if (!HOLDING) { OPEN = (OPEN === cellKey(cell)) ? null : cellKey(cell); render(); return; }
    var u = HOLDING;
    HOLDING = null;
    msg("");
    fetch("/api/dealer/grid", {
      method: "POST", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vdp_id: u.vdp_id, down: cell.down, monthly: cell.monthly })
    }).then(function (r) {
      if (r.status === 401) { location.href = "/signin?next=" + encodeURIComponent("/grid"); return null; }
      return r.json().catch(function () { return {}; });
    }).then(function (d) {
      if (!d) return;
      // Surface the server's reason. A rejection the dealer can act on must not read as "try again".
      if (!d.ok) { msg(d.reason || "Couldn't move that one."); render(); return; }
      load();   // re-read rather than patching local state — the server owns where a unit sits
    }).catch(function () { msg("Couldn't move that one."); render(); });
  }

  function load() {
    fetch("/api/dealer/grid", { credentials: "include" })
      .then(function (r) {
        if (r.status === 401) { location.href = "/signin?next=" + encodeURIComponent("/grid"); return null; }
        if (r.status === 403) { msg("Your account is pending — we'll email you when it's live."); return null; }
        return r.json();
      })
      .then(function (d) {
        $("loading").style.display = "none";
        if (!d) return;
        if (!d.ok) { msg("Couldn't read the lot right now."); return; }
        DATA = d;
        render();
      })
      .catch(function () { $("loading").style.display = "none"; msg("Couldn't read the lot right now."); });
  }

  load();
});
