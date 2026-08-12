# NIMBUS settlement — runbook

```
surface     app.carnimbus.us  (dealer wApp — deck v13 S-04)
code        worker.js, the "THE DEALER wAPP + NIMBUS SETTLEMENT" section at the end
schema      migrations/0070_settlement.sql
pages       site/app/{scan,offer,title,deal,deals}.html + site/assets/js/app-*.js
shipped     2026-08-03
```

A deal carries one aged unit from a scanned VIN to captured funds. This document is what to read
before changing any of it, and what to read when it breaks.

---

## The state machine

`deal_events` is the ledger. `deals.state` is a **cache** of it. `dealTransition()` is the only
writer, and it guards the `UPDATE` on the state it read, so two concurrent requests cannot both
advance the same deal — the loser sees `changes !== 1` and gets a 409 rather than silently winning
a race over someone else's money.

| From | To | Trigger | Endpoint |
|---|---|---|---|
| — | `DRAFT` | dealer confirms a scanned unit | `POST /api/app/deal` |
| `DRAFT` | `STAKED` | buyer capital authorized | `POST /api/app/stake` |
| `STAKED` | `TITLED` | title photo stored in R2 | `POST /api/app/title` |
| `TITLED` | `ADJUDICATED` | agent writes a recommendation | `POST /api/app/adjudicate` |
| `ADJUDICATED` | `SETTLED` | **a person approves** | `POST /api/app/approve` |
| `STAKED` · `TITLED` · `ADJUDICATED` | `DISPUTED` | dealer disputes | `POST /api/app/dispute` |

`SETTLED` and `DISPUTED` are terminal. Self-loops are rejected: a repeated POST fails loudly rather
than appending a duplicate ledger row.

---

## Why the money is never held

`appStake()` creates a Stripe PaymentIntent with **`capture_method: "manual"`**. That authorizes
against the buyer's card and captures nothing. `appApprove()` calls `payment_intents/<id>/capture`.
`appDispute()` calls `.../cancel`.

**Nothing ever lands in a CarNimbus balance.** That is not a stylistic choice — holding customer
funds pending a transaction is custody of value, which raises money-transmission licensing and, in
California, Digital Financial Assets Law exposure. NF-WP-1 §9.7 already declined an adjacent design
for the same reason.

> **If you are about to add a balance, a wallet, a float, or "hold the money for a day so we can
> net it" — stop. That is a change to what kind of company CarNimbus is, and it needs a lawyer
> before it needs a pull request.**

---

## The L1 approval gate

`AUTONOMY-POLICY.md` lines 20–22:

> **Reversibility cap:** irreversible actions never reach L3. A real vehicle purchase, an outbound
> SMS to a non-consented number, **a payout to a creator**, or any action a buyer can't undo caps
> at **L1** by policy.

`settlement_release` is now named in that file's L1-forever table alongside `creator_payout`.

Concretely, in `appAdjudicate()`:

- The **decision is deterministic**, computed from four facts — authorization present, amount
  matches, title document present, title not branded. The model writes the *explanation*; it does
  not discover the decision. An LLM that can flip "the title is missing" into "release the funds"
  is a hole, not a feature.
- `autonomy_level` is written as `'L1'` and `approved_by` is left `NULL`.
- `appApprove()` refuses unless a prior adjudication exists **and** its decision is `release`, then
  records `approved_by` = the dealer who clicked.

The deck's "autonomous agents adjudicate release" is accurate about **speed** and inaccurate about
**autonomy**. Do not close that gap to make a slide literal.

---

## Where the VIN validator comes from

`site/assets/vin.js` is a **verbatim copy** of
`01D-iov/nimbus-foundation-iov/broker/src/vin.js`, which the NF-5 conformance suite exercises
(`node conformance/run.js`, 319 assertions).

It is a copy rather than an import because importing across `../../01D-iov/…` would couple deploying
carnimbus.us to the presence and layout of a different repository on the same disk. Moving that
folder would break `wrangler deploy` for the live site.

**If you change the algorithm, change it in the IoV repo first, re-run conformance, then copy back.**
A fork here is silent and would show up as VINs that validate in one system and not the other.

