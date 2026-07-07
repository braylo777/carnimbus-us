-- Pools v2: promote filterable buyer fields; structure VDP price/geo/mileage.
ALTER TABLE profiles ADD COLUMN zip TEXT;
ALTER TABLE profiles ADD COLUMN max_monthly INTEGER;
ALTER TABLE profiles ADD COLUMN fico TEXT;
ALTER TABLE profiles ADD COLUMN body_pref TEXT;
ALTER TABLE profiles ADD COLUMN timeline TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_budget ON profiles(max_monthly);
ALTER TABLE vdps ADD COLUMN price_total INTEGER;
ALTER TABLE vdps ADD COLUMN mileage INTEGER;
ALTER TABLE vdps ADD COLUMN location_zip TEXT;
CREATE INDEX IF NOT EXISTS idx_vdps_price ON vdps(active, price_mo);
