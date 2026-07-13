#!/usr/bin/env bash
# seed-db.sh — build the local NIMBUS SQLite database from migrations/*.sql.
# Zero external deps: uses the node:sqlite seeder. Safe to re-run (migrations are idempotent-ish;
# re-running rebuilds against the existing file). Delete nimbus.sqlite first for a clean rebuild.
set -euo pipefail
cd "$(dirname "$0")"
node seed-db.js
