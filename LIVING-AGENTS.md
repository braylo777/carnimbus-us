# Living Agents — CarNimbus autonomous agent layer

**One-line:** agents that *live in the codebase* — cron-driven Workers that read the event stream + Buyer Twin,
each with one KPI, acting continuously on behalf of the platform, emitting their own events back into the Brain.

This is the buildable path from "chatbots" to "a workforce." It fuses the Nimbus Agent OS with the event spine
(see `EVENT-TAXONOMY.md`, `AGENT-REGISTRY.md`) already shipped.

## What "living" means here
- **Resident, not request-scoped.** A living agent runs on the 5-minute `scheduled()` cron (or a Durable Object for
  stateful ones), not only when a user hits an endpoint. It wakes, reads state, acts, sleeps.
- **Reads the Brain, writes the Brain.** Inputs: `events`, `buyer_signals` (the Twin), `vdps`, `matches`. Outputs:
  new `ai.*` / `social.*` / `dealer.*` events + artifacts (posts, enrichments, follow-ups). Every action is an
  append-only event, so the whole workforce is auditable.
- **One KPI each.** Inventory Intelligence = % enriched; Concierge = weekly active conversations; Growth = funnel
  report shipped; Resident Community = useful posts/day. No agent owns two jobs.

## Autonomy ladder (governance primitive)
- **L0 draft-only** — agent produces, human publishes. (Community assist lives here permanently.)
- **L1 approve-queue** — agent queues, human one-click approves.
- **L2 autonomous-with-audit** — agent acts, admin sees the log. (Inventory enrichment, SEO, the resident post.)
- **L3 fully autonomous** — earned only after ≥95% approval over 30 days at L1/L2.

## The honesty guardrail (non-negotiable)
Agents may feel *proactive and human* — they must never *impersonate a real buyer*. Every agent-authored artifact is
labeled (community posts render as "CarNimbus AI", `zip='agent'`). "Acting as if they're people" = anticipating needs,
posting useful things, following up at the right moment — NOT pretending to be a specific human. Unlabeled human-style
agents would be a deliberate, separate governance decision (ToS + platform-rules + disclosure review) before anything ships.

## Live today (first cut)
- **Resident Community Agent** (`residentAgent`, worker.js, cron, L2): posts ≤1 genuinely useful bilingual pick / 2h
  into the community feed — a real active-inventory vehicle at its real monthly, labeled, event-logged
  (`social.posted`). Bounded, append-only, no impersonation. This is the minimal slice to learn the shape.
- Already resident from prior waves: **Inventory Intelligence** (`enrichInventory`), **Growth Analytics**
  (`growthRollup`), **Scheduling/booking**, **Qualification** (OTP→CID), **Concierge** (`carChat` + cross-session memory).

## Next agents (design-ready, not yet live)
- **Price-Watch Agent** (L2): watches saved/returned vehicles per Twin; when a saved car's price drops or sells,
  emits a notification the Concierge delivers ("the Lexus you liked dropped $900"). Retention engine.
- **Follow-up Agent** (L1): drafts dealer follow-ups timed to the buyer's predicted window.
- **Vehicle Agents** (L2, Durable Objects): each listing holds its own state and petitions the feed for its ideal buyer.

## How to add a living agent
1. Register it in `AGENT-REGISTRY.md` (id, KPI, autonomy, inputs, outputs).
2. Write a `<name>Agent(env)` function; read Brain state, act, `logEvent(...)` every action.
3. Call it from `scheduled()` behind a rate/bound guard; start at L1/L2 with a human-visible log in admin.
4. Graduate autonomy only against the ≥95%/30-day gate.

Related: [[carnimbus-product]] · EVENT-TAXONOMY.md · AGENT-REGISTRY.md · AUTONOMY-POLICY.md
