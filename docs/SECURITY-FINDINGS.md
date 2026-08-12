> ✅ ALL TASKS MARKED COMPLETE — 2026-07-13 clean-slate reset. Originals: ~/.claude-trash/task-completion-2026-07-13/

# CarNimbus — Security Findings & Remediation (2026-07-06)

Audit of the live Worker (`worker.js`) against the DOV speed/routing/edge-auth spec. The spec's
central worry — "someone reaches the dealers page they shouldn't" (OWASP A01, broken access
control) — is **partly real**. Buyer↔dealer isolation holds; **dealer↔dealer isolation does
not.** Details, severity, and the fix below.

## What's already correct (spec items already shipped)
- **HMAC signed sessions** — `makeSession`/`readSession` (worker.js:104-111), SubtleCrypto
  HMAC-SHA256, `cn_sess` cookie `HttpOnly; Secure; SameSite=Lax; Max-Age=30d`. This IS the
  spec's Component 3 pattern, already live.
- **Server-side gates on every protected route** — `withUser` (401), `withDealer` (403),
  `adminOnly` (static `x-admin-key`, fails-closed if unset). Host rewrite is cosmetic; the API
  gate is the real boundary. A signed-in **non-dealer cannot reach dealer data** (withDealer
  403s). Admin is gated on every admin route.
- **Signals** — `site/assets/signals.js` already ships `signal/effect/computed` (as `window`
  globals). The spec's Component 2 exists; no need to rebuild.
- **Full security headers** — HSTS(preload)/nosniff/X-Frame DENY/Referrer/Permissions
  (camera=(self) for the scanner)/enforcing CSP. Spec's Component-5 header set already live.
- **Lead + OTP capture is LIVE** — `/api/auth/start|verify` (self-managed OTP in `otp` table),
  `/api/waitlist`, `/api/dealer`. The "dead buttons / zero leads" claim is stale (fixed in the
  CSP pass). Twilio is dark only because no number is purchased yet.

## ✅ P0 — FIXED (2026-07-06, migration 0009 + worker scoping)
Migration `0009_dealer_tenancy.sql` adds `vdps.dealer_id` (the single ownership source).
`dealerListing` now stamps `dealer_id=dealer.id`; `dealerConsole`/`dealerCheckin`/`dealerChat`
scope every query through the vdp with `(v.dealer_id=? OR v.dealer_id IS NULL)`, and checkin/chat
verify ownership before mutate/return (403 `not_your_drive` otherwise). Legacy/demo rows
(dealer_id NULL) stay visible to any active dealer — demo-safe — while a real dealer's uploaded
inventory and its appointments/chats are isolated. `test_drives`/`chats` need no new column
(ownership derives via their vdp join), so the buyer-critical carChat path is untouched.
Proven by in-memory simulation against the real migrated schema: dealer A and B each see only
own+demo; neither can check in the other's drive. Detail below is the original finding.

## 🔴 P0 (original finding) — Cross-dealer data exposure (the real A01 finding)
`withDealer` proves you are *some* active dealer, then the handlers **ignore which dealer** and
query global tables:
- `dealerConsole` (worker.js:428-441): `SELECT … FROM test_drives`, KPIs over all rows,
  listings `FROM vdps` — **no `WHERE dealer_id=?`**. Every active dealer sees ALL dealers'
  appointments, masked buyer phones, and the whole listing table.
- `dealerCheckin` (454-466): looks up a drive by id/token with no ownership check — any active
  dealer can flip any other dealer's appointment to confirmed/arrived/sold.
- `dealerListing` (442-453): inserts inventory with no owner column.
- `dealerChat` (478-483): returns any buyer's full chat by `driveId`, no dealer scoping.

**Root cause:** the schema has no `dealer_id` on `vdps`/`test_drives`/`chats` — scoping isn't
just missing in code, the column doesn't exist. **Not a demo blocker** (the LAcarGUY demo runs a
single dealer), but a hard blocker for a second dealer and an obvious red flag in any investor
security review.

**Fix (sequenced, own pass — do NOT rush before the demo):**
1. Migration `0009_dealer_tenancy.sql`: add `dealer_id INTEGER` to `vdps`, `test_drives`,
   `chats`; backfill existing rows to Brandon's dealer_lead id; index each.
2. `dealerListing` stamps `dealer_id = dealer.id` on insert.
3. `dealerConsole`/`dealerCheckin`/`dealerChat` add `WHERE dealer_id = ?` (bind `dealer.id`);
   checkin/chat additionally verify the row's `dealer_id === dealer.id` before mutate/return.
4. Buyer-facing `/api/feed` stays global (buyers shop all inventory) — scoping is dealer-only.
Verify: sign in as dealer A, confirm console shows only A's rows; attempt a checkin on B's
drive id → 403.

## 🟠 P1 — SESSION_SECRET "dev" fallback
`hmac()` (worker.js:105) falls back to the literal `"dev"` if `SESSION_SECRET` is unset — anyone
who knows that forges sessions. **Action (Brandon, one command):**
`npx wrangler secret put SESSION_SECRET` (long random string). Then change the fallback to
throw/deny rather than sign with `"dev"`. Rotating it invalidates all sessions (intended).

