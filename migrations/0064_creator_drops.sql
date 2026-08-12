-- A drop = one dealer-uploaded VIN blasted to the network. ONE row per VIN, not per creator:
-- the feed queries open drops; a claim row is written lazily when a creator actually taps CLAIM.
CREATE TABLE IF NOT EXISTS creator_drops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vin TEXT, vdp_id INTEGER, dealer_id INTEGER,
  rate_cents INTEGER DEFAULT 5000,                   -- $50/post floor; NIMBUS prices up from here
  rate_why TEXT,                                     -- the factors, summing to rate_cents
  locked INTEGER DEFAULT 0,                          -- 0 = NIMBUS priced it · 1 = a human fixed it, never re-priced
  status TEXT DEFAULT 'open', created_at TEXT, expires_at TEXT );
CREATE INDEX IF NOT EXISTS idx_creator_drops_status ON creator_drops(status, id DESC);
CREATE TABLE IF NOT EXISTS creator_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drop_id INTEGER, creator_id INTEGER,
  token TEXT UNIQUE, clicks INTEGER DEFAULT 0,
  status TEXT DEFAULT 'claimed', created_at TEXT );
CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_claims_uniq ON creator_claims(drop_id, creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_claims_creator ON creator_claims(creator_id, id DESC);
