-- BI: timestamp cars going OUT so the inventory in/out feed is real (reconcile only flipped active=0 before).
ALTER TABLE vdps ADD COLUMN deactivated_at TEXT;
