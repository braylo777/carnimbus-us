-- CarNimbus × LAcarGUY live-demo seed for James — 2025 Porsche Macan (Brandon = buyer).
-- Idempotent; safe to re-run. Run after seed/demo.sql:
--   npx wrangler d1 execute carnimbus-waitlist --remote --file=seed/lacarguy-demo.sql
-- NOTE: James's phone is a placeholder; set his real number on demo day:
--   ... --command "UPDATE dealer_leads SET phone='<JAMES_PHONE>' WHERE client_no='CN-LACARGUY';"

-- 1. James's LAcarGUY dealer account, pre-activated (status='active' + client_no).
INSERT INTO dealer_leads (name,dealership,role,phone,email,client_no,status,created_at)
 SELECT 'James','LAcarGUY (Porsche demo)','GM','+10000000000','james@lacarguy.com','CN-LACARGUY','active',datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM dealer_leads WHERE client_no='CN-LACARGUY');

-- 2. The 2025 Porsche Macan, owned by James (dealer_id = his lead). Specs swappable.
INSERT INTO vdps (vin,year,make,model,trim,price_mo,miles,drivetrain,body,features,description,photos,active,embedding_synced,dealer_id,updated_at)
 SELECT 'DEMO-MACAN-2025',2025,'Porsche','Macan','AWD',899,'8k','AWD','SUV',
  '["Certified Pre-Owned","Jet Black Metallic","Black leather","Panoramic roof","AWD"]',
  'I''m a 2025 Macan in Jet Black — certified, low miles, quicker than I look. Ask me anything: price, condition, what a monthly looks like. I''d rather answer straight than make you haggle.',
  '["/assets/inventory/porsche-macan.jpg"]',1,0,
  (SELECT id FROM dealer_leads WHERE client_no='CN-LACARGUY'),datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM vdps WHERE vin='DEMO-MACAN-2025');
UPDATE vdps SET active=1, dealer_id=(SELECT id FROM dealer_leads WHERE client_no='CN-LACARGUY')
 WHERE vin='DEMO-MACAN-2025';

-- 3. Brandon = buyer, his real demo phone (live sign-in merges into this account).
INSERT OR IGNORE INTO users (phone,created_at) VALUES ('+15128440695',datetime('now'));
UPDATE users SET handle='Brandon Lopez' WHERE phone='+15128440695';

-- 4. Brandon's prequalified profile (so the car treats him as pre-approved + feed can rank).
INSERT INTO profiles (user_id,answers,embedding_synced,updated_at)
 SELECT id,'{"q1":"900","q2":"SUV","q3":"sporty luxury","q4":"15 mi","q5":"5","q6":"monthly payment","q7":"no","q8":"today","q9":"excellent","q10":"Porsche Macan"}',0,datetime('now')
 FROM users WHERE phone='+15128440695'
 ON CONFLICT(user_id) DO NOTHING;

-- 5. Fallback appointment (Brandon -> Macan) so James's console is never empty.
INSERT INTO test_drives (user_id,vdp_id,center,slot,status,pass_token,created_at)
 SELECT u.id,v.id,'Culver City','Today, 4:00 PM','requested','DEMOMACANPASS0000000000000001',datetime('now')
 FROM users u,vdps v WHERE u.phone='+15128440695' AND v.vin='DEMO-MACAN-2025'
 AND NOT EXISTS (SELECT 1 FROM test_drives WHERE pass_token='DEMOMACANPASS0000000000000001');

-- 6. Seeded chat thread on the Macan (populates the dealer console chat rail before the live run).
INSERT INTO chats (user_id,vdp_id,role,body,created_at)
 SELECT u.id,v.id,'user','love the Macan — what would my monthly be?',datetime('now','-6 minutes')
 FROM users u,vdps v WHERE u.phone='+15128440695' AND v.vin='DEMO-MACAN-2025'
 AND NOT EXISTS (SELECT 1 FROM chats WHERE body='love the Macan — what would my monthly be?');
INSERT INTO chats (user_id,vdp_id,role,body,created_at)
 SELECT u.id,v.id,'car','You''re pre-qualified — about $899/mo, $0 down, 72-month term. Soft pull, zero credit hit. 🏁',datetime('now','-5 minutes')
 FROM users u,vdps v WHERE u.phone='+15128440695' AND v.vin='DEMO-MACAN-2025'
 AND NOT EXISTS (SELECT 1 FROM chats WHERE body LIKE 'You''re pre-qualified — about $899%');
INSERT INTO chats (user_id,vdp_id,role,body,created_at)
 SELECT u.id,v.id,'user','can I drive it today?',datetime('now','-4 minutes')
 FROM users u,vdps v WHERE u.phone='+15128440695' AND v.vin='DEMO-MACAN-2025'
 AND NOT EXISTS (SELECT 1 FROM chats WHERE user_id=u.id AND vdp_id=v.id AND body='can I drive it today?');
INSERT INTO chats (user_id,vdp_id,role,body,created_at)
 SELECT u.id,v.id,'car','Booked you at Culver City, Today 4:00 PM. Your Drive Now pass is ready — see you soon. 🏎️',datetime('now','-3 minutes')
 FROM users u,vdps v WHERE u.phone='+15128440695' AND v.vin='DEMO-MACAN-2025'
 AND NOT EXISTS (SELECT 1 FROM chats WHERE body LIKE 'Booked you at Culver City%');
