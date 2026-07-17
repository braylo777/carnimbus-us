-- T-101: store the buyer's selected FICO band so scans price by real credit, not the neutral default.
ALTER TABLE scans ADD COLUMN fico TEXT;
