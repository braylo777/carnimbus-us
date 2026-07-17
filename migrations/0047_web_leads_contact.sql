-- T-101: Drive Now captures full contact for booking + tax calc, persisted even if the drive isn't booked.
ALTER TABLE web_leads ADD COLUMN first_name TEXT;
ALTER TABLE web_leads ADD COLUMN last_name  TEXT;
ALTER TABLE web_leads ADD COLUMN address    TEXT;
ALTER TABLE web_leads ADD COLUMN appt_slot  TEXT;
ALTER TABLE web_leads ADD COLUMN consent    INTEGER DEFAULT 0;
