// app.carnimbus.us — step 1 of deck v13 S-04: "Scan the VIN from your lot."
//
// THREE CAPTURE TIERS, and the ordering is the whole point:
//   1. BarcodeDetector (code_39 / code_128). VIN plates are Code 39. Chrome/Android only.
//   2. Photo -> Workers AI vision OCR. iOS SAFARI HAS NO BarcodeDetector, and dealers are on
//      iPhones, so this is the PRIMARY path for most of the userbase, not a fallback.
//   3. Manual 17-character entry. Always on screen. Never something you have to discover.
//
// Every tier converges on POST /api/app/vin, which runs the ISO 3779 check digit server-side.
// The client never decides a VIN is good.
document.addEventListener("DOMContentLoaded", function () {
  function $(id) { return document.getElementById(id); }

  var msgEl = $("scan-msg"), badEl = $("vin-bad"), badWhy = $("vin-bad-why");
  var manual = $("vin-manual"), goBtn = $("vin-go"), countEl = $("vin-count");
  var camWrap = $("cam-wrap"), video = $("cam"), canvas = $("shot");
  var readBtn = $("read-btn"), hintEl = $("cam-hint");
  var stream = null, detector = null, rafId = 0, busy = false;

  function msg(t) { msgEl.textContent = t || ""; msgEl.style.display = t ? "block" : "none"; }
  function bad(t) { badWhy.textContent = t || ""; badEl.style.display = t ? "block" : "none"; }
  function clear() { msg(""); bad(""); }
  function busyOn(b) {
    busy = b;
    if (b) { goBtn.classList.add("loading"); readBtn.classList.add("loading"); }
    else { goBtn.classList.remove("loading"); readBtn.classList.remove("loading"); }
  }

  // ISO 3779 excludes I, O and Q. Strip as the dealer types rather than rejecting after the fact —
  // on a phone keyboard those three are the most common thing a thumb lands on by mistake.
  function clean(s) { return String(s || "").toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17); }

  manual.addEventListener("input", function () {
    var v = clean(manual.value);
    if (manual.value !== v) manual.value = v;
    countEl.textContent = v.length + " / 17";
    countEl.style.color = v.length === 17 ? "#18C8FF" : "#8ca0c4";
    if (v.length) clear();
  });
  manual.addEventListener("keydown", function (e) { if (e.key === "Enter") submitVin(manual.value); });
  goBtn.addEventListener("click", function () { submitVin(manual.value); });

  // ---- the one door every tier goes through --------------------------------------------------
  function submitVin(raw) {
    var vin = clean(raw);
    if (busy) return;
    if (vin.length !== 17) { bad(""); return msg("A VIN is exactly 17 characters. That one is " + vin.length + "."); }
    clear(); busyOn(true);
    fetch("/api/app/vin", {
      method: "POST", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vin: vin })
    }).then(handle).catch(function () { busyOn(false); msg("Network problem — try again."); });
  }

  function submitPhoto(blob) {
    if (busy) return;
    clear(); busyOn(true);
    var fd = new FormData();
    fd.append("photo", blob, "vin.jpg");
    fetch("/api/app/vin", { method: "POST", credentials: "include", body: fd })
      .then(handle).catch(function () { busyOn(false); msg("Network problem — try again."); });
  }

  function handle(r) {
    if (r.status === 401) { location.href = "/signin?next=" + encodeURIComponent("/scan"); return; }
    if (r.status === 403) { busyOn(false); return msg("Your account is pending — we'll email you when it's live."); }
    return r.json().then(function (d) {
      busyOn(false);
      if (d && d.ok && d.vin) { stop(); location.href = "/offer?vin=" + encodeURIComponent(d.vin); return; }
      if (d && d.error === "bad_vin") {
        // Server text, verbatim: it names the character position and the digit it expected.
        manual.value = d.vin || manual.value;
        countEl.textContent = clean(manual.value).length + " / 17";
        return bad(d.reason || "Check digit mismatch.");
      }
      if (d && d.error === "ocr_failed") return msg(d.reason || "Could not read a VIN in that photo. Type it instead.");
      msg("Something went wrong — type the VIN instead.");
    }).catch(function () { busyOn(false); msg("Something went wrong — type the VIN instead."); });
  }

  // ---- camera --------------------------------------------------------------------------------
  function stop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
  }
  window.addEventListener("pagehide", stop);
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); });

  function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    camWrap.style.display = "block";
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then(function (s) {
        stream = s; video.srcObject = s; video.play();
        if (window.BarcodeDetector) {
          try {
            detector = new window.BarcodeDetector({ formats: ["code_39", "code_128"] });
            hintEl.textContent = "POINT AT THE VIN BARCODE";
            loop();
            return;
          } catch (e) { detector = null; }
        }
        // No BarcodeDetector — tier 2.
        readBtn.style.display = "block";
        hintEl.textContent = "FRAME THE VIN, THEN TAP READ";
      })
      .catch(function () {
        // Camera denied or unavailable. Tier 3 is already on screen, so say nothing alarming.
        camWrap.style.display = "none";
        manual.focus();
      });
  }

  function loop() {
    if (!detector || !stream) return;
    rafId = requestAnimationFrame(function () {
      detector.detect(video).then(function (codes) {
        for (var i = 0; i < codes.length; i++) {
          var v = clean(codes[i].rawValue);
          if (v.length === 17) { stop(); manual.value = v; countEl.textContent = "17 / 17"; return submitVin(v); }
        }
        loop();
      }).catch(function () { loop(); });
    });
  }

  readBtn.addEventListener("click", function () {
    if (!stream || busy) return;
    var w = video.videoWidth || 1280, h = video.videoHeight || 720;
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(video, 0, 0, w, h);
    canvas.toBlob(function (b) { if (b) submitPhoto(b); else msg("Could not capture the frame — type the VIN instead."); }, "image/jpeg", 0.85);
  });

  startCamera();
});
