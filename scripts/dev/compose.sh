#!/usr/bin/env sh
set -eu

# Keep explicit release identity supplied by rehearsal/CI callers. For local
# Compose, bind the commit to this checkout and leave the image unbound unless
# the caller supplies a verified digest from a local image.
if [ -n "${APP_COMMIT_SHA:-}" ]; then
  commit_sha="$APP_COMMIT_SHA"
elif commit_sha="$(git rev-parse --verify HEAD 2>/dev/null)"; then
  :
elif [ "${APP_COMMIT_SHA+x}" = x ]; then
  commit_sha="$APP_COMMIT_SHA"
else
  commit_sha=local
fi

image_digest="${APP_IMAGE_DIGEST:-local}"
export APP_COMMIT_SHA="$commit_sha"
export APP_IMAGE_DIGEST="$image_digest"

exec docker compose "$@"
