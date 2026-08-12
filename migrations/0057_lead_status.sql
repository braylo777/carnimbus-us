-- R13: dealer-facing lead outcome. confirmed (default) -> sold | no_show.
ALTER TABLE web_leads ADD COLUMN status TEXT DEFAULT 'confirmed';
