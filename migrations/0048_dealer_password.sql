-- T-102: email+password login for dealers (net-new; phone-OTP stays as fallback).
ALTER TABLE dealer_leads ADD COLUMN login_email TEXT;
ALTER TABLE dealer_leads ADD COLUMN pw_hash TEXT;
ALTER TABLE dealer_leads ADD COLUMN pw_salt TEXT;
