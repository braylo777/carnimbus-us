-- Wave C: Nimbus Phase 0 event spine — append-only behavioral event log.
-- Golden rule: INSERT only. Never UPDATE or DELETE a row. Identity stitching = new marker rows.
CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts          TEXT DEFAULT (datetime('now')),
  cid         TEXT,          -- stable customer id (cidFor(uid)) once known
  anon_id     TEXT,          -- first-party anon cookie id before sign-in
  action      TEXT NOT NULL, -- taxonomy: <prefix>.<verb>, prefix in the locked set
  vehicle_id  INTEGER,
  location    TEXT,
  device      TEXT,
  session_id  TEXT,
  source      TEXT,
  duration_ms INTEGER,
  confidence  REAL
);
CREATE INDEX IF NOT EXISTS idx_events_ts   ON events(ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_anon ON events(anon_id);
CREATE INDEX IF NOT EXISTS idx_events_cid  ON events(cid);
