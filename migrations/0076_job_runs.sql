-- 0076_job_runs.sql — the cron heartbeat.
--
-- Until now there was no `last_run` column anywhere in the schema, so "did the cron run today?"
-- was unanswerable from any surface. The 2026-07-11 incident (migrations committed but never
-- applied; every comment INSERT throwing silently; the feed in degraded fallback) was found by
-- the founder noticing, not by any alarm. This table is what makes that class of failure visible.
--
-- Also the write-failure sink for safeWrite(): a swallowed write still never blocks a request,
-- but it stops being invisible.
--
-- APPLY WITH:  npx wrangler d1 execute carnimbus-waitlist --remote --file=migrations/0076_job_runs.sql
-- NEVER with `d1 migrations apply --remote` — the tracker is at 0055, the schema is at 0075.
--
-- FULLY IDEMPOTENT: both statements are guarded, so re-running this file is a no-op. That is
-- deliberate and it is the standard every migration from here on must meet.

CREATE TABLE IF NOT EXISTS job_runs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  job        TEXT    NOT NULL,          -- cron task name, or "write:<label>" from safeWrite()
  started_at TEXT    NOT NULL,
  ms         INTEGER,
  ok         INTEGER NOT NULL DEFAULT 1,
  error      TEXT
);

CREATE INDEX IF NOT EXISTS idx_job_runs_job ON job_runs(job, started_at DESC);
