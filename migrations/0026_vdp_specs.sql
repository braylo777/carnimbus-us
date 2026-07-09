-- O3: master per-car spec table (vision-ingested from the 100 dealer listing PDFs). Keyed by VIN; joined by vdpOne.
CREATE TABLE IF NOT EXISTS vdp_specs (
  vin TEXT PRIMARY KEY,
  exterior_color TEXT,
  interior_color TEXT,
  engine TEXT,
  transmission TEXT,
  mpg_city INTEGER,
  mpg_hwy INTEGER,
  mpg_combined INTEGER,
  range_mi INTEGER,
  fuel_type TEXT,
  seating INTEGER,
  options_json TEXT,
  mileage_exact INTEGER,
  located_at TEXT,
  raw_notes TEXT,
  updated_at TEXT
);
