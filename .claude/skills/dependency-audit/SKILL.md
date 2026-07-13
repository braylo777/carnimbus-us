---
name: dependency-audit
description: >-
  Audit dependencies for known CVEs, supply-chain risk, and unhealthy packages, then remediate safely.
  Use before a release, when adding a dependency, or on a security sweep. Triggers: "audit deps",
  "any CVEs", "supply chain", "is this package safe", "vulnerability scan", "outdated packages".
source: karanb192/awesome-claude-skills
allowed-tools: Read, Bash
autonomy: L1-approve
---

# Dependency Audit

## When to use
Before shipping, when introducing a new package, or on a scheduled security sweep. Covers known
vulnerabilities plus supply-chain signals (typosquats, abandoned/maintainer-churned packages).

## Steps
1. **Inventory** direct + transitive deps and pin state (lockfile present and committed?).
2. **Scan for CVEs** with the ecosystem tool (`npm audit`, `pip-audit`, `osv-scanner`); record severity.
3. **Assess supply-chain risk**: unmaintained, sudden ownership change, install scripts, name typosquat.
4. **Remediate**: upgrade to a patched version; if none, pin + isolate or replace; avoid blind major bumps.
5. **Re-scan** to confirm zero known-exploitable highs; note accepted risks with rationale.

## DOV conventions (REQUIRED)
- Audit report follows
  `YYYY-MM-DD[-HH-MM]__DOV__<domain>__<topic>__<artifact-type>__<status>__v##.ext`; append one
  `ledger/ledger.jsonl` row.
- Never write `07-finc`, `*/equity`, or `00-ctrl/00E-secret` without approval.
- Never `rm` — move superseded lockfiles/files to `~/.claude-trash/<stamp>/`. Skip `._*`/dotfiles.
- CNMB = Cloudflare Workers single `worker.js` + D1 + Vectorize + Workers AI, **no npm** — keep the
  dependency surface near-zero; audit only the minimal tooling, deploy on "ship".

## Verify
No known high/critical CVE remains unaddressed or unaccepted; the lockfile is committed and reproducible;
a re-scan is clean; each accepted risk has a written rationale.
