-- Q7 (Wave Q): mark dealer-paid recommendation posts as ads. The comments GET already SELECTs c.sponsored
-- (worker.js) and sorts sponsored-first; without this column it silently falls back to the recency query.
ALTER TABLE comments ADD COLUMN sponsored INTEGER DEFAULT 0;
