-- R7-D: demo-vs-real guardrails. A demo tenant's traffic is tagged so ops/investor metrics never count it.
ALTER TABLE dealer_leads ADD COLUMN is_demo INTEGER DEFAULT 0;
ALTER TABLE web_leads ADD COLUMN is_demo INTEGER DEFAULT 0;
