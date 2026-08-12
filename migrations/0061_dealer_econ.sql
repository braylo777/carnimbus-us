-- R20: per-store economics so commission/savings are REAL, not industry estimates.
ALTER TABLE dealer_leads ADD COLUMN commission_pct REAL;
ALTER TABLE dealer_leads ADD COLUMN holding_per_day INTEGER;
ALTER TABLE dealer_leads ADD COLUMN pack_fee INTEGER;
