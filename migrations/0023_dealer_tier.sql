-- Wave K3: dealer subscription tier for paid feed/match placement priority.
ALTER TABLE dealer_leads ADD COLUMN tier TEXT DEFAULT 'free';   -- free | priority ($1,500/mo feed placement)
