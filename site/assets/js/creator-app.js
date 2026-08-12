// CarNimbus for Creators — the whole app, one page.
// Structure mirrors site/assets/js/dealer-console.js: $s() null-safe getter, show() three-way gate,
// tab() display toggling, F() credentials fetch, and a full-screen sheet for detail. External file
// because CSP forbids inline JS.
document.addEventListener("DOMContentLoaded", function () {
  // Null-safe getter — a cached-HTML / new-JS version skew must never kill the whole boot.
  var STUB = { textContent: "", value: "", innerHTML: "", disabled: false, style: {}, classList: { toggle: function(){}, add: function(){}, remove: function(){} }, addEventListener: function(){}, querySelectorAll: function(){ return []; }, focus: function(){}, select: function(){} };
  function $(id) { return document.getElementById(id) || STUB; }
  var F = function (u, o) { o = o || {}; o.credentials = "include"; return fetch(u, o); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  var usd = function (c) { return "$" + ((c || 0) / 100).toFixed(2); };
  var dollars = function (c) { return "$" + Math.round((c || 0) / 100); };

  var FEED = null, DROPMAP = {}, EARN_LOADED = false, CUR = null, BUCKET = "open";

  // ---- GATES ----
  function show(id) {
    ["gate-auth", "gate-pending", "console"].forEach(function (x) { $(x).style.display = (x === id ? "" : "none"); });
    var inside = id === "console";
    $("cr-out").style.display = inside ? "" : "none";
    // Sign-in and the pending notice are single cards — centre them in the viewport.
    $("cr-main").classList.toggle("centered", !inside);
    // Signed out the header reads "CarNimbus for Creators"; signed in it becomes your face + name.
    if (!inside) { $("cr-tag").style.display = ""; $("cr-av").style.display = "none"; $("cr-name").textContent = ""; }
  }

  // ---- TABS ---- (dealer-console.js:17-27)
  function tab(which) {
    var earn = which === "earn";
    $("tab-earn").classList.toggle("on", earn); $("tab-drops").classList.toggle("on", !earn);
    $("pane-earn").style.display = earn ? "" : "none"; $("pane-drops").style.display = earn ? "none" : "";
    try { localStorage.setItem("cr_tab", which); } catch (_) {}
    if (earn && !EARN_LOADED) { EARN_LOADED = true; loadEarnings(); }
  }
  $("tab-drops").addEventListener("click", function () { tab("drops"); });
  $("tab-earn").addEventListener("click", function () { tab("earn"); });

  // ---- SIGN OUT ----
  // Shape mirrors the dealer header button. Unlike the dealer version this actually ends the session:
  // cn_crt is HttpOnly, so only the server can clear it. A document.cookie write here would be a no-op.
  $("cr-out").addEventListener("click", function () {
    var bye = function () { location.replace("/"); };
    F("/api/creator/logout", { method: "POST" }).then(bye).catch(bye);
  });

  // ---- AUTH ----
  function authMsg(el, t) { var m = $(el); m.textContent = t; m.style.display = t ? "block" : "none"; }
  $("au-toggle").addEventListener("click", function () { $("au-login").style.display = "none"; $("au-signup").style.display = ""; });
  $("su-back").addEventListener("click", function () { $("au-signup").style.display = "none"; $("au-login").style.display = ""; });

  $("au-go").addEventListener("click", async function () {
    authMsg("au-msg", "");
    var r = await F("/api/creator/login", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: $("au-email").value.trim(), password: $("au-pass").value }) });
    if (r.status === 403) return authMsg("au-msg", "Your account is still pending review.");
    if (!r.ok) return authMsg("au-msg", "Wrong email or password.");
    boot();
  });

  $("su-go").addEventListener("click", async function () {
    authMsg("su-msg", "");
    var handle = $("su-handle").value.trim();
    if (!handle) return authMsg("su-msg", "Add the handle you post from.");
    if ($("su-pass").value.length < 8) return authMsg("su-msg", "Password needs at least 8 characters.");
    var r = await F("/api/creator/signup", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: $("su-email").value.trim(), password: $("su-pass").value,
        platform: $("su-platform").value, handle: handle,
        followers_declared: parseInt($("su-followers").value.replace(/\D/g, ""), 10) || 0 }) });
    if (r.status === 409) return authMsg("su-msg", "That email already has an account.");
    var d = await r.json().catch(function () { return {}; });
    if (!d.ok) return authMsg("su-msg", "Couldn't create the account — check your details.");
    if (d.pending) { show("gate-pending"); return; }
    boot();
  });

  // ---- AVATAR ----
  // Crop + resize happen HERE, in the browser, so a 5MB phone photo never leaves the device —
  // only a ~3KB 96x96 JPEG data URI is uploaded. Server caps it at 40KB regardless.
  $("cr-av").addEventListener("click", function () { $("cr-avfile").click(); });
  $("cr-avfile").addEventListener("change", function () {
    var f = ($("cr-avfile").files || [])[0];
    if (!f) return;
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        try {
          var s = Math.min(img.width, img.height);                  // largest centred square
          var cv = document.createElement("canvas"); cv.width = 96; cv.height = 96;
          cv.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 96, 96);
          var uri = cv.toDataURL("image/jpeg", 0.82);
          F("/api/creator/avatar", { method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ avatar: uri }) }).then(function (r) {
              if (!r.ok) return;
              var av = $("cr-av");
              av.style.backgroundImage = 'url("' + uri + '")'; av.textContent = "";
              if (FEED && FEED.creator) FEED.creator.avatar = uri;
            }).catch(function () {});
        } catch (_) {}
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(f);
    $("cr-avfile").value = "";
  });

  // ---- PERSONAL LINK ----
  $("rf-copy").addEventListener("click", async function () {
    var b = $("rf-copy");
    try { await navigator.clipboard.writeText($("rf-url").value); b.textContent = "Copied"; }
    catch (_) { $("rf-url").select(); b.textContent = "Press ⌘C"; }
    setTimeout(function () { b.textContent = "Copy link"; }, 1600);
  });

  // ---- DROPS ----
  function card(d) {
    var title = [d.year, d.make, d.model, d.trim].filter(Boolean).join(" ");
    var photo = (d.photos && d.photos[0]) || "";
    var best = d.fit >= 70;
    var why = (d.fit_why || []).filter(function (w) { return w.pts > 0 && w.f !== "open drop"; })
      .map(function (w) { return w.f; }).slice(0, 2).join(" · ");
    // Location is ALWAYS the subtitle — it never gets displaced. A creator picks a car by where
    // they'd have to drive, so that line has to survive every other state.
    var where = [d.dealer_name, d.zip].filter(Boolean).join(" · ") || "location TBD";
    // Claim/post state is an ADDITIONAL line, not a replacement.
    var state = d.post_status ? (d.post_status === "approved" ? "posted · approved"
      : d.post_status === "rejected" ? "posted · rejected" : "posted · in review")
      : d.claimed ? "claimed — tap to get your link" : "";
    // Crowd is a footnote, not a headline.
    var crowd = (!d.post_status && !d.claimed && d.claims) ? '<span class="crowd">' + d.claims + " on it</span>" : "";
    // Age is REAL or ABSENT. days_on_lot is null unless a dealer entered a lot date — we never guess.
    var age = d.days_on_lot != null
      ? '<span class="age' + (d.days_on_lot >= 60 ? " hot" : "") + '">on lot ' + d.days_on_lot + "d</span>" : "";
    // The rate lives once, on the right, as "$75 / per post". The old fit line repeated it
    // ("pays $75") directly under the car — removed; a card is now name, location, state.
    return '<button class="dcard' + (best ? " best" : "") + '" data-id="' + d.id + '" type="button">' +
      (photo ? '<img class="th" src="' + esc(photo) + '" alt="" loading="lazy">' : '<span class="th"></span>') +
      '<span style="flex:1;min-width:0">' +
        (best ? '<span class="badge cyan" style="margin-bottom:5px;display:inline-block">★ BEST FIT</span>' : "") +
        '<span class="ttl" style="display:block">' + esc(title) + "</span>" +
        '<span class="sub" style="display:block">' + esc(where) + "</span>" +
        (state ? '<span class="why" style="display:block">' + esc(state) + "</span>" : "") +
        (age || crowd ? "<span style=\"display:block\">" + age + crowd + "</span>" : "") +
      "</span>" +
      '<span><span class="amt" style="display:block">' + dollars(d.rate_cents) + '</span><span class="per" style="display:block">per post</span></span>' +
      "</button>";
  }

  // ---- DEALERSHIP BUCKETS ----
  // Rooftop is the bucket because that's the creator's real decision ("I'll shoot at Lexus SM today").
  // dealer_name covers 94/95 active cars; dealer_zip only 67 and is duplicated, so ZIP is display + search only.
  function groups(list) {
    var m = {};
    list.forEach(function (d) { var k = d.dealer_name || "Unassigned"; (m[k] = m[k] || []).push(d); });
    return Object.keys(m).map(function (k) {
      var zips = {}; m[k].forEach(function (x) { if (x.zip) zips[x.zip] = 1; });
      // Rooftop tile: a real photo from that lot's own inventory. There is no web-search or
      // image-lookup capability in this codebase, so nothing is fetched from Google — this is
      // a picture we already have and are already loading. Falls back to a lettermark.
      var tile = "";
      for (var i = 0; i < m[k].length; i++) { var p = (m[k][i].photos || [])[0]; if (p) { tile = p; break; } }
      return { name: k, zip: Object.keys(zips).join(" · "), items: m[k], tile: tile };
    }).sort(function (a, b) {
      if (a.name === "Unassigned") return 1;
      if (b.name === "Unassigned") return -1;
      return b.items.length - a.items.length;
    });
  }
  function hit(d, q) {
    if (!q) return true;
    return [d.dealer_name, d.zip, d.make, d.model, d.year, d.trim].filter(Boolean)
      .join(" ").toLowerCase().indexOf(q) > -1;
  }

  function renderDrops() {
    var d = FEED || {};
    var c = d.creator || {};
    // Identity replaces the "for Creators" label once you're in — your face and your name.
    $("cr-tag").style.display = "none";
    $("cr-name").textContent = c.name || c.handle || "";
    var av = $("cr-av");
    av.style.display = "";
    av.style.backgroundImage = c.avatar ? 'url("' + c.avatar + '")' : "";
    av.textContent = c.avatar ? "" : (c.name || c.handle || "?").replace(/^@/, "").slice(0, 1).toUpperCase();
    av.style.color = "#18C8FF"; av.style.font = "700 14px Manrope";
    $("rf-url").value = c.ref_link || "";
    $("rf-stats").textContent = c.ref_link ? ((c.ref_clicks || 0) + " clicks · " + (c.ref_leads || 0) + " leads") : "";
    // Counts are computed from the SAME list the filter renders, so a tap can never show
    // a different number of cards than the badge promised.
    var all = d.drops || [], b = d.buckets || {};
    $("bk-open").textContent = all.filter(function (x) { return !x.claimed; }).length;
    $("bk-claimed").textContent = all.filter(function (x) { return !!x.claimed; }).length;
    $("bk-paid").textContent = dollars(b.paid_cents);
    // Deck v13 S-04 screen 1: LIVE / CLICKS / SALES. Every number is already in this payload —
    // creatorFeed returns creator.ref_clicks and creator.ref_leads alongside the drops — so this is
    // a second reading of one request, not a second request. SALES counts attributed leads
    // (web_leads.creator_id), which is what the affiliate link can actually prove it caused.
    $("kpi-live").textContent   = all.filter(function (x) { return !x.claimed; }).length;
    $("kpi-clicks").textContent = c.ref_clicks || 0;
    $("kpi-sales").textContent  = c.ref_leads || 0;

    var list = d.drops || [];
    DROPMAP = {}; list.forEach(function (x) { DROPMAP[x.id] = x; });
    paint();
  }

  // Filtering is client-side over the already-loaded feed — instant, zero requests.
  // (Same instinct as LEADS_ALL/LEADMAP in dealer-console.js:402-413.)
  function paint() {
    var q = String($("cr-q").value || "").trim().toLowerCase();
    // BUCKET is a real filter: once you claim a car it leaves OPEN and lives in CLAIMED.
    var list = ((FEED || {}).drops || [])
      .filter(function (x) { return BUCKET === "claimed" ? !!x.claimed : !x.claimed; })
      .filter(function (x) { return hit(x, q); });
    if (!list.length) {
      $("cr-list").innerHTML = '<div class="glass pd" style="border-radius:14px;color:#8fa3bf;font:400 13px/1.6 Manrope">'
        + (q ? "Nothing matches &ldquo;" + esc(q) + "&rdquo;."
             : BUCKET === "claimed" ? "Nothing claimed yet. Tap a car in OPEN to get your link."
             : "No open drops right now. New units land here the moment a dealer uploads one &mdash; your link above works either way.")
        + "</div>";
      return;
    }
    var gs = groups(list);
    // First section open; a search auto-opens every section that matched.
    $("cr-list").innerHTML = gs.map(function (g, i) {
      var open = i === 0 || !!q;
      var tile = g.tile
        ? '<img class="lg" src="' + esc(g.tile) + '" alt="" loading="lazy">'
        : '<span class="lgt">' + esc(g.name.replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase() || "?") + "</span>";
      return '<section class="bandsec' + (open ? " open" : "") + '">' +
        '<h4 tabindex="0" role="button" aria-expanded="' + (open ? "true" : "false") + '">' +
          '<span class="hd">' + tile + "<span>" + esc(g.name) +
            (g.zip ? "<small>" + esc(g.zip) + "</small>" : "") +
          "</span></span>" +
        '<span class="ct">' + g.items.length + "</span></h4>" +
        '<div class="body">' + g.items.map(card).join("") + "</div>" +
      "</section>";
    }).join("");
    $("cr-list").querySelectorAll(".bandsec h4").forEach(function (h) {
      var toggle = function () {
        var s = h.parentNode; s.classList.toggle("open");
        h.setAttribute("aria-expanded", s.classList.contains("open") ? "true" : "false");
      };
      h.addEventListener("click", toggle);
      h.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
    });
    $("cr-list").querySelectorAll(".dcard").forEach(function (el) {
      el.addEventListener("click", function () { openDrop(DROPMAP[el.dataset.id]); });
    });
  }
  $("cr-q").addEventListener("input", paint);

  // Bottom bar filters the feed. PAID isn't a feed state — it opens EARNINGS, where that money lives.
  document.querySelectorAll("#buckets .bkt").forEach(function (b) {
    b.addEventListener("click", function () {
      var k = b.dataset.bkt;
      if (k === "paid") { tab("earn"); return; }
      BUCKET = k;
      document.querySelectorAll("#buckets .bkt").forEach(function (o) { o.classList.toggle("on", o === b); });
      paint();
    });
  });

  function loadFeed() {
    return F("/api/creator/feed").then(function (r) {
      if (r.status === 401) { show("gate-auth"); throw 0; }
      if (r.status === 403) { show("gate-pending"); throw 0; }
      return r.json();
    }).then(function (d) {
      if (!d || !d.ok) throw 0;
      FEED = d; show("console"); renderDrops();
    }).catch(function () {});
  }

  // ---- DROP SHEET ---- (open pattern: dealer-console.js:415 — display first, render inside try/catch)
  function openDrop(d) {
    if (!d) return;
    CUR = d;
    $("drop-bg").style.display = "flex";
    $("drop-bg").setAttribute("aria-hidden", "false");
    document.body.classList.add("locked");
    try {
      var title = [d.year, d.make, d.model, d.trim].filter(Boolean).join(" ");
      var photo = (d.photos && d.photos[0]) || "";
      var rateWhy = (d.rate_why || []).map(function (w) { return w.f; }).join(" + ");
      var h = "";
      h += (photo ? '<img src="' + esc(photo) + '" alt="" style="width:100%;height:190px;object-fit:cover;border-radius:14px">' : "");
      h += '<div class="row" style="justify-content:space-between;align-items:flex-start;margin-top:12px;gap:12px">' +
             '<div><div style="font:700 18px/1.3 Manrope">' + esc(title) + "</div>" +
             '<div class="sub" style="font:500 11px/1.5 Manrope;color:#7b8fab;margin-top:3px">' + esc(d.claims || 0) + " creator" + ((d.claims || 0) === 1 ? "" : "s") + " on this unit</div></div>" +
             '<div style="text-align:right;flex:0 0 auto"><div style="font:700 21px/1 Manrope;color:#18C8FF">' + dollars(d.rate_cents) + "</div>" +
             '<div style="font:500 10px Manrope;color:#7b8fab">per post</div></div></div>';
      if (rateWhy) h += '<div style="font:400 10px/1.5 Manrope;color:#6b7f9b;margin-top:8px">' + esc(rateWhy) + "</div>";

      if (!d.claimed) {
        h += '<button id="dp-claim" class="btn primary md" style="width:100%;margin-top:16px">Claim &mdash; ' + dollars(d.rate_cents) + "</button>";
      } else {
        h += '<div class="reflink" style="margin-top:16px"><div style="font:700 11px \'IBM Plex Mono\';letter-spacing:.1em;color:#18C8FF">LINK FOR THIS CAR</div>' +
             '<input id="dp-link" readonly value="' + esc(d.link || "") + '">' +
             '<button id="dp-copy" class="btn ghost md" style="width:100%;margin-top:9px">Copy link</button></div>';
        if (d.post_status) {
          h += '<div class="glass pd" style="border-radius:14px;margin-top:14px"><div style="font:600 13px Manrope;color:#18C8FF">Submitted</div>' +
               '<div style="font:400 12px/1.6 Manrope;color:#b9c8dd;margin-top:6px">' +
               (d.post_status === "approved" ? "Approved. Your earning is queued for payout."
                 : d.post_status === "rejected" ? "This post was rejected, so nothing was paid for it."
                 : "We're reviewing it. It shows as In review until it clears.") + "</div></div>";
        } else {
          h += '<div class="glass pd" style="border-radius:14px;margin-top:14px">' +
               '<div style="font:600 13px Manrope">I posted it</div>' +
               '<input id="dp-url" type="url" class="pill" placeholder="https://… link to your post" inputmode="url" style="margin-top:10px">' +
               '<input id="dp-reach" type="text" class="pill" placeholder="Views / reach" inputmode="numeric" style="margin-top:10px">' +
               '<label class="consent" for="dp-disc" style="margin-top:12px;display:flex;gap:9px;align-items:flex-start">' +
               '<input id="dp-disc" type="checkbox" style="margin-top:3px">' +
               '<span style="font:400 11px/1.5 Manrope;color:#b9c8dd">This is a paid post and I have labelled it as one &mdash; <b>#ad</b> or the platform&rsquo;s paid-partnership tag. Required by the FTC, and required to get paid.</span></label>' +
               '<button id="dp-submit" class="btn primary md" style="width:100%;margin-top:14px">Submit for payout</button>' +
               '<div class="wl-msg" id="dp-msg" style="display:none;margin-top:10px"></div></div>';
        }
      }
      $("dp-body").innerHTML = h;
      wireSheet();
    } catch (err) { if (window.console && console.error) console.error("openDrop render:", err); }
  }

  function closeDrop() {
    $("drop-bg").style.display = "none";
    $("drop-bg").setAttribute("aria-hidden", "true");
    document.body.classList.remove("locked");
    CUR = null;
  }
  $("dp-x").addEventListener("click", closeDrop);
  $("drop-bg").addEventListener("click", function (e) { if (e.target === $("drop-bg")) closeDrop(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && $("drop-bg").style.display === "flex") closeDrop(); });

  function wireSheet() {
    var claim = document.getElementById("dp-claim");
    if (claim) claim.addEventListener("click", async function () {
      claim.disabled = true; claim.textContent = "Claiming…";
      var r = await F("/api/creator/claim", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ drop_id: CUR.id }) });
      if (r.status === 401) { closeDrop(); show("gate-auth"); return; }
      var d = await r.json().catch(function () { return {}; });
      if (!d.ok) { claim.disabled = false; claim.textContent = "Try again"; return; }
      await loadFeed();
      openDrop(DROPMAP[CUR.id]);
    });

    var copy = document.getElementById("dp-copy");
    if (copy) copy.addEventListener("click", async function () {
      try { await navigator.clipboard.writeText(document.getElementById("dp-link").value); copy.textContent = "Copied"; }
      catch (_) { document.getElementById("dp-link").select(); copy.textContent = "Press ⌘C"; }
      setTimeout(function () { copy.textContent = "Copy link"; }, 1600);
    });

    var sub = document.getElementById("dp-submit");
    if (sub) sub.addEventListener("click", async function () {
      var msg = function (t) { var m = document.getElementById("dp-msg"); m.textContent = t; m.style.display = t ? "block" : "none"; };
      msg("");
      if (!document.getElementById("dp-disc").checked) return msg("Tick the disclosure box — we can't pay for an unlabelled paid post.");
      var url = document.getElementById("dp-url").value.trim();
      if (!/^https?:\/\//i.test(url)) return msg("Paste the full link to your post.");
      var r = await F("/api/creator/post", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ claim_id: CUR.claim_id, post_url: url,
          reach_declared: parseInt(document.getElementById("dp-reach").value.replace(/\D/g, ""), 10) || 0,
          disclosure_confirmed: true }) });
      if (r.status === 401) { closeDrop(); show("gate-auth"); return; }
      if (r.status === 409) return msg("You already submitted a post for this drop.");
      var d = await r.json().catch(function () { return {}; });
      if (d.error === "disclosure_required") return msg("Disclosure is required before we can pay.");
      if (!d.ok) return msg("Couldn't submit that — check the link and try again.");
      EARN_LOADED = false;
      await loadFeed();
      closeDrop();
    });
  }

  // ---- EARNINGS ----
  var LABEL = { accrued: "In review", approved: "Approved", paid: "Paid", clawed_back: "Reversed" };
  var COLOR = { accrued: "#8fa3bf", approved: "#18C8FF", paid: "#3ddc84", clawed_back: "#ff7a7a" };

  function loadEarnings() {
    return F("/api/creator/earnings").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !d.ok) return;
      $("e-pending").textContent = usd(d.totals.accrued);
      $("e-approved").textContent = usd(d.totals.approved);
      $("e-paid").textContent = usd(d.totals.paid);
      $("e-score-n").textContent = (d.score || 0) + "/100";
      $("e-score-why").innerHTML = (d.score_why || []).map(function (w) {
        return '<div class="kv"><span>' + esc(w.f) + '</span><span style="color:' + (w.pts < 0 ? "#ff7a7a" : "#18C8FF") + '">' + (w.pts > 0 ? "+" : "") + esc(w.pts) + "</span></div>";
      }).join("") || '<div style="font:400 11px/1.6 Manrope;color:#7b8fab">Nothing measured yet &mdash; post your first drop.</div>';

      if (!d.payouts_enabled) {
        $("e-connect").style.display = "";
        $("e-connect-body").textContent = d.connected
          ? "You started setting up payouts but haven't finished. Money can't move until your details are verified."
          : "We pay through Stripe. You'll verify your identity and add a bank account — that's Stripe's step, not ours.";
        $("e-connect-go").textContent = d.connected ? "Finish payout setup" : "Connect payouts";
      } else { $("e-connect").style.display = "none"; }

      $("e-rows").innerHTML = (d.rows || []).length ? d.rows.map(function (x) {
        var car = [x.year, x.make, x.model].filter(Boolean).join(" ") || "—";
        return '<div class="glass pd" style="border-radius:13px;margin-bottom:8px"><div class="row" style="justify-content:space-between;align-items:baseline;gap:10px">' +
          '<div style="min-width:0"><div style="font:600 12px Manrope">' + esc(car) + "</div>" +
          '<div style="font:500 10px Manrope;color:' + (COLOR[x.status] || "#7b8fab") + ';margin-top:2px">' + esc(LABEL[x.status] || x.status) + "</div></div>" +
          '<div class="disp" style="font-size:14px">' + usd(x.amount_cents) + "</div></div></div>";
      }).join("") : '<div style="font:400 12px/1.6 Manrope;color:#7b8fab">No earnings yet.</div>';
    }).catch(function () {});
  }

  $("e-connect-go").addEventListener("click", async function () {
    var m = $("e-msg"); m.textContent = ""; m.style.display = "none";
    $("e-connect-go").disabled = true;
    var r = await F("/api/creator/connect/start", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    $("e-connect-go").disabled = false;
    if (r.status === 503) { m.textContent = "Payouts aren't switched on yet on our side. Your earnings keep accruing."; m.style.display = "block"; return; }
    var d = await r.json().catch(function () { return {}; });
    if (!d.ok || !d.url) { m.textContent = "Couldn't open payout setup — try again shortly."; m.style.display = "block"; return; }
    location.href = d.url;
  });

  // ---- BOOT ---- (dealer-console.js:551-557)
  function boot() {
    loadFeed().then(function () {
      setTimeout(function () { if (!EARN_LOADED && $("console").style.display !== "none") { EARN_LOADED = true; loadEarnings(); } }, 700);
    });
  }
  tab("drops");
  if (new URLSearchParams(location.search).get("connected") === "1") {
    F("/api/creator/connect/return").then(function () { history.replaceState({}, "", "/"); boot(); }).catch(boot);
  } else { boot(); }
  setInterval(function () { if ($("console").style.display !== "none" && $("pane-drops").style.display !== "none") loadFeed(); }, 30000);
});
