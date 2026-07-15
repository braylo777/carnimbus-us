-- BI: archive the retired name/phone/fico buyer model (never hard-deleted). New buyers view reads web_leads.
-- Live profiles/users stay intact but the console no longer reads them; a hard purge is a separate explicit step.
CREATE TABLE IF NOT EXISTS profiles_archive AS SELECT * FROM profiles;
CREATE TABLE IF NOT EXISTS users_archive    AS SELECT * FROM users;
