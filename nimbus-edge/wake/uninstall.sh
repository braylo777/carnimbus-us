#!/bin/bash
# Fully remove the wake protocol from this machine. Does NOT touch the drive key or any data.
set -u
EDGE="/Volumes/CNMB/01-prod/01A-app/carnimbus-com-site/nimbus-edge"
LA="$HOME/Library/LaunchAgents"
APPSUP="$HOME/Library/Application Support/CarNimbus"
PLIST="com.carnimbus.wake.plist"
launchctl unload "$LA/$PLIST" 2>/dev/null || true
rm -f "$LA/$PLIST"
rm -f "$APPSUP/wake-launcher.sh"
rmdir "$APPSUP" 2>/dev/null || true
bash "$EDGE/wake/sleep.sh" 2>/dev/null || true
echo "uninstalled com.carnimbus.wake + local launcher, tore down any running daemons."
echo "Drive key + data untouched. (Full Disk Access grant, if you added one, remove it manually in System Settings.)"
