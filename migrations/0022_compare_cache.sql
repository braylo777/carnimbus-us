-- Wave I2: cached LLM verdicts for /compare/<a>-vs-<b> SEO pages.
CREATE TABLE IF NOT EXISTS vdp_compare (
  a_id INTEGER NOT NULL, b_id INTEGER NOT NULL, verdict TEXT,
  created_at TEXT DEFAULT (datetime('now')), PRIMARY KEY (a_id,b_id));
