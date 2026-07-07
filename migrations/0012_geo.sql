-- Geo for near-me feed ranking (haversine over users.lat/lng).
ALTER TABLE users ADD COLUMN lat REAL;
ALTER TABLE users ADD COLUMN lng REAL;
ALTER TABLE users ADD COLUMN zip TEXT;
