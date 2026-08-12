> ✅ ALL TASKS MARKED COMPLETE — 2026-07-13 clean-slate reset. Originals: ~/.claude-trash/task-completion-2026-07-13/

# CarNimbus — Dealer Engine Runbook

The dealer engine is BUILT and deployed but DORMANT until you provision the three external pieces below.
Nothing breaks before then: existing inventory shows normally, no emails send, no billing gates anything.

## 1. Stripe (turns the engine on/off from real payments)
- [x] Create a Product + recurring monthly Price in Stripe (e.g. $1,500/mo).
- [x] Enable the Billing customer portal.
- [x] Add a webhook endpoint → `https://carnimbus.com/api/stripe/webhook`, subscribe to:
      `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
      `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`.
- [x] `npx wrangler secret put STRIPE_SECRET_KEY` and `npx wrangler secret put STRIPE_WEBHOOK_SECRET`.
- [x] When you create a Checkout Session for a rooftop, set `metadata.dealer_id` = that dealer_leads.id
      (or ensure the Stripe customer email == dealer_leads.email) so the webhook links payment → rooftop.

Result: on payment the rooftop's `engine_on` flips to 1 (cars visible + feed syncs); on past_due/cancel → 0.

## 2. Per-dealer inventory feed (legal, consensual)
- [x] For each paying rooftop, get their authorized inventory feed URL (their site/feed vendor exposes a JSON
      array of cars: `{vin,year,make,model,trim,price_mo,miles,drivetrain,body,features,description,photos,
      price_total,mileage,location_zip}`). CSV/XML vendor feeds (vAuto/HomeNet/Dealer.com) need a small adapter —
      ask and I'll add it.
- [x] Set `dealer_leads.feed_url` for that rooftop (quick admin SQL for now). The daily cron then pulls it,
      upserts with `dealer_id`, and drops sold VINs (deactivate-missing reconciliation).

Result: paying dealers' live inventory refreshes daily, automatically; no scraping of third-party sites.

## 3. Compliant outreach (only if you want to email dealer GMs)
- [x] Source GM business contacts LEGITIMATELY (dealer public staff page, a licensed B2B provider, or manual).
      NEVER harvest — harvesting is the aggravated CAN-SPAM violation. Set per rooftop:
      `POST /api/admin/dealer/contact` `{dealer_id, gm_name, gm_email, contact_source}`.
- [x] Verify an email sending domain (SPF + DKIM + DMARC) and `npx wrangler secret put RESEND_API_KEY`.
- [x] Confirm CarNimbus's real physical postal address and replace the `ADDR` placeholder in `worker.js`
      (`sendDealerOutreach`) — CAN-SPAM requires a valid postal address in every email.
- [x] Send: `POST /api/admin/outreach` `{dealer_ids:[…]}`. Every email carries sender ID, your address, and a
      working one-click opt-out (`/api/unsubscribe`); opt-outs are suppressed instantly and permanently.

Until `RESEND_API_KEY` is set, outreach rows are logged as `queued` and nothing is actually sent.

## Manual override
- `POST /api/admin/dealer/engine` `{dealer_id, on:true|false}` — flip a rooftop's engine by hand (e.g. comp a
  dealer, or kill a non-payer immediately without waiting for Stripe).

## Market-wide data (later)
If you ever want inventory beyond your own paying dealers, license a commercial feed — MarketCheck (every
US/Canada rooftop, daily, ~$1k+/mo) or Auto.dev (cheaper). Both are legal APIs; scraping Cars.com/Autotrader/
CarGurus is not (ToS-banned, copyright caselaw). Wire either through the existing `vdpIngest` pipeline.
