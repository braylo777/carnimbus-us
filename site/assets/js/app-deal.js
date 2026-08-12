// app.carnimbus.us — the settlement surface. This screen is where the MOAT slide becomes a thing
// a dealer can actually operate.
//
// The approval gate is the load-bearing part. It is NOT pre-selected, NOT auto-focused, and there
// is no code path that approves without a click. AUTONOMY-POLICY.md:20 caps an irreversible payout
// at L1 (act-with-approval) forever, for the same reason creator_payout is capped: once money has
// left, the correction belongs in Stripe, not in an UPDATE.
document.addEventListener("DOMContentLoaded", function () {
  function $(id) { return document.getElementById(id); }
  var msgEl = $("d-msg");
  function msg(t) { msgEl.textContent = t || ""; msgEl.style.display = t ? "block" : "none"; }

  var dealId = "";
  try { dealId = new URLSearchParams(location.search).get("id") || ""; } catch (e) { dealId = ""; }
  if (!dealId) { location.replace("/deals"); return; }

  function load() {
    fetch("/api/app/deal?id=" + encodeURIComponent(dealId), { credentials: "include" })
      .then(function (r) {
        if (r.status === 401) { location.href = "/signin?next=" + encodeURIComponent("/deal?id=" + dealId); return null; }
        if (r.status === 403) { msg("Your account is pending."); return null; }
        if (r.status === 404) { msg("That deal isn't yours or doesn't exist."); return null; }
        return r.json();
      })
      .then(function (d) { if (d && d.ok) render(d); else if (d) msg("Couldn't load that deal."); })
      .catch(function () { msg("Network problem — try again."); });
  }

  function render(d) {
    var deal = d.deal, adj = d.adjudication, stake = d.stake;
    window.cnRenderRail($("rail"), deal.state);
    $("car-name").textContent = window.cnCarName(d.decoded);
    $("car-vin").textContent = deal.vin;
    $("car-offer").textContent = window.cnUsd(deal.offer_cents);
    $("car-fee").textContent = "less " + window.cnUsd(deal.fee_cents) + " CarNimbus fee";

    if (stake) {
      $("stake-card").style.display = "block";
      $("stake-amt").textContent = window.cnUsd(stake.amount_cents);
      $("stake-copy").textContent =
        stake.status === "requires_capture" ? "Authorized, not captured — the money is still the buyer's."
      : stake.status === "captured"        ? "Released to you at punch."
      : stake.status === "canceled"        ? "Authorization cancelled. The buyer's card was never charged."
      : stake.status;
      var t = [];
      if (stake.authorized_at) t.push("AUTHORIZED " + stake.authorized_at);
      if (stake.captured_at) t.push("CAPTURED " + stake.captured_at);
      $("stake-times").textContent = t.join("  ·  ");
    }

    // Adjudication
    $("adj-run").style.display = deal.state === "TITLED" ? "block" : "none";
    $("adj-wait").style.display = (deal.state === "DRAFT" || deal.state === "STAKED") ? "block" : "none";
    if (adj) {
      $("adj-out").style.display = "block";
      $("adj-decision").textContent = adj.decision === "release" ? "Release" : "Hold";
      $("adj-decision").style.color = adj.decision === "release" ? "#18C8FF" : "#f5a623";
      $("adj-conf").textContent = adj.confidence != null ? Math.round(adj.confidence * 100) + "% CONFIDENCE · " + (adj.autonomy_level || "L1") : (adj.autonomy_level || "L1");
      $("adj-rationale").textContent = adj.rationale || "";   // never truncated
    }

    var needsHuman = deal.state === "ADJUDICATED" && adj && !adj.approved_by;
    $("gate").style.display = needsHuman ? "block" : "none";
    if (needsHuman && adj.decision === "release") {
      $("approve").textContent = "Approve and release " + window.cnUsd(deal.offer_cents);
      $("approve").disabled = false;
    } else if (needsHuman) {
      // The agent held. Approval is not offered at all — the only way forward is dispute or fix.
      $("approve").style.display = "none";
    }
    if (adj && adj.approved_by) {
      $("approved").style.display = "block";
      $("approved").textContent = "Released by dealer #" + adj.approved_by + (adj.approved_at ? " on " + adj.approved_at : "") + ".";
    }

    // Ledger
    var box = $("events");
    box.textContent = "";
    var ev = d.events || [];
    for (var i = 0; i < ev.length; i++) {
      var row = document.createElement("div");
      row.style.cssText = "padding:7px 0;border-top:" + (i ? "1px solid rgba(255,255,255,.06)" : "none");
      var top = document.createElement("div");
      top.style.cssText = "font:700 11px Manrope;color:#e2e9f2";
      top.textContent = (ev[i].from_state ? ev[i].from_state + " → " : "") + ev[i].to_state;
      var sub = document.createElement("div");
      sub.className = "mono";
      sub.style.cssText = "font-size:9px;color:#8ca0c4;letter-spacing:.10em;margin-top:2px";
      sub.textContent = (ev[i].actor_kind || "").toUpperCase() + " " + (ev[i].actor || "") + "  ·  " + (ev[i].at || "");
      row.appendChild(top); row.appendChild(sub);
      if (ev[i].reason) {
        var why = document.createElement("div");
        why.style.cssText = "font:500 11px/1.5 Manrope;color:#aebfdf;margin-top:3px";
        why.textContent = ev[i].reason;
        row.appendChild(why);
      }
      box.appendChild(row);
    }

    $("loading").style.display = "none";
    $("body").style.display = "block";
  }

  $("adj-run").addEventListener("click", function () {
    var b = $("adj-run"); b.classList.add("loading"); msg("");
    post("/api/app/adjudicate", { deal_id: dealId }, b, function () { load(); });
  });

  $("approve").addEventListener("click", function () {
    var b = $("approve"); b.classList.add("loading"); msg("");
    post("/api/app/approve", { deal_id: dealId }, b, function () { load(); });
  });

  $("dispute-open").addEventListener("click", function () {
    var box = $("dispute-box");
    box.style.display = box.style.display === "none" ? "block" : "none";
  });

  $("dispute-go").addEventListener("click", function () {
    var why = ($("dispute-why").value || "").trim();
    if (!why) return msg("Say what's wrong — the reason goes on the permanent record.");
    var b = $("dispute-go"); b.classList.add("loading"); msg("");
    post("/api/app/dispute", { deal_id: dealId, reason: why }, b, function () { load(); });
  });

  function post(path, body, btn, ok) {
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
      if (d.error === "adjudication_holds") return msg("The adjudicator is holding this deal: " + (d.rationale || ""));
      if (d.error === "wrong_state") return msg("This deal has moved on — reloading.") || load();
      if (d.error === "capture_failed") return msg("Stripe refused the capture" + (d.detail ? " (" + d.detail + ")" : "") + ". Nothing was taken.");
      msg("That didn't go through — try again.");
    }).catch(function () { btn.classList.remove("loading"); msg("Network problem — try again."); });
  }

  load();
});
