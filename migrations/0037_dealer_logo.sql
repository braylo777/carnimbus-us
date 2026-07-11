-- U2 (Wave U): dealer logo asset path for sponsored-post branding; NULL falls back to initials in feed.js.
ALTER TABLE dealer_leads ADD COLUMN logo TEXT;
-- U2: which rooftop a sponsored/agent post is about.
ALTER TABLE comments ADD COLUMN dealer_id INTEGER;
