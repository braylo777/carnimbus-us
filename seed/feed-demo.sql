-- W5 (Wave W): one-time demo seed so the feed shows research/community posts immediately for pitch screenshots.
-- Synthetic community rows (persona name in zip, synthetic=1, audit-consistent), all status='approved'.
INSERT INTO comments (user_id,vdp_id,body,zip,synthetic,status,created_at)
SELECT 0, id, 'Checked the resale curve on this one — holds value better than its class average per KBB-style data. Solid pick if you keep cars 5+ yrs.', 'Mia R.', 1, 'approved', datetime('now','-12 minutes') FROM vdps WHERE active=1 ORDER BY RANDOM() LIMIT 1;
INSERT INTO comments (user_id,vdp_id,body,zip,synthetic,status,created_at)
SELECT 0, id, 'Pulled the history on this trim — clean-title, one-owner examples are the ones to chase. Ask for the Carfax before you drive.', 'DeShawn', 1, 'approved', datetime('now','-34 minutes') FROM vdps WHERE active=1 ORDER BY RANDOM() LIMIT 1;
INSERT INTO comments (user_id,vdp_id,body,zip,synthetic,status,created_at)
SELECT 0, id, 'Ran the financing math at 72mo — the monthly here is genuinely reasonable for the segment. Put a grand down and it gets comfy.', 'OC Buyer', 1, 'approved', datetime('now','-58 minutes') FROM vdps WHERE active=1 ORDER BY RANDOM() LIMIT 1;
INSERT INTO comments (user_id,vdp_id,body,zip,synthetic,status,created_at)
SELECT 0, id, 'Took the same generation on a Vegas run — cargo + comfort held up great. Good family hauler if that''s your use case.', 'Road Tripper', 1, 'approved', datetime('now','-91 minutes') FROM vdps WHERE active=1 ORDER BY RANDOM() LIMIT 1;
INSERT INTO comments (user_id,vdp_id,body,zip,synthetic,status,created_at)
SELECT 0, id, 'Real-world mpg on this powertrain beats the sticker in city driving from what owners report. Easy on the gas budget.', 'Eco Fan', 1, 'approved', datetime('now','-126 minutes') FROM vdps WHERE active=1 ORDER BY RANDOM() LIMIT 1;
INSERT INTO comments (user_id,vdp_id,body,zip,synthetic,status,created_at)
SELECT 0, id, 'Safety scores on this year are strong — worth confirming the trim has the driver-assist pack before you commit.', 'Jane D.', 1, 'approved', datetime('now','-155 minutes') FROM vdps WHERE active=1 ORDER BY RANDOM() LIMIT 1;
