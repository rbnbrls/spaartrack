#!/usr/bin/env sh
set -eu
test -n "${STORY_ID:-}" || { echo "STORY_ID is required"; exit 1; }
test -f roadmap.md
test -f test-cases.md
echo "readiness inputs present for ${STORY_ID}"
