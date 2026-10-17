#!/usr/bin/env sh
set -eu

: "${DEVELOPMENT_DIGEST:?DEVELOPMENT_DIGEST is required}"
: "${PRODUCTION_DIGEST:?PRODUCTION_DIGEST is required}"

if [ "$DEVELOPMENT_DIGEST" != "$PRODUCTION_DIGEST" ]; then
  echo "promotion refused: development and production digests do not match" >&2
  exit 1
fi

case "$DEVELOPMENT_DIGEST" in
  sha256:*) : ;;
  *) echo "promotion refused: digest must use sha256" >&2; exit 1 ;;
esac

printf '%s\n' "promotion approved for $DEVELOPMENT_DIGEST"
