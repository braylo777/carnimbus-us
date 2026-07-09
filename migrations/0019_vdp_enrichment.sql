-- Wave E: Inventory Intelligence Agent output. One enrichment row per vehicle.
CREATE TABLE IF NOT EXISTS vdp_enrichment (
  vdp_id            INTEGER PRIMARY KEY,
  summary           TEXT,
  pros              TEXT,   -- JSON array
  cons              TEXT,   -- JSON array
  ideal_buyer       TEXT,
  financing_context TEXT,
  created_at        TEXT DEFAULT (datetime('now'))
);

-- Wave E4: Growth Analytics Agent weekly funnel roll-up (append-only).
CREATE TABLE IF NOT EXISTS growth_rollup (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT DEFAULT (datetime('now')),
  data       TEXT   -- JSON funnel snapshot
);
