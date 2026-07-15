-- BI: email is the new contact channel (captured later via the appointment API); phone retired.
ALTER TABLE web_leads ADD COLUMN email TEXT;
