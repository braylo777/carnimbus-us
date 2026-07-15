#!/bin/bash
# Teardown: kill every daemon the wake agent booted (by pidfile) and clear the run dir. Idempotent.
# The site-side lock (2s heartbeat auto-lock on unplug) is separate and already live; this handles the
# LOCAL daemons. Safe to run by hand.
set -u
EDGE="$(cd "$(dirname "$0")/.." && pwd)"
RUN="$EDGE/wake/run"
[ -d "$RUN" ] || exit 0
# Note: run/*.pid includes watcher.pid, so when the unplug watcher invokes this, it also kills itself — intended
# (the watcher's while-loop has already exited by then; killing the now-idle parent is a clean no-op for teardown).
for pf in "$RUN"/*.pid; do
  [ -e "$pf" ] || continue
  name="$(basename "$pf" .pid)"
  pid="$(cat "$pf" 2>/dev/null)"
  if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null
    echo "[$(date -u +%FT%TZ)] slept $name (pid $pid)" >> "$RUN/wake.log"
  fi
  rm -f "$pf"
done
