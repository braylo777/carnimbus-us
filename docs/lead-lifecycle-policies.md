# Lead Lifecycle Policies (R23)

Status vocabulary: **confirmed | sold | no_show | cancelled**. Every change goes through
`leadTransition()` in worker.js — the only status mutator — which stamps `web_leads.status_ts`,
writes a permanent `lead_events` ledger row, logs the events-spine action, and runs these policies.
`cancelled` = buyer called it off before the slot (only possible over text). `no_show` = the slot
passed without arrival. Both are re-engageable; they mean different things in the funnel.

| # | When | Automated effect |
|---|------|------------------|
| P1 | any → any | Ledger row + `status_ts` stamp; `dealer.lead_<status>` event; console buckets update |
| P2 | → sold | One thank-you text at T+2h ("Congrats on the <car> — I'm here if any question pops up."), then silence forever. Sold leads are never re-marketed. |
| P4 | → no_show | T+1h: "We had the <car> out front for you — want me to grab another time that works better?" |
| P5 | → no_show | T+1d: "Still holding your <car> match. Reply with a day that works…" · T+3d final: "I'll keep your match saved — text me whenever you're ready." Max 3 messages, ever. |
| P6 | buyer texts CANCEL (confirmed lead) | Instant booking cancel + reply "No problem — your drive's cancelled. Want me to move it instead? Reply with a day that works." Console flips in real time. STOP/UNSUBSCRIBE remain carrier opt-outs; CANCEL only opts out when no live lead matches the phone. |
| P7 | → cancelled | One win-back at T+2d ("Your <car> match is still reserved…"), then stop. |
| P8 | no_show/cancelled lead replies with a day word | Back to **confirmed** → reappears on the Matches board; reply "You're back on the books — we'll confirm the exact time shortly." |
| P9 | any queued text | Quiet hours: sends land 9:00–20:00 PT only (clamped to next 9am otherwise). |
| P10 | STOP | Consent zeroed, all pending follow-ups deleted, `followup_stage=99` — the sequence is dead forever. Suppression/consent are also checked at send time by `runQueue`. |
| P11 | any transition | All pending follow-ups for that phone are wiped first — no stale message ever fires after a status changes. |
| P12 | → no_show/cancelled | Lead stays fully visible to NIMBUS (`show no-shows`, `show cancellations`, `show win-backs`) and in the panel TIMELINE. |
| P13 | 2nd no_show for the same lead | No auto-texts — flagged for a personal call instead. Never pushy. |
| P14 | all texts | ≤160 chars, human voice, dealership's CarNimbus line, no links. |
| P15 | Twilio dark | Sends no-op safely but the queue + ledger still record intent — history is complete the day Twilio goes live. |

Console: Confirmed sorts by soonest slot (the future); Sold/No-show/Cancelled sort by `status_ts`
newest-first (the history), with the outcome timestamp on the time rail. The panel's **View timeline**
shows the ledger + every follow-up sent/queued. Trends exposes `outcomes` (status counts + win-backs).
