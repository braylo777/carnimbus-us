-- T-102: drag-drop credit/price categorization. One car -> many bands (credit-tier pre-staging).
CREATE TABLE IF NOT EXISTS listing_placements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dealer_id INTEGER, vdp_id INTEGER,
  credit_band TEXT, category TEXT,
  monthly INTEGER, down INTEGER, rate_markup REAL,   -- rate_markup is DEALER-FACING ONLY
  created_at TEXT, updated_at TEXT );
CREATE INDEX IF NOT EXISTS idx_place_dealer ON listing_placements(dealer_id, vdp_id, credit_band);
CREATE INDEX IF NOT EXISTS idx_place_band ON listing_placements(credit_band, vdp_id);
