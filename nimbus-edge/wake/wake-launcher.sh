#!/bin/bash
# Local (internal-disk) entry point for the launchd wake agent. install.sh copies this to
# ~/Library/Application Support/CarNimbus/ and points the launchd plist at it. Why a local launcher:
# launchd cannot *exec a script that lives on the removable drive* (macOS returns EPERM), and a launchd
# process cannot *touch removable-volume files at all* until /bin/bash is granted Full Disk Access
# (one-time System Settings step — see wake/README.md). This launcher lives on the internal disk so launchd
# can always start it; it hands off to the drive's wake.sh only when the drive is mounted AND accessible.
DRIVE_WAKE="/Volumes/CNMB/01-prod/01A-app/carnimbus-com-site/nimbus-edge/wake/wake.sh"
# Probe with a REAL content read (not `test -r`): under launchd, TCC allows stat() but blocks reading/execing a
# removable-volume file until /bin/bash has Full Disk Access. `head -c1` actually opens+reads, so it fails cleanly
# pre-grant (exit 0, no noisy EPERM) and succeeds once granted. Also covers the drive simply not being mounted.
if ! head -c1 "$DRIVE_WAKE" >/dev/null 2>&1; then
  echo "[$(date -u +%FT%TZ)] drive wake.sh not accessible (drive out, or Full Disk Access not yet granted for /bin/bash)" >> /tmp/carnimbus-wake.out
  exit 0
fi
exec /bin/bash "$DRIVE_WAKE"
