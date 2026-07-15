#!/bin/bash
# nimbus-edge WAKE agent — plugging the verified CNMB drive boots the brain and opens ai.carnimbus.com.
# Guarded (launchd StartOnMount fires on every mount), fail-closed (needs the drive's Ed25519 key),
# idempotent (skips anything already listening), local-only (no deploy, no public cutover).
set -u
DRIVE="/Volumes/CNMB"
BASE="$DRIVE/01-prod/01A-app/carnimbus-com-site"
EDGE="$BASE/nimbus-edge"
LOCAL="$BASE/nimbus-local"
KEY="$DRIVE/00-corp/00E-keys/nimbus-admin/admin.ed25519.key"
RUN="$EDGE/wake/run"
mkdir -p "$RUN"
log(){ echo "[$(date -u +%FT%TZ)] $*" >> "$RUN/wake.log"; }

# 1. GUARD — launchd fires this on ANY volume mount; only our drive proceeds.
[ -d "$DRIVE" ] || exit 0

# 1b. SINGLE-FLIGHT LOCK — StartOnMount + RunAtLoad can fire two instances at once; an atomic mkdir serializes
# them so they never race the port checks and orphan a daemon under a stale pidfile. Steal a lock older than 30s
# (left by a crashed run). The winner releases it on exit; backgrounded daemons/watcher outlive the lock.
LOCK="$RUN/wake.lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  if [ -d "$LOCK" ] && [ -n "$(find "$LOCK" -maxdepth 0 -mmin +0.5 2>/dev/null)" ]; then
    rmdir "$LOCK" 2>/dev/null; mkdir "$LOCK" 2>/dev/null || { log "another wake in progress — skipping"; exit 0; }
  else
    log "another wake in progress — skipping"; exit 0
  fi
fi
trap 'rmdir "$LOCK" 2>/dev/null' EXIT

# 2. VERIFY THE DRIVE — possession check: the Ed25519 private key must be physically present on the mounted drive.
# This gates on POSSESSION (drive plugged into this machine), not a cryptographic signature — the strong
# challenge-response lives in nimbus-key.js `login` once the gateway is up. Absent key ⇒ fail closed.
if [ ! -f "$KEY" ]; then log "drive not verified (no Ed25519 key at $KEY) — refusing to wake"; exit 0; fi

listening(){ lsof -nP -iTCP:"$1" -sTCP:LISTEN -t >/dev/null 2>&1; }
# boot <name> <port> <workdir> <cmd...>
boot(){
  local name="$1" port="$2" dir="$3"; shift 3
  if listening "$port"; then log "$name already up on :$port"; return; fi
  ( cd "$dir" && exec "$@" ) >>"$RUN/$name.log" 2>&1 &
  echo $! > "$RUN/$name.pid"
  log "$name booted pid $(cat "$RUN/$name.pid") on :$port"
}

# 3. BOOT the edge (C daemons) + the brain (Node gateway), each in its correct working dir.
boot static   8080 "$EDGE"  ./static 8080 ../site
boot balancer 8081 "$EDGE"  ./balancer 8081
boot monitor  8085 "$EDGE"  ./monitor 8085
boot gateway  8787 "$LOCAL" node serve.js
# optional local inference — only if an Ollama server is actually answering
if command -v ollama >/dev/null 2>&1 && curl -s -o /dev/null http://127.0.0.1:11434 2>/dev/null; then
  boot aibackend 8788 "$LOCAL" node ai-backend.js
else
  log "ollama not answering on :11434 — skipping local AI backend (optional)"
fi

# 4. OPEN THE DOOR — brain online.
sleep 1
open "https://ai.carnimbus.com"
log "awake — opened ai.carnimbus.com"

# 5. SLEEP ON UNPLUG — background watcher tears the local daemons down when the drive leaves.
if [ ! -f "$RUN/watcher.pid" ] || ! kill -0 "$(cat "$RUN/watcher.pid" 2>/dev/null)" 2>/dev/null; then
  ( while [ -d "$DRIVE" ]; do sleep 3; done
    log "drive removed — sleeping"
    bash "$EDGE/wake/sleep.sh" ) >>"$RUN/wake.log" 2>&1 &
  echo $! > "$RUN/watcher.pid"
fi
