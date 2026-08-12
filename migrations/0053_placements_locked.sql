-- R4: a dealer's manual bucket move locks the card so AI auto-bucketing skips it.
ALTER TABLE listing_placements ADD COLUMN locked INTEGER DEFAULT 0;
