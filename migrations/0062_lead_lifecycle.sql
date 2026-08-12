-- R23: lead lifecycle ledger — every status change is a permanent timestamped row.
CREATE TABLE IF NOT EXISTS lead_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL,
  dealer_id INTEGER,
  from_status TEXT, to_status TEXT NOT NULL,
  source TEXT NOT NULL,          -- 'dealer' | 'sms' | 'system'
  note TEXT,
  ts TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lead_events_lead ON lead_events(lead_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_lead_events_dealer ON lead_events(dealer_id, ts DESC);
ALTER TABLE web_leads ADD COLUMN status_ts TEXT;
ALTER TABLE web_leads ADD COLUMN followup_stage INTEGER DEFAULT 0;
