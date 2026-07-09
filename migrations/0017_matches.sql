-- Wave B: backend matching table (dated, no swiping) + sponsored feed flag
CREATE TABLE IF NOT EXISTS matches (
  user_id    INTEGER NOT NULL,
  vdp_id     INTEGER NOT NULL,
  score      REAL,
  created_at TEXT DEFAULT (datetime('now')),
  status     TEXT DEFAULT 'new',          -- new|talking|booked|dismissed
  notified   INTEGER DEFAULT 0,           -- SMS match-notification sent
  PRIMARY KEY (user_id, vdp_id)
);
CREATE INDEX IF NOT EXISTS idx_matches_user ON matches(user_id, created_at DESC);

-- Sponsored/dealer-paid placement flag for community feed comments
ALTER TABLE comments ADD COLUMN sponsored INTEGER DEFAULT 0;
