-- H3 (Wave T): IP logs for auth start rate-limiting
CREATE TABLE auth_ip_log (ip TEXT, created_at TEXT);
CREATE INDEX idx_auth_ip ON auth_ip_log(ip, created_at);
