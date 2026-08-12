# CarNimbus — Event Taxonomy (FROZEN)

> The canonical vocabulary for every behavioral event CarNimbus records. This taxonomy is **frozen**:
> the seven prefixes below are the complete, locked set. All intelligence — the Buyer Digital Twin,
> agent inputs, funnel analytics — reads from this one append-only stream.

Events land in the D1 `events` table (`migrations/0018_events.sql`) via `POST /api/events`, batched from
`site/assets/nimbus-sensor.js` using `navigator.sendBeacon`. Server-side agents also emit directly.

**Event row shape:** `id, ts, cid, anon_id, action, vehicle_id, location, device, session_id, source,
duration_ms, confidence`.

---

## The golden rule: append-only

> **Every event is inserted, never updated, never deleted.**

The `events` table is an immutable log. Corrections are new rows, not edits. Identity changes
(anonymous → known) are recorded as **new stitch marker rows**, never by mutating old rows.
This makes the stream a trustworthy audit trail and lets any consumer replay history deterministically.

---

## The frozen prefix set

Exactly seven prefixes. An `action` is `prefix.verb`. Rows whose prefix is not in this set are **dropped**
at ingest.

| Prefix | Meaning | Actions |
|--------|---------|---------|
| `discovery.*` | Passive browsing / attention | `viewed_vehicle` · `viewed_page` · `scrolled_feed` · `watched_video` · `dwell` |
| `intent.*` | Signals of buying intent | `liked` · `saved` · `shared` · `compared` · `returned_to_vehicle` · `opened_calculator` |
| `finance.*` | Financing & qualification | `opened_financing` · `started_qualification` · `completed_qualification` |
| `action.*` | Real-world commitments | `scheduled_test_drive` · `completed_test_drive` · `purchased_vehicle` |
| `social.*` | Community activity | `posted` · `commented` · `referred` · `reviewed` · **`claimed`** |
| `ai.*` | Agent-originated events | `asked_nimbus` · `conversation_turn` · `recommendation_shown` · `recommendation_clicked` |
| `dealer.*` | Dealer / Drive Now lifecycle | `lead_delivered` · `lead_contacted` · `lead_converted` · `lead_lost` · **`drop_created`** · **`deal_created`** · **`deal_staked`** · **`deal_titled`** · **`deal_settled`** · **`deal_disputed`** |

### Creator Network additions (2026-07-28)

The Creator Network (`creator.carnimbus.us`) emits **no new prefix**. It reuses the locked set, which is
exactly what extension rule 1 below permits:

| Event | Action | Emitted by |
|---|---|---|
| A dealer VIN upload mints a drop | `dealer.drop_created` | `dropForListing()` — `confidence` carries the rate in dollars |
| A dealer confirms a scanned unit | `dealer.deal_created` | `appDealCreate()` — app.carnimbus.us |
| Buyer capital is authorized | `dealer.deal_staked` | `appStake()` — `confidence` carries dollars |
| Title document uploaded | `dealer.deal_titled` | `appTitleUpload()` |
| A **person** approves release | `dealer.deal_settled` | `appApprove()` — never emitted by an agent; see AUTONOMY-POLICY.md |
| A deal is disputed | `dealer.deal_disputed` | `appDispute()` — the authorization is cancelled, not captured |
| Clearance queue rendered | `dealer.recommendation_shown` | `appClear()` — `confidence` carries the card count |
| A dealer repriced on a rec | `dealer.recommendation_taken` | `appReprice()` — `confidence` carries the new monthly |
| A dealer skipped a rec | `dealer.recommendation_skipped` | `appRecSkip()` — the reason is training signal |

> The five `deal_*` events are an **analytics** signal only. The settlement ledger of record is the
> `deal_events` table, which is append-only and is what `deals.state` is derived from. `events`
> has no payload column and `vehicle_id` is an INTEGER, so deal identity rides in `session_id`
> as `deal:<id>`.
| A creator claims a drop | `social.claimed` | `creatorClaim()` |
| A creator submits a post | `social.posted` | `creatorPost()` |
| A buyer clicks a creator's **car** link | `social.referred` | `creatorRedirect()` — `source:"creator-link"`, carries `vehicle_id` |
| A buyer clicks a creator's **personal** link | `social.referred` | `creatorRedirect()` — `source:"creator-ref"`, no `vehicle_id` (it lands on `/browse`) |
| NIMBUS records a post verdict | `ai.recommendation_shown` | `creatorPost()` — `source` carries the verdict |

**There is deliberately no `creator.*` prefix.** `logEvent()` does not gate prefixes (only `postEvents()`
does, at ingest), so adding one would have been trivial and silently wrong — the taxonomy is frozen and
the creator surface fits the existing vocabulary without strain.

---

## Identity & the stitch event

Buyers begin **anonymous**. On first `/api/events` beacon the server mints an `anon_id`
(first-party cookie `cn_anon`; `HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`). All early events
carry only `anon_id`.

When a buyer signs in and completes qualification, the OTP→profile path emits:

```
finance.completed_qualification   ← mints/stitches the CID
```

This is the **stitch point**. At completion the server:
1. Resolves the customer id (`cid`) for the now-known buyer.
2. Emits `finance.completed_qualification` on the new `cid`.
3. Inserts a **stitch marker row** copying the prior `anon_id`'s identity to the `cid`.

Old `anon_id` rows are left untouched (golden rule). Downstream consumers join `anon_id → cid` through
the marker to reconstruct the full pre-signup journey.

---

## Extension rules

The vocabulary can grow, but only within tight bounds:

1. **New actions must use a prefix from the locked set.** No new prefixes — ever. If a proposed event
   doesn't fit one of the seven prefixes, the taxonomy is wrong for it and the design needs revisiting,
   not the prefix set.
2. **Never overwrite.** New actions are additive. Renaming or repurposing an existing action is forbidden;
   deprecate by ceasing to emit, not by mutating meaning.
3. **Append-only forever.** No `UPDATE`, no `DELETE` on `events`. Corrections and identity changes are
   new rows.
4. **Unknown-prefix rows are dropped at ingest** (`POST /api/events` validates each `action`). This keeps
   the stream clean and the prefix contract enforced in code, not just docs.
5. **`confidence` is optional and additive.** Agent-inferred events may carry a `confidence` score; direct
   user actions are implicitly `1.0`.

## Related docs
`MASTERPLAN.md` (Phase 0 = the spine) · `TWIN-SCHEMA.md` (the twin reads this stream) ·
`AGENT-REGISTRY.md` (which agents emit `ai.*`).
