-- C3 (Wave T): comment moderation lifecycle. 'approved' preserves today's instant-post UX (classified inline on insert).
ALTER TABLE comments ADD COLUMN status TEXT DEFAULT 'approved';
