-- ⚠⚠ HISTORICAL — APPLIED 2026. NEVER RUN THIS FILE AGAIN. ⚠⚠
--
-- `waitlist_new` no longer exists (the RENAME below consumed it), so a replay would SUCCEED:
-- it would recreate waitlist_new, copy 7 columns that do NOT include `phone`, DROP the live
-- waitlist table, and rename the copy over it — silently destroying every phone number.
-- waitlist.phone is the SMS STOP/START do-not-text list (worker.js:525, :3718), so that is a
-- compliance loss, not just a data loss.
--
-- The line below makes an accidental replay fail LOUDLY on statement 1 instead. RAISE() outside
-- a trigger is a hard error in SQLite ("RAISE() may only be used within a trigger-program"),
-- which is precisely the behaviour we want from a file that must never execute again.
SELECT RAISE(ABORT, '0003 is historical: replaying it DROPs waitlist and destroys every phone number');

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
