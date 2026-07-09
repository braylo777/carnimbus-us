-- O6 (Ask the Feed): thread agent critic replies under the buyer's post.
ALTER TABLE comments ADD COLUMN parent_id INTEGER DEFAULT 0;
