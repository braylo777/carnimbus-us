# CarNimbus — Model & Prompt Registry

> Every model and prompt that CarNimbus ships is **named, versioned, and eval-gated**. This registry is
> the single place that answers: which model/prompt is live, what it's for, and did it pass its eval.

CarNimbus intelligence runs on Workers AI: **llama-3.3-70b** (chat / reasoning) and **bge-base** (768-dim
embeddings, index `carnimbus-match`). No external model APIs, no npm SDKs — models are called from
`worker.js` via the Workers AI binding.

---

## DOV naming convention

Models and prompts follow the **DOV schema** — `Domain.Object.Version` — so any artifact is
self-describing and sortable.

```
<domain>.<object>.<version>
```

| Segment | Meaning | Examples |
|---------|---------|----------|
| `domain` | The agent / capability area | `concierge`, `inventory`, `qualification`, `seo`, `growth` |
| `object` | The artifact kind + role | `chat-model`, `embed-model`, `enrich-prompt`, `opener-prompt` |
| `version` | Monotonic `vN` (bump on any behavior-affecting change) | `v1`, `v2`, `v3` |

**Examples:**
- `concierge.chat-model.v2` — llama-3.3-70b behind the Concierge agent, prompt revision 2.
- `inventory.enrich-prompt.v1` — VDP enrichment prompt (summary/pros/cons/ideal-buyer).
- `match.embed-model.v1` — bge-base embeddings feeding the `carnimbus-match` Vectorize index.
- `seo.vdp-prompt.v1` — `/cars/<slug>` page-copy generator.

A registered entry records: DOV name · underlying Workers AI model id · prompt hash · owner agent ·
golden-set id · eval verdict · date shipped.

---

## Eval-gate policy

> **No model or prompt change ships without passing its golden-set eval.**

1. **Every domain has a golden set** — a frozen, versioned set of representative inputs with expected /
   acceptable outputs (e.g. affordability answers must respect `monthlyFor`/`aprFor` truth-core;
   enrichment must not fabricate specs; concierge must not invent inventory).
2. **A change = a version bump.** Any edit to a prompt or a switch of underlying model creates a new DOV
   `vN` and must be evaluated as a candidate, never edited in place on the live entry.
3. **The gate is pass/fail against the golden set.** A candidate ships only if it meets or beats the
   incumbent on the golden set's scored metrics with no regression on hard-constraint checks
   (truth-core accuracy, no-hallucination, safety/refusal).
4. **Truth-core is a hard gate.** Any financial output is checked against `monthlyFor(price, down, aprPct,
   term=72)` and `aprFor(fico)`. A mismatch fails the eval outright, regardless of other scores.
5. **The verdict is recorded.** The registry entry carries the eval verdict + golden-set version; a live
   model with no passing eval on record is a policy violation.
6. **Rollback is one entry.** Because entries are versioned and immutable, reverting is repointing the
   live pointer to the prior passing `vN`.

## Related docs
`AGENT-REGISTRY.md` · `AUTONOMY-POLICY.md` (evals gate autonomy too) · `MASTERPLAN.md` (Phase 4).
