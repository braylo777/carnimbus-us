#!/bin/bash
# One-time install of the wake protocol on THIS machine. Reversible via uninstall.sh.
#
# macOS reality: a launchd agent cannot exec code on the removable CNMB drive, nor read its files, until
# /bin/bash has Full Disk Access (System Settings > Privacy & Security > Full Disk Access). That grant CANNOT
# be scripted (by design). So this installer: (1) puts a LOCAL launcher on the internal disk that launchd runs,
# (2) loads the on-mount agent, and (3) opens the Full Disk Access pane and tells you exactly what to add.
# Until the grant is given, the on-mount automation no-ops quietly; the protocol still works right now via
#   bash /Volumes/CNMB/.../nimbus-edge/wake/wake.sh
set -eu
DRIVE="/Volumes/CNMB"
EDGE="$DRIVE/01-prod/01A-app/carnimbus-com-site/nimbus-edge"
LOCAL="$DRIVE/01-prod/01A-app/carnimbus-com-site/nimbus-local"
KEY="$DRIVE/00-corp/00E-keys/nimbus-admin/admin.ed25519.key"
LA="$HOME/Library/LaunchAgents"
APPSUP="$HOME/Library/Application Support/CarNimbus"
PLIST="com.carnimbus.wake.plist"
LAUNCHER="$APPSUP/wake-launcher.sh"

[ -d "$DRIVE" ] || { echo "CNMB drive not mounted — aborting"; exit 1; }

# 1. Ed25519 drive key (the 'verified drive' credential). One-time; never overwrites.
if [ ! -f "$KEY" ]; then
  echo "no Ed25519 drive key — generating (stays on the drive, mode 600, never committed)…"
  ( cd "$LOCAL" && node nimbus-key.js keygen )
else
  echo "Ed25519 drive key already present — leaving it."
fi

# 2. Build the edge binaries if missing.
( cd "$EDGE" && make all >/dev/null && echo "nimbus-edge daemons built." )

# 3. Copy the LOCAL launcher onto the internal disk (launchd's stable, always-execable entry point).
mkdir -p "$APPSUP"
cp "$EDGE/wake/wake-launcher.sh" "$LAUNCHER"
chmod +x "$LAUNCHER"

# 4. Generate the launchd plist pointing at the local launcher (absolute $HOME path resolved here).
mkdir -p "$LA"
cat > "$LA/$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.carnimbus.wake</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$LAUNCHER</string>
  </array>
  <key>StartOnMount</key><true/>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>/tmp/carnimbus-wake.out</string>
  <key>StandardErrorPath</key><string>/tmp/carnimbus-wake.err</string>
</dict>
</plist>
PLISTEOF

launchctl unload "$LA/$PLIST" 2>/dev/null || true
launchctl load "$LA/$PLIST"
echo "installed & loaded com.carnimbus.wake (entry: $LAUNCHER)"

# 5. The one manual step macOS forces: grant Full Disk Access so launchd may touch the removable drive.
echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo " ONE-TIME MANUAL STEP (macOS security — cannot be scripted):"
echo "   System Settings ▸ Privacy & Security ▸ Full Disk Access ▸ [+]"
echo "   add:  /bin/bash   (press ⌘⇧G, type /bin/bash, Add), toggle it ON."
echo "   Then the drive will auto-wake on every plug-in. Until then, run:"
echo "     bash $EDGE/wake/wake.sh"
echo "════════════════════════════════════════════════════════════════════════"
open "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles" 2>/dev/null || true
echo "uninstall any time: bash $EDGE/wake/uninstall.sh"
