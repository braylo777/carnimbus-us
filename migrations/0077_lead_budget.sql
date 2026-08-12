-- 0077_lead_budget.sql — store the cash buyer's stated budget.
--
-- lead.js has always sent `budget`; webLead() only ever passed it to routeLead(), which returns
-- "unrouted" until CRM_ENDPOINT exists. So a cash buyer's entire stated budget — the only number
-- that matters for a cash deal — was collected and discarded on every submission.
--
-- (`credit_band` needed no migration: 0057 added the column and nothing ever wrote it.)
--
-- APPLY WITH:  npx wrangler d1 execute carnimbus-waitlist --remote --file=migrations/0077_lead_budget.sql
-- NEVER with `d1 migrations apply --remote` — the tracker is at 0055, the schema is ahead of it.
--
-- ⚠ NOT IDEMPOTENT: SQLite has no ADD COLUMN IF NOT EXISTS, so a second run errors with
-- "duplicate column name: budget". That is expected and safe — it changes nothing.

ALTER TABLE web_leads ADD COLUMN budget INTEGER;
