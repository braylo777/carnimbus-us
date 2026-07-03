-- Adds per-IP rate-limiting support and SMS/marketing consent tracking.
ALTER TABLE waitlist ADD COLUMN ip TEXT;
ALTER TABLE waitlist ADD COLUMN sms_consent INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_waitlist_ip_created ON waitlist(ip, created_at);
