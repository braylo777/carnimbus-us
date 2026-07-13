---
name: database-migration
description: >-
  Version schema changes with safe, reversible forward/back migrations. Use when altering tables,
  adding columns/indexes, backfilling data, or coordinating a schema change across environments.
  Triggers: "migration", "alter the schema", "add a column", "backfill", "rollback the DB change".
source: karanb192/awesome-claude-skills
allowed-tools: Read, Write, Edit, Bash
autonomy: L1-approve
---

# Database Migration

## When to use
Any structural or large data change to a database. Each change is a numbered, ordered migration with a
tested down-path so it can be rolled back.

## Steps
1. **Write up + down** in one versioned migration file; the down must truly reverse the up.
2. **Expand, then contract**: add new columns/tables first, backfill, switch reads/writes, drop old
   last — so old and new code coexist during rollout.
3. **Backfill in batches** to avoid long locks; make backfills idempotent and re-runnable.
4. **Test on a copy** of production-shaped data; time it and check locking.
5. **Apply forward, verify, keep the rollback ready**; never edit an already-applied migration — add a new one.

## DOV conventions (REQUIRED)
- Migration notes/artifacts follow
  `YYYY-MM-DD[-HH-MM]__DOV__<domain>__<topic>__<artifact-type>__<status>__v##.ext`; append one
  `ledger/ledger.jsonl` row.
- Never write `07-finc`, `*/equity`, or `00-ctrl/00E-secret` without approval — financial schema
  changes are approval-gated.
- Never `rm` — move superseded files to `~/.claude-trash/<stamp>/`. Skip `._*`/dotfiles on scans.
- CNMB = Cloudflare Workers + **D1**; migrations run via `wrangler d1 migrations`; apply only on "ship".

## Verify
Up applies cleanly and down fully reverses on a data copy; backfill is idempotent; old and new code
both work mid-rollout; no already-applied migration was mutated.
