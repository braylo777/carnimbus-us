-- Wave F: dealer ROI — revenue attribution + timestamped status transitions.
ALTER TABLE test_drives ADD COLUMN sale_price INTEGER;
ALTER TABLE test_drives ADD COLUMN arrived_at TEXT;
ALTER TABLE test_drives ADD COLUMN sold_at TEXT;
CREATE TABLE IF NOT EXISTS drive_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, drive_id INTEGER NOT NULL,
  status TEXT NOT NULL, ts TEXT DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS idx_drive_events_drive ON drive_events(drive_id);
