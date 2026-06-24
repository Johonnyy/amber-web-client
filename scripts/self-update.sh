#!/usr/bin/env bash
#
# Self-update the Amber web client: pull the latest code, rebuild, restart.
#
# Triggered by POST /api/update (see app/api/update/route.ts) — usually by voice
# ("Amber, update yourself"). Runs detached from the request; full output is
# appended to .self-update.log, and a one-word progress marker (building|done|
# failed) is written to .self-update.status so the browser (lib/clientTools.ts)
# can show success/failure instead of spinning on the update screen forever.
#
# IMPORTANT (production): if this runs inside the web service's own systemd
# cgroup, `systemctl restart` will kill it mid-flight. Launch it decoupled, e.g.
# set AMBER_UPDATE_CMD so the route runs it under a transient unit:
#   sudo systemd-run --collect --unit=amber-web-update bash scripts/self-update.sh
#
# Env:
#   AMBER_UPDATE_BRANCH   branch to deploy        (default: this clone's branch)
#   AMBER_RESTART_CMD     how to restart the app  (default: sudo systemctl restart amber-web)

set -euo pipefail

cd "$(dirname "$0")/.."
LOG=".self-update.log"
STATUS=".self-update.status"

# Default to the branch this clone is actually on — a repo checked out on `master`
# must not be reset to a non-existent `origin/main` (which fails and leaves the
# update half-done). An explicit AMBER_UPDATE_BRANCH still wins.
BRANCH="${AMBER_UPDATE_BRANCH:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)}"
RESTART_CMD="${AMBER_RESTART_CMD:-sudo systemctl restart amber-web}"

echo "building" > "$STATUS"

# Any failure below marks the update failed and leaves the old build running, so
# the client stops waiting and reports it instead of hanging on the update screen.
fail() {
  local code=$?
  echo "failed" > "$STATUS"
  echo "=== FAILED (exit $code) $(date -u +%FT%TZ) ===" >> "$LOG"
}
trap fail ERR

{
  echo "=== self-update $(date -u +%FT%TZ) — branch=$BRANCH ==="
  git fetch --all --prune
  git reset --hard "origin/$BRANCH"
  npm ci
  npm run build
  # Mark done *before* restarting: a non-detached restart can kill this script
  # mid-line, so the status file has to already read "done" by the time it does.
  echo "done" > "$STATUS"
  echo "restarting via: $RESTART_CMD"
  eval "$RESTART_CMD"
  echo "=== done ==="
} >> "$LOG" 2>&1
