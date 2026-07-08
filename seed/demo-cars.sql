-- Real sale prices on the demo inventory so per-buyer monthly is honest.
-- All demo cars share Cid @ Porsche South Bay's dealer_id so the one seeded calendar serves any of them.
-- At $500/mo, $2k down, ~9.3% APR, 72mo: Camry $434 ✓, 330i $482 ✓, NX350/Q5 ~$580 ✗, Macan $983 ✗.

UPDATE vdps SET price=25900 WHERE make='Toyota'  AND model='Camry';
UPDATE vdps SET price=28500 WHERE make='BMW'     AND model LIKE '330%';
UPDATE vdps SET price=41000 WHERE make='Lexus'   AND model LIKE 'NX%';
UPDATE vdps SET price=39500 WHERE make='Audi'    AND model='Q5';
UPDATE vdps SET price=56083 WHERE vin='DEMO-MACAN-2025';

-- Put the demo set under Cid's dealer (Porsche South Bay) so bookings hit the seeded slots.
UPDATE vdps SET dealer_id=(SELECT dealer_id FROM vdps WHERE vin='DEMO-MACAN-2025'), active=1
  WHERE price IS NOT NULL AND dealer_id IS NULL;
