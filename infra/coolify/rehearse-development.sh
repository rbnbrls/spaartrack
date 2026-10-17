#!/usr/bin/env sh
set -eu

: "${COOLIFY_COMMIT_SHA:?COOLIFY_COMMIT_SHA is required}"
: "${COOLIFY_IMAGE_DIGEST:?COOLIFY_IMAGE_DIGEST is required}"
: "${COOLIFY_MIGRATION_VERSION:?COOLIFY_MIGRATION_VERSION is required}"

export APP_ENV=development
export APP_RELEASE=development
export APP_COMMIT_SHA="$COOLIFY_COMMIT_SHA"
export APP_IMAGE_DIGEST="$COOLIFY_IMAGE_DIGEST"
export APP_MIGRATION_VERSION="$COOLIFY_MIGRATION_VERSION"
export APP_DEPLOYED_AT="${APP_DEPLOYED_AT:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

docker compose up -d --build
curl --fail --silent http://localhost:18080/health/ready >/dev/null
release_record="$(curl --fail --silent http://localhost:18080/api/v1/release)"

printf '%s' "$release_record" | grep -F "\"commit_sha\":\"$COOLIFY_COMMIT_SHA\"" >/dev/null
printf '%s' "$release_record" | grep -F "\"image_digest\":\"$COOLIFY_IMAGE_DIGEST\"" >/dev/null
printf '%s' "$release_record" | grep -F "\"migration_version\":\"$COOLIFY_MIGRATION_VERSION\"" >/dev/null
printf '%s\n' "$release_record"
