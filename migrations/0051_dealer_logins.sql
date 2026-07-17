-- T-102: multiple staff logins per dealership (email -> dealer_id). Lets Cid + Max share one store's portal.
CREATE TABLE IF NOT EXISTS dealer_logins (
  email TEXT PRIMARY KEY, dealer_id INTEGER, pw_hash TEXT, pw_salt TEXT, created_at TEXT );
