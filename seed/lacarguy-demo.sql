-- CarNimbus × LAcarGUY live-demo seed for James — 2025 Porsche Macan (Brandon = buyer).
-- Idempotent; safe to re-run. Run after seed/demo.sql:
--   npx wrangler d1 execute carnimbus-waitlist --remote --file=seed/lacarguy-demo.sql
-- NOTE: James's phone is a placeholder; set his real number on demo day:
--   ... --command "UPDATE dealer_leads SET phone='<JAMES_PHONE>' WHERE client_no='CN-LACARGUY';"

-- 1. James's LAcarGUY dealer account, pre-activated (status='active' + client_no).
INSERT INTO dealer_leads (name,dealership,role,phone,email,client_no,status,created_at)
 SELECT 'Cid','Porsche South Bay','GM','+13104647885','cid@lacarguy.com','CN-LACARGUY','active',datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM dealer_leads WHERE client_no='CN-LACARGUY');

-- 2. The 2025 Porsche Macan, owned by James (dealer_id = his lead). Specs swappable.
INSERT INTO vdps (vin,year,make,model,trim,price_mo,miles,drivetrain,body,features,description,photos,active,embedding_synced,dealer_id,updated_at)
 SELECT 'DEMO-MACAN-2025',2025,'Porsche','Macan','',728,'5,190','AWD','SUV',
  '["Certified Pre-Owned","Premium Package Plus","Panoramic Roof System","Heated & ventilated seats","Surround View","AWD · 7-speed PDK","Clean CARFAX"]',
  '2025 Porsche Macan, Certified Pre-Owned, 5,190 miles, Volcano Gray Metallic over black leather. Engine: 2.0L turbocharged inline-4, 261 horsepower and 295 lb-ft of torque, 7-speed PDK dual-clutch, all-wheel drive. Performance: 0 to 60 mph in about 6.0 seconds, top track speed around 144 mph. Fuel economy: 19 city / 25 highway MPG. Premium Package Plus (panoramic roof, heated and ventilated front seats, Surround View camera), 19-inch Macan wheels, LED headlights with Porsche Dynamic Light System Plus, Lane Change Assist, Apple CarPlay, 8-speaker audio, memory seats. Clean CARFAX, Porsche Approved Certified Pre-Owned with 24-month/unlimited-mile limited warranty and roadside assistance, at Porsche South Bay in Hawthorne, CA. Retail $56,083, about $728/mo, $0 down.',
  '["/assets/inventory/porsche-macan.jpg"]',1,0,
  (SELECT id FROM dealer_leads WHERE client_no='CN-LACARGUY'),datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM vdps WHERE vin='DEMO-MACAN-2025');
UPDATE vdps SET active=1, price_mo=728, miles='5,190', trim='',
  features='["Certified Pre-Owned","Premium Package Plus","Panoramic Roof System","Heated & ventilated seats","Surround View","AWD · 7-speed PDK","Clean CARFAX"]',
  description='2025 Porsche Macan, Certified Pre-Owned, 5,190 miles, Volcano Gray Metallic over black leather. Engine: 2.0L turbocharged inline-4, 261 horsepower and 295 lb-ft of torque, 7-speed PDK dual-clutch, all-wheel drive. Performance: 0 to 60 mph in about 6.0 seconds, top track speed around 144 mph. Fuel economy: 19 city / 25 highway MPG. Premium Package Plus (panoramic roof, heated and ventilated front seats, Surround View camera), 19-inch Macan wheels, LED headlights with Porsche Dynamic Light System Plus, Lane Change Assist, Apple CarPlay, 8-speaker audio, memory seats. Clean CARFAX, Porsche Approved Certified Pre-Owned with 24-month/unlimited-mile limited warranty and roadside assistance, at Porsche South Bay in Hawthorne, CA. Retail $56,083, about $728/mo, $0 down.',
  embedding_synced=0, dealer_id=(SELECT id FROM dealer_leads WHERE client_no='CN-LACARGUY')
 WHERE vin='DEMO-MACAN-2025';

-- 3. Brandon = buyer, his real demo phone (live sign-in merges into this account).
INSERT OR IGNORE INTO users (phone,created_at) VALUES ('+15128440695',datetime('now'));
UPDATE users SET handle='Brandon Lopez' WHERE phone='+15128440695';

-- 4. Brandon's prequalified profile (so the car treats him as pre-approved + feed can rank).
INSERT INTO profiles (user_id,answers,embedding_synced,updated_at)
 SELECT id,'{"full_name":"Brandon Lopez","zip":"90064","buy_method":"finance","max_down":"5000","max_monthly":"900","fico":"800+","income":"150k+","dream_car":"2025 black McLaren Artura","reason":"Tired of fixing my 2002 Jeep Grand Cherokee","hobbies":["Weightlifting","Chess","Traveling"]}',0,datetime('now')
 FROM users WHERE phone='+15128440695'
 ON CONFLICT(user_id) DO UPDATE SET answers=excluded.answers, embedding_synced=0;

-- 5. (Fallback appointment intentionally REMOVED — the Pass must only appear AFTER the buyer
--    books a test drive live on the car page. Booking is done during the demo, minting a real pass.)

-- 6. (Chat thread intentionally NOT seeded — the demo starts the conversation fresh so the buyer
--     asks every question live. The "Start over" button on the car page clears history per run.)
