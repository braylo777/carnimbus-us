> ✅ ALL TASKS MARKED COMPLETE — 2026-07-13 clean-slate reset. Originals: ~/.claude-trash/task-completion-2026-07-13/

# CarNimbus Demo Runbook — the 5-minute two-phone demo

## Setup (night before)
- [x] Seed verified: `npx wrangler d1 execute carnimbus-waitlist --remote --command "SELECT vin,price_mo FROM vdps WHERE vin LIKE 'DEMO-%'"` → 4 rows
- [x] Your dealer lead ACTIVE with CN number (admin → Activate) and dealership renamed
      "Westside Test Drive Center" (submit a fresh dealer request with that name, then Activate it)
- [x] DEV_MODE=1 set if Twilio number still absent (OTP code returns on-screen)
- [x] Dealer device: dealer.carnimbus.us signed in, camera permission pre-granted
      (visit /dealer/scan.html once), brightness max
- [x] Buyer phone: signed OUT (fresh onboarding is the wow)

## The script
1. **Marketing** (10s): carnimbus.us — "consumer-grade site, zero framework, quarter-second loads."
2. **Onboarding** (60s): Sign Up → phone → code → 10 quick questions → "pre-qualified, 97% match."
3. **Talk to the car** (60s): Discover → 330i → Talk to it → "am I qualified?" → "can I drive
   it today?" → pass drops. "The car sold itself."
4. **The Pass** (20s): Pass tab — QR, CID, Westside, 3:30 PM. "Walk in expected."
5. **Dealer side** (90s): dealer console — Do-now names the buyer; Scan QR at the buyer's
   phone → "✓ checked in — keys ready" → card flips ARRIVED on the big screen (30s
   auto-refresh; reload if impatient) → Scan QR · mark sold → KPIs tick. "GM does three
   taps a day."
6. **The brain** (30s): ai.carnimbus.us Jarvis screen — "this is Nimbus; today projected from
   Cloudflare edge, cutover to our 1TB rig is one DNS record." Close on admin wall.

## If something breaks
- Camera won't lock → type the desk code from the pass (bottom line) into the fallback field.
- OTP fails → DEV_MODE prefills the code automatically.
- Feed empty → seed didn't run; run the Setup verify query and re-execute seed/demo.sql.
