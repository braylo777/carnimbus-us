// app.carnimbus.us — steps 3 and 4 of deck v13 S-04: "Confirm & upload title. Done."
//
// Two actions, strictly ordered. Upload is gated behind stake because the whole MOAT claim is
// "funds locked BEFORE the sale" — a title handed over against an unfunded deal is the exact
// exposure this product exists to remove.
document.addEventListener("DOMContentLoaded", function () {
  function $(id) { return document.getElementById(id); }
  var msgEl = $("t-msg");
  function msg(t) { msgEl.textContent = t || ""; msgEl.style.display = t ? "block" : "none"; }

  var dealId = "";
  try { dealId = new URLSearchParams(location.search).get("deal") || ""; } catch (e) { dealId = ""; }
  if (!dealId) { location.replace("/deals"); return; }

  var previewUrl = null;

  function load() {
    fetch("/api/app/deal?id=" + encodeURIComponent(dealId), { credentials: "include" })
      .then(function (r) {
        if (r.status === 401) { location.href = "/signin?next=" + encodeURIComponent("/title?deal=" + dealId); return null; }
        if (r.status === 403) { msg("Your account is pending."); return null; }
        if (r.status === 404) { msg("That deal isn't yours or doesn't exist."); return null; }
        return r.json();
      })
      .then(function (d) { if (d && d.ok) render(d); else if (d) msg("Couldn't load that deal."); })
      .catch(function () { msg("Network problem — try again."); });
  }

  function render(d) {
    var deal = d.deal;
    window.cnRenderRail($("rail"), deal.state);
    $("car-name").textContent = window.cnCarName(d.decoded);
    $("car-vin").textContent = deal.vin;
    $("car-offer").textContent = window.cnUsd(deal.offer_cents);

    var staked = deal.state !== "DRAFT";
    var titled = deal.state === "TITLED" || deal.state === "ADJUDICATED" || deal.state === "SETTLED";

    $("stake-btn").style.display = staked ? "none" : "block";
    if (d.stake) {
      $("stake-chip").textContent = d.stake.status === "captured" ? "CAPTURED" :
                                    d.stake.status === "canceled" ? "RELEASED BACK" : "AUTHORIZED";
      $("stake-done").style.display = "block";
      $("stake-done").textContent = d.stake.status === "requires_capture"
        ? window.cnUsd(d.stake.amount_cents) + " authorized — still the buyer's money until punch."
        : window.cnUsd(d.stake.amount_cents) + " " + d.stake.status + ".";
    }

    if (staked && !titled) {
      $("title-card").style.opacity = "1";
      $("title-gate").style.display = "none";
      $("title-controls").style.display = "block";
    }
    if (titled) {
      $("title-card").style.opacity = "1";
      $("title-gate").style.display = "none";
      $("title-controls").style.display = "none";
      $("title-done").style.display = "block";
      var a = $("track");
      a.href = "/deal?id=" + deal.id;
      a.style.display = "flex";
    }
    $("loading").style.display = "none";
    $("body").style.display = "block";
  }

  $("stake-btn").addEventListener("click", function () {
    var b = $("stake-btn"); b.classList.add("loading"); msg("");
    fetch("/api/app/stake", {
      method: "POST", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deal_id: dealId })
    }).then(function (r) {
      if (r.status === 401) { location.href = "/signin"; return null; }
      if (r.status === 403) { b.classList.remove("loading"); msg("Your account is pending."); return null; }
      return r.json();
    }).then(function (d) {
      b.classList.remove("loading");
      if (!d) return;
      if (d.ok) { load(); return; }
      if (d.error === "stripe_unconfigured") return msg("Payments aren't configured yet — nothing was charged.");
      if (d.error === "wrong_state") return msg("This deal is already past that step.");
      msg("Couldn't lock the funds — try again.");
    }).catch(function () { b.classList.remove("loading"); msg("Network problem — try again."); });
  });

  $("title-file").addEventListener("change", function () {
    var f = $("title-file").files && $("title-file").files[0];
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    if (!f) { $("title-preview").style.display = "none"; return; }
    previewUrl = URL.createObjectURL(f);
    $("title-preview").src = previewUrl;
    $("title-preview").style.display = "block";
  });

  $("title-btn").addEventListener("click", function () {
    var f = $("title-file").files && $("title-file").files[0];
    if (!f) return msg("Pick a photo of the title first.");
    var b = $("title-btn"); b.classList.add("loading"); msg("");
    var fd = new FormData();
    fd.append("deal_id", dealId);
    fd.append("file", f, f.name || "title.jpg");
    fetch("/api/app/title", { method: "POST", credentials: "include", body: fd })
      .then(function (r) {
        if (r.status === 401) { location.href = "/signin"; return null; }
        if (r.status === 413) { b.classList.remove("loading"); msg("That photo is too large — 12 MB max."); return null; }
        if (r.status === 415) { b.classList.remove("loading"); msg("That file isn't an image."); return null; }
        return r.json();
      })
      .then(function (d) {
        b.classList.remove("loading");
        if (!d) return;
        if (d.ok) {
          if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
          load(); return;
        }
        if (d.error === "docs_unconfigured") return msg("Document storage isn't configured yet.");
        msg("Upload failed — try again.");
      })
      .catch(function () { b.classList.remove("loading"); msg("Network problem — try again."); });
  });

  window.addEventListener("pagehide", function () { if (previewUrl) URL.revokeObjectURL(previewUrl); });
  load();
});
