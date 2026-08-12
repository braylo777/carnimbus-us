-- R16: link a lead to its first-party behavioral trail + cache the generated trade image.
ALTER TABLE web_leads ADD COLUMN anon_id TEXT;
ALTER TABLE web_leads ADD COLUMN trade_image TEXT;
CREATE INDEX IF NOT EXISTS idx_events_anon ON events(anon_id);
