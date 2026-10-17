#!/usr/bin/env sh
set -eu
echo "pre-deploy: verify backup point and migration compatibility"
test -n "$APP_RELEASE" || { echo "APP_RELEASE is required"; exit 1; }
test -n "${APP_COMMIT_SHA:-}" || { echo "APP_COMMIT_SHA is required"; exit 1; }
test -n "${APP_IMAGE_DIGEST:-}" || { echo "APP_IMAGE_DIGEST is required"; exit 1; }
test -n "${APP_MIGRATION_VERSION:-}" || { echo "APP_MIGRATION_VERSION is required"; exit 1; }
