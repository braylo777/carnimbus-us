---
name: refactoring-patterns
description: >-
  Detect code smells and apply named refactorings behavior-preservingly, guarded by tests. Use when
  code is duplicated, long, tangled, or hard to change, or before extending a messy module. Triggers:
  "refactor", "clean this up", "code smell", "this is getting unwieldy", "extract/rename/simplify".
source: karanb192/awesome-claude-skills
allowed-tools: Read, Edit, Bash
autonomy: L1-approve
---

# Refactoring Patterns

## When to use
When structure — not behavior — is the problem: duplication, long functions/params, feature envy,
shotgun surgery, primitive obsession, deep nesting. Refactor before adding to a smelly area.

## Steps
1. **Pin behavior**: ensure a passing test (or characterization test) covers the target before touching it.
2. **Name the smell** and the matching move: Extract Function/Class, Inline, Rename, Introduce
   Parameter Object, Replace Conditional with Polymorphism, Guard Clauses, Decompose Conditional.
3. **Apply one move at a time**; run tests after each — keep every step green and behavior-preserving.
4. **Commit small**; do not mix refactor with feature change in one commit.
5. Note recurring smells/decisions in `.claude/brain/`; let the format hook handle formatting.

## DOV conventions (REQUIRED)
- Any filed artifact follows
  `YYYY-MM-DD[-HH-MM]__DOV__<domain>__<topic>__<artifact-type>__<status>__v##.ext`; append one
  `ledger/ledger.jsonl` row.
- Never write `07-finc`, `*/equity`, or `00-ctrl/00E-secret` without approval.
- Never `rm` — move superseded files to `~/.claude-trash/<stamp>/`. Skip `._*`/dotfiles on scans.
- CNMB = Cloudflare Workers single `worker.js` + D1 + Vectorize + Workers AI, no npm; deploy on "ship".

## Verify
Tests are green before and after each move; external behavior is unchanged; the targeted smell is gone
and no new one introduced. Refactor commits contain no behavioral change.
