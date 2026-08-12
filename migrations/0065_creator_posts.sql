-- Submitted posts. disclosure_confirmed is the FTC 16 CFR Part 255 acknowledgement —
-- required to submit; a paid-post network without it is the legal exposure.
CREATE TABLE IF NOT EXISTS creator_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id INTEGER, creator_id INTEGER, drop_id INTEGER,
  post_url TEXT, platform TEXT, reach_declared INTEGER DEFAULT 0,
  disclosure_confirmed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'submitted',                   -- submitted | approved | rejected
  reviewed_at TEXT, created_at TEXT );
CREATE INDEX IF NOT EXISTS idx_creator_posts_creator ON creator_posts(creator_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_creator_posts_status ON creator_posts(status, id DESC);
-- The attribution join: which creator's tracked link produced this lead.
ALTER TABLE web_leads ADD COLUMN creator_claim_id INTEGER;
