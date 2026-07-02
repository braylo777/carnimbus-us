#!/usr/bin/env bash
# Build validation gate — never push a broken site. Run by the pre-push hook.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build >/dev/null || { echo "❌ build broken — NOT pushing"; exit 1; }
echo "✅ validate ok"
