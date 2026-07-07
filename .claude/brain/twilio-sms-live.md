# Twilio SMS is live (trial account) — 2026-07-07

From number: +12132960405 (213 LA). Secrets set on Worker: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
TWILIO_FROM. Inbound webhook on the number → https://carnimbus.com/api/sms/inbound (POST).
Creds also at ~/.twilio-creds (line1 SID, line2 token, 600) for API ops — never print.

Gotchas:
- Account is TRIAL: every SMS is prefixed "Sent from your Twilio trial account", and only
  Verified Caller IDs receive texts. +15128440695 (Brandon) verified; +13104647885 (Cid) NOT yet —
  sends to him log status=failed in sms_log until verified (Console → Verified Caller IDs, text
  option) or the account is upgraded (upgrade also removes the prefix).
- DEV_MODE=0 since demo ship (wrangler.jsonc): OTP arrives by text only. Flip to "1" + deploy to
  restore on-screen code echo (~60s, demo fallback #1 in DEMO-RUNBOOK.md).
- book() + carChat <BOOK> now insert test_drives as status='confirmed' (not 'requested') and send
  instant SMS (buyer pass link + dealer notify); sms_queue row is a +24h reminder, not the primary.
- smsInbound relays non-keyword texts two-way: dealer_lead phone ↔ buyer of latest non-sold
  test_drive. Keywords (STOP/HELP/START) short-circuit first.
