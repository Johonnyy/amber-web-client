#!/usr/bin/env bash
#
# Self-update the Amber web client: pull the latest code, rebuild, restart.
#
# Triggered by POST /api/update (see app/api/update/route.ts) — usually by voice
# ("Amber, update yourself"). Runs detached from the request; output is appended
# to .self-update.log in the repo root.
#
# IMPORTANT (production): if this runs inside the web service's own systemd
# cgroup, `systemctl restart` will kill it mid-flight. Launch it decoupled, e.g.
# set AMBER_UPDATE_CMD so the route runs it under a transient unit:
#   sudo systemd-run --collect --unit=amber-web-update bash scripts/self-update.sh
#
# Env:
#   AMBER_UPDATE_BRANCH   branch to deploy        (default: main)
#   AMBER_RESTART_CMD     how to restart the app  (default: sudo systemctl restart amber-web)

set -euo pipefail

cd "$(dirname "$0")/.."
LOG=".self-update.log"

BRANCH="${AMBER_UPDATE_BRANCH:-main}"
RESTART_CMD="${AMBER_RESTART_CMD:-sudo systemctl restart amber-web}"

{
  echo "=== self-update $(date -u +%FT%TZ) — branch=$BRANCH ==="
  git fetch --all --prune
  git reset --hard "origin/$BRANCH"
  npm ci
  npm run build
  echo "restarting via: $RESTART_CMD"
  eval "$RESTART_CMD"
  echo "=== done ==="
} >> "$LOG" 2>&1
