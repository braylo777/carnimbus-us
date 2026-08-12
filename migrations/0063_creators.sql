-- Creator Network (slide-4 step 2): creator identity + declared social presence.
-- followers_declared is SELF-REPORTED and never verified — no social API exists in this codebase.
CREATE TABLE IF NOT EXISTS creators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE, pw_hash TEXT, pw_salt TEXT,
  handle TEXT, status TEXT DEFAULT 'pending',        -- pending | approved | suspended
  followers_declared INTEGER DEFAULT 0,
  stripe_account_id TEXT, payouts_enabled INTEGER DEFAULT 0, charges_enabled INTEGER DEFAULT 0,
  -- NIMBUS decision columns. score is MEASURED (CTR, approvals, attributed leads) — declared
  -- followers contribute nothing to it, because nothing here can verify them.
  score INTEGER DEFAULT 0, score_why TEXT, audience_tags TEXT, scored_at TEXT,
  created_at TEXT );
CREATE TABLE IF NOT EXISTS creator_socials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id INTEGER, platform TEXT, handle TEXT, url TEXT,
  followers_declared INTEGER DEFAULT 0,
  verified INTEGER DEFAULT 0,                        -- always 0 today: no social API is wired
  created_at TEXT );
CREATE INDEX IF NOT EXISTS idx_creator_socials_creator ON creator_socials(creator_id);
