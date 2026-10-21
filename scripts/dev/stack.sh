#!/usr/bin/env bash
# Per-checkout Docker Compose lifecycle helper.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/dev/stack.sh [--allow-primary] <up|down|ps|reset|config>

A primary checkout uses the canonical spaartrack project and ports. A git
worktree gets a deterministic project name and host-port range derived from
its checkout path. Set STACK_ID to make the worktree identity explicit.
EOF
}

fail() { printf 'stack.sh: %s\n' "$*" >&2; exit 1; }

ALLOW_PRIMARY=0
while [[ "${1:-}" == --* ]]; do
  case "$1" in
    --allow-primary) ALLOW_PRIMARY=1; shift ;;
    --help) usage; exit 0 ;;
    *) fail "unknown option: $1" ;;
  esac
done
COMMAND="${1:-}"
[[ -n "$COMMAND" ]] || { usage >&2; exit 2; }
case "$COMMAND" in up|down|ps|reset|config) ;;
  *) fail "unknown command: $COMMAND" ;;
esac

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
cd "$ROOT"

# A worktree is identified by its own checkout path, never by the shared git
# directory. This remains stable when the task's branch is renamed.
WORKTREE_ID=${STACK_ID:-$(basename "$ROOT")}
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  COMMON_DIR=$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null || git rev-parse --git-common-dir)
  PRIMARY_ROOT=$(CDPATH= cd -- "$(dirname -- "$COMMON_DIR")" && pwd)
else
  PRIMARY_ROOT=""
fi

if [[ -n "$PRIMARY_ROOT" && "$ROOT" == "$PRIMARY_ROOT" ]]; then
  PROJECT=spaartrack
  API_PORT=${API_PORT:-18080}
  DB_PORT=${DB_PORT:-55432}
  REDIS_PORT=${REDIS_PORT:-6395}
  WEB_PORT=${WEB_PORT:-3000}
  S3_PORT=${S3_PORT:-19000}
  S3_CONSOLE_PORT=${S3_CONSOLE_PORT:-19001}
  OTEL_GRPC_PORT=${OTEL_GRPC_PORT:-4317}
  OTEL_HTTP_PORT=${OTEL_HTTP_PORT:-4318}
  OTEL_METRICS_PORT=${OTEL_METRICS_PORT:-8889}
  PROMETHEUS_PORT=${PROMETHEUS_PORT:-9090}
  GRAFANA_PORT=${GRAFANA_PORT:-3001}
else
  [[ "$WORKTREE_ID" != spaartrack && -n "$WORKTREE_ID" ]] || fail "missing safe worktree identifier; refusing canonical project fallback"
  [[ "$WORKTREE_ID" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]] || fail "invalid worktree identifier; refusing canonical project fallback"
  DERIVED_PROJECT="spaartrack-$(printf '%s' "$WORKTREE_ID" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9' '-' | sed -E 's/-+/-/g; s/^-|-$//g')"
  PROJECT=${STACK_PROJECT_NAME:-$DERIVED_PROJECT}
  [[ -n "$PROJECT" && "$PROJECT" != spaartrack ]] || [[ "$ALLOW_PRIMARY" == 1 ]] || fail "refusing unsafe canonical project name; use --allow-primary explicitly"
  SEED=$(printf '%s' "$ROOT/$WORKTREE_ID" | cksum | awk '{print $1}')
  OFFSET=$((SEED % 700))
  API_PORT=${API_PORT:-$((18100 + OFFSET))}
  DB_PORT=${DB_PORT:-$((55500 + OFFSET))}
  REDIS_PORT=${REDIS_PORT:-$((6500 + OFFSET))}
  WEB_PORT=${WEB_PORT:-$((3700 + OFFSET))}
  S3_PORT=${S3_PORT:-$((19700 + OFFSET))}
  S3_CONSOLE_PORT=${S3_CONSOLE_PORT:-$((20700 + OFFSET))}
  OTEL_GRPC_PORT=${OTEL_GRPC_PORT:-$((4417 + OFFSET))}
  OTEL_HTTP_PORT=${OTEL_HTTP_PORT:-$((4418 + OFFSET))}
  OTEL_METRICS_PORT=${OTEL_METRICS_PORT:-$((9589 + OFFSET))}
  PROMETHEUS_PORT=${PROMETHEUS_PORT:-$((9990 + OFFSET))}
  GRAFANA_PORT=${GRAFANA_PORT:-$((3701 + OFFSET))}
  [[ "$PROJECT" != spaartrack ]] || fail "refusing to target canonical project from a worktree"
fi

if [[ "$PROJECT" == spaartrack && "$ROOT" != "$PRIMARY_ROOT" && "$ALLOW_PRIMARY" != 1 ]]; then
  fail "refusing canonical spaartrack project outside the primary checkout; use --allow-primary explicitly"
fi

export COMPOSE_PROJECT_NAME="$PROJECT"
export API_PORT DB_PORT REDIS_PORT WEB_PORT S3_PORT S3_CONSOLE_PORT
export OTEL_GRPC_PORT OTEL_HTTP_PORT OTEL_METRICS_PORT PROMETHEUS_PORT GRAFANA_PORT

print_config() {
  printf 'COMPOSE_PROJECT_NAME=%s\nAPI_URL=http://localhost:%s\nDATABASE_URL=postgres://spaartrack:change-me-local-only@localhost:%s/spaartrack\nREDIS_URL=redis://localhost:%s/0\nWEB_URL=http://localhost:%s\n' \
    "$PROJECT" "$API_PORT" "$DB_PORT" "$REDIS_PORT" "$WEB_PORT"
  printf 'S3_URL=http://localhost:%s\nSTACK_ROOT=%s\n' "$S3_PORT" "$ROOT"
}

case "$COMMAND" in
  config) print_config ;;
  up)
    docker compose --project-name "$PROJECT" up -d --build
    print_config
    ;;
  down) docker compose --project-name "$PROJECT" down ;;
  ps) docker compose --project-name "$PROJECT" ps ;;
  reset)
    docker compose --project-name "$PROJECT" down -v
    docker compose --project-name "$PROJECT" up -d --build
    print_config
    ;;
esac
