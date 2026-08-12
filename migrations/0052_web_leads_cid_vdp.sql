-- Round 3: persist the matched car's vdp, a stable per-buyer CID, and a cached AI intel brief.
ALTER TABLE web_leads ADD COLUMN vdp_id INTEGER;
ALTER TABLE web_leads ADD COLUMN cid TEXT;
ALTER TABLE web_leads ADD COLUMN intel_brief TEXT;
