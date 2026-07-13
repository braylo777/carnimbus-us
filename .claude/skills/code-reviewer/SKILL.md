---
name: code-reviewer
description: >-
  Performs a rigorous, severity-ranked code review of a diff or file set: correctness bugs,
  OWASP Top 10 / injection / auth / secrets exposure, and reuse/simplification cleanups. Use when
  asked to "review this code", "security review", "check this PR/diff", or before shipping a change.
source: Anthropic anthropics/skills + Agensi
allowed-tools: Read, Grep, Bash
autonomy: L0-suggest
---

# Code Reviewer

## When to use
Before merging/shipping, when the user says "review", "audit", "look for vulns", or after a
meaningful edit that needs a second pair of eyes.

## Steps
1. Scope the review: `git diff` (or read the named files). Never review the whole repo blindly.
2. Read each changed hunk with surrounding context — a diff line lies without its neighbors.
3. Pass 1 — correctness: null/undefined, off-by-one, error handling, async/await races, resource
   leaks, incorrect edge cases. Trace the actual data flow, don't pattern-match.
4. Pass 2 — security (OWASP): injection (SQL/command/template), broken auth/session, secrets in
   code, SSRF, path traversal, missing input validation, unsafe deserialization, CSP/XSS.
5. Pass 3 — quality: duplication, dead code, over-engineering, naming, missing tests.
6. Rank findings CRITICAL / HIGH / MEDIUM / LOW. For each: file:line, why it matters, concrete fix.
7. Lead with the verdict (ship / block) and the CRITICAL/HIGH list. Do not fix unless asked.

## DOV conventions (REQUIRED)
If a written review report is filed, name it
`YYYY-MM-DD__DOV__<domain>__<topic>__code-review__ready__v##.md` and append a line to `ledger.jsonl`
in the sink. Never write to `07-finc`, `*-equity`, or `00E-secret` without approval. Never `rm` —
move anything discarded to `~/.claude-trash`. Skip `._*`/dotfiles when scanning. For CNMB code:
CarNimbus = Cloudflare Workers (single `worker.js`) + D1 + Vectorize + Workers AI, vanilla JS only
(no npm/packages) — flag any added dependency as a HIGH finding.

## Verify
Every CRITICAL/HIGH finding cites a real file:line that exists in the diff, and the verdict follows
from the findings (no unaddressed CRITICALs behind a "ship" verdict).
