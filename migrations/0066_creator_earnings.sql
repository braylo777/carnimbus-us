-- Money ledger. Append-and-transition only; clawed_back is how a bad accrual is unwound
-- rather than deleted. No row is ever removed.
CREATE TABLE IF NOT EXISTS creator_earnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id INTEGER, post_id INTEGER, amount_cents INTEGER,
  status TEXT DEFAULT 'accrued',                     -- accrued | approved | paid | clawed_back
  stripe_transfer_id TEXT, paid_at TEXT, created_at TEXT );
CREATE INDEX IF NOT EXISTS idx_creator_earnings_creator ON creator_earnings(creator_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_status ON creator_earnings(status, id DESC);
