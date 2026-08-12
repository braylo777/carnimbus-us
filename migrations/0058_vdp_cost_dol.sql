-- R14: dealer-entered economics — unit cost + lot date power commission/savings KPIs (live day count).
ALTER TABLE vdps ADD COLUMN unit_cost INTEGER;
ALTER TABLE vdps ADD COLUMN lot_date TEXT;
