-- Wave AF: Dealer Engine — subscription state + inventory on/off + feed + compliant outreach CRM.
ALTER TABLE dealer_leads ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE dealer_leads ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE dealer_leads ADD COLUMN subscription_status TEXT DEFAULT 'none';
ALTER TABLE dealer_leads ADD COLUMN current_period_end TEXT;
ALTER TABLE dealer_leads ADD COLUMN engine_on INTEGER DEFAULT 1;
ALTER TABLE dealer_leads ADD COLUMN feed_url TEXT;
ALTER TABLE dealer_leads ADD COLUMN feed_synced_at TEXT;
ALTER TABLE dealer_leads ADD COLUMN gm_email TEXT;
ALTER TABLE dealer_leads ADD COLUMN gm_name TEXT;
ALTER TABLE dealer_leads ADD COLUMN contact_source TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_dealer_stripe_sub ON dealer_leads(stripe_subscription_id);
CREATE TABLE IF NOT EXISTS dealer_outreach (
  id INTEGER PRIMARY KEY AUTOINCREMENT, dealer_id INTEGER, email TEXT, subject TEXT,
  status TEXT DEFAULT 'queued', sent_at TEXT, opened_at TEXT, replied_at TEXT, unsub_token TEXT,
  created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS email_suppression (
  email TEXT PRIMARY KEY, reason TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_outreach_token ON dealer_outreach(unsub_token);
