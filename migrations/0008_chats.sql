-- 0008: persisted car-chat threads + display handles for demo users
CREATE TABLE IF NOT EXISTS chats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  vdp_id INTEGER NOT NULL,
  role TEXT NOT NULL,            -- 'user' | 'car'
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chats_uv ON chats(user_id, vdp_id, id);
ALTER TABLE users ADD COLUMN handle TEXT;
