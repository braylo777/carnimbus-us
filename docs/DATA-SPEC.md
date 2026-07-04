# CarNimbus — Per-Subdomain Minimum Viable Dataset (Phase-1 gating spec)

**Ticket:** DEX-SUB-06 · **Question:** what is the minimum data each surface needs to keep the
human↔AI interaction flawless, clean, seamless? **Answer (from the live schemas, not theory):
far less than assumed.** Everything below exists in `migrations/` today.

## app.carnimbus.com — buyer

| Field | Type | Why it's required |
|---|---|---|
| `phone` (E.164) | identity | OTP sign-in; the only credential a buyer ever types |
| `profile.answers` q1–q10 | JSON | the entire matchmaking signal (budget, body, use, seats, priority, trade-in, timeline, credit band, dream car) |
| `zip` (optional) | text | community feed handle + future geo-routing |

That's it. `sid` (SID-######-####) is **issued, not collected** — generated on first verify
(`genCode("SID")`, worker.js) and shown on the Account page. No email, no name, no address.
**Buyer minimum: ~12 fields, one of which the buyer types.**

## dealer.carnimbus.com — dealer

| Field | Type | Why it's required |
|---|---|---|
| `dealership`, `name` | text | who the console belongs to |
| `phone` | identity factor | same OTP sign-in as buyers; matched to `dealer_leads` |
| `client_no` (CN-######-####) | activation key | **issued by admin on payment** — no number, no dashboard (DEX-AUTH-03/04) |
| per listing: `year, make, model, price_mo` + 1 photo URL | VDP minimum | everything the AI needs to sell the car; `trim/miles/drivetrain/body/description` optional flavor |

**Dealer minimum: 4 identity fields + 5 per car.**

## admin.carnimbus.com — internal (DEX-SUB-03 security model)

Stores **zero data**. Every request carries `x-admin-key` = the `ADMIN_KEY` Worker secret.
Key custody: operator copy at `~/.carnimbus-admin-key` (chmod 600, never printed/committed);
browser convenience copy in `localStorage.cn_admin`. Risk note: localStorage is XSS-readable —
accepted because the strict CSP (`script-src 'self'` + two Cloudflare hosts, no inline)
prevents script injection; revisit if CSP ever loosens. Rotation = `npx wrangler secret put
ADMIN_KEY` + update the local file.

## ai.carnimbus.com — the Nimbus layer

Consumes **derived text only**: `profileText(answers)` and `vdpText(vdp)` → embeddings keyed by
opaque ids (`profile:{user_id}`, `vdp:{id}`). Zero PII crosses the seam — no phone, no name.
Three layers, never conflated (see LINUX-JS.md §AI): GLM-5.2 inference (CPU/RAM-offload on 1TB
DDR5 — not VRAM-resident), dedicated vector store, SQLite relational store.

## Verdict

The flawless-interaction dataset is **~12 fields per buyer and ~6 per car**. The product's
data moat is the *profile-answer + conversation* corpus, not bulk PII — collect less, match
better.
