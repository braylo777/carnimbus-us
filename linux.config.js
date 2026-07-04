// Linux JS project config — conventions adopted; ships as vanilla today (no compiler yet).
// See LINUX-JS.md for the full architecture + migration path.
export default {
  appDir: "site",                 // page-per-file routing source
  styling: "vanilla-css",         // assets/styles.css passed through unchanged
  state: "signals",               // assets/signals.js — no React hooks, no virtual DOM
  target: "cloudflare-worker",    // worker.js hosts static assets + APIs
  routes: {                        // live file  ↔  Linux JS route convention
    "/":            "site/index.html",       // ↔ src/app/page.jsx
    "/browse":      "site/browse.html",      // ↔ src/app/browse/page.jsx
    "/waitlist":    "site/waitlist.html",    // ↔ src/app/waitlist/page.jsx
    "/about":       "site/about.html",       // ↔ src/app/about/page.jsx
    "/contact":     "site/contact.html",     // ↔ src/app/contact/page.jsx
    "/app/profile": "site/app/profile.html"  // ↔ src/app/app/profile/page.jsx
  }
};
