-- R15: compliance seed (build-list #35/#37) — consent metadata + suppression list. Cheap now, expensive later.
ALTER TABLE web_leads ADD COLUMN consent_ts TEXT;
ALTER TABLE web_leads ADD COLUMN consent_url TEXT;
ALTER TABLE web_leads ADD COLUMN consent_cert TEXT;
CREATE TABLE IF NOT EXISTS suppression (id INTEGER PRIMARY KEY AUTOINCREMENT, email_hash TEXT, phone_hash TEXT, reason TEXT, created_at TEXT);
CREATE INDEX IF NOT EXISTS idx_suppr_email ON suppression(email_hash);
CREATE INDEX IF NOT EXISTS idx_suppr_phone ON suppression(phone_hash);
