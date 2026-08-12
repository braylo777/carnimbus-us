# Creator Network Runbook — creator.carnimbus.com

**Shipped 2026-07-28.** The network that fills slide-4 step 2: *"Unit is sent to 'Creator Network'."*

## The loop

```
dealer uploads a VIN (dealer.carnimbus.com)
  └─ dealerListing() INSERT branch → dropForListing()
       ├─ rateForDrop(v)  → rate_cents + rate_why, locked=0
       └─ creator_drops row, status 'open'      [event: dealer.drop_created]

creator.carnimbus.com/feed
  └─ ranked per creator by dropFit() — everyone sees every drop; ★ = best fit
       └─ CLAIM → creator_claims + token        [event: social.claimed]

carnimbus.com/c/<token>   (the creator posts this link)
  └─ clicks+1, cn_ref cookie 90d, 302 → /used/<slug>-<id>   [event: social.referred]
       └─ buyer submits a lead → web_leads.creator_claim_id stamped

creator submits post URL + FTC disclosure
  └─ creator_posts + creator_earnings 'accrued' [events: social.posted, ai.recommendation_shown]
       └─ postVerdict() → approve | review | reject

ai.carnimbus.com #CREATORS panel
  └─ NIMBUS proposes → YOU CONFIRM → Stripe transfer → 'paid'
```

## Surfaces

| Host | Page | File |
|---|---|---|
| creator. | `/` | `site/creator/signin.html` |
| creator. | `/feed` | `site/creator/feed.html` — **the slide-4 screenshot** |
| creator. | `/drop?id=N` | `site/creator/drop.html` |
| creator. | `/earnings` | `site/creator/earnings.html` |
| creator. | `/profile` | `site/creator/profile.html` |
| ai. | `#creators` | 6th panel on `site/ai/index.html` (the console is one page, five→six hash panels) |

## Tables (`migrations/0063`–`0066`)

`creators` · `creator_socials` · `creator_drops` · `creator_claims` · `creator_posts` ·
`creator_earnings` — plus `web_leads.creator_claim_id`, the attribution join.

## NIMBUS decision functions — all deterministic, all ship a `why`

| Function | Decides | Overridable |
|---|---|---|
| `rateForDrop(v)` | what a post on this unit pays: $50 base + value + days-on-lot, capped $150 | yes — `drop_rate` writes `locked=1`, and `creatorAgent` never re-prices a locked drop |
| `creatorScore(stats)` | a creator's standing 0–100 from **measured** performance | recomputed on cron |
| `dropFit(drop,aff,claims)` | feed ordering per creator | ranking only; never hides a drop |
| `postVerdict(post,claim,stats)` | approve / review / reject | a human confirms either way |

**Declared follower counts contribute nothing to any score.** No social API exists in this codebase, so a
follower count is a claim. The score moves only on things we watched happen: click-through on our own
tracked links, posts approved, leads attributed.

## Operating it

Everything is a verb in the NIMBUS chat (deterministic — answers without touching the model):

```
show creators          show drops          show posts pending       show payouts
approve post 41        reject post 41      pay earning 12
```

Destructive verbs return a **proposal**, never a mutation. `aiAct` refuses without `confirm:true`.

## ⚠ Money

- **`creator_payout` is L1 forever.** A Stripe transfer is irreversible, so per `AUTONOMY-POLICY.md` no
  accuracy score ever promotes it. NIMBUS surfaces it; a human clicks Confirm.
- Requires **`STRIPE_SECRET_KEY`** (`npx wrangler secret put STRIPE_SECRET_KEY`) and Connect enabled in
  the Stripe dashboard. Until both exist, payout endpoints return `503 stripe_unconfigured` and earnings
  simply keep accruing — nothing breaks.
- A transfer also requires `creators.payouts_enabled=1`, which only Stripe sets after its own KYC.
  **That is the real gate on an auto-approved account**, not our follower threshold.
- `creator_clawback` refuses on a `paid` earning. Once money has left, the correction is a Stripe
  operation, not a row update.

## ⚠ Three fences

1. **Creators see T0 only.** Car data and their own numbers. Never buyer identity, band, or lead
   contents. Attribution reports a **count** of leads, never rows. In `aiGraph` a creator node edges to a
   **car**, never to a rider or profile.
2. **No `creator.*` event prefix.** The taxonomy is frozen at seven. Creator activity uses `social.*`,
   drops use `dealer.*`, NIMBUS verdicts use `ai.*`.
3. **No creator SMS.** `runQueue()` resolves consent via `SELECT sms_consent FROM waitlist WHERE phone=?`.
   A creator has no `waitlist` row, so a queued text would be **marked sent and silently never
   delivered**. Creator notification is email only. Do not "just add" creators to `sms_queue`.

## FTC

`creator_posts.disclosure_confirmed` is required to submit (`400 disclosure_required`) **and** re-checked
before approval (`422 no_disclosure`) — an undisclosed paid post cannot be approved even if an operator
asks for it. This is 16 CFR Part 255, and it is the one rule in this system that the operator cannot
override from the console.

## Failure modes

- **A creator-network failure never fails a dealer upload.** `dropForListing` is called
  `.catch(()=>{})` from `dealerListing`. Drop the tables entirely and VIN upload still returns `{ok:true}`.
- `creatorAgent` is `.catch(()=>{})` in `scheduled()` like every other cron agent — one failing agent
  never starves the rest.
- Stripe unset → `503`, not `500`. Deliberate: it is a configuration state, not an error.
