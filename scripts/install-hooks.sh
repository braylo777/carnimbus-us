#!/usr/bin/env bash
# Installs a local pre-push hook so even a manual `git push` runs build validation first.
set -euo pipefail
cd "$(dirname "$0")/.."
cat > .git/hooks/pre-push <<'HOOK'
#!/usr/bin/env bash
exec bash scripts/validate.sh
HOOK
chmod +x .git/hooks/pre-push
echo "pre-push hook installed"
