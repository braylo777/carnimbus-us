---
name: systematic-debugging
description: >-
  Drives a disciplined four-phase root-cause hunt — reproduce, isolate, fix, verify — instead of
  guess-and-patch. Use when facing a bug, flaky test, crash, or "it doesn't work", especially after
  a first quick fix failed or the cause is unclear. Stops symptom-patching and finds the real cause.
source: karanb192/awesome-claude-skills
allowed-tools: Read, Grep, Bash
autonomy: L1-approve
---

# Systematic Debugging

## When to use
Any non-obvious bug, intermittent failure, or regression — especially when the obvious fix didn't
hold, or you catch yourself about to change code without understanding why it's broken.

## Steps
1. REPRODUCE — get a reliable, minimal repro. Nail the exact inputs, environment, and expected vs
   actual. If you can't reproduce it, you can't fix it — instrument until you can.
2. ISOLATE — bisect the surface: binary-search the code path, add logging/asserts, check recent
   diffs (`git log`/`git bisect`), rule out layers one at a time until the fault localizes to a
   single cause. State the hypothesis explicitly.
3. FIX — address the root cause, not the symptom. Make the smallest change that resolves the true
   cause; note any nearby latent bugs found.
4. VERIFY — confirm the original repro now passes, add a regression test that would have caught it,
   and run the surrounding suite to check for collateral breakage.
5. Never declare "fixed" on a hypothesis you didn't confirm against the actual failure.

## DOV conventions (REQUIRED)
If a written post-mortem is filed, name it
`YYYY-MM-DD__DOV__<domain>__<topic>__debug-report__ready__v##.md` and append to `ledger.jsonl`.
Never `rm` logs/artifacts — move to `~/.claude-trash`. Skip `._*`/dotfiles. Never read/write
`00E-secret`; no `07-finc`/`*-equity` writes without approval. For CNMB/CarNimbus (Workers
`worker.js`, D1, Vectorize, Workers AI, vanilla — no npm), reproduce via `wrangler tail`/preview
logs; deploy a fix only on "ship".

## Verify
The exact original repro now passes, a regression test locks the fix in, and the root cause is stated
in one sentence that actually explains the observed failure.
