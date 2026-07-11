# CarNimbus — Autonomy Policy

> Agents earn autonomy; they are not granted it. This policy defines the **L0–L3 ladder** and the
> **graduation criteria** an agent must meet to climb it. It governs every agent in `AGENT-REGISTRY.md`.

The principle: start every new agent (and every new capability) at **L0**, measure it against real
decisions, and promote only on evidence. Autonomy is a privilege backed by data, capped by reversibility.

---

## The L0–L3 ladder

| Level | Name | Behavior | Human role |
|-------|------|----------|------------|
| **L0** | Suggest-only | Agent proposes; takes no action | Human reviews and acts on every suggestion |
| **L1** | Act-with-approval | Agent prepares an action, waits for explicit approval | Human approves each action before it executes |
| **L2** | Act-then-notify | Agent acts on reversible decisions, then notifies | Human can veto / roll back after the fact |
| **L3** | Fully autonomous | Agent acts without per-decision oversight, within eval gates | Human monitors aggregate metrics only |

**Reversibility cap:** irreversible actions never reach L3. A real vehicle purchase, an outbound SMS to a
non-consented number, or any action a buyer can't undo caps at **L1** by policy — no accuracy score buys
past it. Reversible actions (showing an enrichment, drafting a reply, publishing a page that can be
unpublished) may climb to L2/L3.

---

## Graduation criteria

An agent graduates from one level to the next only when **all** of the following hold over a rolling
evaluation window at its current level:

| Criterion | Threshold |
|-----------|-----------|
| **Accuracy** | Decisions meet the agent's KPI accuracy bar (per `AGENT-REGISTRY.md`) — target **≥ 95%** on its golden set + live sample |
| **Human-override rate** | Humans reverse/reject the agent below a ceiling — target **< 5%** of decisions |
| **Supervised volume** | A minimum count of real, supervised decisions at the current level — enough for the rates above to be statistically meaningful (not a handful) |
| **Eval currency** | The agent's live model/prompt has a **passing golden-set eval on record** (`MODEL-REGISTRY.md`) |
| **No hard-gate breach** | Zero truth-core (`monthlyFor`/`aprFor`) or safety violations in the window |

**Promotion is one level at a time.** No skipping L1 or L2. A single hard-gate breach (a wrong financial
figure, an unauthorized outbound message) is a **hard demotion** — the agent drops a level and re-earns it.

---

## Operating rules

- **Default to L0.** Every new agent, and every materially new capability on an existing agent, starts at
  L0 regardless of the agent's other privileges.
- **Autonomy is per-capability, not per-agent.** An agent can be L3 on one action and L1 on another; the
  ladder is scoped to the decision type.
- **Metrics come from the event stream.** Override rate, volume, and accuracy are computed from `ai.*`
  events (`EVENT-TAXONOMY.md`) plus human veto signals — the same append-only log everything else reads.
- **Demotion is automatic on breach.** The gate is enforced in policy, not left to judgment.
- **Synthetic Compliance Auditing.** Synthetic agents (nudgers) are permitted for feed stimulation but must write logs to `synthetic_agent_audit`. Every synthetic comment must carry the `synthetic = 1` flag and represent its persona (e.g. "Jane D.", "Local Driver") to comply with FTC/UDAP guidelines.

## Related docs
`AGENT-REGISTRY.md` · `MODEL-REGISTRY.md` · `EVENT-TAXONOMY.md` · `MASTERPLAN.md` (Phase 3).
