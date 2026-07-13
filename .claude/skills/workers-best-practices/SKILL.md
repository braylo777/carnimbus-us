---
name: workers-best-practices
description: >-
  Reviews and authors Cloudflare Workers code against production best practices.
  Use when writing a new Worker, reviewing worker.js, configuring wrangler.jsonc/toml,
  or checking for anti-patterns. Trigger on "review this Worker", "check my Cloudflare
  code", "is this Worker production-ready", or before a CNMB deploy.
source: VoltAgent skills library (Cloudflare authored)
allowed-tools: Read, Write, Bash, Grep, Glob
autonomy: L1-approve
---

# Cloudflare Workers Best Practices

## When to use
Reviewing or authoring a Cloudflare Worker (single `worker.js` for CNMB), touching
`wrangler.jsonc`, or auditing for the common failure modes before shipping.

## Steps
1. Retrieve current guidance from developers.cloudflare.com rather than relying on
   pre-trained memory; Workers APIs change often.
2. Check the fetch handler signature `export default { async fetch(request, env, ctx) }`
   — reject the deprecated service-worker `addEventListener("fetch")` form.
3. Streaming: return `Response` bodies as streams; never buffer large payloads in memory.
   Use `ctx.waitUntil()` for post-response work; never leave floating promises.
4. No mutable module-global state that assumes a single request — Workers are shared and
   reused across requests; per-request state lives in the handler or Durable Objects.
5. Secrets via `wrangler secret put` and `env` bindings only — never hardcoded, never in
   `wrangler.jsonc` vars. D1/KV/R2/Vectorize/AI reached through typed bindings.
6. Enable observability (`observability.enabled = true`) and structured logging; set
   `compatibility_date` and required `compatibility_flags`.
7. Handle errors with try/catch returning proper status codes; respect subrequest and
   CPU-time limits; use `cache` API or Cache-Control for edge caching.

## DOV conventions (REQUIRED)
naming schema YYYY-MM-DD[-HH-MM]__DOV__<domain>__<topic>__<artifact-type>__<status>__v##.ext;
append to ledger.jsonl when producing an artifact; never write 07-finc/*-equity/00E-secret
without approval; never rm (move to ~/.claude-trash); skip ._*/dotfiles. CNMB = Cloudflare
Workers single worker.js + D1 + Vectorize + Workers AI, no npm (vanilla only), deploy only
on "ship". This skill governs every CarNimbus worker.js review.

## Verify
- `wrangler deploy --dry-run` succeeds and reports expected bindings.
- No `addEventListener`, no hardcoded secrets (`grep -nE "sk_|api[_-]?key" worker.js`).
- Observability enabled; no floating promises flagged in review notes.
