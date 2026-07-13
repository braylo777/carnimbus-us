---
name: root-cause-tracing
description: >-
  Trace a failure backward through its dependency and call chain to the true root cause instead of
  patching the symptom. Use for cascading failures, flaky errors, "fix works but breaks elsewhere",
  or an exception far from its origin. Triggers: "why is this failing", "root cause", "trace the
  chain", "cascading failure", "keeps coming back".
source: karanb192/awesome-claude-skills
allowed-tools: Read, Bash
autonomy: L1-approve
---

# Root-Cause Tracing

## When to use
When a fix at the point of failure would be a band-aid, or when one fault triggers several downstream
errors. The goal is the earliest link that, if corrected, dissolves the whole cascade.

## Steps
1. **Capture** the exact failure: message, stack, inputs, and the first vs. last symptom in time.
2. **Walk upstream**: from the failing line, follow each dependency/caller one hop at a time; note
   what each layer assumed vs. received.
3. **Find the divergence**: the first point where actual state broke the assumption — that is the root.
4. **Confirm causally**: reproduce, then temporarily correct only the root and show the cascade clears.
5. **Fix once** at the root; add a regression guard; note the dead-end paths in `.claude/brain/`.

## DOV conventions (REQUIRED)
- Any written report follows
  `YYYY-MM-DD[-HH-MM]__DOV__<domain>__<topic>__<artifact-type>__<status>__v##.ext`; append one
  `ledger/ledger.jsonl` row when filed.
- Never write `07-finc`, `*/equity`, or `00-ctrl/00E-secret` without approval.
- Never `rm` — move to `~/.claude-trash/<stamp>/`. Skip `._*`/dotfiles on any scan.
- CNMB = Cloudflare Workers single `worker.js` + D1 + Vectorize + Workers AI, no npm; deploy on "ship".

## Verify
The identified root, when corrected, clears every downstream symptom (reproduce before/after). A
regression test now fails without the fix and passes with it. No symptom-only patches remain.
