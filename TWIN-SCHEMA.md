# CarNimbus — Buyer Digital Twin Schema

> The **Buyer Digital Twin** is a living, per-buyer model assembled from the append-only event stream
> (`EVENT-TAXONOMY.md`). It is what every agent (`AGENT-REGISTRY.md`) reasons over: who the buyer is,
> what they can afford, what they want, and where they are in the journey.

The twin is **derived, not authored** — it is a projection of events plus first-party profile inputs.
Fields are grouped into **privacy tiers** that govern who and what may read them.

---

## Privacy tiers

| Tier | Name | Meaning | Access |
|------|------|---------|--------|
| **T0** | Public | Non-identifying, shareable | Any agent, analytics, feed |
| **T1** | First-party | Identifying, buyer-provided | Authenticated buyer + agents acting for them |
| **T2** | Sensitive-financial | Regulated / high-sensitivity | Qualification + affordability only, on consent |

---

## Fields by tier

### T0 — Public
| Field | Type | Source |
|-------|------|--------|
| `anon_id` | string | minted on first beacon (`cn_anon` cookie) |
| `lifecycle_stage` | enum | derived: `browsing → engaged → qualified → booked → purchased` |
| `preferences.body_style` | enum[] | derived from `discovery.*` / `intent.*` events |
| `preferences.price_band` | band | derived (coarse, non-financial) |
| `behavioral_signals` | object | derived aggregates: dwell, returns, compares, feed activity |
| `dream_car` | ref | most-returned-to / most-liked vehicle (`intent.returned_to_vehicle`) |

### T1 — First-party
| Field | Type | Source |
|-------|------|--------|
| `cid` | string | minted at `finance.completed_qualification` stitch |
| `identity.name` | string | profile input |
| `identity.phone` | string | OTP mobile |
| `identity.location` | string | profile / geo |
| `preferences.hobbies` | string[] | profile input |
| `preferences.must_haves` | string[] | profile / chat |
| `sms_consent` | bool | explicit consent flag |

### T2 — Sensitive-financial
| Field | Type | Source | Rule |
|-------|------|--------|------|
| `financial_band` | enum | soft-pull FICO → **band only** | **never store a raw score** |
| `affordability.max_monthly` | number | `monthlyFor(price, down, aprPct, term)` | derived |
| `affordability.est_apr` | number | `aprFor(fico)` | derived from band |
| `affordability.down_available` | number | buyer-declared | consent-gated |

---

## The FICO rule (non-negotiable)

> **Soft-pull FICO is stored only as a band, never as a raw score.**

The qualification agent may run a soft pull to estimate rate, but the twin persists a **band**
(e.g. `good`, `very-good`) and the derived `est_apr` via `aprFor()`. The precise numeric score is used
transiently to pick the band and is then discarded. No table, log, or event row ever holds a raw FICO.

---

## Invariants

- **Derived, replayable.** Rebuilding the twin from the event stream + profile inputs must reproduce the
  same T0/T1 fields. T2 fields require the buyer's active financial consent to (re)populate.
- **Tier gates access.** An agent operating at a given autonomy level may only read the tiers its task
  requires; `dealer.*`-facing surfaces never see T2.
- **Append-only lineage.** Every twin field traces to event rows (or profile inputs); no field is edited
  in place without a new source event.

## Related docs
`EVENT-TAXONOMY.md` · `AGENT-REGISTRY.md` · `AUTONOMY-POLICY.md` · `MASTERPLAN.md` (Phase 2).
