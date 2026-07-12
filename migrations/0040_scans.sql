-- AC3: every validated "Show My Matches" click, timestamped + IP, deduped per IP+terms (repeats counted)
CREATE TABLE IF NOT EXISTS scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_ts TEXT NOT NULL DEFAULT (datetime('now')),
  last_ts TEXT NOT NULL DEFAULT (datetime('now')),
  ip TEXT NOT NULL,
  dream_car TEXT NOT NULL DEFAULT '',
  deal_type TEXT,
  monthly INTEGER,
  down INTEGER,
  zip TEXT,
  radius INTEGER,
  ua TEXT,
  results INTEGER,
  top_match TEXT,
  repeats INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scans_dedup ON scans(ip, dream_car, deal_type, monthly, down, zip, radius);
CREATE INDEX IF NOT EXISTS idx_scans_ts ON scans(first_ts);