---

## The title token: deferred, and why that is not caution

The deck's MOAT slide says "Agent-native ERC chain" and Mobility Capital v5 §43 specifies a Vehicle
Title Token as ERC-721, "One per VIN". **No chain layer ships.**

The mitigation that would have made it doctrinally clean — minting under a *salted* commitment
rather than `keccak256(vin)` — has already been examined and rejected in writing, in this project.
`01D-iov/nimbus-foundation-iov/layer5-deferred/README.md` quarantines `CatallaxyVIN.sol`, an ERC-721
vehicle index registry built on exactly that design:

> "The design was careful in the right places: registration under a *salted* commitment rather than
> `keccak256(vin)` … **The blocker is not the commitment.** It is that the contract writes a
> permanent per-vehicle record to a public ledger: a token id, an owner address, a commitment …
> That is undeletable behavioural metadata … A standing 45-day Delete Act deletion cadence plus
> CCPA erasure rights cannot be satisfied against it."

Salting makes the id non-enumerable. It does not make it non-derived, and it does nothing about the
owner address, which that README calls "a persistent global identifier." Three further walls, each
independently sufficient:

- **ERC-721 is transferable by construction.** A transferable title token is a market, and operating
  a market we also govern is Refusal 3.
- **"When settlement eventually exists it is fiat, via a conventional processor (Stripe)."**
  NF-1 §3.5 L5-4. That is exactly what `appStake` / `appApprove` do.
- **Solidity needs a compiler and third-party libraries.** NF-WP-1 §14 fixes the binding stack at
  Workers + vanilla JS + D1 with **no build step**. This repo could not compile a contract even if
  the doctrine cleared it.

`deals.vin_salt` is still generated and stored. Nothing reads it. It is kept because it is cheap now
and unrecoverable later, and because a commitment secret that has ever left the database is not a
secret. **It must never appear in an API response** — `appDealGet()` omits it deliberately.

Reopening this is a charter action, not a code change. See
`06-exec/06A-decis/2026-08-03-app-dealer-wapp/`.

---

## When it breaks

### A Stripe authorization expired
**Manual-capture authorizations lapse after 7 days.** A deal parked in `STAKED` past that point
*looks funded and is not* — the single most likely way this system could quietly lie to a dealer.
`settlementWatch()` in the 5-minute cron logs `stake_expiring:` at day 5.
**Fix:** dispute the deal (cancels cleanly), then re-stake. There is no way to extend an
authorization; Stripe does not offer one.

### `settlement_drift:` in the logs
`deals.state` and the last `deal_events` row disagree — a partial failure where the `UPDATE` landed
and the `INSERT` did not. **The ledger is authoritative.** The watcher deliberately does **not**
auto-repair, because which side is wrong is a judgement about real money. Read `deal_events` for the
deal, decide, and correct `deals.state` by hand with a written note.

### Stuck in `ADJUDICATED`
That is the design, not a bug — it is waiting on a person. Check `/deals`; adjudicated rows are
amber and the summary strip counts them. If the adjudicator returned `hold`, `appApprove()` will
refuse with `adjudication_holds` and the rationale; fix the underlying fact (usually a missing title
document) and re-run.

### `capture_failed`
Stripe refused the capture — expired authorization, or the card was cancelled. **Nothing was taken.**
The deal stays in `ADJUDICATED`. Dispute and re-stake.

### `docs_unconfigured` on title upload
The `DOCS` R2 binding is missing. `wrangler.jsonc` declares `carnimbus-docs`; the bucket must exist
(`npx wrangler r2 bucket create carnimbus-docs`). The stake is unaffected — no money moved.

### Title document 403
Correct behaviour. `appTitleGet()` returns **403, not 404**, for a deal the caller does not own —
a 404 would confirm which deal ids exist.

---

## See also

`AUTONOMY-POLICY.md` (the L1 ladder) · `EVENT-TAXONOMY.md` (the five `dealer.deal_*` events, and why
they are analytics rather than the ledger) · `SECURITY-RUNBOOK.md` ·
`01D-iov/nimbus-foundation-iov/DOCTRINE.md` and `layer5-deferred/README.md`
