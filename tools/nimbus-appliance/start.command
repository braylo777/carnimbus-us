#!/bin/zsh
# NIMBUS appliance — double-click to power ai.carnimbus.com from this Mac's RAM.
cd "$(dirname "$0")"
set -e

command -v ollama >/dev/null || { echo "Ollama not installed. Run:  brew install ollama"; exit 1; }
command -v node   >/dev/null || { echo "Node not installed. Run:  brew install node"; exit 1; }
command -v cloudflared >/dev/null || { echo "cloudflared not installed. Run:  brew install cloudflared"; exit 1; }

# 1) Ollama + models
pgrep -x ollama >/dev/null || { ollama serve >/tmp/nimbus-ollama.log 2>&1 & sleep 2; }
ollama list | grep -q "llama3.1:8b"     || ollama pull llama3.1:8b
ollama list | grep -q "nomic-embed-text" || ollama pull nomic-embed-text

# 2) The bridge the Worker talks to
node serve.mjs >/tmp/nimbus-appliance.log 2>&1 &
BRIDGE=$!
sleep 1

# 3) Public tunnel (the cloud Worker cannot reach localhost without this)
echo ""
echo "Starting tunnel — copy the https://….trycloudflare.com URL it prints, then run ONCE:"
echo "    npx wrangler secret put AI_BACKEND_URL     (paste the URL)"
echo ""
echo "Close this window to stop — the site falls back to cloud AI automatically."
trap "kill $BRIDGE 2>/dev/null" EXIT
cloudflared tunnel --url http://127.0.0.1:8787
