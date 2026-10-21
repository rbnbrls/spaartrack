#!/bin/sh
set -eu

# Run Compose with a checkout-scoped project and deterministic host ports.
# The standard checkout (directory basename "spaartrack") keeps the published ports.
root=${COMPOSE_WORKTREE_ROOT:-$(pwd -P)}
project=${COMPOSE_PROJECT_NAME:-$(basename "$root")}
project=$(printf '%s' "$project" | tr '[:upper:]_' '[:lower:]-' | tr -cd 'a-z0-9-')
[ -n "$project" ] || project=spaartrack

if [ "$(basename "$root")" = "spaartrack" ] && [ -z "${COMPOSE_PROJECT_NAME:-}" ]; then
  api=18080; db=55432; web=3000; redis=6379; object=19000; console=19001
  otel_grpc=4317; otel_http=4318; otel_metrics=8889; prometheus=9090; grafana=3001
else
  checksum=$(printf '%s' "$root" | cksum | awk '{print $1}')
  offset=$((checksum % 1000 + 1))
  api=$((20000 + offset)); db=$((21000 + offset)); web=$((22000 + offset)); redis=$((23000 + offset))
  object=$((24000 + offset)); console=$((25000 + offset)); otel_grpc=$((26000 + offset))
  otel_http=$((27000 + offset)); otel_metrics=$((28000 + offset)); prometheus=$((29000 + offset)); grafana=$((30000 + offset))
fi

export COMPOSE_PROJECT_NAME="$project"
export API_PORT=${API_PORT:-$api} DB_PORT=${DB_PORT:-$db} WEB_PORT=${WEB_PORT:-$web}
export REDIS_PORT=${REDIS_PORT:-$redis} OBJECT_STORAGE_PORT=${OBJECT_STORAGE_PORT:-$object}
export OBJECT_STORAGE_CONSOLE_PORT=${OBJECT_STORAGE_CONSOLE_PORT:-$console}
export OTEL_GRPC_PORT=${OTEL_GRPC_PORT:-$otel_grpc} OTEL_HTTP_PORT=${OTEL_HTTP_PORT:-$otel_http}
export OTEL_METRICS_PORT=${OTEL_METRICS_PORT:-$otel_metrics} PROMETHEUS_PORT=${PROMETHEUS_PORT:-$prometheus}
export GRAFANA_PORT=${GRAFANA_PORT:-$grafana}

if [ "${1:-}" = settings ]; then
  printf '%s\n' \
    "COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME" "WEB_PORT=$WEB_PORT" "API_PORT=$API_PORT" \
    "DB_PORT=$DB_PORT" "REDIS_PORT=$REDIS_PORT" "OBJECT_STORAGE_PORT=$OBJECT_STORAGE_PORT" \
    "OBJECT_STORAGE_CONSOLE_PORT=$OBJECT_STORAGE_CONSOLE_PORT" "OTEL_GRPC_PORT=$OTEL_GRPC_PORT" \
    "OTEL_HTTP_PORT=$OTEL_HTTP_PORT" "OTEL_METRICS_PORT=$OTEL_METRICS_PORT" \
    "PROMETHEUS_PORT=$PROMETHEUS_PORT" "GRAFANA_PORT=$GRAFANA_PORT"
  exit 0
fi

exec docker compose "$@"
