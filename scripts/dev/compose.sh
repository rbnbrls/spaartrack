#!/bin/sh
set -eu

# Run Compose with a checkout-scoped project and deterministic host ports.
# The primary checkout keeps the published ports; worktrees use a path hash.
root=${COMPOSE_WORKTREE_ROOT:-$(pwd -P)}
if [ -d "$root" ]; then
  root_real=$(cd "$root" && pwd -P)
else
  # Contract tests use disposable, non-existent fixture paths.
  root_real=$root
fi

primary=0
if [ -d "$root" ] && git -C "$root" rev-parse --git-common-dir >/dev/null 2>&1; then
  common_dir=$(git -C "$root" rev-parse --git-common-dir)
  case "$common_dir" in
    /*) ;;
    *) common_dir=$root/$common_dir ;;
  esac
  common_parent=$(dirname "$common_dir")
  [ -d "$common_parent" ] && common_parent=$(cd "$common_parent" && pwd -P)
  [ "$common_parent" = "$root_real" ] && primary=1
elif [ "$(basename "$root_real")" = spaartrack ]; then
  # Non-git fixture fallback; real checkouts are classified by git above.
  primary=1
fi

digest=$(printf '%s' "$root_real" | shasum -a 256 | awk '{print $1}')
short_digest=$(printf '%.12s' "$digest")
if [ "$primary" -eq 1 ]; then
  derived_project=spaartrack
else
  derived_project=spaartrack-wt-$short_digest
fi
project=${COMPOSE_PROJECT_NAME:-$derived_project}
project=$(printf '%s' "$project" | tr '[:upper:]_' '[:lower:]-' | tr -cd 'a-z0-9-')
[ -n "$project" ] || project=spaartrack

if [ "$primary" -eq 1 ]; then
  api=18080; db=55432; web=3000; redis=6379; object=19000; console=19001
  otel_grpc=4317; otel_http=4318; otel_metrics=8889; prometheus=9090; grafana=3001
else
  digest_number=$(printf '%d' "0x$(printf '%.8s' "$digest")")
  offset=$((digest_number % 1000 + 1))
  api=$((20000 + offset)); db=$((21000 + offset)); web=$((22000 + offset)); redis=$((23000 + offset))
  object=$((24000 + offset)); console=$((25000 + offset)); otel_grpc=$((26000 + offset))
  otel_http=$((27000 + offset)); otel_metrics=$((28000 + offset)); prometheus=$((29000 + offset)); grafana=$((30000 + offset))
  for derived_port in "$api" "$db" "$web" "$redis" "$object" "$console" "$otel_grpc" "$otel_http" "$otel_metrics" "$prometheus" "$grafana"; do
    case "$derived_port" in
      18080|55432|3000|6379|19000|19001|4317|4318|8889|9090|3001) exit 1 ;;
    esac
  done
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
