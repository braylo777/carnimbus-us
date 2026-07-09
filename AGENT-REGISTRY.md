# CarNimbus — Agent Registry

> The six Phase-1 Nimbus agents. Each is a bounded, measurable worker that reads the append-only event
> stream (`EVENT-TAXONOMY.md`) and the Buyer Digital Twin (`TWIN-SCHEMA.md`), and emits `ai.*` events back
> into the stream. Autonomy is earned, not assigned — see `AUTONOMY-POLICY.md`.

**Autonomy levels:** `L0` suggest-only (human acts) · `L1` act-with-approval · `L2` act-then-notify
(reversible, human can veto) · `L3` fully autonomous (within eval gates).

---

## The six Phase-1 agents

| Agent | KPI | Autonomy | Inputs | Outputs | Events emitted |
|-------|-----|----------|--------|---------|----------------|
| **Inventory Intelligence** | % active VDPs enriched; enrichment CTR uplift | **L2** — writes enrichment, human can veto | Active `vdps`, Vectorize similarity, `llm()` | VDP summary, pros/cons, ideal-buyer, financing context | `ai.recommendation_shown` |
| **Qualification** | Qualification completion rate; anon→CID stitch rate | **L1** — soft-pull with buyer consent | OTP session, profile inputs, FICO band (`aprFor`) | CID mint, financial band, affordability envelope | `finance.started_qualification`, `finance.completed_qualification` |
| **Scheduling** | Test-drive booking rate; show rate | **L1** — books on buyer confirm | Buyer intent, dealer calendar, match list | Test-drive booking, Drive Now pass | `action.scheduled_test_drive`, `action.completed_test_drive` |
| **Concierge** | Conversation→match→book conversion; turn depth | **L2** — replies autonomously, escalates edge cases | Session, profile, chat history (cross-session recall), matches | Chat replies, proactive openers (price drop / new match) | `ai.asked_nimbus`, `ai.conversation_turn`, `ai.recommendation_clicked` |
| **Growth Analytics** | Weekly funnel accuracy; roll-up freshness | **L3** — read-only reporting, no user-facing action | Full event stream, `matches`, `test_drives` | Weekly funnel roll-up JSON (events→drives→sales), cohort/retention | `ai.recommendation_shown` (report-ready marker) |
| **Content/SEO** | Indexed `/cars/<slug>` pages; organic sessions | **L2** — publishes pages, human can unpublish | Active `vdps`, enrichment, schema templates | Server-rendered VDP pages, schema.org Vehicle+FAQ, sitemap entries | `ai.recommendation_shown` |

---

## Design notes

- **Every agent is a stream citizen.** It reads events + twin, does bounded work, and writes `ai.*`
  events describing what it did. Nothing happens off-stream — the log is the system of record.
- **KPIs gate autonomy.** An agent graduates L0→L3 by hitting its accuracy threshold and keeping its
  human-override rate below the ceiling over a volume of supervised decisions (`AUTONOMY-POLICY.md`).
- **Reversibility sets the ceiling.** Irreversible actions (a real purchase, an outbound SMS to a
  non-consented number) never reach L3; they cap at L1/L2 by policy regardless of accuracy.
- **Models are registered and eval-gated.** No agent swaps its underlying model/prompt without a passing
  golden-set eval (`MODEL-REGISTRY.md`).

## Related docs
`AUTONOMY-POLICY.md` · `EVENT-TAXONOMY.md` · `TWIN-SCHEMA.md` · `MODEL-REGISTRY.md` · `MASTERPLAN.md` (Wave E).
