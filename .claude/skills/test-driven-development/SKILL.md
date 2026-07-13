---
name: test-driven-development
description: >-
  Enforces strict RED-GREEN-REFACTOR TDD — write a failing test first, watch it fail, write the
  minimum code to pass, then refactor. Use when asked to "do TDD", "write the test first", "build
  this test-first", or when adding behavior that should be spec'd before it's implemented.
source: karanb192/awesome-claude-skills
allowed-tools: Read, Write, Bash
autonomy: L1-approve
---

# Test-Driven Development

## When to use
When implementing new behavior or fixing a bug and the discipline of a failing test first will
prevent regressions and over-building. Especially for pure logic and API contracts.

## Steps
1. RED — write ONE small failing test that names the desired behavior. Run it and confirm it fails
   for the right reason (assertion failure, not import/syntax error).
2. GREEN — write the minimum production code to make that test pass. No extra features, no
   speculative generality. Run the test; confirm green.
3. REFACTOR — clean up names/duplication in both test and code while keeping the bar green. Re-run.
4. Repeat one behavior at a time; keep the full suite green after every cycle.
5. For a bug: first write a test that reproduces it (RED), then fix (GREEN) — the test becomes the
   regression guard.
6. Never write production code with no failing test demanding it; never skip watching RED fail.

## DOV conventions (REQUIRED)
Name test files per the sink's convention; if filing a test-plan artifact use
`YYYY-MM-DD__DOV__<domain>__<topic>__test-plan__ready__v##.md` and append to `ledger.jsonl`. Never
`rm` a test to make the suite pass — move to `~/.claude-trash` if truly obsolete. Skip
`._*`/dotfiles. Never touch `00E-secret`/`07-finc`/`*-equity`. For CNMB/CarNimbus (Workers
`worker.js`, D1, Vectorize, Workers AI, vanilla — no npm), tests run against the Worker via Miniflare
or the preview URL; deploy only on "ship".

## Verify
Show the RED run (test failed) and the GREEN run (same test passed) — both are required evidence.
The final full suite is green and no test was deleted or skipped to get there.
