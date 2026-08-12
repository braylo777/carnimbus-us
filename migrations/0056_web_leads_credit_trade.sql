-- R11: buyer credit band + trade-in on web_leads (shown on the lead card + fed to the Intel Brief).
ALTER TABLE web_leads ADD COLUMN credit_band TEXT;
ALTER TABLE web_leads ADD COLUMN trade_in TEXT;
