-- Wave D2: fix the demand sensor.
--
-- WHAT WAS WRONG. 0073 defined unserved demand as `scans.results = 0` — "we showed them nothing."
-- Measured against production on 2026-08-03: across all 62 scans the MINIMUM result count was 17.
-- Never zero, not once. Because search() widens the radius and relaxes the budget until it finds
-- something, `results = 0` is effectively unreachable while there is any inventory at all. The
-- signal could never fire, so demand_cells.unserved would have stayed 0 forever and
-- clearanceAdvisor — which ranks on `unserved × age` — would have scored every unit at zero.
--
-- THE RIGHT SIGNAL WAS ALREADY BEING COMPUTED AND THROWN AWAY. search() returns
-- `reason: "widen_radius" | "over_budget" | "need_inputs"` to the browser so the UI can say "nothing
-- within your radius — here are the nearest". That is the real miss: not "we showed you nothing",
-- but "nothing we showed you was what you asked for". The INSERT INTO scans never stored it.
--
--   widen_radius — we had to leave their search area to answer
--   over_budget  — we had to exceed their monthly to answer
--   need_inputs  — they never gave us enough to search (NOT demand; excluded from unserved)
--   NULL         — a clean hit, inside radius and inside budget
--
-- top_mo records the best match's monthly payment so the gap between what they asked for and what
-- we could actually offer is measurable, not just its existence.

ALTER TABLE scans ADD COLUMN reason TEXT;
ALTER TABLE scans ADD COLUMN top_mo INTEGER;

-- LOT AGE. clearanceAdvisor gates on age >= 30 days, sourced from vdp_specs.days_on_lot or
-- vdps.lot_date. In production 0 of 95 live cars had days_on_lot and 1 of 95 had lot_date, so every
-- unit computed as age 0 and was skipped. Dealers will fill lot dates in eventually; until they do
-- the system needs a floor it can defend.
--
-- first_seen is that floor: the earliest moment we have evidence the unit existed. It SYSTEMATICALLY
-- UNDERSTATES true lot age — the car was on the lot before we ever saw it — which is the safe
-- direction to be wrong in, because it means we never call a fresh unit aged.
ALTER TABLE vdps ADD COLUMN first_seen TEXT;

-- Backfill from the event spine. All 95 live cars have events; the earliest is 2026-07-09.
UPDATE vdps SET first_seen = (SELECT MIN(e.ts) FROM events e WHERE e.vehicle_id = vdps.id)
WHERE first_seen IS NULL
  AND EXISTS (SELECT 1 FROM events e WHERE e.vehicle_id = vdps.id);

-- Anything with no event history at all starts its clock now rather than pretending to be old.
UPDATE vdps SET first_seen = datetime('now') WHERE first_seen IS NULL;

CREATE INDEX IF NOT EXISTS idx_vdps_first_seen ON vdps(active, first_seen);
CREATE INDEX IF NOT EXISTS idx_scans_reason    ON scans(reason);
