-- U3 (Wave U): real persona pool + scale dial for the synthetic community, replacing syntheticNudger's inline
-- 6-string array + canned question bank. Cox Automotive names are cited reasoning domains only (no live fetch).
CREATE TABLE IF NOT EXISTS personas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, handle TEXT, avatar TEXT, beat TEXT,
  active INTEGER DEFAULT 1,
  next_post_at TEXT
);
-- Singleton config row (id=1) — the literal 10→100→1,000→100,000 ramp dial. Raising these is a config UPDATE,
-- not a redeploy. posts_per_hour_cap exists because uncapped LLM calls at scale is unbounded Workers AI spend.
CREATE TABLE IF NOT EXISTS swarm_config (
  id INTEGER PRIMARY KEY CHECK (id=1),
  active_personas INTEGER DEFAULT 10,
  posts_per_hour_cap INTEGER DEFAULT 5
);
INSERT OR IGNORE INTO swarm_config (id,active_personas,posts_per_hour_cap) VALUES (1,10,5);
INSERT INTO personas (name,handle,avatar,beat) VALUES
  ('Mia R.','mia_r',NULL,'resale value — cites KBB-style market data'),
  ('DeShawn','deshawn_la',NULL,'reliability — cites Carfax-style history/accident signals'),
  ('OC Buyer','oc_buyer',NULL,'financing — cites Dealertrack/vAuto-style terms'),
  ('Road Tripper','road_tripper',NULL,'family/cargo fit — real-world use cases'),
  ('Eco Fan','eco_fan',NULL,'EV/hybrid economics — range, charging, fuel savings'),
  ('Local Driver','local_driver',NULL,'daily commute fit — traffic, parking, gas mileage'),
  ('SoCal Commuter','socal_commuter',NULL,'highway comfort — NVH, adaptive cruise, seat comfort'),
  ('Jane D.','jane_d',NULL,'safety — cites NHTSA/IIHS-style ratings'),
  ('Cid V.','cid_v',NULL,'dealer/service history — cites Manheim-style auction condition grading'),
  ('Ava T.','ava_t',NULL,'first-time buyer questions — plain-language explainers');
