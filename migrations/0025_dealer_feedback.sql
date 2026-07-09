-- N7: dealer post-test-drive voice feedback (recorded → Whisper transcript → stored, per dealer).
CREATE TABLE IF NOT EXISTS dealer_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dealer_id INTEGER NOT NULL,
  drive_id INTEGER,
  transcript TEXT,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_dealer_feedback_dealer ON dealer_feedback(dealer_id, id DESC);
