# NIMBUS appliance — run ai.carnimbus.com on your own Mac

The site runs in Cloudflare's cloud, so it **cannot** reach `localhost` on your laptop directly.
This folder is the bridge: Ollama (your RAM) → a tiny local server → a Cloudflare tunnel → the Worker.

## One-time setup
1. `brew install ollama node cloudflared`
2. Double-click **start.command** (or `zsh start.command`). It pulls the models, starts everything,
   and prints a `https://….trycloudflare.com` URL.
3. Point the site at your Mac (once per new tunnel URL):
   `npx wrangler secret put AI_BACKEND_URL` → paste the URL.
4. In NIMBUS, type `status` — it should say **appliance: up**.

## Daily use
Double-click **start.command**. Leave the window open; NIMBUS briefs, chat, and embeddings run on your
Mac and burn **zero** Workers-AI neurons. Close the window → the site automatically falls back to cloud
AI (and the free-tier 10k/day quota applies again). Deterministic NIMBUS commands work either way.

Note: the quick tunnel URL changes each launch — repeat step 3 after a restart, or set up a named
Cloudflare tunnel for a permanent URL (ask Claude to do this when you're ready).

Buyer-facing car chat intentionally stays on Workers AI (the local model breaks its persona); the
appliance powers NIMBUS, lead briefs, and search embeddings.
