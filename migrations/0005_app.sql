-- Profile-match web app (CNMB-301/303/305/306).
CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT UNIQUE, created_at TEXT);
CREATE TABLE otp (phone TEXT, code_hash TEXT, expires TEXT, tries INTEGER DEFAULT 0);
CREATE TABLE profiles (user_id INTEGER PRIMARY KEY, answers TEXT, embedding_synced INTEGER DEFAULT 0, updated_at TEXT);
CREATE TABLE vdps (id INTEGER PRIMARY KEY AUTOINCREMENT, vin TEXT UNIQUE, year INTEGER, make TEXT,
  model TEXT, trim TEXT, price_mo INTEGER, miles TEXT, drivetrain TEXT, body TEXT, features TEXT,
  description TEXT, photos TEXT, active INTEGER DEFAULT 1, embedding_synced INTEGER DEFAULT 0, updated_at TEXT);
CREATE TABLE test_drives (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, vdp_id INTEGER,
  center TEXT, slot TEXT, status TEXT, pass_token TEXT, created_at TEXT);
CREATE TABLE comments (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, vdp_id INTEGER,
  body TEXT, zip TEXT, created_at TEXT);
