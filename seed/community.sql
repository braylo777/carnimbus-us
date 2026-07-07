-- Demo community pool (~150 members + ~190 posts). Cleanup:
-- DELETE FROM comments WHERE zip IN ('demo','agent'); DELETE FROM users WHERE phone LIKE '+1310555%';
INSERT OR IGNORE INTO users (phone,handle,sid,created_at) VALUES
 ('+13105551001','Andre L.','SID-DEMO-0001',datetime('now','-2 days')),
 ('+13105551002','Grace K.','SID-DEMO-0002',datetime('now','-3 days')),
 ('+13105551003','Wes H.','SID-DEMO-0003',datetime('now','-4 days')),
 ('+13105551004','Trey W.','SID-DEMO-0004',datetime('now','-5 days')),
 ('+13105551005','Talia F.','SID-DEMO-0005',datetime('now','-6 days')),
 ('+13105551006','Marco Z.','SID-DEMO-0006',datetime('now','-7 days')),
 ('+13105551007','Simone T.','SID-DEMO-0007',datetime('now','-8 days')),
 ('+13105551008','Hugo L.','SID-DEMO-0008',datetime('now','-9 days')),
 ('+13105551009','Opal K.','SID-DEMO-0009',datetime('now','-10 days')),
 ('+13105551010','Willa H.','SID-DEMO-0010',datetime('now','-11 days')),
 ('+13105551011','Dario W.','SID-DEMO-0011',datetime('now','-12 days')),
 ('+13105551012','Priya F.','SID-DEMO-0012',datetime('now','-13 days')),
 ('+13105551013','Tomas Z.','SID-DEMO-0013',datetime('now','-14 days')),
 ('+13105551014','Tara T.','SID-DEMO-0014',datetime('now','-1 days')),
 ('+13105551015','Deja L.','SID-DEMO-0015',datetime('now','-2 days')),
 ('+13105551016','Rashad K.','SID-DEMO-0016',datetime('now','-3 days')),
 ('+13105551017','Jade H.','SID-DEMO-0017',datetime('now','-4 days')),
 ('+13105551018','Devon W.','SID-DEMO-0018',datetime('now','-5 days')),
 ('+13105551019','Esme F.','SID-DEMO-0019',datetime('now','-6 days')),
 ('+13105551020','Lorenzo Z.','SID-DEMO-0020',datetime('now','-7 days')),
 ('+13105551021','Theo T.','SID-DEMO-0021',datetime('now','-8 days')),
 ('+13105551022','Anaya L.','SID-DEMO-0022',datetime('now','-9 days')),
 ('+13105551023','Diego K.','SID-DEMO-0023',datetime('now','-10 days')),
 ('+13105551024','Leila H.','SID-DEMO-0024',datetime('now','-11 days')),
 ('+13105551025','Ivan W.','SID-DEMO-0025',datetime('now','-12 days')),
 ('+13105551026','Yuki F.','SID-DEMO-0026',datetime('now','-13 days')),
 ('+13105551027','Farah Z.','SID-DEMO-0027',datetime('now','-14 days')),
 ('+13105551028','Gio T.','SID-DEMO-0028',datetime('now','-1 days')),
 ('+13105551029','Nadia L.','SID-DEMO-0029',datetime('now','-2 days')),
 ('+13105551030','Beau K.','SID-DEMO-0030',datetime('now','-3 days')),
 ('+13105551031','Isla H.','SID-DEMO-0031',datetime('now','-4 days')),
 ('+13105551032','Pablo W.','SID-DEMO-0032',datetime('now','-5 days')),
 ('+13105551033','Xavier F.','SID-DEMO-0033',datetime('now','-6 days')),
 ('+13105551034','Etta Z.','SID-DEMO-0034',datetime('now','-7 days')),
 ('+13105551035','Jordan T.','SID-DEMO-0035',datetime('now','-8 days')),
 ('+13105551036','Zoe L.','SID-DEMO-0036',datetime('now','-9 days')),
 ('+13105551037','Omar K.','SID-DEMO-0037',datetime('now','-10 days')),
 ('+13105551038','Luis H.','SID-DEMO-0038',datetime('now','-11 days')),
 ('+13105551039','Mira W.','SID-DEMO-0039',datetime('now','-12 days')),
 ('+13105551040','Ravi F.','SID-DEMO-0040',datetime('now','-13 days')),
 ('+13105551041','Paloma Z.','SID-DEMO-0041',datetime('now','-14 days')),
 ('+13105551042','Felix T.','SID-DEMO-0042',datetime('now','-1 days')),
 ('+13105551043','Mabel L.','SID-DEMO-0043',datetime('now','-2 days')),
 ('+13105551044','Uma K.','SID-DEMO-0044',datetime('now','-3 days')),
 ('+13105551045','Bruno H.','SID-DEMO-0045',datetime('now','-4 days')),
 ('+13105551046','Aaliyah W.','SID-DEMO-0046',datetime('now','-5 days')),
 ('+13105551047','Cole F.','SID-DEMO-0047',datetime('now','-6 days')),
 ('+13105551048','Rosa Z.','SID-DEMO-0048',datetime('now','-7 days')),
 ('+13105551049','Sam T.','SID-DEMO-0049',datetime('now','-8 days')),
 ('+13105551050','Kai L.','SID-DEMO-0050',datetime('now','-9 days')),
 ('+13105551051','Amara K.','SID-DEMO-0051',datetime('now','-10 days')),
 ('+13105551052','Quinn H.','SID-DEMO-0052',datetime('now','-11 days')),
 ('+13105551053','Camila W.','SID-DEMO-0053',datetime('now','-12 days')),
 ('+13105551054','Jonah F.','SID-DEMO-0054',datetime('now','-13 days')),
 ('+13105551055','Remy Z.','SID-DEMO-0055',datetime('now','-14 days')),
 ('+13105551056','Yara T.','SID-DEMO-0056',datetime('now','-1 days')),
 ('+13105551057','Frankie L.','SID-DEMO-0057',datetime('now','-2 days')),
 ('+13105551058','Sofia K.','SID-DEMO-0058',datetime('now','-3 days')),
 ('+13105551059','Malik H.','SID-DEMO-0059',datetime('now','-4 days')),
 ('+13105551060','Bella W.','SID-DEMO-0060',datetime('now','-5 days')),
 ('+13105551061','Hana F.','SID-DEMO-0061',datetime('now','-6 days')),
 ('+13105551062','Noah Z.','SID-DEMO-0062',datetime('now','-7 days')),
 ('+13105551063','Lena T.','SID-DEMO-0063',datetime('now','-8 days')),
 ('+13105551064','Rafi L.','SID-DEMO-0064',datetime('now','-9 days')),
 ('+13105551065','Gwen K.','SID-DEMO-0065',datetime('now','-10 days')),
 ('+13105551066','Nico H.','SID-DEMO-0066',datetime('now','-11 days')),
 ('+13105551067','Vince W.','SID-DEMO-0067',datetime('now','-12 days')),
 ('+13105551068','Cleo F.','SID-DEMO-0068',datetime('now','-13 days')),
 ('+13105551069','Marcus Z.','SID-DEMO-0069',datetime('now','-14 days')),
 ('+13105551070','Nina T.','SID-DEMO-0070',datetime('now','-1 days')),
 ('+13105551071','Kenji L.','SID-DEMO-0071',datetime('now','-2 days')),
 ('+13105551072','Carmen K.','SID-DEMO-0072',datetime('now','-3 days')),
 ('+13105551073','Elena H.','SID-DEMO-0073',datetime('now','-4 days')),
 ('+13105551074','Blake W.','SID-DEMO-0074',datetime('now','-5 days')),
 ('+13105551075','Ines F.','SID-DEMO-0075',datetime('now','-6 days')),
 ('+13105551076','Dorian Z.','SID-DEMO-0076',datetime('now','-7 days')),
 ('+13105551077','Kira T.','SID-DEMO-0077',datetime('now','-8 days')),
 ('+13105551078','Suri L.','SID-DEMO-0078',datetime('now','-9 days')),
 ('+13105551079','Zane K.','SID-DEMO-0079',datetime('now','-10 days')),
 ('+13105551080','Maya H.','SID-DEMO-0080',datetime('now','-11 days')),
 ('+13105551081','Andre W.','SID-DEMO-0081',datetime('now','-12 days')),
 ('+13105551082','Grace F.','SID-DEMO-0082',datetime('now','-13 days')),
 ('+13105551083','Wes Z.','SID-DEMO-0083',datetime('now','-14 days')),
 ('+13105551084','Trey T.','SID-DEMO-0084',datetime('now','-1 days')),
 ('+13105551085','Talia L.','SID-DEMO-0085',datetime('now','-2 days')),
 ('+13105551086','Marco K.','SID-DEMO-0086',datetime('now','-3 days')),
 ('+13105551087','Simone H.','SID-DEMO-0087',datetime('now','-4 days')),
 ('+13105551088','Hugo W.','SID-DEMO-0088',datetime('now','-5 days')),
 ('+13105551089','Opal F.','SID-DEMO-0089',datetime('now','-6 days')),
 ('+13105551090','Willa Z.','SID-DEMO-0090',datetime('now','-7 days')),
 ('+13105551091','Dario T.','SID-DEMO-0091',datetime('now','-8 days')),
 ('+13105551092','Priya L.','SID-DEMO-0092',datetime('now','-9 days')),
 ('+13105551093','Tomas K.','SID-DEMO-0093',datetime('now','-10 days')),
 ('+13105551094','Tara H.','SID-DEMO-0094',datetime('now','-11 days')),
 ('+13105551095','Deja W.','SID-DEMO-0095',datetime('now','-12 days')),
 ('+13105551096','Rashad F.','SID-DEMO-0096',datetime('now','-13 days')),
 ('+13105551097','Jade Z.','SID-DEMO-0097',datetime('now','-14 days')),
 ('+13105551098','Devon T.','SID-DEMO-0098',datetime('now','-1 days')),
 ('+13105551099','Esme L.','SID-DEMO-0099',datetime('now','-2 days')),
 ('+13105551100','Lorenzo K.','SID-DEMO-0100',datetime('now','-3 days')),
 ('+13105551101','Theo H.','SID-DEMO-0101',datetime('now','-4 days')),
 ('+13105551102','Anaya W.','SID-DEMO-0102',datetime('now','-5 days')),
 ('+13105551103','Diego F.','SID-DEMO-0103',datetime('now','-6 days')),
 ('+13105551104','Leila Z.','SID-DEMO-0104',datetime('now','-7 days')),
 ('+13105551105','Ivan T.','SID-DEMO-0105',datetime('now','-8 days')),
 ('+13105551106','Yuki L.','SID-DEMO-0106',datetime('now','-9 days')),
 ('+13105551107','Farah K.','SID-DEMO-0107',datetime('now','-10 days')),
 ('+13105551108','Gio H.','SID-DEMO-0108',datetime('now','-11 days')),
 ('+13105551109','Nadia W.','SID-DEMO-0109',datetime('now','-12 days')),
 ('+13105551110','Beau F.','SID-DEMO-0110',datetime('now','-13 days')),
 ('+13105551111','Isla Z.','SID-DEMO-0111',datetime('now','-14 days')),
 ('+13105551112','Pablo T.','SID-DEMO-0112',datetime('now','-1 days')),
 ('+13105551113','Xavier L.','SID-DEMO-0113',datetime('now','-2 days')),
 ('+13105551114','Etta K.','SID-DEMO-0114',datetime('now','-3 days')),
 ('+13105551115','Jordan H.','SID-DEMO-0115',datetime('now','-4 days')),
 ('+13105551116','Zoe W.','SID-DEMO-0116',datetime('now','-5 days')),
 ('+13105551117','Omar F.','SID-DEMO-0117',datetime('now','-6 days')),
 ('+13105551118','Luis Z.','SID-DEMO-0118',datetime('now','-7 days')),
 ('+13105551119','Mira T.','SID-DEMO-0119',datetime('now','-8 days')),
 ('+13105551120','Ravi L.','SID-DEMO-0120',datetime('now','-9 days')),
 ('+13105551121','Paloma K.','SID-DEMO-0121',datetime('now','-10 days')),
 ('+13105551122','Felix H.','SID-DEMO-0122',datetime('now','-11 days')),
 ('+13105551123','Mabel W.','SID-DEMO-0123',datetime('now','-12 days')),
 ('+13105551124','Uma F.','SID-DEMO-0124',datetime('now','-13 days')),
 ('+13105551125','Bruno Z.','SID-DEMO-0125',datetime('now','-14 days')),
 ('+13105551126','Aaliyah T.','SID-DEMO-0126',datetime('now','-1 days')),
 ('+13105551127','Cole L.','SID-DEMO-0127',datetime('now','-2 days')),
 ('+13105551128','Rosa K.','SID-DEMO-0128',datetime('now','-3 days')),
 ('+13105551129','Sam H.','SID-DEMO-0129',datetime('now','-4 days')),
 ('+13105551130','Kai W.','SID-DEMO-0130',datetime('now','-5 days')),
 ('+13105551131','Amara F.','SID-DEMO-0131',datetime('now','-6 days')),
 ('+13105551132','Quinn Z.','SID-DEMO-0132',datetime('now','-7 days')),
 ('+13105551133','Camila T.','SID-DEMO-0133',datetime('now','-8 days')),
 ('+13105551134','Jonah L.','SID-DEMO-0134',datetime('now','-9 days')),
 ('+13105551135','Remy K.','SID-DEMO-0135',datetime('now','-10 days')),
 ('+13105551136','Yara H.','SID-DEMO-0136',datetime('now','-11 days')),
 ('+13105551137','Frankie W.','SID-DEMO-0137',datetime('now','-12 days')),
 ('+13105551138','Sofia F.','SID-DEMO-0138',datetime('now','-13 days')),
 ('+13105551139','Malik Z.','SID-DEMO-0139',datetime('now','-14 days')),
 ('+13105551140','Bella T.','SID-DEMO-0140',datetime('now','-1 days')),
 ('+13105551141','Hana L.','SID-DEMO-0141',datetime('now','-2 days')),
 ('+13105551142','Noah K.','SID-DEMO-0142',datetime('now','-3 days')),
 ('+13105551143','Lena H.','SID-DEMO-0143',datetime('now','-4 days')),
 ('+13105551144','Rafi W.','SID-DEMO-0144',datetime('now','-5 days')),
 ('+13105551145','Gwen F.','SID-DEMO-0145',datetime('now','-6 days')),
 ('+13105551146','Nico Z.','SID-DEMO-0146',datetime('now','-7 days')),
 ('+13105551147','Vince T.','SID-DEMO-0147',datetime('now','-8 days')),
 ('+13105551148','Cleo L.','SID-DEMO-0148',datetime('now','-9 days')),
 ('+13105551149','Marcus K.','SID-DEMO-0149',datetime('now','-10 days')),
 ('+13105551150','Nina H.','SID-DEMO-0150',datetime('now','-11 days'));
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Talked to a car at 1am and it answered every question straight. No pressure. Wild.','demo',datetime('now','-13 minutes') FROM users WHERE phone='+13105551012';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Pre-qualified in like 30 seconds, zero hit to my credit. Where was this 3 cars ago','demo',datetime('now','-26 minutes') FROM users WHERE phone='+13105551023';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'The AI literally talked me OUT of a car that didnt fit my budget. Respect.','demo',datetime('now','-39 minutes') FROM users WHERE phone='+13105551034';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Scheduled a test drive from my couch. Walked in, keys ready. Thats the whole vibe.','demo',datetime('now','-52 minutes') FROM users WHERE phone='+13105551045';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'My agent found me 3 SUVs near me that all fit the monthly. Picking this weekend.','demo',datetime('now','-65 minutes') FROM users WHERE phone='+13105551056';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'No salesman calling me 40 times. Just the car answering for itself. Finally.','demo',datetime('now','-78 minutes') FROM users WHERE phone='+13105551067';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Traded in my old beater, numbers were clear before I showed up. Painless.','demo',datetime('now','-91 minutes') FROM users WHERE phone='+13105551078';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Asked the car how fast it really goes and it gave me the actual spec. Love it','demo',datetime('now','-104 minutes') FROM users WHERE phone='+13105551089';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Been burned by dealers before — this felt different. Honest the whole way.','demo',datetime('now','-117 minutes') FROM users WHERE phone='+13105551100';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Matched with something so close to my dream car I did a double take','demo',datetime('now','-130 minutes') FROM users WHERE phone='+13105551111';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'The soft-pull range was dead accurate to what I got approved for. Legit.','demo',datetime('now','-143 minutes') FROM users WHERE phone='+13105551122';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Showed up, they knew my name, terms were set. In and out in 20 min.','demo',datetime('now','-156 minutes') FROM users WHERE phone='+13105551133';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'My agent surfaced a car I didnt even search for and it was perfect','demo',datetime('now','-169 minutes') FROM users WHERE phone='+13105551144';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Certified, one owner, clean CARFAX — and the photo matched. Rare these days.','demo',datetime('now','-182 minutes') FROM users WHERE phone='+13105551005';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Just got matched with a certified Outback under budget — this app actually gets me','demo',datetime('now','-195 minutes') FROM users WHERE phone='+13105551016';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Talked to a car at 1am and it answered every question straight. No pressure. Wild.','demo',datetime('now','-208 minutes') FROM users WHERE phone='+13105551027';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Pre-qualified in like 30 seconds, zero hit to my credit. Where was this 3 cars ago','demo',datetime('now','-221 minutes') FROM users WHERE phone='+13105551038';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'The AI literally talked me OUT of a car that didnt fit my budget. Respect.','demo',datetime('now','-234 minutes') FROM users WHERE phone='+13105551049';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Scheduled a test drive from my couch. Walked in, keys ready. Thats the whole vibe.','demo',datetime('now','-247 minutes') FROM users WHERE phone='+13105551060';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'My agent found me 3 SUVs near me that all fit the monthly. Picking this weekend.','demo',datetime('now','-260 minutes') FROM users WHERE phone='+13105551071';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'No salesman calling me 40 times. Just the car answering for itself. Finally.','demo',datetime('now','-273 minutes') FROM users WHERE phone='+13105551082';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Traded in my old beater, numbers were clear before I showed up. Painless.','demo',datetime('now','-286 minutes') FROM users WHERE phone='+13105551093';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Asked the car how fast it really goes and it gave me the actual spec. Love it','demo',datetime('now','-299 minutes') FROM users WHERE phone='+13105551104';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Been burned by dealers before — this felt different. Honest the whole way.','demo',datetime('now','-312 minutes') FROM users WHERE phone='+13105551115';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Matched with something so close to my dream car I did a double take','demo',datetime('now','-325 minutes') FROM users WHERE phone='+13105551126';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'The soft-pull range was dead accurate to what I got approved for. Legit.','demo',datetime('now','-338 minutes') FROM users WHERE phone='+13105551137';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Showed up, they knew my name, terms were set. In and out in 20 min.','demo',datetime('now','-351 minutes') FROM users WHERE phone='+13105551148';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'My agent surfaced a car I didnt even search for and it was perfect','demo',datetime('now','-364 minutes') FROM users WHERE phone='+13105551009';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Certified, one owner, clean CARFAX — and the photo matched. Rare these days.','demo',datetime('now','-377 minutes') FROM users WHERE phone='+13105551020';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Just got matched with a certified Civic under budget — this app actually gets me','demo',datetime('now','-390 minutes') FROM users WHERE phone='+13105551031';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Talked to a car at 1am and it answered every question straight. No pressure. Wild.','demo',datetime('now','-403 minutes') FROM users WHERE phone='+13105551042';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Pre-qualified in like 30 seconds, zero hit to my credit. Where was this 3 cars ago','demo',datetime('now','-416 minutes') FROM users WHERE phone='+13105551053';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'The AI literally talked me OUT of a car that didnt fit my budget. Respect.','demo',datetime('now','-429 minutes') FROM users WHERE phone='+13105551064';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Scheduled a test drive from my couch. Walked in, keys ready. Thats the whole vibe.','demo',datetime('now','-442 minutes') FROM users WHERE phone='+13105551075';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'My agent found me 3 SUVs near me that all fit the monthly. Picking this weekend.','demo',datetime('now','-455 minutes') FROM users WHERE phone='+13105551086';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'No salesman calling me 40 times. Just the car answering for itself. Finally.','demo',datetime('now','-468 minutes') FROM users WHERE phone='+13105551097';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Traded in my old beater, numbers were clear before I showed up. Painless.','demo',datetime('now','-481 minutes') FROM users WHERE phone='+13105551108';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Asked the car how fast it really goes and it gave me the actual spec. Love it','demo',datetime('now','-494 minutes') FROM users WHERE phone='+13105551119';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Been burned by dealers before — this felt different. Honest the whole way.','demo',datetime('now','-507 minutes') FROM users WHERE phone='+13105551130';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Matched with something so close to my dream car I did a double take','demo',datetime('now','-520 minutes') FROM users WHERE phone='+13105551141';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'The soft-pull range was dead accurate to what I got approved for. Legit.','demo',datetime('now','-533 minutes') FROM users WHERE phone='+13105551002';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Showed up, they knew my name, terms were set. In and out in 20 min.','demo',datetime('now','-546 minutes') FROM users WHERE phone='+13105551013';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'My agent surfaced a car I didnt even search for and it was perfect','demo',datetime('now','-559 minutes') FROM users WHERE phone='+13105551024';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Certified, one owner, clean CARFAX — and the photo matched. Rare these days.','demo',datetime('now','-572 minutes') FROM users WHERE phone='+13105551035';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Just got matched with a certified Q5 under budget — this app actually gets me','demo',datetime('now','-585 minutes') FROM users WHERE phone='+13105551046';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Talked to a car at 1am and it answered every question straight. No pressure. Wild.','demo',datetime('now','-598 minutes') FROM users WHERE phone='+13105551057';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Pre-qualified in like 30 seconds, zero hit to my credit. Where was this 3 cars ago','demo',datetime('now','-611 minutes') FROM users WHERE phone='+13105551068';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'The AI literally talked me OUT of a car that didnt fit my budget. Respect.','demo',datetime('now','-624 minutes') FROM users WHERE phone='+13105551079';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Scheduled a test drive from my couch. Walked in, keys ready. Thats the whole vibe.','demo',datetime('now','-637 minutes') FROM users WHERE phone='+13105551090';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'My agent found me 3 SUVs near me that all fit the monthly. Picking this weekend.','demo',datetime('now','-650 minutes') FROM users WHERE phone='+13105551101';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'No salesman calling me 40 times. Just the car answering for itself. Finally.','demo',datetime('now','-663 minutes') FROM users WHERE phone='+13105551112';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Traded in my old beater, numbers were clear before I showed up. Painless.','demo',datetime('now','-676 minutes') FROM users WHERE phone='+13105551123';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Asked the car how fast it really goes and it gave me the actual spec. Love it','demo',datetime('now','-689 minutes') FROM users WHERE phone='+13105551134';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Been burned by dealers before — this felt different. Honest the whole way.','demo',datetime('now','-702 minutes') FROM users WHERE phone='+13105551145';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Matched with something so close to my dream car I did a double take','demo',datetime('now','-715 minutes') FROM users WHERE phone='+13105551006';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'The soft-pull range was dead accurate to what I got approved for. Legit.','demo',datetime('now','-728 minutes') FROM users WHERE phone='+13105551017';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Showed up, they knew my name, terms were set. In and out in 20 min.','demo',datetime('now','-741 minutes') FROM users WHERE phone='+13105551028';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'My agent surfaced a car I didnt even search for and it was perfect','demo',datetime('now','-754 minutes') FROM users WHERE phone='+13105551039';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Certified, one owner, clean CARFAX — and the photo matched. Rare these days.','demo',datetime('now','-767 minutes') FROM users WHERE phone='+13105551050';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Just got matched with a certified RAV4 under budget — this app actually gets me','demo',datetime('now','-780 minutes') FROM users WHERE phone='+13105551061';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Talked to a car at 1am and it answered every question straight. No pressure. Wild.','demo',datetime('now','-793 minutes') FROM users WHERE phone='+13105551072';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Pre-qualified in like 30 seconds, zero hit to my credit. Where was this 3 cars ago','demo',datetime('now','-806 minutes') FROM users WHERE phone='+13105551083';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'The AI literally talked me OUT of a car that didnt fit my budget. Respect.','demo',datetime('now','-819 minutes') FROM users WHERE phone='+13105551094';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Scheduled a test drive from my couch. Walked in, keys ready. Thats the whole vibe.','demo',datetime('now','-832 minutes') FROM users WHERE phone='+13105551105';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'My agent found me 3 SUVs near me that all fit the monthly. Picking this weekend.','demo',datetime('now','-845 minutes') FROM users WHERE phone='+13105551116';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'No salesman calling me 40 times. Just the car answering for itself. Finally.','demo',datetime('now','-858 minutes') FROM users WHERE phone='+13105551127';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Traded in my old beater, numbers were clear before I showed up. Painless.','demo',datetime('now','-871 minutes') FROM users WHERE phone='+13105551138';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Asked the car how fast it really goes and it gave me the actual spec. Love it','demo',datetime('now','-884 minutes') FROM users WHERE phone='+13105551149';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Been burned by dealers before — this felt different. Honest the whole way.','demo',datetime('now','-897 minutes') FROM users WHERE phone='+13105551010';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Matched with something so close to my dream car I did a double take','demo',datetime('now','-910 minutes') FROM users WHERE phone='+13105551021';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'The soft-pull range was dead accurate to what I got approved for. Legit.','demo',datetime('now','-923 minutes') FROM users WHERE phone='+13105551032';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Showed up, they knew my name, terms were set. In and out in 20 min.','demo',datetime('now','-936 minutes') FROM users WHERE phone='+13105551043';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'My agent surfaced a car I didnt even search for and it was perfect','demo',datetime('now','-949 minutes') FROM users WHERE phone='+13105551054';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Certified, one owner, clean CARFAX — and the photo matched. Rare these days.','demo',datetime('now','-962 minutes') FROM users WHERE phone='+13105551065';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Just got matched with a certified Outback under budget — this app actually gets me','demo',datetime('now','-975 minutes') FROM users WHERE phone='+13105551076';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Talked to a car at 1am and it answered every question straight. No pressure. Wild.','demo',datetime('now','-988 minutes') FROM users WHERE phone='+13105551087';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Pre-qualified in like 30 seconds, zero hit to my credit. Where was this 3 cars ago','demo',datetime('now','-1001 minutes') FROM users WHERE phone='+13105551098';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'The AI literally talked me OUT of a car that didnt fit my budget. Respect.','demo',datetime('now','-1014 minutes') FROM users WHERE phone='+13105551109';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Scheduled a test drive from my couch. Walked in, keys ready. Thats the whole vibe.','demo',datetime('now','-1027 minutes') FROM users WHERE phone='+13105551120';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'My agent found me 3 SUVs near me that all fit the monthly. Picking this weekend.','demo',datetime('now','-1040 minutes') FROM users WHERE phone='+13105551131';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'No salesman calling me 40 times. Just the car answering for itself. Finally.','demo',datetime('now','-1053 minutes') FROM users WHERE phone='+13105551142';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Traded in my old beater, numbers were clear before I showed up. Painless.','demo',datetime('now','-1066 minutes') FROM users WHERE phone='+13105551003';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Asked the car how fast it really goes and it gave me the actual spec. Love it','demo',datetime('now','-1079 minutes') FROM users WHERE phone='+13105551014';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Been burned by dealers before — this felt different. Honest the whole way.','demo',datetime('now','-1092 minutes') FROM users WHERE phone='+13105551025';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Matched with something so close to my dream car I did a double take','demo',datetime('now','-1105 minutes') FROM users WHERE phone='+13105551036';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'The soft-pull range was dead accurate to what I got approved for. Legit.','demo',datetime('now','-1118 minutes') FROM users WHERE phone='+13105551047';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Showed up, they knew my name, terms were set. In and out in 20 min.','demo',datetime('now','-1131 minutes') FROM users WHERE phone='+13105551058';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'My agent surfaced a car I didnt even search for and it was perfect','demo',datetime('now','-1144 minutes') FROM users WHERE phone='+13105551069';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Certified, one owner, clean CARFAX — and the photo matched. Rare these days.','demo',datetime('now','-1157 minutes') FROM users WHERE phone='+13105551080';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Just got matched with a certified Civic under budget — this app actually gets me','demo',datetime('now','-1170 minutes') FROM users WHERE phone='+13105551091';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Talked to a car at 1am and it answered every question straight. No pressure. Wild.','demo',datetime('now','-1183 minutes') FROM users WHERE phone='+13105551102';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Pre-qualified in like 30 seconds, zero hit to my credit. Where was this 3 cars ago','demo',datetime('now','-1196 minutes') FROM users WHERE phone='+13105551113';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'The AI literally talked me OUT of a car that didnt fit my budget. Respect.','demo',datetime('now','-1209 minutes') FROM users WHERE phone='+13105551124';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Scheduled a test drive from my couch. Walked in, keys ready. Thats the whole vibe.','demo',datetime('now','-1222 minutes') FROM users WHERE phone='+13105551135';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'My agent found me 3 SUVs near me that all fit the monthly. Picking this weekend.','demo',datetime('now','-1235 minutes') FROM users WHERE phone='+13105551146';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'No salesman calling me 40 times. Just the car answering for itself. Finally.','demo',datetime('now','-1248 minutes') FROM users WHERE phone='+13105551007';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Traded in my old beater, numbers were clear before I showed up. Painless.','demo',datetime('now','-1261 minutes') FROM users WHERE phone='+13105551018';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Asked the car how fast it really goes and it gave me the actual spec. Love it','demo',datetime('now','-1274 minutes') FROM users WHERE phone='+13105551029';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Been burned by dealers before — this felt different. Honest the whole way.','demo',datetime('now','-1287 minutes') FROM users WHERE phone='+13105551040';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Matched with something so close to my dream car I did a double take','demo',datetime('now','-1300 minutes') FROM users WHERE phone='+13105551051';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'The soft-pull range was dead accurate to what I got approved for. Legit.','demo',datetime('now','-1313 minutes') FROM users WHERE phone='+13105551062';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Showed up, they knew my name, terms were set. In and out in 20 min.','demo',datetime('now','-1326 minutes') FROM users WHERE phone='+13105551073';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'My agent surfaced a car I didnt even search for and it was perfect','demo',datetime('now','-1339 minutes') FROM users WHERE phone='+13105551084';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Certified, one owner, clean CARFAX — and the photo matched. Rare these days.','demo',datetime('now','-1352 minutes') FROM users WHERE phone='+13105551095';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Just got matched with a certified Q5 under budget — this app actually gets me','demo',datetime('now','-1365 minutes') FROM users WHERE phone='+13105551106';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Talked to a car at 1am and it answered every question straight. No pressure. Wild.','demo',datetime('now','-1378 minutes') FROM users WHERE phone='+13105551117';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Pre-qualified in like 30 seconds, zero hit to my credit. Where was this 3 cars ago','demo',datetime('now','-1391 minutes') FROM users WHERE phone='+13105551128';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'The AI literally talked me OUT of a car that didnt fit my budget. Respect.','demo',datetime('now','-1404 minutes') FROM users WHERE phone='+13105551139';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Scheduled a test drive from my couch. Walked in, keys ready. Thats the whole vibe.','demo',datetime('now','-1417 minutes') FROM users WHERE phone='+13105551150';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'My agent found me 3 SUVs near me that all fit the monthly. Picking this weekend.','demo',datetime('now','-1430 minutes') FROM users WHERE phone='+13105551011';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'No salesman calling me 40 times. Just the car answering for itself. Finally.','demo',datetime('now','-1443 minutes') FROM users WHERE phone='+13105551022';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Traded in my old beater, numbers were clear before I showed up. Painless.','demo',datetime('now','-1456 minutes') FROM users WHERE phone='+13105551033';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Asked the car how fast it really goes and it gave me the actual spec. Love it','demo',datetime('now','-1469 minutes') FROM users WHERE phone='+13105551044';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Been burned by dealers before — this felt different. Honest the whole way.','demo',datetime('now','-1482 minutes') FROM users WHERE phone='+13105551055';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Matched with something so close to my dream car I did a double take','demo',datetime('now','-1495 minutes') FROM users WHERE phone='+13105551066';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'The soft-pull range was dead accurate to what I got approved for. Legit.','demo',datetime('now','-1508 minutes') FROM users WHERE phone='+13105551077';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Showed up, they knew my name, terms were set. In and out in 20 min.','demo',datetime('now','-1521 minutes') FROM users WHERE phone='+13105551088';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'My agent surfaced a car I didnt even search for and it was perfect','demo',datetime('now','-1534 minutes') FROM users WHERE phone='+13105551099';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Certified, one owner, clean CARFAX — and the photo matched. Rare these days.','demo',datetime('now','-1547 minutes') FROM users WHERE phone='+13105551110';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Just got matched with a certified RAV4 under budget — this app actually gets me','demo',datetime('now','-1560 minutes') FROM users WHERE phone='+13105551121';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Talked to a car at 1am and it answered every question straight. No pressure. Wild.','demo',datetime('now','-1573 minutes') FROM users WHERE phone='+13105551132';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Pre-qualified in like 30 seconds, zero hit to my credit. Where was this 3 cars ago','demo',datetime('now','-1586 minutes') FROM users WHERE phone='+13105551143';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'The AI literally talked me OUT of a car that didnt fit my budget. Respect.','demo',datetime('now','-1599 minutes') FROM users WHERE phone='+13105551004';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Scheduled a test drive from my couch. Walked in, keys ready. Thats the whole vibe.','demo',datetime('now','-1612 minutes') FROM users WHERE phone='+13105551015';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'My agent found me 3 SUVs near me that all fit the monthly. Picking this weekend.','demo',datetime('now','-1625 minutes') FROM users WHERE phone='+13105551026';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'No salesman calling me 40 times. Just the car answering for itself. Finally.','demo',datetime('now','-1638 minutes') FROM users WHERE phone='+13105551037';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Traded in my old beater, numbers were clear before I showed up. Painless.','demo',datetime('now','-1651 minutes') FROM users WHERE phone='+13105551048';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Asked the car how fast it really goes and it gave me the actual spec. Love it','demo',datetime('now','-1664 minutes') FROM users WHERE phone='+13105551059';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Been burned by dealers before — this felt different. Honest the whole way.','demo',datetime('now','-1677 minutes') FROM users WHERE phone='+13105551070';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Matched with something so close to my dream car I did a double take','demo',datetime('now','-1690 minutes') FROM users WHERE phone='+13105551081';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'The soft-pull range was dead accurate to what I got approved for. Legit.','demo',datetime('now','-1703 minutes') FROM users WHERE phone='+13105551092';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Showed up, they knew my name, terms were set. In and out in 20 min.','demo',datetime('now','-1716 minutes') FROM users WHERE phone='+13105551103';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'My agent surfaced a car I didnt even search for and it was perfect','demo',datetime('now','-1729 minutes') FROM users WHERE phone='+13105551114';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Certified, one owner, clean CARFAX — and the photo matched. Rare these days.','demo',datetime('now','-1742 minutes') FROM users WHERE phone='+13105551125';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Just got matched with a certified Outback under budget — this app actually gets me','demo',datetime('now','-1755 minutes') FROM users WHERE phone='+13105551136';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Talked to a car at 1am and it answered every question straight. No pressure. Wild.','demo',datetime('now','-1768 minutes') FROM users WHERE phone='+13105551147';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Pre-qualified in like 30 seconds, zero hit to my credit. Where was this 3 cars ago','demo',datetime('now','-1781 minutes') FROM users WHERE phone='+13105551008';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'The AI literally talked me OUT of a car that didnt fit my budget. Respect.','demo',datetime('now','-1794 minutes') FROM users WHERE phone='+13105551019';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Scheduled a test drive from my couch. Walked in, keys ready. Thats the whole vibe.','demo',datetime('now','-1807 minutes') FROM users WHERE phone='+13105551030';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'My agent found me 3 SUVs near me that all fit the monthly. Picking this weekend.','demo',datetime('now','-1820 minutes') FROM users WHERE phone='+13105551041';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'No salesman calling me 40 times. Just the car answering for itself. Finally.','demo',datetime('now','-1833 minutes') FROM users WHERE phone='+13105551052';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Traded in my old beater, numbers were clear before I showed up. Painless.','demo',datetime('now','-1846 minutes') FROM users WHERE phone='+13105551063';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Asked the car how fast it really goes and it gave me the actual spec. Love it','demo',datetime('now','-1859 minutes') FROM users WHERE phone='+13105551074';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Been burned by dealers before — this felt different. Honest the whole way.','demo',datetime('now','-1872 minutes') FROM users WHERE phone='+13105551085';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Matched with something so close to my dream car I did a double take','demo',datetime('now','-1885 minutes') FROM users WHERE phone='+13105551096';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'The soft-pull range was dead accurate to what I got approved for. Legit.','demo',datetime('now','-1898 minutes') FROM users WHERE phone='+13105551107';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Showed up, they knew my name, terms were set. In and out in 20 min.','demo',datetime('now','-1911 minutes') FROM users WHERE phone='+13105551118';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'My agent surfaced a car I didnt even search for and it was perfect','demo',datetime('now','-1924 minutes') FROM users WHERE phone='+13105551129';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Certified, one owner, clean CARFAX — and the photo matched. Rare these days.','demo',datetime('now','-1937 minutes') FROM users WHERE phone='+13105551140';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Just got matched with a certified Civic under budget — this app actually gets me','demo',datetime('now','-1950 minutes') FROM users WHERE phone='+13105551001';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Talked to a car at 1am and it answered every question straight. No pressure. Wild.','demo',datetime('now','-1963 minutes') FROM users WHERE phone='+13105551012';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Pre-qualified in like 30 seconds, zero hit to my credit. Where was this 3 cars ago','demo',datetime('now','-1976 minutes') FROM users WHERE phone='+13105551023';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'The AI literally talked me OUT of a car that didnt fit my budget. Respect.','demo',datetime('now','-1989 minutes') FROM users WHERE phone='+13105551034';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Scheduled a test drive from my couch. Walked in, keys ready. Thats the whole vibe.','demo',datetime('now','-2002 minutes') FROM users WHERE phone='+13105551045';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'My agent found me 3 SUVs near me that all fit the monthly. Picking this weekend.','demo',datetime('now','-2015 minutes') FROM users WHERE phone='+13105551056';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'No salesman calling me 40 times. Just the car answering for itself. Finally.','demo',datetime('now','-2028 minutes') FROM users WHERE phone='+13105551067';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Traded in my old beater, numbers were clear before I showed up. Painless.','demo',datetime('now','-2041 minutes') FROM users WHERE phone='+13105551078';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Asked the car how fast it really goes and it gave me the actual spec. Love it','demo',datetime('now','-2054 minutes') FROM users WHERE phone='+13105551089';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Been burned by dealers before — this felt different. Honest the whole way.','demo',datetime('now','-2067 minutes') FROM users WHERE phone='+13105551100';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Matched with something so close to my dream car I did a double take','demo',datetime('now','-2080 minutes') FROM users WHERE phone='+13105551111';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'The soft-pull range was dead accurate to what I got approved for. Legit.','demo',datetime('now','-2093 minutes') FROM users WHERE phone='+13105551122';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Showed up, they knew my name, terms were set. In and out in 20 min.','demo',datetime('now','-2106 minutes') FROM users WHERE phone='+13105551133';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'My agent surfaced a car I didnt even search for and it was perfect','demo',datetime('now','-2119 minutes') FROM users WHERE phone='+13105551144';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Certified, one owner, clean CARFAX — and the photo matched. Rare these days.','demo',datetime('now','-2132 minutes') FROM users WHERE phone='+13105551005';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Just got matched with a certified Q5 under budget — this app actually gets me','demo',datetime('now','-2145 minutes') FROM users WHERE phone='+13105551016';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Talked to a car at 1am and it answered every question straight. No pressure. Wild.','demo',datetime('now','-2158 minutes') FROM users WHERE phone='+13105551027';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Pre-qualified in like 30 seconds, zero hit to my credit. Where was this 3 cars ago','demo',datetime('now','-2171 minutes') FROM users WHERE phone='+13105551038';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'The AI literally talked me OUT of a car that didnt fit my budget. Respect.','demo',datetime('now','-2184 minutes') FROM users WHERE phone='+13105551049';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'Scheduled a test drive from my couch. Walked in, keys ready. Thats the whole vibe.','demo',datetime('now','-2197 minutes') FROM users WHERE phone='+13105551060';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'My agent found me 3 SUVs near me that all fit the monthly. Picking this weekend.','demo',datetime('now','-2210 minutes') FROM users WHERE phone='+13105551071';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT 0,v.id,'Spotted a strong match near you — certified and right in budget. Want to talk to it?','agent',datetime('now','-90 minutes') FROM vdps v WHERE v.vin='DEMO-330I';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT 0,v.id,'Spotted a strong match near you — certified and right in budget. Want to talk to it?','agent',datetime('now','-110 minutes') FROM vdps v WHERE v.vin='DEMO-Q5';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT 0,v.id,'Spotted a strong match near you — certified and right in budget. Want to talk to it?','agent',datetime('now','-130 minutes') FROM vdps v WHERE v.vin='DEMO-NX350';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT 0,v.id,'Spotted a strong match near you — certified and right in budget. Want to talk to it?','agent',datetime('now','-150 minutes') FROM vdps v WHERE v.vin='DEMO-CAMRY';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) VALUES (0,0,'Tip: get pre-qualified first — its a soft pull, 0 FICO impact, and unlocks real monthly ranges.','agent',datetime('now','-200 minutes'));
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) VALUES (0,0,'New drop this week across LA — 9 certified cars live now. Ask me what fits your budget.','agent',datetime('now','-230 minutes'));
INSERT OR IGNORE INTO users (phone,handle,sid,created_at) VALUES ('+13104647885','Sid Conalucci','SID-LACARGUY',datetime('now','-1 day'));
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT u.id,v.id,'Huge thanks to Sid at Porsche South Bay — walked out in my 2025 Macan today. Painless.','demo',datetime('now','-42 minutes') FROM users u,vdps v WHERE u.phone='+13104647885' AND v.vin='DEMO-MACAN-2025';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT 0,v.id,'That 2025 Macan is right in your dream-car lane, Brandon — want to talk to it? Tap below.','agent',datetime('now','-38 minutes') FROM vdps v WHERE v.vin='DEMO-MACAN-2025';
