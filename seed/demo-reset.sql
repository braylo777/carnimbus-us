-- LAcarGUY demo reset: fresh conversation state, McLaren-dream profile intact, consent on.
-- Idempotent — run before every rehearsal AND right before the demo:
--   npx wrangler d1 execute carnimbus-waitlist --remote --file=seed/demo-reset.sql
DELETE FROM chats WHERE user_id=(SELECT id FROM users WHERE phone='+15128440695');
DELETE FROM test_drives WHERE user_id=(SELECT id FROM users WHERE phone='+15128440695');
DELETE FROM otp WHERE phone='+15128440695';
INSERT INTO waitlist (phone,lang,sms_consent,created_at) SELECT '+15128440695','en',1,datetime('now')
 WHERE NOT EXISTS (SELECT 1 FROM waitlist WHERE phone='+15128440695');
UPDATE waitlist SET sms_consent=1 WHERE phone='+15128440695';
-- sanity: Macan active + owned by Cid; Cid active with the demo phone
UPDATE vdps SET active=1 WHERE vin='DEMO-MACAN-2025';
UPDATE dealer_leads SET status='active', phone='+13104647885' WHERE client_no='CN-LACARGUY';
