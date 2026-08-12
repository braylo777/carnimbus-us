-- Permanent personal affiliate link per creator ("their" link, always copyable), alongside the
-- existing per-car claim links. A creator now has two ways to send us traffic.
ALTER TABLE creators  ADD COLUMN ref_token TEXT;
ALTER TABLE creators  ADD COLUMN ref_clicks INTEGER DEFAULT 0;
-- web_leads carries BOTH: creator_claim_id = the specific car link that produced it (nullable),
-- creator_id = whoever earned it by EITHER link. Every lead-counting query must use creator_id,
-- or leads arriving through a personal link vanish from scores, payouts, and the NIMBUS funnel.
ALTER TABLE web_leads ADD COLUMN creator_id INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS idx_creators_ref_token ON creators(ref_token);
CREATE INDEX IF NOT EXISTS idx_web_leads_creator ON web_leads(creator_id);
