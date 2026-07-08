-- Real sale price on inventory → per-buyer monthly is computed, not stored. Template for the LA Car Guy dump.
ALTER TABLE vdps ADD COLUMN price INTEGER;
UPDATE vdps SET price=56083 WHERE vin='DEMO-MACAN-2025';
