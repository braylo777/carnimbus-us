-- Creator identity: the round avatar + short display name in the console header.
-- Avatars are 96x96 JPEG data URIs written by the browser after a client-side crop/resize,
-- hard-capped at 40KB by /api/creator/avatar. No R2 bucket needed at this scale.
ALTER TABLE creators ADD COLUMN avatar TEXT;
ALTER TABLE creators ADD COLUMN display_name TEXT;
-- An avatar can be staged BEFORE a creator row exists. Dealer staff (e.g. Max) auto-provision
-- their creator account on first dealer-credential login; the staged row attaches at that moment
-- so their face is present the first time they ever see the console.
CREATE TABLE IF NOT EXISTS creator_avatar_stage (
  email        TEXT PRIMARY KEY,
  avatar       TEXT NOT NULL,
  display_name TEXT,
  created_at   TEXT
);
