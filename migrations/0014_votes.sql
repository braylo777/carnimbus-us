-- Reddit-style feed: vote counts + multi-image review posts.
ALTER TABLE comments ADD COLUMN upvotes INTEGER DEFAULT 0;
ALTER TABLE comments ADD COLUMN downvotes INTEGER DEFAULT 0;
ALTER TABLE comments ADD COLUMN images TEXT;   -- JSON array of /assets image URLs for review posts
CREATE TABLE IF NOT EXISTS post_votes (
  user_id INTEGER,
  comment_id INTEGER,
  dir INTEGER,                                  -- +1 up, -1 down
  PRIMARY KEY (user_id, comment_id)
);
