-- Dealer availability calendar. Cid Conalucci @ Porsche South Bay for the demo; keyed by dealer_id so it generalizes.
CREATE TABLE IF NOT EXISTS dealer_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dealer_id INTEGER,
  starts_at TEXT,        -- "YYYY-MM-DD HH:MM" local wall-clock, matches test_drives.slot
  taken INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_slots_open ON dealer_slots (dealer_id, taken, starts_at);
