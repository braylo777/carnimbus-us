-- AD4: cash budget on scans + dedup index includes it (NOT NULL DEFAULT 0 keeps dedup exact — no NULL-distinct trap)
ALTER TABLE scans ADD COLUMN budget INTEGER NOT NULL DEFAULT 0;
DROP INDEX IF EXISTS idx_scans_dedup;
CREATE UNIQUE INDEX idx_scans_dedup ON scans(ip, dream_car, deal_type, monthly, down, budget, zip, radius);
