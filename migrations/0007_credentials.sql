-- 0007: buyer SIDs + dealer client numbers (access-credential system)
ALTER TABLE users ADD COLUMN sid TEXT;
ALTER TABLE dealer_leads ADD COLUMN client_no TEXT;
ALTER TABLE dealer_leads ADD COLUMN status TEXT DEFAULT 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_sid ON users(sid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dealer_client ON dealer_leads(client_no);
