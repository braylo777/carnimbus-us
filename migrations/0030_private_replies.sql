-- R3 (Wave R): AI research replies are a private experience — visible only to the buyer who asked.
-- 0 = public (default, all existing rows); a user_id = visible only to that user (and pinned under their post).
ALTER TABLE comments ADD COLUMN visible_to INTEGER DEFAULT 0;
