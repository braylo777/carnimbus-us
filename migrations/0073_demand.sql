-- Wave D: the demand sensor. carnimbus.us → ai. → app.
--
-- WHAT THIS IS FOR. The free public tool is not a lead magnet, it is a demand sensor. Every search
-- writes a `scans` row: what they wanted, which ZIP, what budget, what credit band, and — the part
-- nothing has ever read — `results`, the number of cars we could show them.
--
-- `results = 0` IS THE ASSET. It is a real person, in a known place, in a known week, with a known
-- budget and credit band, who asked and we had nothing. That is not a missed lead. It is a
-- mispriced car sitting on a lot 8 miles away. demand_cells aggregates those into something a
-- dealer can act on, and clearanceAdvisor() turns them into "drop this unit to $665".
--
-- TWO PRIVACY RULES, BOTH ENFORCED IN THE WRITER, NOT THE READER.
--
--   1. ZIP3, never the full ZIP. substr(zip,1,3) is a metro-scale area. A 5-digit ZIP crossed with
--      a credit band and a budget is close enough to a household to matter.
--   2. k >= 5. A cell built from one scan IS that person — their neighbourhood, their credit, what
--      they can afford. demandRollup()'s INSERT carries `HAVING COUNT(*) >= 5` so a small cell is
--      never written in the first place. Suppressing at read time would leave the row on disk, and
--      a row on disk is a row that leaks.
--
-- Do not relax either one for better resolution. Sharper cells are worth less than the thing they
-- would cost, and this is a public-benefit company whose whole consumer promise is "free, and we
-- are not doing anything weird with this."

CREATE TABLE IF NOT EXISTS demand_cells (
  week        TEXT NOT NULL,   -- strftime('%Y-W%W', first_ts)
  zip3        TEXT NOT NULL,   -- substr(zip,1,3)
  segment     TEXT NOT NULL,   -- segOf(make,model): luxury|truck|minivan|coupe|ev|suv|sedan
  band        TEXT NOT NULL,   -- APR_FICO key: '800+'|'740-799'|'670-739'|'580-669'|'under 580'|'unknown'
  scans       INTEGER NOT NULL,
  unserved    INTEGER NOT NULL,               -- scans where results = 0
  monthly_p25 INTEGER,
  monthly_p50 INTEGER,                        -- the number clearanceAdvisor prices against
  monthly_p75 INTEGER,
  updated_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (week, zip3, segment, band)
);

-- clearanceAdvisor looks up by (zip3, segment) for the current week, once per active unit.
CREATE INDEX IF NOT EXISTS idx_demand_lookup ON demand_cells(zip3, segment, week);
-- The demand board sorts the whole week by unserved.
CREATE INDEX IF NOT EXISTS idx_demand_week   ON demand_cells(week, unserved DESC);

-- Why the advisor said what it said, kept so a dealer can argue with it and so accuracy can be
-- measured later. AUTONOMY-POLICY.md graduation is on MEASURED accuracy; with no record of what was
-- recommended there is nothing to measure, and clearanceAdvisor stays at L0 forever by default.
CREATE TABLE IF NOT EXISTS clearance_recs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  dealer_id    INTEGER NOT NULL,
  vdp_id       INTEGER NOT NULL,
  week         TEXT NOT NULL,
  zip3         TEXT, segment TEXT, band TEXT,
  listed_mo    INTEGER,        -- what it was listed at when we recommended
  suggested_mo INTEGER,        -- what we said to move it to
  unserved     INTEGER,        -- the evidence: how many searches we missed
  reachable    INTEGER,        -- how many of those the suggested price would enter
  age_days     INTEGER,
  confidence   TEXT,           -- high | medium | low, from cell.scans
  outcome      TEXT,           -- NULL | 'taken' | 'skipped'
  skip_reason  TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  resolved_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_recs_dealer ON clearance_recs(dealer_id, outcome, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_recs_open ON clearance_recs(dealer_id, vdp_id, week);
