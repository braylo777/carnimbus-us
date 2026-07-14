# CarNimbus — Dealer CRM Lead Routing (TASK-006) Runbook

The CRM seam is **BUILT and deployed but DORMANT**. Nothing changes until you provision the destination below.
Today every Drive Now lead still: stores in `web_leads` → SMS to `ADMIN_PHONE` → buyer's own `mailto:` draft to Cid.

## What's built
- `adfFor(lead)` in `worker.js` — generates **ADF/XML** (Auto-lead Data Format), the industry-standard lead format
  that CDK, VinSolutions, DealerSocket, eLead and Reynolds all ingest. This needs **no partner API and no
  credentials** — ADF is an open format. Includes: vehicle (year/make/model/VIN), buyer phone, and a comments
  block carrying type, deal terms, ZIP/radius, and intent.
- `routeLead(env, lead)` — called from `webLead()` after the DB insert. Returns `"unrouted"` when unconfigured,
  `"routed"` on success, `"crm_<status>"` / `"crm_error"` otherwise. Never throws into the request path.
- Every attempt logs `intent.web_lead_routed` with the outcome in `source` → visible in the NIMBUS event tail.

## What Cid must supply (none of it is guessable)
- [ ] The rooftop's **ADF ingestion URL** *or* **ADF email inbox** (most CRMs expose both; ask his CRM admin for
      "the ADF/XML lead feed endpoint for this rooftop").
- [ ] The **CRM vendor** + **rooftop/dealer ID** — some vendors require the dealer ID inside `<provider>` or as a
      URL path/query param. If so, tell me the exact shape and I'll add it to `adfFor`.
- [ ] Confirm they want `interest="buy"` only (vs. lease/finance-specific routing).
- [ ] Whether they want the buyer's phone required. **Today the scanner does not collect a phone** — `web_leads.phone`
      is optional and the Drive Now flow never asks. Most CRMs will accept a lead without one, but many dealers
      auto-reject phoneless leads. If Cid wants phone-required, that's a form change — say the word.

## Turning it on
```
npx wrangler secret put CRM_ENDPOINT      # the ADF ingestion URL
npx wrangler deploy
```
Then send one test lead and confirm it lands in his CRM. Roll back instantly by unsetting the secret — the code
falls back to the existing SMS + mailto path with no redeploy needed.

## If it's an email inbox rather than a URL
ADF-over-email needs a verified sending domain + `RESEND_API_KEY` (already wired for dealer outreach in
`sendDealerOutreach`). Tell me and I'll add an `CRM_EMAIL` branch to `routeLead` that posts the same ADF body
through Resend instead of HTTP.

## Not built (deliberately) — TASK-007
Inline calendar booking. Blocked on a real decision, not on effort: `/api/book` is session-gated (`withUser`) but
the scanner buyer is anonymous, and `dealer_slots` currently holds **seeded demo data, not Cid's real calendar**.
Options are written up in the Wave AI plan; this is the Thursday scoping question.
