-- LAcarGUY rooftops (real 'Located at' from listings). Porsche South Bay = Cid, untouched.
INSERT INTO dealer_leads (name,dealership,role,phone,email,client_no,status,created_at)
SELECT 'Priya','Audi Pacific','Used Sales Mgr','+13105550112','used0@lacarguy.example','CN-LAG-AP0','active',datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM dealer_leads WHERE dealership='Audi Pacific');
INSERT INTO dealer_leads (name,dealership,role,phone,email,client_no,status,created_at)
SELECT 'Omar','Genesis Santa Monica','Used Sales Mgr','+13105550118','used1@lacarguy.example','CN-LAG-GSM1','active',datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM dealer_leads WHERE dealership='Genesis Santa Monica');
INSERT INTO dealer_leads (name,dealership,role,phone,email,client_no,status,created_at)
SELECT 'Ava','Honda Santa Monica','Used Sales Mgr','+13105550115','used2@lacarguy.example','CN-LAG-HSM2','active',datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM dealer_leads WHERE dealership='Honda Santa Monica');
INSERT INTO dealer_leads (name,dealership,role,phone,email,client_no,status,created_at)
SELECT 'Bex','Hyundai Santa Monica','Used Sales Mgr','+13105550119','used3@lacarguy.example','CN-LAG-HSM3','active',datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM dealer_leads WHERE dealership='Hyundai Santa Monica');
INSERT INTO dealer_leads (name,dealership,role,phone,email,client_no,status,created_at)
SELECT 'Nina','Kia Santa Monica','Used Sales Mgr','+13105550117','used4@lacarguy.example','CN-LAG-KSM4','active',datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM dealer_leads WHERE dealership='Kia Santa Monica');
INSERT INTO dealer_leads (name,dealership,role,phone,email,client_no,status,created_at)
SELECT 'Dana','Lexus Santa Monica','Used Sales Mgr','+13105550111','used5@lacarguy.example','CN-LAG-LSM5','active',datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM dealer_leads WHERE dealership='Lexus Santa Monica');
INSERT INTO dealer_leads (name,dealership,role,phone,email,client_no,status,created_at)
SELECT 'Tomas','Pacific Volkswagen','Used Sales Mgr','+13105550113','used6@lacarguy.example','CN-LAG-PV6','active',datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM dealer_leads WHERE dealership='Pacific Volkswagen');
INSERT INTO dealer_leads (name,dealership,role,phone,email,client_no,status,created_at)
SELECT 'Reggie','Subaru Pacific','Used Sales Mgr','+13105550114','used8@lacarguy.example','CN-LAG-SP8','active',datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM dealer_leads WHERE dealership='Subaru Pacific');
INSERT INTO dealer_leads (name,dealership,role,phone,email,client_no,status,created_at)
SELECT 'Marcus','Toyota Santa Monica','Used Sales Mgr','+13105550110','used9@lacarguy.example','CN-LAG-TSM9','active',datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM dealer_leads WHERE dealership='Toyota Santa Monica');
INSERT INTO dealer_leads (name,dealership,role,phone,email,client_no,status,created_at)
SELECT 'Luis','Toyota of Hollywood','Used Sales Mgr','+13105550116','used10@lacarguy.example','CN-LAG-TOH10','active',datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM dealer_leads WHERE dealership='Toyota of Hollywood');
