-- Wave G: Buyer Digital Twin — derived behavioral signals per user + match recency.
CREATE TABLE IF NOT EXISTS buyer_signals (
  user_id INTEGER PRIMARY KEY, signals TEXT, updated_at TEXT DEFAULT (datetime('now')));
ALTER TABLE matches ADD COLUMN ranked_at TEXT;
-- Wave H: dedupe drive reminders.
ALTER TABLE test_drives ADD COLUMN reminded INTEGER DEFAULT 0;
