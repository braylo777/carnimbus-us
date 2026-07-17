-- T-102: route each Drive-Now lead to the matched car's dealer so it renders in their portal.
ALTER TABLE web_leads ADD COLUMN dealer_id INTEGER;
