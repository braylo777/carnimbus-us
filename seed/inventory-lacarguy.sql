-- CarNimbus interim inventory (LAcarGUY-style used cars) so matchmaking demos before the real
-- 833-car feed arrives. Idempotent. Owned by the LAcarGUY dealer (Cid). Photos reuse existing
-- /assets/inventory/*.jpg by body type — swap real photos in later.
--   npx wrangler d1 execute carnimbus-waitlist --remote --file=seed/inventory-lacarguy.sql
INSERT INTO vdps (vin,year,make,model,trim,price_mo,miles,drivetrain,body,features,description,photos,active,embedding_synced,updated_at) VALUES
 ('DEMO-INV-01',2023,'Toyota','RAV4','XLE',620,'22k','AWD','SUV','["Certified","Adaptive cruise"]','Dependable and drama-free — I just keep going.','["/assets/inventory/lexus-nx350.jpg"]',1,0,datetime('now')),
 ('DEMO-INV-02',2022,'Honda','Accord','Sport',540,'28k','FWD','Sedan','["Certified"]','Smart money pick — roomy, sharp, easy on gas.','["/assets/inventory/toyota-camry.jpg"]',1,0,datetime('now')),
 ('DEMO-INV-03',2024,'Tesla','Model 3','RWD',700,'9k','RWD','EV','["Autopilot","1-owner"]','Silent, instant, and always up to date.','["/assets/inventory/porsche-macan.jpg"]',1,0,datetime('now')),
 ('DEMO-INV-04',2021,'Subaru','Outback','Premium',560,'35k','AWD','SUV','["Certified","Roof rails"]','Trailhead today, school run tomorrow. I do both.','["/assets/inventory/audi-q5.jpg"]',1,0,datetime('now')),
 ('DEMO-INV-05',2023,'Lexus','RX 350','Luxury',820,'18k','AWD','SUV','["Certified","Mark Levinson"]','Quiet luxury that never tries too hard.','["/assets/inventory/lexus-nx350.jpg"]',1,0,datetime('now')),
 ('DEMO-INV-06',2022,'Volkswagen','GTI','Autobahn',520,'24k','FWD','Sedan','["Certified","Plaid seats"]','Hot hatch heart, grown-up manners.','["/assets/inventory/bmw-330i.jpg"]',1,0,datetime('now')),
 ('DEMO-INV-07',2024,'Hyundai','Ioniq 5','SEL',640,'12k','AWD','EV','["Ultra-fast charge"]','Retro-future looks, 18-minute charge.','["/assets/inventory/porsche-macan.jpg"]',1,0,datetime('now')),
 ('DEMO-INV-08',2020,'Audi','A4','Premium',470,'41k','AWD','Sedan','["quattro"]','Understated, quick, quattro-sure in the rain.','["/assets/inventory/bmw-330i.jpg"]',1,0,datetime('now')),
 ('DEMO-INV-09',2023,'Kia','Telluride','SX',780,'20k','AWD','SUV','["Certified","3-row"]','Three rows, zero compromises. The whole crew fits.','["/assets/inventory/audi-q5.jpg"]',1,0,datetime('now')),
 ('DEMO-INV-10',2022,'Mazda','CX-5','Grand Touring',500,'27k','AWD','SUV','["Certified"]','Drives richer than the price tag admits.','["/assets/inventory/lexus-nx350.jpg"]',1,0,datetime('now')),
 ('DEMO-INV-11',2021,'BMW','X3','xDrive30i',690,'33k','AWD','SUV','["Certified","M Sport"]','Sport-SUV that still corners like it means it.','["/assets/inventory/audi-q5.jpg"]',1,0,datetime('now')),
 ('DEMO-INV-12',2024,'Toyota','Camry','SE',480,'11k','FWD','Sedan','["Certified"]','Nearly new, barely broken in. Low-drama value.','["/assets/inventory/toyota-camry.jpg"]',1,0,datetime('now')),
 ('DEMO-INV-13',2023,'Ford','Mustang Mach-E','Premium',720,'15k','AWD','EV','["1-owner"]','Mustang badge, electric punch, SUV space.','["/assets/inventory/porsche-macan.jpg"]',1,0,datetime('now')),
 ('DEMO-INV-14',2022,'Volvo','XC60','Momentum',750,'26k','AWD','SUV','["Certified","Safety+"]','Scandinavian calm with a safety obsession.','["/assets/inventory/lexus-nx350.jpg"]',1,0,datetime('now')),
 ('DEMO-INV-15',2020,'Lexus','ES 350','Luxury',560,'38k','FWD','Sedan','["Certified"]','Living-room-smooth. Miles just melt away.','["/assets/inventory/toyota-camry.jpg"]',1,0,datetime('now')),
 ('DEMO-INV-16',2021,'Genesis','GV70','2.5T',730,'22k','AWD','SUV','["1-owner"]','The luxury flex nobody expects — yet.','["/assets/inventory/audi-q5.jpg"]',1,0,datetime('now')),
 ('DEMO-INV-17',2024,'Honda','Civic','Si',450,'10k','FWD','Sedan','["1-owner","6-speed"]','Cheap thrills, done right. Row your own.','["/assets/inventory/bmw-330i.jpg"]',1,0,datetime('now')),
 ('DEMO-INV-18',2022,'Tesla','Model Y','Long Range',780,'19k','AWD','EV','["Autopilot"]','Do-everything EV — space, speed, supercharge.','["/assets/inventory/porsche-macan.jpg"]',1,0,datetime('now')),
 ('DEMO-INV-19',2021,'Acura','RDX','A-Spec',640,'30k','AWD','SUV','["Certified"]','Sharper-dressed cousin of the sensible SUV.','["/assets/inventory/lexus-nx350.jpg"]',1,0,datetime('now')),
 ('DEMO-INV-20',2023,'Nissan','Altima','SR',420,'21k','FWD','Sedan','["Certified"]','Budget-friendly and quietly sporty.','["/assets/inventory/toyota-camry.jpg"]',1,0,datetime('now'))
 ON CONFLICT(vin) DO UPDATE SET price_mo=excluded.price_mo, active=1, embedding_synced=0, updated_at=excluded.updated_at;
UPDATE vdps SET dealer_id=(SELECT id FROM dealer_leads WHERE client_no='CN-LACARGUY') WHERE vin LIKE 'DEMO-INV-%';
