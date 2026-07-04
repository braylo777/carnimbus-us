-- CarNimbus demo seed — makes production match the pitch-deck screens (A3/A4/A5).
-- Run AFTER migration 0008:  npx wrangler d1 execute carnimbus-waitlist --remote --file=seed/demo.sql
INSERT INTO vdps (vin,year,make,model,trim,price_mo,miles,drivetrain,body,features,description,photos,active,embedding_synced,updated_at) VALUES
 ('DEMO-330I',2024,'BMW','330i','M Sport',487,'14k','RWD','Sedan','["Certified","M Sport package"]','Trouble, but the fun kind. Quick, clean, confident.','["/assets/inventory/bmw-330i.jpg"]',1,0,datetime('now')),
 ('DEMO-CAMRY',2025,'Toyota','Camry','XSE',449,'7k','AWD','Sedan','["Certified"]','Smooth operator. Zero drama, all polish.','["/assets/inventory/toyota-camry.jpg"]',1,0,datetime('now')),
 ('DEMO-NX350',2022,'Lexus','NX','350',559,'21k','AWD','SUV','["Certified"]','Quiet luxury with a fast side.','["/assets/inventory/lexus-nx350.jpg"]',1,0,datetime('now')),
 ('DEMO-Q5',2017,'Audi','Q5','S Line',529,'38k','AWD','SUV','["S Line"]','Veteran mover. Still shows off.','["/assets/inventory/audi-q5.jpg"]',1,0,datetime('now'))
 ON CONFLICT(vin) DO UPDATE SET active=1;
INSERT OR IGNORE INTO users (phone,created_at) VALUES ('+13235550101',datetime('now')),('+13235550102',datetime('now')),('+13235550103',datetime('now')),('+13235550104',datetime('now'));
UPDATE users SET handle='Maya Torres'    WHERE phone='+13235550101';
UPDATE users SET handle='Diego Ramirez'  WHERE phone='+13235550102';
UPDATE users SET handle='Aaliyah Brooks' WHERE phone='+13235550103';
UPDATE users SET handle='Marcus Lee'     WHERE phone='+13235550104';
INSERT INTO profiles (user_id,answers,embedding_synced,updated_at)
 SELECT id,'{"q1":"500","q2":"Sedan","q3":"sporty","q4":"20 mi","q5":"4","q6":"monthly payment","q7":"no","q8":"this week","q9":"good","q10":"BMW 330i"}',0,datetime('now') FROM users WHERE phone='+13235550101'
 ON CONFLICT(user_id) DO NOTHING;
INSERT INTO test_drives (user_id,vdp_id,center,slot,status,pass_token,created_at) SELECT u.id,v.id,'Westside','Today, 3:30 PM','confirmed','MAYA01PASS00000000000000001',datetime('now') FROM users u,vdps v WHERE u.phone='+13235550101' AND v.vin='DEMO-330I'
 AND NOT EXISTS (SELECT 1 FROM test_drives WHERE pass_token='MAYA01PASS00000000000000001');
INSERT INTO test_drives (user_id,vdp_id,center,slot,status,pass_token,created_at) SELECT u.id,v.id,'Westside','11:30 AM','arrived','DIEG01PASS00000000000000001',datetime('now') FROM users u,vdps v WHERE u.phone='+13235550102' AND v.vin='DEMO-CAMRY'
 AND NOT EXISTS (SELECT 1 FROM test_drives WHERE pass_token='DIEG01PASS00000000000000001');
INSERT INTO test_drives (user_id,vdp_id,center,slot,status,pass_token,created_at) SELECT u.id,v.id,'Westside','Closed','sold','AALI01PASS00000000000000001',datetime('now') FROM users u,vdps v WHERE u.phone='+13235550103' AND v.vin='DEMO-NX350'
 AND NOT EXISTS (SELECT 1 FROM test_drives WHERE pass_token='AALI01PASS00000000000000001');
INSERT INTO test_drives (user_id,vdp_id,center,slot,status,pass_token,created_at) SELECT u.id,v.id,'Westside','Tmrw','requested','MARC01PASS00000000000000001',datetime('now') FROM users u,vdps v WHERE u.phone='+13235550104' AND v.vin='DEMO-Q5'
 AND NOT EXISTS (SELECT 1 FROM test_drives WHERE pass_token='MARC01PASS00000000000000001');
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT u.id,v.id,'Got pre-qualified for a ''24 330i at $487/mo — soft pull, no ding. Is that a fair rate for a 700 score? 👀','90301',datetime('now','-3 hours') FROM users u,vdps v WHERE u.phone='+13235550101' AND v.vin='DEMO-330I'
 AND NOT EXISTS (SELECT 1 FROM comments WHERE zip='90301' AND body LIKE 'Got pre-qualified%');
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT 0,0,'For a 700-739 band that''s a solid rate. I found 3 similar 3-Series under $500/mo within 5 mi of Inglewood — want them?','agent',datetime('now','-2 hours')
 WHERE NOT EXISTS (SELECT 1 FROM comments WHERE zip='agent' AND body LIKE 'For a 700-739 band%');
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT u.id,0,'Westside test drive center was actually chill. Walked in pre-approved, drove off in an hour. No haggle. 🏁','90008',datetime('now','-5 hours') FROM users u WHERE u.phone='+13235550102'
 AND NOT EXISTS (SELECT 1 FROM comments WHERE zip='90008' AND body LIKE 'Westside test drive center%');
INSERT INTO chats (user_id,vdp_id,role,body,created_at)
 SELECT u.id,v.id,'user','am I qualified for the 330i?',datetime('now','-40 minutes') FROM users u,vdps v WHERE u.phone='+13235550101' AND v.vin='DEMO-330I'
 AND NOT EXISTS (SELECT 1 FROM chats WHERE body='am I qualified for the 330i?');
INSERT INTO chats (user_id,vdp_id,role,body,created_at)
 SELECT u.id,v.id,'car','You''re pre-qualified — ~$487/mo, $0 down. Soft pull, zero credit hit. 🎉',datetime('now','-39 minutes') FROM users u,vdps v WHERE u.phone='+13235550101' AND v.vin='DEMO-330I'
 AND NOT EXISTS (SELECT 1 FROM chats WHERE body LIKE 'You''re pre-qualified%');
INSERT INTO chats (user_id,vdp_id,role,body,created_at)
 SELECT u.id,v.id,'user','can I drive it today?',datetime('now','-38 minutes') FROM users u,vdps v WHERE u.phone='+13235550101' AND v.vin='DEMO-330I'
 AND NOT EXISTS (SELECT 1 FROM chats WHERE body='can I drive it today?');
INSERT INTO chats (user_id,vdp_id,role,body,created_at)
 SELECT u.id,v.id,'car','Booked you at Westside, 3:30 PM. Your pass is ready. See you soon! 🏎️',datetime('now','-37 minutes') FROM users u,vdps v WHERE u.phone='+13235550101' AND v.vin='DEMO-330I'
 AND NOT EXISTS (SELECT 1 FROM chats WHERE body LIKE 'Booked you at Westside%');
