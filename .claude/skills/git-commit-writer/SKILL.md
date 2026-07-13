---
name: git-commit-writer
description: >-
  Writes clean Conventional Commit messages from a staged diff — correct type/scope, imperative
  subject under 72 chars, and a body explaining why. Use when asked to "write a commit message",
  "commit this", or "clean up my commit". Groups unrelated changes into separate commit suggestions.
source: Agensi
allowed-tools: Bash, Read
autonomy: L1-approve
---

# Git Commit Writer

## When to use
When staged/unstaged changes need a message, or the user asks to commit. Also when one changeset
mixes concerns and should become multiple commits.

## Steps
1. Inspect: `git status` and `git diff --staged` (fall back to `git diff` if nothing staged).
2. Identify the primary change and any unrelated changes bundled with it.
3. Pick the Conventional Commit type: feat, fix, docs, style, refactor, perf, test, build, ci,
   chore. Add a scope in parens when it clarifies (e.g. `fix(auth):`).
4. Subject: imperative mood, lowercase after the colon, no trailing period, <= 72 chars.
5. Body (when non-trivial): explain WHY and any behavior change. Wrap at ~72 cols. Note breaking
   changes with a `BREAKING CHANGE:` footer.
6. If changes span concerns, propose splitting into multiple commits with `git add -p` groupings.
7. Present the message for approval. Only commit when the user says so.

## DOV conventions (REQUIRED)
Append the commit's `feat`/`fix` type + subject line to `ledger.jsonl` when it produces a durable
artifact. Never commit secrets, `.env`, keys, or anything under `00E-secret`; never `rm` tracked
files — move to `~/.claude-trash`. Skip `._*`/dotfiles. End every commit body with the required
trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. For CNMB/CarNimbus (Workers
`worker.js`, D1, Vectorize, Workers AI, vanilla — no npm), only mention deploy in the commit if the
user actually said "ship".

## Verify
`git log -1 --stat` shows the intended files, the subject parses as a valid Conventional Commit,
and no secret/denied file was included.
