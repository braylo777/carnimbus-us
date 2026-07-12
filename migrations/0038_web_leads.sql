-- X2 (Wave X): anonymous website leads — the 5-step Sid form. Routed via admin SMS now; CDK API later.
CREATE TABLE IF NOT EXISTS web_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dream_car TEXT, deal_type TEXT, monthly TEXT, down TEXT,
  zip TEXT, radius TEXT, phone TEXT, ip TEXT,
  routed TEXT DEFAULT 'admin-sms', created_at TEXT
);