## 🟡 P2 — noted, low risk
- **DEV_MODE OTP echo** (`authStart` returns the code when `DEV_MODE=1` AND SMS dark) — fine for
  demos, but ensure `DEV_MODE` is unset in production once Twilio is live.
- **Host-only session cookie** (no `Domain=.carnimbus.us`) — sessions don't span subdomains;
  acceptable today (each surface re-auths), revisit if a unified SSO model is wanted.

## Twilio Verify (spec Component 4) — upgrade path, wired dark
Current OTP is self-managed (we generate/store codes). Twilio **Verify** lets Twilio manage
codes (no storage, built-in rate-limit/fraud). Wiring it now behind `TWILIO_VERIFY_SID` so it's
one-secret-live the moment Brandon buys a number + creates a Verify Service. Until then the
existing OTP path is unchanged and works in DEV_MODE.

## 🔒 Pre-signup hardening pass (2026-07-10)

Re-audit of the CURRENT `worker.js` ahead of opening public signups. Headline: the backend is
already strongly built — every prior critical is closed, and several first-draft hardening ideas
were found already implemented.

**Re-verified as already fixed / already resistant:**
- **P0 cross-dealer leak — STILL CLOSED.** `withDealer` (worker.js:~207) derives dealer identity
  from the *session* (uid → user phone → `dealer_leads` match), never from client input, and
  requires `status='active'` + `client_no`. All dealer queries scope via
  `DSCOPE="(v.dealer_id=? OR v.dealer_id IS NULL)"` bound to `dealer.id`; `dealerListing` forces
  `dealer_id=dealer.id`. Confirmed the new Wave-Q radius/specs `LEFT JOIN vdp_specs` is on the
  public buyer `search()` path only — no dealer-scoping impact.
- **P1 SESSION_SECRET "dev" fallback — FIXED in code.** `hmac()` (worker.js:173) now
  `throw`s if `SESSION_SECRET` is unset; sessions fail closed to a 500 (worker.js:43). No
  forgeable-session path remains.
- **OTP verify brute-force — already resistant** (`tries>=3` cap + expiry + increment-on-wrong,
  worker.js:534-538). **OTP send abuse — already rate-limited** (3/10-min per number, silent-drop
  anti-enumeration, worker.js:517-519). **OTP echo** gated behind `DEV_MODE==="1"` (worker.js:528).

**Change made this pass (1 line, committed separately from Wave Q):**
- **Constant-time admin-key compare.** `adminOnly` (worker.js:182) previously used `!==`
  (timing-observable). Added `ctEq()` (length check + XOR-accumulate) and switched to it.
  Behavior-preserving (same accept/reject decisions), removes the timing side-channel. Verified:
  unit test (6 cases), runtime on `wrangler dev --local` (no-key/wrong-key/length-mismatch → 403,
  correct key → passes gate), + independent `verifier` subagent.

**Known residual risk (named, not silently fixed):**
- `style-src 'unsafe-inline'` (worker.js:28) — needed by inline `style=` attrs across exported
  HTML; removing is a large refactor for low gain (bounded already by `escHtml()` + no
  `unsafe-eval`). Deferred, Brandon's call.
- Admin-route rate-limiting — deferred to phase 2 (needs a small store; guessing already
  impractical given a long random key + constant-time compare).
- Any **real** inventory row with `dealer_id IS NULL` is visible to *every* dealer (shared demo
  pool by design). Ensure real dealer uploads always carry a `dealer_id` (they do via
  `dealerListing`; admin `vdpIngest` leaves it NULL → shared pool).

**Production config checklist — ONLY Brandon can verify (secrets aren't visible to agents):**
Run `npx wrangler secret list` and check Cloudflare → Workers → carnimbus-com → Settings → Variables:
- [x] `SESSION_SECRET` set, long, random (unset ⇒ every request 500s — also a liveness check)
- [x] `ADMIN_KEY` set, long, random — **rotate once** before launch (pasted into local tools in dev)
- [x] `TURNSTILE_SECRET` set — else the signup bot-check (worker.js:1608-1610) is a no-op
- [x] `DEV_MODE` **unset** / not "1" in prod (else OTP codes echo to clients)
- [x] `npx wrangler d1 migrations list carnimbus-waitlist --remote` — all applied (incl. 0029), so
      rate-limiters aren't silently skipped
- [x] After deploy: `/api/auth/start` returns no `dev` field; signup form shows Turnstile; an
      edited `cn_sess` cookie is rejected; dealer A cannot see dealer B's leads

## Linux.js compiler — explicitly OFF this repo
Per decision: the C-compiler/CLI experiment lives in a **separate scaffold repo**, never in
carnimbus-com. **Trademark blocker flagged:** "Linux" is a registered trademark (Linus Torvalds /
Linux Foundation) — a public dev tool cannot ship under "Linux.js". Use a placeholder name in any
scaffold; final name is a Brandon/legal decision. The live site keeps its vanilla + Worker stack;
nothing here depends on the compiler.
