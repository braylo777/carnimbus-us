-- D1 (Wave T): pricing MODEL only — no live billing. base + slot premium computed for admin/console display.
ALTER TABLE dealer_leads ADD COLUMN base_fee INTEGER DEFAULT 1500;
ALTER TABLE dealer_leads ADD COLUMN ad_slot INTEGER;          -- 1-3 or NULL
ALTER TABLE dealer_leads ADD COLUMN slot_premium INTEGER DEFAULT 0;
