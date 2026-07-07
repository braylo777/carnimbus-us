-- Demo community pool (~150 members + posts), human copy + LA geo. Cleanup:
-- DELETE FROM comments WHERE zip IN ('demo','agent'); DELETE FROM users WHERE phone LIKE '+1310555%';
INSERT OR IGNORE INTO users (phone,handle,sid,zip,lat,lng,created_at) VALUES
 ('+13105551001','Andre L.','SID-DEMO-0001','90066',34.0030,-118.4330,datetime('now','-2 days')),
 ('+13105551002','Grace K.','SID-DEMO-0002','90230',33.9930,-118.3920,datetime('now','-3 days')),
 ('+13105551003','Wes H.','SID-DEMO-0003','90232',34.0280,-118.4000,datetime('now','-4 days')),
 ('+13105551004','Trey W.','SID-DEMO-0004','90291',33.9930,-118.4670,datetime('now','-5 days')),
 ('+13105551005','Talia F.','SID-DEMO-0005','90501',33.8310,-118.2930,datetime('now','-6 days')),
 ('+13105551006','Marco Z.','SID-DEMO-0006','90504',33.8800,-118.3340,datetime('now','-7 days')),
 ('+13105551007','Simone T.','SID-DEMO-0007','90277',33.8370,-118.3910,datetime('now','-8 days')),
 ('+13105551008','Hugo L.','SID-DEMO-0008','90266',33.8860,-118.4050,datetime('now','-9 days')),
 ('+13105551009','Opal K.','SID-DEMO-0009','90254',33.8690,-118.4070,datetime('now','-10 days')),
 ('+13105551010','Willa H.','SID-DEMO-0010','90245',33.9170,-118.4020,datetime('now','-11 days')),
 ('+13105551011','Dario W.','SID-DEMO-0011','90802',33.7610,-118.1860,datetime('now','-12 days')),
 ('+13105551012','Priya F.','SID-DEMO-0012','90740',33.7630,-118.0850,datetime('now','-13 days')),
 ('+13105551013','Tomas Z.','SID-DEMO-0013','90803',33.7580,-118.1280,datetime('now','-14 days')),
 ('+13105551014','Tara T.','SID-DEMO-0014','90731',33.7280,-118.2840,datetime('now','-1 days')),
 ('+13105551015','Deja L.','SID-DEMO-0015','90045',33.9635,-118.4020,datetime('now','-2 days')),
 ('+13105551016','Rashad K.','SID-DEMO-0016','90066',33.9980,-118.4280,datetime('now','-3 days')),
 ('+13105551017','Jade H.','SID-DEMO-0017','90230',33.9880,-118.3870,datetime('now','-4 days')),
 ('+13105551018','Devon W.','SID-DEMO-0018','90232',34.0230,-118.3950,datetime('now','-5 days')),
 ('+13105551019','Esme F.','SID-DEMO-0019','90291',33.9880,-118.4620,datetime('now','-6 days')),
 ('+13105551020','Lorenzo Z.','SID-DEMO-0020','90501',33.8260,-118.3080,datetime('now','-7 days')),
 ('+13105551021','Theo T.','SID-DEMO-0021','90504',33.8750,-118.3290,datetime('now','-8 days')),
 ('+13105551022','Anaya L.','SID-DEMO-0022','90277',33.8320,-118.3860,datetime('now','-9 days')),
 ('+13105551023','Diego K.','SID-DEMO-0023','90266',33.9010,-118.4200,datetime('now','-10 days')),
 ('+13105551024','Leila H.','SID-DEMO-0024','90254',33.8640,-118.4020,datetime('now','-11 days')),
 ('+13105551025','Ivan W.','SID-DEMO-0025','90245',33.9120,-118.3970,datetime('now','-12 days')),
 ('+13105551026','Yuki F.','SID-DEMO-0026','90802',33.7760,-118.2010,datetime('now','-13 days')),
 ('+13105551027','Farah Z.','SID-DEMO-0027','90740',33.7580,-118.0800,datetime('now','-14 days')),
 ('+13105551028','Gio T.','SID-DEMO-0028','90803',33.7530,-118.1230,datetime('now','-1 days')),
 ('+13105551029','Nadia L.','SID-DEMO-0029','90731',33.7430,-118.2990,datetime('now','-2 days')),
 ('+13105551030','Beau K.','SID-DEMO-0030','90045',33.9585,-118.3970,datetime('now','-3 days')),
 ('+13105551031','Isla H.','SID-DEMO-0031','90066',33.9930,-118.4230,datetime('now','-4 days')),
 ('+13105551032','Pablo W.','SID-DEMO-0032','90230',34.0030,-118.4020,datetime('now','-5 days')),
 ('+13105551033','Xavier F.','SID-DEMO-0033','90232',34.0180,-118.3900,datetime('now','-6 days')),
 ('+13105551034','Etta Z.','SID-DEMO-0034','90291',33.9830,-118.4570,datetime('now','-7 days')),
 ('+13105551035','Jordan T.','SID-DEMO-0035','90501',33.8410,-118.3030,datetime('now','-8 days')),
 ('+13105551036','Zoe L.','SID-DEMO-0036','90504',33.8700,-118.3240,datetime('now','-9 days')),
 ('+13105551037','Omar K.','SID-DEMO-0037','90277',33.8270,-118.3810,datetime('now','-10 days')),
 ('+13105551038','Luis H.','SID-DEMO-0038','90266',33.8960,-118.4150,datetime('now','-11 days')),
 ('+13105551039','Mira W.','SID-DEMO-0039','90254',33.8590,-118.3970,datetime('now','-12 days')),
 ('+13105551040','Ravi F.','SID-DEMO-0040','90245',33.9070,-118.4120,datetime('now','-13 days')),
 ('+13105551041','Paloma Z.','SID-DEMO-0041','90802',33.7710,-118.1960,datetime('now','-14 days')),
 ('+13105551042','Felix T.','SID-DEMO-0042','90740',33.7530,-118.0750,datetime('now','-1 days')),
 ('+13105551043','Mabel L.','SID-DEMO-0043','90803',33.7680,-118.1380,datetime('now','-2 days')),
 ('+13105551044','Uma K.','SID-DEMO-0044','90731',33.7380,-118.2940,datetime('now','-3 days')),
 ('+13105551045','Bruno H.','SID-DEMO-0045','90045',33.9535,-118.3920,datetime('now','-4 days')),
 ('+13105551046','Aaliyah W.','SID-DEMO-0046','90066',34.0080,-118.4380,datetime('now','-5 days')),
 ('+13105551047','Cole F.','SID-DEMO-0047','90230',33.9980,-118.3970,datetime('now','-6 days')),
 ('+13105551048','Rosa Z.','SID-DEMO-0048','90232',34.0130,-118.3850,datetime('now','-7 days')),
 ('+13105551049','Sam T.','SID-DEMO-0049','90291',33.9980,-118.4720,datetime('now','-8 days')),
 ('+13105551050','Kai L.','SID-DEMO-0050','90501',33.8360,-118.2980,datetime('now','-9 days')),
 ('+13105551051','Amara K.','SID-DEMO-0051','90504',33.8650,-118.3190,datetime('now','-10 days')),
 ('+13105551052','Quinn H.','SID-DEMO-0052','90277',33.8420,-118.3960,datetime('now','-11 days')),
 ('+13105551053','Camila W.','SID-DEMO-0053','90266',33.8910,-118.4100,datetime('now','-12 days')),
 ('+13105551054','Jonah F.','SID-DEMO-0054','90254',33.8540,-118.3920,datetime('now','-13 days')),
 ('+13105551055','Remy Z.','SID-DEMO-0055','90245',33.9220,-118.4070,datetime('now','-14 days')),
 ('+13105551056','Yara T.','SID-DEMO-0056','90802',33.7660,-118.1910,datetime('now','-1 days')),
 ('+13105551057','Frankie L.','SID-DEMO-0057','90740',33.7480,-118.0700,datetime('now','-2 days')),
 ('+13105551058','Sofia K.','SID-DEMO-0058','90803',33.7630,-118.1330,datetime('now','-3 days')),
 ('+13105551059','Malik H.','SID-DEMO-0059','90731',33.7330,-118.2890,datetime('now','-4 days')),
 ('+13105551060','Bella W.','SID-DEMO-0060','90045',33.9485,-118.4070,datetime('now','-5 days')),
 ('+13105551061','Hana F.','SID-DEMO-0061','90066',34.0030,-118.4330,datetime('now','-6 days')),
 ('+13105551062','Noah Z.','SID-DEMO-0062','90230',33.9930,-118.3920,datetime('now','-7 days')),
 ('+13105551063','Lena T.','SID-DEMO-0063','90232',34.0280,-118.4000,datetime('now','-8 days')),
 ('+13105551064','Rafi L.','SID-DEMO-0064','90291',33.9930,-118.4670,datetime('now','-9 days')),
 ('+13105551065','Gwen K.','SID-DEMO-0065','90501',33.8310,-118.2930,datetime('now','-10 days')),
 ('+13105551066','Nico H.','SID-DEMO-0066','90504',33.8800,-118.3340,datetime('now','-11 days')),
 ('+13105551067','Vince W.','SID-DEMO-0067','90277',33.8370,-118.3910,datetime('now','-12 days')),
 ('+13105551068','Cleo F.','SID-DEMO-0068','90266',33.8860,-118.4050,datetime('now','-13 days')),
 ('+13105551069','Marcus Z.','SID-DEMO-0069','90254',33.8690,-118.4070,datetime('now','-14 days')),
 ('+13105551070','Nina T.','SID-DEMO-0070','90245',33.9170,-118.4020,datetime('now','-1 days')),
 ('+13105551071','Kenji L.','SID-DEMO-0071','90802',33.7610,-118.1860,datetime('now','-2 days')),
 ('+13105551072','Carmen K.','SID-DEMO-0072','90740',33.7630,-118.0850,datetime('now','-3 days')),
 ('+13105551073','Elena H.','SID-DEMO-0073','90803',33.7580,-118.1280,datetime('now','-4 days')),
 ('+13105551074','Blake W.','SID-DEMO-0074','90731',33.7280,-118.2840,datetime('now','-5 days')),
 ('+13105551075','Ines F.','SID-DEMO-0075','90045',33.9635,-118.4020,datetime('now','-6 days')),
 ('+13105551076','Dorian Z.','SID-DEMO-0076','90066',33.9980,-118.4280,datetime('now','-7 days')),
 ('+13105551077','Kira T.','SID-DEMO-0077','90230',33.9880,-118.3870,datetime('now','-8 days')),
 ('+13105551078','Suri L.','SID-DEMO-0078','90232',34.0230,-118.3950,datetime('now','-9 days')),
 ('+13105551079','Zane K.','SID-DEMO-0079','90291',33.9880,-118.4620,datetime('now','-10 days')),
 ('+13105551080','Maya H.','SID-DEMO-0080','90501',33.8260,-118.3080,datetime('now','-11 days')),
 ('+13105551081','Andre W.','SID-DEMO-0081','90504',33.8750,-118.3290,datetime('now','-12 days')),
 ('+13105551082','Grace F.','SID-DEMO-0082','90277',33.8320,-118.3860,datetime('now','-13 days')),
 ('+13105551083','Wes Z.','SID-DEMO-0083','90266',33.9010,-118.4200,datetime('now','-14 days')),
 ('+13105551084','Trey T.','SID-DEMO-0084','90254',33.8640,-118.4020,datetime('now','-1 days')),
 ('+13105551085','Talia L.','SID-DEMO-0085','90245',33.9120,-118.3970,datetime('now','-2 days')),
 ('+13105551086','Marco K.','SID-DEMO-0086','90802',33.7760,-118.2010,datetime('now','-3 days')),
 ('+13105551087','Simone H.','SID-DEMO-0087','90740',33.7580,-118.0800,datetime('now','-4 days')),
 ('+13105551088','Hugo W.','SID-DEMO-0088','90803',33.7530,-118.1230,datetime('now','-5 days')),
 ('+13105551089','Opal F.','SID-DEMO-0089','90731',33.7430,-118.2990,datetime('now','-6 days')),
 ('+13105551090','Willa Z.','SID-DEMO-0090','90045',33.9585,-118.3970,datetime('now','-7 days')),
 ('+13105551091','Dario T.','SID-DEMO-0091','90066',33.9930,-118.4230,datetime('now','-8 days')),
 ('+13105551092','Priya L.','SID-DEMO-0092','90230',34.0030,-118.4020,datetime('now','-9 days')),
 ('+13105551093','Tomas K.','SID-DEMO-0093','90232',34.0180,-118.3900,datetime('now','-10 days')),
 ('+13105551094','Tara H.','SID-DEMO-0094','90291',33.9830,-118.4570,datetime('now','-11 days')),
 ('+13105551095','Deja W.','SID-DEMO-0095','90501',33.8410,-118.3030,datetime('now','-12 days')),
 ('+13105551096','Rashad F.','SID-DEMO-0096','90504',33.8700,-118.3240,datetime('now','-13 days')),
 ('+13105551097','Jade Z.','SID-DEMO-0097','90277',33.8270,-118.3810,datetime('now','-14 days')),
 ('+13105551098','Devon T.','SID-DEMO-0098','90266',33.8960,-118.4150,datetime('now','-1 days')),
 ('+13105551099','Esme L.','SID-DEMO-0099','90254',33.8590,-118.3970,datetime('now','-2 days')),
 ('+13105551100','Lorenzo K.','SID-DEMO-0100','90245',33.9070,-118.4120,datetime('now','-3 days')),
 ('+13105551101','Theo H.','SID-DEMO-0101','90802',33.7710,-118.1960,datetime('now','-4 days')),
 ('+13105551102','Anaya W.','SID-DEMO-0102','90740',33.7530,-118.0750,datetime('now','-5 days')),
 ('+13105551103','Diego F.','SID-DEMO-0103','90803',33.7680,-118.1380,datetime('now','-6 days')),
 ('+13105551104','Leila Z.','SID-DEMO-0104','90731',33.7380,-118.2940,datetime('now','-7 days')),
 ('+13105551105','Ivan T.','SID-DEMO-0105','90045',33.9535,-118.3920,datetime('now','-8 days')),
 ('+13105551106','Yuki L.','SID-DEMO-0106','90066',34.0080,-118.4380,datetime('now','-9 days')),
 ('+13105551107','Farah K.','SID-DEMO-0107','90230',33.9980,-118.3970,datetime('now','-10 days')),
 ('+13105551108','Gio H.','SID-DEMO-0108','90232',34.0130,-118.3850,datetime('now','-11 days')),
 ('+13105551109','Nadia W.','SID-DEMO-0109','90291',33.9980,-118.4720,datetime('now','-12 days')),
 ('+13105551110','Beau F.','SID-DEMO-0110','90501',33.8360,-118.2980,datetime('now','-13 days')),
 ('+13105551111','Isla Z.','SID-DEMO-0111','90504',33.8650,-118.3190,datetime('now','-14 days')),
 ('+13105551112','Pablo T.','SID-DEMO-0112','90277',33.8420,-118.3960,datetime('now','-1 days')),
 ('+13105551113','Xavier L.','SID-DEMO-0113','90266',33.8910,-118.4100,datetime('now','-2 days')),
 ('+13105551114','Etta K.','SID-DEMO-0114','90254',33.8540,-118.3920,datetime('now','-3 days')),
 ('+13105551115','Jordan H.','SID-DEMO-0115','90245',33.9220,-118.4070,datetime('now','-4 days')),
 ('+13105551116','Zoe W.','SID-DEMO-0116','90802',33.7660,-118.1910,datetime('now','-5 days')),
 ('+13105551117','Omar F.','SID-DEMO-0117','90740',33.7480,-118.0700,datetime('now','-6 days')),
 ('+13105551118','Luis Z.','SID-DEMO-0118','90803',33.7630,-118.1330,datetime('now','-7 days')),
 ('+13105551119','Mira T.','SID-DEMO-0119','90731',33.7330,-118.2890,datetime('now','-8 days')),
 ('+13105551120','Ravi L.','SID-DEMO-0120','90045',33.9485,-118.4070,datetime('now','-9 days')),
 ('+13105551121','Paloma K.','SID-DEMO-0121','90066',34.0030,-118.4330,datetime('now','-10 days')),
 ('+13105551122','Felix H.','SID-DEMO-0122','90230',33.9930,-118.3920,datetime('now','-11 days')),
 ('+13105551123','Mabel W.','SID-DEMO-0123','90232',34.0280,-118.4000,datetime('now','-12 days')),
 ('+13105551124','Uma F.','SID-DEMO-0124','90291',33.9930,-118.4670,datetime('now','-13 days')),
 ('+13105551125','Bruno Z.','SID-DEMO-0125','90501',33.8310,-118.2930,datetime('now','-14 days')),
 ('+13105551126','Aaliyah T.','SID-DEMO-0126','90504',33.8800,-118.3340,datetime('now','-1 days')),
 ('+13105551127','Cole L.','SID-DEMO-0127','90277',33.8370,-118.3910,datetime('now','-2 days')),
 ('+13105551128','Rosa K.','SID-DEMO-0128','90266',33.8860,-118.4050,datetime('now','-3 days')),
 ('+13105551129','Sam H.','SID-DEMO-0129','90254',33.8690,-118.4070,datetime('now','-4 days')),
 ('+13105551130','Kai W.','SID-DEMO-0130','90245',33.9170,-118.4020,datetime('now','-5 days')),
 ('+13105551131','Amara F.','SID-DEMO-0131','90802',33.7610,-118.1860,datetime('now','-6 days')),
 ('+13105551132','Quinn Z.','SID-DEMO-0132','90740',33.7630,-118.0850,datetime('now','-7 days')),
 ('+13105551133','Camila T.','SID-DEMO-0133','90803',33.7580,-118.1280,datetime('now','-8 days')),
 ('+13105551134','Jonah L.','SID-DEMO-0134','90731',33.7280,-118.2840,datetime('now','-9 days')),
 ('+13105551135','Remy K.','SID-DEMO-0135','90045',33.9635,-118.4020,datetime('now','-10 days')),
 ('+13105551136','Yara H.','SID-DEMO-0136','90066',33.9980,-118.4280,datetime('now','-11 days')),
 ('+13105551137','Frankie W.','SID-DEMO-0137','90230',33.9880,-118.3870,datetime('now','-12 days')),
 ('+13105551138','Sofia F.','SID-DEMO-0138','90232',34.0230,-118.3950,datetime('now','-13 days')),
 ('+13105551139','Malik Z.','SID-DEMO-0139','90291',33.9880,-118.4620,datetime('now','-14 days')),
 ('+13105551140','Bella T.','SID-DEMO-0140','90501',33.8260,-118.3080,datetime('now','-1 days')),
 ('+13105551141','Hana L.','SID-DEMO-0141','90504',33.8750,-118.3290,datetime('now','-2 days')),
 ('+13105551142','Noah K.','SID-DEMO-0142','90277',33.8320,-118.3860,datetime('now','-3 days')),
 ('+13105551143','Lena H.','SID-DEMO-0143','90266',33.9010,-118.4200,datetime('now','-4 days')),
 ('+13105551144','Rafi W.','SID-DEMO-0144','90254',33.8640,-118.4020,datetime('now','-5 days')),
 ('+13105551145','Gwen F.','SID-DEMO-0145','90245',33.9120,-118.3970,datetime('now','-6 days')),
 ('+13105551146','Nico Z.','SID-DEMO-0146','90802',33.7760,-118.2010,datetime('now','-7 days')),
 ('+13105551147','Vince T.','SID-DEMO-0147','90740',33.7580,-118.0800,datetime('now','-8 days')),
 ('+13105551148','Cleo L.','SID-DEMO-0148','90803',33.7530,-118.1230,datetime('now','-9 days')),
 ('+13105551149','Marcus K.','SID-DEMO-0149','90731',33.7430,-118.2990,datetime('now','-10 days')),
 ('+13105551150','Nina H.','SID-DEMO-0150','90045',33.9585,-118.3970,datetime('now','-11 days'));
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'my sister told me to try this. got matched with a CX-5 like 4 min from my place, went saturday morning. keys were ready. that''s it??','demo',datetime('now','-13 minutes') FROM users WHERE phone='+13105551012';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'credit''s not amazing rn so I was nervous. soft pull, didn''t ding me, and it still found stuff I could actually afford','demo',datetime('now','-26 minutes') FROM users WHERE phone='+13105551023';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'the car literally told me a different one fit my budget better lol. who does that','demo',datetime('now','-39 minutes') FROM users WHERE phone='+13105551034';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'picked mine up yesterday. no four hour desk marathon. in and out. still kinda in shock','demo',datetime('now','-52 minutes') FROM users WHERE phone='+13105551045';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'was 100% gonna get talked into more than I wanted. instead it just showed me what works. refreshing honestly','demo',datetime('now','-65 minutes') FROM users WHERE phone='+13105551056';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'asked how fast it really goes expecting a sales dodge and it just gave me the actual number. ok cool','demo',datetime('now','-78 minutes') FROM users WHERE phone='+13105551067';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'traded my old civic, numbers were clear before I even walked in. no surprises at the desk for once','demo',datetime('now','-91 minutes') FROM users WHERE phone='+13105551078';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'matched me with something so close to my dream car I did a double take. not mad about it','demo',datetime('now','-104 minutes') FROM users WHERE phone='+13105551089';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'been burned by dealers twice. this felt different. it let me walk and meant it','demo',datetime('now','-117 minutes') FROM users WHERE phone='+13105551100';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'the pre-qual range was dead on to what I actually got approved for. no games','demo',datetime('now','-130 minutes') FROM users WHERE phone='+13105551111';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'showed up, they knew my name, terms already set. 20 min later I''m driving home','demo',datetime('now','-143 minutes') FROM users WHERE phone='+13105551122';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'surfaced a car I never would''ve searched for and it''s kind of perfect for my commute','demo',datetime('now','-156 minutes') FROM users WHERE phone='+13105551133';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'certified, one owner, clean carfax, AND the photos matched the actual car. rare','demo',datetime('now','-169 minutes') FROM users WHERE phone='+13105551144';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'did the whole thing from my couch in sweatpants. test drive booked for thursday. wild time to be alive','demo',datetime('now','-182 minutes') FROM users WHERE phone='+13105551005';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'kept waiting for the catch. still waiting. drove off in it monday','demo',datetime('now','-195 minutes') FROM users WHERE phone='+13105551016';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'honestly just wanted to browse and it didn''t pressure me once. so I actually stayed','demo',datetime('now','-208 minutes') FROM users WHERE phone='+13105551027';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'my partner and I compared like 5 SUVs in the feed in one sitting. way less overwhelming than lot-hopping','demo',datetime('now','-221 minutes') FROM users WHERE phone='+13105551038';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'asked a dumb question about towing and got a real answer, no condescension. appreciated that','demo',datetime('now','-234 minutes') FROM users WHERE phone='+13105551049';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'the monthly it quoted is exactly what I''m paying. no doc-fee ambush','demo',datetime('now','-247 minutes') FROM users WHERE phone='+13105551060';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'found one two zips over, drove it, loved it, done by lunch','demo',datetime('now','-260 minutes') FROM users WHERE phone='+13105551071';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'I hate small talk with salesmen so this was honestly a dream. just me and the facts','demo',datetime('now','-273 minutes') FROM users WHERE phone='+13105551082';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'got my trade value up front and it held. first time that''s ever happened to me','demo',datetime('now','-286 minutes') FROM users WHERE phone='+13105551093';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'the little ''why it fits you'' thing actually nailed why I''d want it. kinda spooky','demo',datetime('now','-299 minutes') FROM users WHERE phone='+13105551104';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'booked, drove, bought. three taps and a saturday. thanks for saving my weekend','demo',datetime('now','-312 minutes') FROM users WHERE phone='+13105551115';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'was ready to fight over the price and there was nothing to fight about. weird feeling','demo',datetime('now','-325 minutes') FROM users WHERE phone='+13105551126';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'showed my mom, now she wants to trade her camry lol','demo',datetime('now','-338 minutes') FROM users WHERE phone='+13105551137';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'genuinely the least stressful car thing I''ve ever done and I''ve done it four times','demo',datetime('now','-351 minutes') FROM users WHERE phone='+13105551148';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'no spam calls after. just the appointment reminder. that alone sold me','demo',datetime('now','-364 minutes') FROM users WHERE phone='+13105551009';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'asked if it was a bot straight up and it was honest about it. respect','demo',datetime('now','-377 minutes') FROM users WHERE phone='+13105551020';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'ngl I was dreading the whole dealer thing but I asked the car my questions at like midnight and it actually answered straight. weird but I''m into it','demo',datetime('now','-390 minutes') FROM users WHERE phone='+13105551031';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'my sister told me to try this. got matched with a CX-5 like 4 min from my place, went saturday morning. keys were ready. that''s it??','demo',datetime('now','-403 minutes') FROM users WHERE phone='+13105551042';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'credit''s not amazing rn so I was nervous. soft pull, didn''t ding me, and it still found stuff I could actually afford','demo',datetime('now','-416 minutes') FROM users WHERE phone='+13105551053';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'the car literally told me a different one fit my budget better lol. who does that','demo',datetime('now','-429 minutes') FROM users WHERE phone='+13105551064';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'picked mine up yesterday. no four hour desk marathon. in and out. still kinda in shock','demo',datetime('now','-442 minutes') FROM users WHERE phone='+13105551075';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'was 100% gonna get talked into more than I wanted. instead it just showed me what works. refreshing honestly','demo',datetime('now','-455 minutes') FROM users WHERE phone='+13105551086';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'asked how fast it really goes expecting a sales dodge and it just gave me the actual number. ok cool','demo',datetime('now','-468 minutes') FROM users WHERE phone='+13105551097';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'traded my old civic, numbers were clear before I even walked in. no surprises at the desk for once','demo',datetime('now','-481 minutes') FROM users WHERE phone='+13105551108';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'matched me with something so close to my dream car I did a double take. not mad about it','demo',datetime('now','-494 minutes') FROM users WHERE phone='+13105551119';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'been burned by dealers twice. this felt different. it let me walk and meant it','demo',datetime('now','-507 minutes') FROM users WHERE phone='+13105551130';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'the pre-qual range was dead on to what I actually got approved for. no games','demo',datetime('now','-520 minutes') FROM users WHERE phone='+13105551141';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'showed up, they knew my name, terms already set. 20 min later I''m driving home','demo',datetime('now','-533 minutes') FROM users WHERE phone='+13105551002';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'surfaced a car I never would''ve searched for and it''s kind of perfect for my commute','demo',datetime('now','-546 minutes') FROM users WHERE phone='+13105551013';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'certified, one owner, clean carfax, AND the photos matched the actual car. rare','demo',datetime('now','-559 minutes') FROM users WHERE phone='+13105551024';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'did the whole thing from my couch in sweatpants. test drive booked for thursday. wild time to be alive','demo',datetime('now','-572 minutes') FROM users WHERE phone='+13105551035';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'kept waiting for the catch. still waiting. drove off in it monday','demo',datetime('now','-585 minutes') FROM users WHERE phone='+13105551046';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'honestly just wanted to browse and it didn''t pressure me once. so I actually stayed','demo',datetime('now','-598 minutes') FROM users WHERE phone='+13105551057';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'my partner and I compared like 5 SUVs in the feed in one sitting. way less overwhelming than lot-hopping','demo',datetime('now','-611 minutes') FROM users WHERE phone='+13105551068';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'asked a dumb question about towing and got a real answer, no condescension. appreciated that','demo',datetime('now','-624 minutes') FROM users WHERE phone='+13105551079';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'the monthly it quoted is exactly what I''m paying. no doc-fee ambush','demo',datetime('now','-637 minutes') FROM users WHERE phone='+13105551090';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'found one two zips over, drove it, loved it, done by lunch','demo',datetime('now','-650 minutes') FROM users WHERE phone='+13105551101';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'I hate small talk with salesmen so this was honestly a dream. just me and the facts','demo',datetime('now','-663 minutes') FROM users WHERE phone='+13105551112';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'got my trade value up front and it held. first time that''s ever happened to me','demo',datetime('now','-676 minutes') FROM users WHERE phone='+13105551123';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'the little ''why it fits you'' thing actually nailed why I''d want it. kinda spooky','demo',datetime('now','-689 minutes') FROM users WHERE phone='+13105551134';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'booked, drove, bought. three taps and a saturday. thanks for saving my weekend','demo',datetime('now','-702 minutes') FROM users WHERE phone='+13105551145';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'was ready to fight over the price and there was nothing to fight about. weird feeling','demo',datetime('now','-715 minutes') FROM users WHERE phone='+13105551006';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'showed my mom, now she wants to trade her camry lol','demo',datetime('now','-728 minutes') FROM users WHERE phone='+13105551017';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'genuinely the least stressful car thing I''ve ever done and I''ve done it four times','demo',datetime('now','-741 minutes') FROM users WHERE phone='+13105551028';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'no spam calls after. just the appointment reminder. that alone sold me','demo',datetime('now','-754 minutes') FROM users WHERE phone='+13105551039';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'asked if it was a bot straight up and it was honest about it. respect','demo',datetime('now','-767 minutes') FROM users WHERE phone='+13105551050';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'ngl I was dreading the whole dealer thing but I asked the car my questions at like midnight and it actually answered straight. weird but I''m into it','demo',datetime('now','-780 minutes') FROM users WHERE phone='+13105551061';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'my sister told me to try this. got matched with a CX-5 like 4 min from my place, went saturday morning. keys were ready. that''s it??','demo',datetime('now','-793 minutes') FROM users WHERE phone='+13105551072';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'credit''s not amazing rn so I was nervous. soft pull, didn''t ding me, and it still found stuff I could actually afford','demo',datetime('now','-806 minutes') FROM users WHERE phone='+13105551083';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'the car literally told me a different one fit my budget better lol. who does that','demo',datetime('now','-819 minutes') FROM users WHERE phone='+13105551094';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'picked mine up yesterday. no four hour desk marathon. in and out. still kinda in shock','demo',datetime('now','-832 minutes') FROM users WHERE phone='+13105551105';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'was 100% gonna get talked into more than I wanted. instead it just showed me what works. refreshing honestly','demo',datetime('now','-845 minutes') FROM users WHERE phone='+13105551116';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'asked how fast it really goes expecting a sales dodge and it just gave me the actual number. ok cool','demo',datetime('now','-858 minutes') FROM users WHERE phone='+13105551127';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'traded my old civic, numbers were clear before I even walked in. no surprises at the desk for once','demo',datetime('now','-871 minutes') FROM users WHERE phone='+13105551138';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'matched me with something so close to my dream car I did a double take. not mad about it','demo',datetime('now','-884 minutes') FROM users WHERE phone='+13105551149';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'been burned by dealers twice. this felt different. it let me walk and meant it','demo',datetime('now','-897 minutes') FROM users WHERE phone='+13105551010';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'the pre-qual range was dead on to what I actually got approved for. no games','demo',datetime('now','-910 minutes') FROM users WHERE phone='+13105551021';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'showed up, they knew my name, terms already set. 20 min later I''m driving home','demo',datetime('now','-923 minutes') FROM users WHERE phone='+13105551032';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'surfaced a car I never would''ve searched for and it''s kind of perfect for my commute','demo',datetime('now','-936 minutes') FROM users WHERE phone='+13105551043';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'certified, one owner, clean carfax, AND the photos matched the actual car. rare','demo',datetime('now','-949 minutes') FROM users WHERE phone='+13105551054';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'did the whole thing from my couch in sweatpants. test drive booked for thursday. wild time to be alive','demo',datetime('now','-962 minutes') FROM users WHERE phone='+13105551065';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'kept waiting for the catch. still waiting. drove off in it monday','demo',datetime('now','-975 minutes') FROM users WHERE phone='+13105551076';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'honestly just wanted to browse and it didn''t pressure me once. so I actually stayed','demo',datetime('now','-988 minutes') FROM users WHERE phone='+13105551087';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'my partner and I compared like 5 SUVs in the feed in one sitting. way less overwhelming than lot-hopping','demo',datetime('now','-1001 minutes') FROM users WHERE phone='+13105551098';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'asked a dumb question about towing and got a real answer, no condescension. appreciated that','demo',datetime('now','-1014 minutes') FROM users WHERE phone='+13105551109';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'the monthly it quoted is exactly what I''m paying. no doc-fee ambush','demo',datetime('now','-1027 minutes') FROM users WHERE phone='+13105551120';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'found one two zips over, drove it, loved it, done by lunch','demo',datetime('now','-1040 minutes') FROM users WHERE phone='+13105551131';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'I hate small talk with salesmen so this was honestly a dream. just me and the facts','demo',datetime('now','-1053 minutes') FROM users WHERE phone='+13105551142';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'got my trade value up front and it held. first time that''s ever happened to me','demo',datetime('now','-1066 minutes') FROM users WHERE phone='+13105551003';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'the little ''why it fits you'' thing actually nailed why I''d want it. kinda spooky','demo',datetime('now','-1079 minutes') FROM users WHERE phone='+13105551014';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'booked, drove, bought. three taps and a saturday. thanks for saving my weekend','demo',datetime('now','-1092 minutes') FROM users WHERE phone='+13105551025';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'was ready to fight over the price and there was nothing to fight about. weird feeling','demo',datetime('now','-1105 minutes') FROM users WHERE phone='+13105551036';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'showed my mom, now she wants to trade her camry lol','demo',datetime('now','-1118 minutes') FROM users WHERE phone='+13105551047';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'genuinely the least stressful car thing I''ve ever done and I''ve done it four times','demo',datetime('now','-1131 minutes') FROM users WHERE phone='+13105551058';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'no spam calls after. just the appointment reminder. that alone sold me','demo',datetime('now','-1144 minutes') FROM users WHERE phone='+13105551069';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'asked if it was a bot straight up and it was honest about it. respect','demo',datetime('now','-1157 minutes') FROM users WHERE phone='+13105551080';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'ngl I was dreading the whole dealer thing but I asked the car my questions at like midnight and it actually answered straight. weird but I''m into it','demo',datetime('now','-1170 minutes') FROM users WHERE phone='+13105551091';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'my sister told me to try this. got matched with a CX-5 like 4 min from my place, went saturday morning. keys were ready. that''s it??','demo',datetime('now','-1183 minutes') FROM users WHERE phone='+13105551102';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'credit''s not amazing rn so I was nervous. soft pull, didn''t ding me, and it still found stuff I could actually afford','demo',datetime('now','-1196 minutes') FROM users WHERE phone='+13105551113';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'the car literally told me a different one fit my budget better lol. who does that','demo',datetime('now','-1209 minutes') FROM users WHERE phone='+13105551124';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'picked mine up yesterday. no four hour desk marathon. in and out. still kinda in shock','demo',datetime('now','-1222 minutes') FROM users WHERE phone='+13105551135';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'was 100% gonna get talked into more than I wanted. instead it just showed me what works. refreshing honestly','demo',datetime('now','-1235 minutes') FROM users WHERE phone='+13105551146';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'asked how fast it really goes expecting a sales dodge and it just gave me the actual number. ok cool','demo',datetime('now','-1248 minutes') FROM users WHERE phone='+13105551007';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'traded my old civic, numbers were clear before I even walked in. no surprises at the desk for once','demo',datetime('now','-1261 minutes') FROM users WHERE phone='+13105551018';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'matched me with something so close to my dream car I did a double take. not mad about it','demo',datetime('now','-1274 minutes') FROM users WHERE phone='+13105551029';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'been burned by dealers twice. this felt different. it let me walk and meant it','demo',datetime('now','-1287 minutes') FROM users WHERE phone='+13105551040';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'the pre-qual range was dead on to what I actually got approved for. no games','demo',datetime('now','-1300 minutes') FROM users WHERE phone='+13105551051';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'showed up, they knew my name, terms already set. 20 min later I''m driving home','demo',datetime('now','-1313 minutes') FROM users WHERE phone='+13105551062';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'surfaced a car I never would''ve searched for and it''s kind of perfect for my commute','demo',datetime('now','-1326 minutes') FROM users WHERE phone='+13105551073';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'certified, one owner, clean carfax, AND the photos matched the actual car. rare','demo',datetime('now','-1339 minutes') FROM users WHERE phone='+13105551084';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'did the whole thing from my couch in sweatpants. test drive booked for thursday. wild time to be alive','demo',datetime('now','-1352 minutes') FROM users WHERE phone='+13105551095';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'kept waiting for the catch. still waiting. drove off in it monday','demo',datetime('now','-1365 minutes') FROM users WHERE phone='+13105551106';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'honestly just wanted to browse and it didn''t pressure me once. so I actually stayed','demo',datetime('now','-1378 minutes') FROM users WHERE phone='+13105551117';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'my partner and I compared like 5 SUVs in the feed in one sitting. way less overwhelming than lot-hopping','demo',datetime('now','-1391 minutes') FROM users WHERE phone='+13105551128';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'asked a dumb question about towing and got a real answer, no condescension. appreciated that','demo',datetime('now','-1404 minutes') FROM users WHERE phone='+13105551139';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'the monthly it quoted is exactly what I''m paying. no doc-fee ambush','demo',datetime('now','-1417 minutes') FROM users WHERE phone='+13105551150';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'found one two zips over, drove it, loved it, done by lunch','demo',datetime('now','-1430 minutes') FROM users WHERE phone='+13105551011';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'I hate small talk with salesmen so this was honestly a dream. just me and the facts','demo',datetime('now','-1443 minutes') FROM users WHERE phone='+13105551022';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'got my trade value up front and it held. first time that''s ever happened to me','demo',datetime('now','-1456 minutes') FROM users WHERE phone='+13105551033';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'the little ''why it fits you'' thing actually nailed why I''d want it. kinda spooky','demo',datetime('now','-1469 minutes') FROM users WHERE phone='+13105551044';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'booked, drove, bought. three taps and a saturday. thanks for saving my weekend','demo',datetime('now','-1482 minutes') FROM users WHERE phone='+13105551055';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'was ready to fight over the price and there was nothing to fight about. weird feeling','demo',datetime('now','-1495 minutes') FROM users WHERE phone='+13105551066';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'showed my mom, now she wants to trade her camry lol','demo',datetime('now','-1508 minutes') FROM users WHERE phone='+13105551077';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'genuinely the least stressful car thing I''ve ever done and I''ve done it four times','demo',datetime('now','-1521 minutes') FROM users WHERE phone='+13105551088';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'no spam calls after. just the appointment reminder. that alone sold me','demo',datetime('now','-1534 minutes') FROM users WHERE phone='+13105551099';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'asked if it was a bot straight up and it was honest about it. respect','demo',datetime('now','-1547 minutes') FROM users WHERE phone='+13105551110';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'ngl I was dreading the whole dealer thing but I asked the car my questions at like midnight and it actually answered straight. weird but I''m into it','demo',datetime('now','-1560 minutes') FROM users WHERE phone='+13105551121';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'my sister told me to try this. got matched with a CX-5 like 4 min from my place, went saturday morning. keys were ready. that''s it??','demo',datetime('now','-1573 minutes') FROM users WHERE phone='+13105551132';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'credit''s not amazing rn so I was nervous. soft pull, didn''t ding me, and it still found stuff I could actually afford','demo',datetime('now','-1586 minutes') FROM users WHERE phone='+13105551143';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'the car literally told me a different one fit my budget better lol. who does that','demo',datetime('now','-1599 minutes') FROM users WHERE phone='+13105551004';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'picked mine up yesterday. no four hour desk marathon. in and out. still kinda in shock','demo',datetime('now','-1612 minutes') FROM users WHERE phone='+13105551015';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'was 100% gonna get talked into more than I wanted. instead it just showed me what works. refreshing honestly','demo',datetime('now','-1625 minutes') FROM users WHERE phone='+13105551026';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'asked how fast it really goes expecting a sales dodge and it just gave me the actual number. ok cool','demo',datetime('now','-1638 minutes') FROM users WHERE phone='+13105551037';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'traded my old civic, numbers were clear before I even walked in. no surprises at the desk for once','demo',datetime('now','-1651 minutes') FROM users WHERE phone='+13105551048';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'matched me with something so close to my dream car I did a double take. not mad about it','demo',datetime('now','-1664 minutes') FROM users WHERE phone='+13105551059';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'been burned by dealers twice. this felt different. it let me walk and meant it','demo',datetime('now','-1677 minutes') FROM users WHERE phone='+13105551070';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'the pre-qual range was dead on to what I actually got approved for. no games','demo',datetime('now','-1690 minutes') FROM users WHERE phone='+13105551081';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'showed up, they knew my name, terms already set. 20 min later I''m driving home','demo',datetime('now','-1703 minutes') FROM users WHERE phone='+13105551092';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'surfaced a car I never would''ve searched for and it''s kind of perfect for my commute','demo',datetime('now','-1716 minutes') FROM users WHERE phone='+13105551103';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'certified, one owner, clean carfax, AND the photos matched the actual car. rare','demo',datetime('now','-1729 minutes') FROM users WHERE phone='+13105551114';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'did the whole thing from my couch in sweatpants. test drive booked for thursday. wild time to be alive','demo',datetime('now','-1742 minutes') FROM users WHERE phone='+13105551125';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'kept waiting for the catch. still waiting. drove off in it monday','demo',datetime('now','-1755 minutes') FROM users WHERE phone='+13105551136';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'honestly just wanted to browse and it didn''t pressure me once. so I actually stayed','demo',datetime('now','-1768 minutes') FROM users WHERE phone='+13105551147';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'my partner and I compared like 5 SUVs in the feed in one sitting. way less overwhelming than lot-hopping','demo',datetime('now','-1781 minutes') FROM users WHERE phone='+13105551008';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'asked a dumb question about towing and got a real answer, no condescension. appreciated that','demo',datetime('now','-1794 minutes') FROM users WHERE phone='+13105551019';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'the monthly it quoted is exactly what I''m paying. no doc-fee ambush','demo',datetime('now','-1807 minutes') FROM users WHERE phone='+13105551030';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'found one two zips over, drove it, loved it, done by lunch','demo',datetime('now','-1820 minutes') FROM users WHERE phone='+13105551041';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'I hate small talk with salesmen so this was honestly a dream. just me and the facts','demo',datetime('now','-1833 minutes') FROM users WHERE phone='+13105551052';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'got my trade value up front and it held. first time that''s ever happened to me','demo',datetime('now','-1846 minutes') FROM users WHERE phone='+13105551063';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'the little ''why it fits you'' thing actually nailed why I''d want it. kinda spooky','demo',datetime('now','-1859 minutes') FROM users WHERE phone='+13105551074';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'booked, drove, bought. three taps and a saturday. thanks for saving my weekend','demo',datetime('now','-1872 minutes') FROM users WHERE phone='+13105551085';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'was ready to fight over the price and there was nothing to fight about. weird feeling','demo',datetime('now','-1885 minutes') FROM users WHERE phone='+13105551096';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'showed my mom, now she wants to trade her camry lol','demo',datetime('now','-1898 minutes') FROM users WHERE phone='+13105551107';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'genuinely the least stressful car thing I''ve ever done and I''ve done it four times','demo',datetime('now','-1911 minutes') FROM users WHERE phone='+13105551118';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'no spam calls after. just the appointment reminder. that alone sold me','demo',datetime('now','-1924 minutes') FROM users WHERE phone='+13105551129';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'asked if it was a bot straight up and it was honest about it. respect','demo',datetime('now','-1937 minutes') FROM users WHERE phone='+13105551140';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'ngl I was dreading the whole dealer thing but I asked the car my questions at like midnight and it actually answered straight. weird but I''m into it','demo',datetime('now','-1950 minutes') FROM users WHERE phone='+13105551001';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'my sister told me to try this. got matched with a CX-5 like 4 min from my place, went saturday morning. keys were ready. that''s it??','demo',datetime('now','-1963 minutes') FROM users WHERE phone='+13105551012';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'credit''s not amazing rn so I was nervous. soft pull, didn''t ding me, and it still found stuff I could actually afford','demo',datetime('now','-1976 minutes') FROM users WHERE phone='+13105551023';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'the car literally told me a different one fit my budget better lol. who does that','demo',datetime('now','-1989 minutes') FROM users WHERE phone='+13105551034';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'picked mine up yesterday. no four hour desk marathon. in and out. still kinda in shock','demo',datetime('now','-2002 minutes') FROM users WHERE phone='+13105551045';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'was 100% gonna get talked into more than I wanted. instead it just showed me what works. refreshing honestly','demo',datetime('now','-2015 minutes') FROM users WHERE phone='+13105551056';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'asked how fast it really goes expecting a sales dodge and it just gave me the actual number. ok cool','demo',datetime('now','-2028 minutes') FROM users WHERE phone='+13105551067';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'traded my old civic, numbers were clear before I even walked in. no surprises at the desk for once','demo',datetime('now','-2041 minutes') FROM users WHERE phone='+13105551078';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'matched me with something so close to my dream car I did a double take. not mad about it','demo',datetime('now','-2054 minutes') FROM users WHERE phone='+13105551089';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'been burned by dealers twice. this felt different. it let me walk and meant it','demo',datetime('now','-2067 minutes') FROM users WHERE phone='+13105551100';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'the pre-qual range was dead on to what I actually got approved for. no games','demo',datetime('now','-2080 minutes') FROM users WHERE phone='+13105551111';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'showed up, they knew my name, terms already set. 20 min later I''m driving home','demo',datetime('now','-2093 minutes') FROM users WHERE phone='+13105551122';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'surfaced a car I never would''ve searched for and it''s kind of perfect for my commute','demo',datetime('now','-2106 minutes') FROM users WHERE phone='+13105551133';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'certified, one owner, clean carfax, AND the photos matched the actual car. rare','demo',datetime('now','-2119 minutes') FROM users WHERE phone='+13105551144';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'did the whole thing from my couch in sweatpants. test drive booked for thursday. wild time to be alive','demo',datetime('now','-2132 minutes') FROM users WHERE phone='+13105551005';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'kept waiting for the catch. still waiting. drove off in it monday','demo',datetime('now','-2145 minutes') FROM users WHERE phone='+13105551016';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'honestly just wanted to browse and it didn''t pressure me once. so I actually stayed','demo',datetime('now','-2158 minutes') FROM users WHERE phone='+13105551027';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'my partner and I compared like 5 SUVs in the feed in one sitting. way less overwhelming than lot-hopping','demo',datetime('now','-2171 minutes') FROM users WHERE phone='+13105551038';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'asked a dumb question about towing and got a real answer, no condescension. appreciated that','demo',datetime('now','-2184 minutes') FROM users WHERE phone='+13105551049';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'the monthly it quoted is exactly what I''m paying. no doc-fee ambush','demo',datetime('now','-2197 minutes') FROM users WHERE phone='+13105551060';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT id,0,'found one two zips over, drove it, loved it, done by lunch','demo',datetime('now','-2210 minutes') FROM users WHERE phone='+13105551071';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT 0,v.id,'Spotted a strong match near you — certified and right in your budget. Want to talk to it?','agent',datetime('now','-90 minutes') FROM vdps v WHERE v.vin='DEMO-330I';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT 0,v.id,'Spotted a strong match near you — certified and right in your budget. Want to talk to it?','agent',datetime('now','-110 minutes') FROM vdps v WHERE v.vin='DEMO-Q5';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT 0,v.id,'Spotted a strong match near you — certified and right in your budget. Want to talk to it?','agent',datetime('now','-130 minutes') FROM vdps v WHERE v.vin='DEMO-NX350';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT 0,v.id,'Spotted a strong match near you — certified and right in your budget. Want to talk to it?','agent',datetime('now','-150 minutes') FROM vdps v WHERE v.vin='DEMO-CAMRY';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) VALUES (0,0,'Tip: get pre-qualified first — it''s a soft pull, 0 FICO impact, and unlocks real monthly ranges.','agent',datetime('now','-200 minutes'));
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) VALUES (0,0,'New drop this week across LA — certified cars live now. Ask me what fits your budget.','agent',datetime('now','-230 minutes'));
INSERT OR IGNORE INTO users (phone,handle,sid,zip,lat,lng,created_at) VALUES ('+13104647885','Cid Condoluci','CID-LACARGUY','90501',33.8360,-118.2980,datetime('now','-1 day'));
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT u.id,v.id,'Huge thanks to Cid at Porsche South Bay — drove home in my 2025 Macan today. No games, no all-day desk grind. This is how it should be.','demo',datetime('now','-42 minutes') FROM users u,vdps v WHERE u.phone='+13104647885' AND v.vin='DEMO-MACAN-2025';
INSERT INTO comments (user_id,vdp_id,body,zip,created_at) SELECT 0,v.id,'That 2025 Macan is right in your dream-car lane, Brandon — want to talk to it? Tap below.','agent',datetime('now','-38 minutes') FROM vdps v WHERE v.vin='DEMO-MACAN-2025';
