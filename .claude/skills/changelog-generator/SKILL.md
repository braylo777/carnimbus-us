---
name: changelog-generator
description: >-
  Produce release notes / a CHANGELOG section from conventional commits, grouped by change
  type with a human-readable summary. Use when asked to "generate a changelog", "write
  release notes", "what changed since <tag>", or when cutting a release.
source: Agensi / karanb192 (changelog skill)
allowed-tools: Read, Write, Bash
autonomy: L1-approve
---

# Changelog Generator

## When to use
Cutting a release or summarizing a range of commits. Triggers: "generate changelog",
"release notes", "changes since v1.2.0".

## Steps
1. Determine the range: `git describe --tags --abbrev=0` for the last tag, then
   `git log <lasttag>..HEAD --pretty='%H%x09%s%x09%b'`.
2. Parse conventional-commit prefixes and group:
   - **Features** (`feat`), **Fixes** (`fix`), **Performance** (`perf`),
     **Refactors** (`refactor`), **Docs** (`docs`), **Breaking changes**
     (`!` or `BREAKING CHANGE:` footer — always call these out at top).
3. Rewrite each entry as a user-facing sentence (not the raw commit subject); collapse
   noise (chore/ci/test) unless notable. Link PR/issue numbers if present.
4. Compute the next semver bump: breaking → major, feat → minor, else patch. Suggest it.
5. Prepend a dated section to `CHANGELOG.md` (Keep a Changelog format) or present the draft.

## DOV conventions (REQUIRED)
- Standalone artifacts use
  `YYYY-MM-DD[-HH-MM]__DOV__<domain>__<topic>__<artifact-type>__<status>__v##.ext` and a
  `ledger.jsonl` line.
- Never write `07-finc`, `*-equity`, or `00E-secret` without approval.
- Never `rm` — move to `~/.claude-trash`. Skip `._*`/dotfiles.
- CNMB = Cloudflare Workers single `worker.js` + D1 + Vectorize + Workers AI, no npm;
  deploy only on "ship".

## Verify
Each changelog line must trace to a real commit in the range; the suggested version bump
must match the highest-severity change present.
