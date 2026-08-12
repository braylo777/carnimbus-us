-- R7: remember where a link-ingested listing came from + when we last re-checked it (auto sold-detection).
ALTER TABLE vdps ADD COLUMN source_url TEXT;
ALTER TABLE vdps ADD COLUMN source_checked_at TEXT;
