-- Phone-first waitlist: phone becomes the primary identity/dedup key.
-- Table rebuild required: 0001 declared email NOT NULL UNIQUE, which would
-- reject phone-only signups. New shape: phone UNIQUE (nullable for legacy
-- email-only rows), email UNIQUE nullable. SQLite treats NULLs as distinct.
CREATE TABLE waitlist_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  lang TEXT,
  created_at TEXT,
  user_agent TEXT,
  ip TEXT,
  sms_consent INTEGER DEFAULT 0
);
INSERT INTO waitlist_new (id, email, lang, created_at, user_agent, ip, sms_consent)
  SELECT id, email, lang, created_at, user_agent, ip, sms_consent FROM waitlist;
DROP TABLE waitlist;
ALTER TABLE waitlist_new RENAME TO waitlist;
