-- 0009: dealer tenancy — own inventory + derived appointment/chat isolation.
-- vdps.dealer_id is the single ownership source; test_drives/chats scope via their vdp join.
-- Existing (demo/legacy) rows stay NULL = visible to any active dealer (demo-safe);
-- inventory uploaded by a real dealer is stamped with their dealer_leads.id and isolated.
ALTER TABLE vdps ADD COLUMN dealer_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_vdps_dealer ON vdps(dealer_id);
