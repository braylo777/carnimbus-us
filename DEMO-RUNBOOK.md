# LAcarGUY Demo Runbook — CarNimbus end-to-end
Brandon = buyer (512-844-0695) · Cid = dealer (310-464-7885, Porsche South Bay)

## Before the demo (5 min)
1. Reset state: `npx wrangler d1 execute carnimbus-waitlist --remote --file=seed/demo-reset.sql`
2. Check: Brandon's phone + Cid's phone charged, both on cellular; Cid signed into
   `dealer.carnimbus.us` on the laptop; Brandon logged OUT (fresh sign-in on camera).

## The 10 steps
1. **Homepage** — `carnimbus.us`. New "old way vs CarNimbus way" visuals. Tap **Log in**.
2. **Login** — enter 512-844-0695 → code arrives **by text** → enter → in.
3. **Profile** — questionnaire: Brandon Lopez / 90064 / Finance / $5k / ~$900 / 800+ / $150k+ /
   dream car **"2025 black McLaren Artura"** / Upgrade / Weightlifting · Chess · Traveling.
4. **Match me** — Top Matches: the **2025 Porsche Macan** ranked with "Chosen because…" (honors the
   McLaren, fits budget + nearby).
5. **Talk to the car** — ask "how fast are you?" (real specs: ~6.0s 0-60, 144 mph). Have fun — it
   has a personality and never invents numbers.
6. **Schedule test drive** — Schedule Test Drive → Today · 4:00 PM → Confirm.
7. **Appointment** — Brandon's phone: pass-link text arrives instantly. **Cid's phone: new-appointment
   text arrives instantly.** Cid replies by text → lands on Brandon's phone (two-way relay).
8. **Pass** — open the pass link: QR + desk code.
9. **Save to phone** — tap "Save this pass 📲" → Share → Add to Home Screen.
10. **Scan at dealership** — Cid: console shows the appointment **CONFIRMED** → Scan QR · check in →
    ARRIVED → Scan QR · mark sold → **SOLD**. KPIs tick up.

## Fallbacks (in order of likelihood)
- **Twilio hiccup (no OTP text):** edit wrangler.jsonc `"DEV_MODE":"1"` → `npx wrangler deploy`
  (~60s) — code then shows on screen as well.
- **Live booking fails:** run the standby booking so Cid's console is populated:
  `npx wrangler d1 execute carnimbus-waitlist --remote --command "INSERT INTO test_drives (user_id,vdp_id,center,slot,status,pass_token,created_at) SELECT u.id,v.id,'Porsche South Bay','Today, 4:00 PM','confirmed','DEMOFALLBACKPASS000000000001',datetime('now') FROM users u,vdps v WHERE u.phone='+15128440695' AND v.vin='DEMO-MACAN-2025';"`
- **QR won't scan (lighting):** Cid types the 6-char desk code on `dealer.carnimbus.us/scan`.

## After (reset for the next run)
`npx wrangler d1 execute carnimbus-waitlist --remote --file=seed/demo-reset.sql`
