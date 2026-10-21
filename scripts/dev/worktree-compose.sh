#!/usr/bin/env bash
# Start the current linked worktree without sharing the primary stack.
# The override deliberately owns a separate, explicit host-port set.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_ID="$(basename "$ROOT" | tr -cs '[:alnum:]_-' '-')"
WORKTREE_ID="${WORKTREE_ID%-}"
PROJECT_NAME="spaartrack-${WORKTREE_ID}"

cd "$ROOT"
exec env COMPOSE_PROJECT_NAME="${PROJECT_NAME}" \
  docker compose -f compose.yaml -f compose.privacy-local.yaml "$@"