-- SMS infra: outbound/inbound log + scheduled/recurring queue (CNMB-201/203).
CREATE TABLE sms_log (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT, direction TEXT,
  body TEXT, status TEXT, twilio_sid TEXT, created_at TEXT);
CREATE TABLE sms_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT, template TEXT,
  body TEXT, send_at TEXT, recurring TEXT, sent INTEGER DEFAULT 0, created_at TEXT);
CREATE INDEX idx_queue_due ON sms_queue(sent, send_at);
