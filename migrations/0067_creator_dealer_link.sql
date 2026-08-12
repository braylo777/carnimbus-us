-- Dealer staff can sign in to the Creator Network with their existing dealer credentials.
-- dealer_id records the provenance of an auto-provisioned creator account (NULL = self-serve signup).
ALTER TABLE creators ADD COLUMN dealer_id INTEGER;
