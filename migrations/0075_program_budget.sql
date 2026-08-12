-- 0075_program_budget.sql — deck v13 S-04 step 1: "Deal closes; the program is funded."
--
-- Steps 2-5 of the slide (creators assigned → content campaign → AI website routing → automated
-- traffic) already existed: creator_drops, creator_claims, creator_posts, creator_earnings, and
-- the /c/<token> attribution rail. Step 1 did not. Creator spend accrued against nothing, so the
-- loop the deck draws as a circle was open at the top.
--
-- APPLY WITH:  npx wrangler d1 execute carnimbus-waitlist --remote --file=migrations/0075_program_budget.sql
-- NEVER with `d1 migrations apply --remote` — the d1_migrations tracker is 14 behind the real
-- schema and would replay ten ALTER TABLE ADD COLUMNs on columns that already exist.
--
-- NOT IDEMPOTENT: the ALTER at the bottom errors on a second run ("duplicate column name"). That
-- is expected and correct — SQLite has no ADD COLUMN IF NOT EXISTS. The two statements above it
-- are guarded and safe to re-run.

CREATE TABLE IF NOT EXISTS dealer_programs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  dealer_id    INTEGER NOT NULL,
  -- Funded by closed deals, in appApprove() — the one human-gated path to SETTLED.
  budget_cents INTEGER NOT NULL DEFAULT 0,
  -- A MIRROR of creator_earnings, never an authority. Money still moves only through the
  -- creator_payout verb on ai., which is confirm-gated and L1-forever per AUTONOMY-POLICY.md:20.
  spent_cents  INTEGER NOT NULL DEFAULT 0,
  status       TEXT    NOT NULL DEFAULT 'active',   -- active | paused
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);

-- The ON CONFLICT target in appApprove() binds to exactly this column list. SQLite requires the
-- conflict target to match a unique index; change one and the upsert silently becomes an error.
CREATE UNIQUE INDEX IF NOT EXISTS idx_programs_dealer ON dealer_programs(dealer_id);

ALTER TABLE creator_drops ADD COLUMN program_id INTEGER;
