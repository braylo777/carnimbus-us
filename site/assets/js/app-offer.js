// app.carnimbus.us — step 2 of deck v13 S-04: "Preview pricing in seconds."
//
// The order things render in is deliberate and is the sales argument:
//   what car -> what we pay -> how long it has been sitting -> where that sits in the band -> fee.
// The fee appears ABOVE the confirm button. A fee revealed after a commitment is a different
// product than the one this deck sells.
document.addEventListener("DOMContentLoaded", function () {
  function $(id) { return document.getElementById(id); }
  function usd(cents) {
    if (!cents && cents !== 0) return "—";
    return "$" + Math.round(cents / 100).toLocaleString("en-US");
  }
  function esc(s) { return String(s == null ? "" : s); }

  var msgEl = $("offer-msg");
  function msg(t) { msgEl.textContent = t || ""; msgEl.style.display = t ? "block" : "none"; $("loading").style.display = "none"; }

  var vin = "";
  try { vin = new URLSearchParams(location.search).get("vin") || ""; } catch (e) { vin = ""; }
  if (!vin) { location.replace("/scan"); return; }

  var state = null;

  fetch("/api/app/offer?vin=" + encodeURIComponent(vin), { credentials: "include" })
    .then(function (r) {
      if (r.status === 401) { location.href = "/signin?next=" + encodeURIComponent("/offer?vin=" + vin); return null; }
      if (r.status === 403) { msg("Your account is pending — we'll email you when it's live."); return null; }
      return r.json();
    })
    .then(function (d) {
      if (!d) return;
      if (!d.ok) { msg(d.reason || "We couldn't price that VIN. Scan it again."); return; }
      state = d; render(d);
    })
    .catch(function () { msg("Network problem — try again."); });

  function render(d) {
    var dec = d.decoded || {}, s = d.specs || null, o = d.offer || {};
    var name = [dec.year, dec.make, dec.model, dec.trim].filter(function (x) { return x; }).join(" ");
    $("car-name").textContent = name || "Unidentified unit";
    $("car-vin").textContent = d.vin;

    $("offer-amt").textContent = o.priced ? usd(o.offer_cents) : "—";
    if (!o.priced) $("offer-unpriced").style.display = "block";
    $("fee-amt").textContent = usd(o.fee_cents);

    // Aging — only when we actually know how long it has sat. A fabricated day count on the one
    // number the whole pitch rests on would be worse than showing nothing.
    if (s && s.days_on_lot != null) {
      $("aging").style.display = "block";
      $("dol").textContent = s.days_on_lot + (s.days_on_lot === 1 ? " day" : " days");
      if (o.priced && o.benchmark_cents && s.market_price_avg) {
        var avgCents = Math.round(Number(s.market_price_avg) * 100);
        var give = avgCents - o.offer_cents;              // what the dealer gives up to us
        var delta = o.benchmark_cents - give;             // vs. discounting it themselves
        $("aging-line").textContent = delta > 0
          ? "Clearing it here costs " + usd(delta) + " less than the average discount dealers take to move a unit this old."
          : "Clearing it here costs " + usd(-delta) + " more than the average discount — but it moves now, not eventually.";
      } else {
        $("aging-line").textContent = "This unit has been on your lot " + s.days_on_lot + " days.";
      }
    }

    // Market band with the offer marked on it.
    if (s && s.market_price_low && s.market_price_high) {
      var lo = Number(s.market_price_low) * 100, hi = Number(s.market_price_high) * 100;
      $("band-wrap").style.display = "block";
      $("band-low").textContent = usd(lo);
      $("band-high").textContent = usd(hi);
      var pct = hi > lo ? Math.max(0, Math.min(100, ((o.offer_cents - lo) / (hi - lo)) * 100)) : 0;
      $("band-fill").style.width = pct + "%";
      $("band-mark").style.left = pct + "%";
    }

    // Condition rows — each only if known.
    var rows = [];
    if (s && s.condition_grade) rows.push(["Condition", s.condition_grade]);
    if (s && s.title_status) rows.push(["Title", s.title_status]);
    if (s && s.mileage_exact) rows.push(["Mileage", Number(s.mileage_exact).toLocaleString("en-US") + " mi"]);
    if (dec.drivetrain) rows.push(["Drivetrain", dec.drivetrain]);
    if (dec.fuel) rows.push(["Fuel", dec.fuel]);
    if (rows.length) {
      var box = $("cond");
      box.style.display = "block";
      box.textContent = "";
      for (var i = 0; i < rows.length; i++) {
        var r = document.createElement("div");
        r.className = "row";
        r.style.cssText = "align-items:baseline;padding:5px 0";
        var k = document.createElement("div");
        k.style.cssText = "font:500 12px Manrope;color:#8ca0c4";
        k.textContent = rows[i][0];
        var v = document.createElement("div");
        v.style.cssText = "font:700 12px Manrope;color:#e2e9f2;margin-left:auto";
        v.textContent = esc(rows[i][1]);
        r.appendChild(k); r.appendChild(v); box.appendChild(r);
      }
    }

    $("loading").style.display = "none";
    $("body").style.display = "block";
  }

  $("confirm").addEventListener("click", function () {
    if (!state) return;
    var btn = $("confirm");
    if (!state.offer || !state.offer.priced) return msg("We can't create a deal without a wholesale price on this VIN. Add it to your inventory feed first.");
    btn.classList.add("loading"); msg("");
    fetch("/api/app/deal", {
      method: "POST", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vin: state.vin, offer_cents: state.offer.offer_cents })
    }).then(function (r) {
      if (r.status === 401) { location.href = "/signin"; return null; }
      if (r.status === 403) { btn.classList.remove("loading"); msg("Your account is pending."); return null; }
      return r.json();
    }).then(function (d) {
      if (!d) return;
      btn.classList.remove("loading");
      if (d && d.ok && d.deal) { location.href = "/title?deal=" + d.deal.id; return; }
      msg("Couldn't create the deal — try again.");
    }).catch(function () { btn.classList.remove("loading"); msg("Network problem — try again."); });
  });
});
