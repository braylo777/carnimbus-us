-- C1 (Wave T): internal audit flag for founder-approved synthetic feed agents. NEVER rendered to end users.
ALTER TABLE comments ADD COLUMN synthetic INTEGER DEFAULT 0;
CREATE TABLE IF NOT EXISTS synthetic_agent_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  vdp_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  persona TEXT NOT NULL
);
