# AD-MANAGER-RUNBOOK — autonomous Meta ad pipeline

**Goal:** one Claude prompt → Higgsfield creative → Meta FB/IG campaign → traffic to carnimbus.com →
web-leads that reach the team. Trial with an approval gate, then hands-off.
**Companion:** `AUTONOMY-POLICY.md` (spend/authority) · `EVENT-TAXONOMY.md` (funnel events) ·
`DEALER-CRM-RUNBOOK.md` (lead routing). Skill: `.claude/skills/ad-campaign/`.
**Status legend:** ☐ todo · ◐ in progress · ☑ done. Owner: **[YOU]** dashboard · **[CC]** Claude Code.

## Live status checklist
### Phase 0 — work email `braylo@carnimbus.com` (send+receive)
- ☐ [YOU] Cloudflare → carnimbus.com → Email → Email Routing → address `braylo@carnimbus.com` → forward to Gmail
- ☐ [CC] Confirm SPF `include:_spf.resend.com`, Resend DKIM CNAMEs, `_dmarc` TXT on carnimbus.com
- ☐ [YOU] Gmail "Send mail as" → SMTP `smtp.resend.com:465` user `resend` pass=<Resend API key>

### Phase 1 — Meta API access (Page/BM/Ad-Account/payment already exist)
- ☐ [YOU] Business Settings → Security Center → **Business Verification** (LONG POLE — start first, 1–2 days)
- ☐ [YOU] Data Sources → Datasets → Pixel `carnimbus-web` → copy **Pixel ID**
- ☐ [YOU] Events Manager → Conversions API → **Generate access token** → hand to [CC] as a secret
- ☐ [YOU→CC] provide Ad Account ID (`act_…`), Page ID, Pixel ID, and Sid & Max lead-notify emails

### Phase 2 — MCPs
- ☐ [CC] `claude mcp add --scope user --transport http meta-ads https://mcp.facebook.com/ads` → [YOU] OAuth
- ☐ [CC] confirm Higgsfield MCP (already connected) + smoke-test both read-only (no spend)

### Phase 3 — conversion tracking + lead email (in `worker.js`, BEFORE spend; DEV_MODE-testable)
- ☐ [CC] secret `META_CAPI_TOKEN` + var `META_PIXEL_ID` + var `LEAD_NOTIFY_EMAILS`
- ☐ [CC] `metaCapi()` helper → fire `Lead` in `webLead()` (worker.js:1960), `Schedule` in `book()` (worker.js:1318)
- ☐ [CC] capture `fbclid`/`utm_*` → `web_leads` columns (D1 migration) → derive `fbc`
- ☐ [CC] Ad-lead email: make `/api/webleads` (cold ad traffic) email the **LAcarGUY `gm_email`** (Sid & Max's work address) — reuse the EXISTING Resend + `gm_email` path that drive-now/booking already uses (`from CarNimbus <hello@carnimbus.com>`). Today the web-lead form only SMS's `ADMIN_PHONE`; the drive-now booking already reaches the dealer (SMS to `dl.phone` + Resend to `gm_email`). Ads land on the lead form, so wire it to the same LAcarGUY inbox.

### Phase 4 — autonomous skill + workflow (approval gate → hands-off)
- ◐ [CC] `.claude/skills/ad-campaign/SKILL.md` scaffolded (guardrail constants + pipeline); wiring pending MCP OAuth
- ☐ [CC] Workflow: Higgsfield creative → Meta campaign PAUSED (≤caps) → `AskUserQuestion` approval → publish → monitor
- ☐ caps enforced: `DAILY_CAP_USD=20`, `LIFETIME_CAP_USD=200`, `APPROVAL_GATE=on`, kill-switch

### Phase 5 — trial → hands-off
- ☐ 2–3 supervised campaigns; verify creative + CPL + full attribution (Meta event + web_leads row + email + SMS)
- ☐ flip `APPROVAL_GATE=off` once trusted (caps + kill-switch stay on)

## YOUR STEP-BY-STEP (human-only — do in this order; after #7 Claude is in control)
1. **Start Meta Business Verification NOW** (the long pole, 1–2 days). business.facebook.com →
   Business Settings → Security Center → complete verification. → *hand me:* nothing yet, just start it.
2. **Turn on the work email.** Cloudflare → carnimbus.com → Email → Email Routing → enable → add
   `braylo@carnimbus.com` → forward to your Gmail → click the confirm link Gmail receives.
   → *hand me:* "email routing on."
3. **Grab 3 Meta IDs.** Events Manager → your dataset: **Pixel ID**. Business Settings → Ad Accounts:
   **Ad Account ID (`act_…`)**. Business Settings → Pages: **Page ID**. → *hand me:* those 3 numbers (safe to paste).
4. **Generate the CAPI token** (secret — do NOT paste in chat). Events Manager → dataset → Settings →
   Conversions API → Generate access token → copy it. → *hand me:* say "ready" and I'll run
   `wrangler secret put META_CAPI_TOKEN`; you paste it into that prompt only.
5. **Confirm the lead inbox.** Tell me the **LAcarGUY work email** for Sid & Max (or confirm it's the
   `gm_email` on the LAcarGUY dealer record). → *hand me:* the address(es).
6. **Connect the Meta MCP.** I run `claude mcp add … meta-ads https://mcp.facebook.com/ads`; a browser
   opens → **you click "Allow"** granting the CarNimbus Ad Account + Page. → *hand me:* "authorized."
7. **Fund + set the trial budget.** Confirm the ad account has a working card and tell me the trial cap
   (default $20/day, $200 lifetime). → *hand me:* "funded, trial cap = $X."

→ **After #7 I'm in control:** I generate creative (Higgsfield), draft the campaign PAUSED within your
caps, show it to you for one-tap approval (trial only), publish, and report cost-per-lead. After 2–3
good trial runs I flip `APPROVAL_GATE=off` and it's prompt → live, hands-off (caps + kill-switch stay on).

## Guardrails (hard)
- Real money: campaigns start **PAUSED**, spend caps enforced in-skill, kill-switch pauses all. No
  `07-finc` auto-write — Brandon funds the ad account + approves budgets.
- **Meta Special Ad Category:** keep creative about car-matching/test-drive, NOT financing/credit
  approval (the soft-pull FICO angle would force the *Credit* category → restricted geo/age targeting).
- Use the **official** Meta MCP (no third-party token custody). Ramp spend gradually (anti-flagging).

## Code anchors (from repo map)
- Landing/ad target: `site/index.html` ZIP-first lead form → `POST /api/webleads` → `webLead()` worker.js:1960 → D1 `web_leads`.
- Booking/appointments: `book()` worker.js:1318 → event `action.appointment_set` (Meta `Schedule`).
- Email transport: Resend, from `CarNimbus <hello@carnimbus.com>` (only outbound today: `dealerContact` ~worker.js:770).
- Funnel events to map → Meta: `intent.web_lead` → Lead · `action.appointment_set` → Schedule.
- Beachhead geo: ZIP 90277 (South Bay) — `assets/data/zip-centroids-socal.json`.
