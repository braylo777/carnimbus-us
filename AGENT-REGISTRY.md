# CarNimbus — Agent Registry

> The six Phase-1 Nimbus agents. Each is a bounded, measurable worker that reads the append-only event
> stream (`EVENT-TAXONOMY.md`) and the Buyer Digital Twin (`TWIN-SCHEMA.md`), and emits `ai.*` events back
> into the stream. Autonomy is earned, not assigned — see `AUTONOMY-POLICY.md`.

**Autonomy levels:** `L0` suggest-only (human acts) · `L1` act-with-approval · `L2` act-then-notify
(reversible, human can veto) · `L3` fully autonomous (within eval gates).

---

## The active 5-node agent swarm

| Swarm Agent | Objective & Responsibilities | Host Gateway | Target Databases |
|-------------|------------------------------|--------------|------------------|
| **Recommend** | Matches prospective buyers with inventory based on twin profiles. | `ai.carnimbus.com` | Inventory DB (Hetzner) |
| **Qualify**   | Handles FICO-band pre-qualification and soft checks. | `ai.carnimbus.com` | Profile DB (Hetzner) |
| **Schedule**  | Books test drives at neighboring showrooms. | `ai.carnimbus.com` | Profile DB & Dealer DB |
| **Notify**    | Issues SMS test-drive alerts and transaction receipts. | `ai.carnimbus.com` | Profile DB |
| **Creator**   | Creator Network upkeep: closes drops whose car is gone, re-prices **unlocked** drops as units age, re-scores creators on measured performance. **KPI: attributed leads per dollar accrued.** | `ai.carnimbus.com` | Creator tables & Inventory DB |
| **Attribute** | Computes lead generation ROI and dealer ad-tier slots. | `ai.carnimbus.com` | Profile DB & Inventory DB |

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
