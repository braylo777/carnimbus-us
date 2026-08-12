-- Wave S: NIMBUS settlement — app.carnimbus.us (deck v13 S-04 / S-07 MOAT).
-- A deal carries a unit from a scanned VIN to captured funds:
--   DRAFT -> STAKED -> TITLED -> ADJUDICATED -> SETTLED,  and any of the middle three -> DISPUTED.
--
-- THREE THINGS THIS SCHEMA ENCODES ON PURPOSE.
--
-- 1. deal_events IS THE LEDGER; deals.state is a cache of it. dealTransition() in worker.js is the
--    only writer and it guards the UPDATE on the state it read, so two concurrent requests cannot
--    both advance the same deal. settlementWatch() in the 5-minute cron logs any drift and does NOT
--    auto-repair, because which side is wrong is a judgement about real money.
--
-- 2. MONEY IS NEVER HELD. stakes rows describe a Stripe PaymentIntent created with
--    capture_method='manual' — funds are AUTHORIZED against the buyer and captured only at punch.
--    Nothing lands in a CarNimbus balance. Making this a stored balance would make CarNimbus a
--    money transmitter; that is a legal change, not a product change.
--
-- 3. A HUMAN RELEASES THE MONEY. adjudications.approved_by stays NULL until a person confirms.
--    AUTONOMY-POLICY.md:20 — "irreversible actions never reach L3 ... a payout ... caps at L1 by
--    policy" — same reasoning as creator_payout. The agent writes a recommendation in seconds; it
--    cannot capture.
--
-- No vtt_tokens table. The title-token layer is DEFERRED, not merely unbuilt — see the VTT block at
-- the end of worker.js and 01D-iov/nimbus-foundation-iov/layer5-deferred/README.md.

CREATE TABLE IF NOT EXISTS deals (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  vin              TEXT NOT NULL,
  -- 32 bytes of hex, generated at deal creation and NEVER transmitted. Unused while the token layer
  -- is deferred; kept because it is cheap now and unrecoverable later, and because a commitment
  -- secret that has ever left the database is not a secret.
  vin_salt         TEXT NOT NULL,
  seller_dealer_id INTEGER NOT NULL,          -- dealer_leads.id — tenancy, enforced in every WHERE
  buyer_dealer_id  INTEGER,
  state            TEXT NOT NULL DEFAULT 'DRAFT',
  offer_cents      INTEGER NOT NULL,          -- integer cents everywhere; never a float
  fee_cents        INTEGER NOT NULL DEFAULT 89500,   -- $895 seller fee, deck v13 S-05 ARPU
  created_at       TEXT DEFAULT (datetime('now')),
  settled_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_deals_seller ON deals(seller_dealer_id, state);
CREATE INDEX IF NOT EXISTS idx_deals_vin    ON deals(vin);

-- Append-only. There is no UPDATE or DELETE path to this table anywhere in worker.js.
CREATE TABLE IF NOT EXISTS deal_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id    INTEGER NOT NULL,
  from_state TEXT,                            -- NULL only on the creation row
  to_state   TEXT NOT NULL,
  actor      TEXT NOT NULL,                   -- dealer_leads.id, or the agent name
  actor_kind TEXT NOT NULL,                   -- 'dealer' | 'agent' | 'system'
  reason     TEXT,
  at         TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_deal_events_deal ON deal_events(deal_id, id);

-- One authorization per deal. status mirrors Stripe: requires_capture | captured | canceled.
-- ⚠ A Stripe manual-capture authorization LAPSES AFTER 7 DAYS. A deal parked in STAKED past that
-- point looks funded and is not — the single most likely way this system could quietly lie to a
-- dealer. settlementWatch() warns at day 5.
CREATE TABLE IF NOT EXISTS stakes (
  deal_id               INTEGER PRIMARY KEY,
  stripe_payment_intent TEXT NOT NULL,
  amount_cents          INTEGER NOT NULL,
  status                TEXT NOT NULL,
  authorized_at         TEXT,
  captured_at           TEXT
);

-- The agent's recommendation, kept whether or not a human accepts it. rationale is stored in full
-- and never truncated: it is the record of why money moved, and it has to survive the conversation.
CREATE TABLE IF NOT EXISTS adjudications (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id        INTEGER NOT NULL,
  agent          TEXT NOT NULL,
  model          TEXT NOT NULL,
  decision       TEXT NOT NULL,               -- 'release' | 'hold'
  rationale      TEXT NOT NULL,
  confidence     REAL,
  autonomy_level TEXT NOT NULL DEFAULT 'L1',  -- L1-forever. See AUTONOMY-POLICY.md.
  approved_by    INTEGER,                     -- dealer_leads.id of the PERSON who released
  approved_at    TEXT,
  at             TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_adjudications_deal ON adjudications(deal_id, id);
