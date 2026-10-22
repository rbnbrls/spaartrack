#!/usr/bin/env sh
set -eu

# release-gate.sh — deploy claim gate for spaartrack
# Usage: release-gate.sh --sha <commit-sha> [--execute] [--strategy <squash|rebase|merge>] [--target devtest]
#   --sha: commit SHA to deploy/claim (required)
#   --execute: actually claim deploy success (default: dry-run; refuses to claim without credentials)
#   --strategy: merge strategy when linear history is enabled (required if required_linear_history=true)
#   --target: devtest (default) | production (refused)
# Exit codes: 0 = PASS (dry-run or executed), 1 = FAIL, 2 = usage error

REPO="rbnbrls/spaartrack"
SCRIPT_NAME="$(basename "$0")"

usage() {
  printf 'Usage: %s --sha <commit-sha> [--execute] [--strategy <squash|rebase|merge>] [--target devtest]\n' "$SCRIPT_NAME" >&2
  exit 2
}

log() { printf '[%s] %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; }
pass() { printf '  PASS: %s\n' "$1"; }
fail() { printf '  FAIL: %s\n' "$1"; }
warn() { printf '  WARN: %s\n' "$1"; }

SHA=""
EXECUTE=false
STRATEGY=""
TARGET="devtest"

while [ $# -gt 0 ]; do
  case "$1" in
    --sha) SHA="$2"; shift 2 ;;
    --execute) EXECUTE=true; shift ;;
    --strategy) STRATEGY="$2"; shift 2 ;;
    --target) TARGET="$2"; shift 2 ;;
    *) usage ;;
  esac
done

[ -n "$SHA" ] || { echo "error: --sha is required" >&2; usage; }

log "Release gate check for SHA: $SHA (target=$TARGET, execute=$EXECUTE)"

# --- G1: Target allowed ---
if [ "$TARGET" = "production" ]; then
  fail "production target is refused — release never deploys production"
  exit 1
fi
pass "target is devtest (production refused)"

# --- G2: Push-bound digest evidence from a green push run at this SHA ---
log "G2: verifying push-bound digest evidence at $SHA"
PUSH_RUN=$(gh run list --repo "$REPO" --event push --commit "$SHA" --limit 1 --json databaseId,conclusion,headSha --jq '.[0] | "\(.databaseId) \(.conclusion) \(.headSha)"' 2>/dev/null || echo "")
if [ -z "$PUSH_RUN" ]; then
  fail "no push-triggered CI run found for commit $SHA"
  exit 1
fi
RUN_ID=$(echo "$PUSH_RUN" | cut -d' ' -f1)
RUN_CONCLUSION=$(echo "$PUSH_RUN" | cut -d' ' -f2)
RUN_HEAD=$(echo "$PUSH_RUN" | cut -d' ' -f3)
if [ "$RUN_CONCLUSION" != "success" ]; then
  fail "push run $RUN_ID for $SHA concluded $RUN_CONCLUSION (need success)"
  exit 1
fi
if [ "$RUN_HEAD" != "$SHA" ]; then
  fail "push run $RUN_ID head SHA ($RUN_HEAD) != requested SHA ($SHA)"
  exit 1
fi
pass "push run $RUN_ID at $SHA concluded success"

# Verify required image jobs exist and succeeded in that run
for svc in api web worker; do
  JOB_CONCL=$(gh run view "$RUN_ID" --repo "$REPO" --json jobs --jq ".jobs[] | select(.name == \"image ($svc)\") | .conclusion" 2>/dev/null || echo "")
  if [ "$JOB_CONCL" != "success" ]; then
    fail "image ($svc) job in run $RUN_ID: $JOB_CONCL (need success)"
    exit 1
  fi
done
pass "all image jobs (api, web, worker) succeeded in run $RUN_ID"

# Download and verify digest evidence from artifacts
DIGESTS_TMP="$(mktemp -d)"
trap 'rm -rf "$DIGESTS_TMP"' EXIT INT TERM

for svc in api web worker; do
  gh run download "$RUN_ID" --repo "$REPO" --name "image-evidence-$RUN_ID-$svc" --dir "$DIGESTS_TMP/$svc" >/dev/null 2>&1 || {
    fail "failed to download image-evidence artifact for $svc from run $RUN_ID"
    exit 1
  }
  DIGEST_JSON="$DIGESTS_TMP/$svc/spaartrack-$svc.digest.json"
  [ -f "$DIGEST_JSON" ] || { fail "digest.json missing for $svc"; exit 1; }
  DIGEST=$(jq -r '.digest' "$DIGEST_JSON" 2>/dev/null || echo "")
  JSON_SHA=$(jq -r '.commit_sha' "$DIGEST_JSON" 2>/dev/null || echo "")
  case "$DIGEST" in sha256:*) ;; *) fail "digest for $svc is not sha256: format: $DIGEST"; exit 1 ;; esac
  [ "$JSON_SHA" = "$SHA" ] || { fail "digest commit_sha ($JSON_SHA) != requested SHA ($SHA)"; exit 1; }
  printf '  %s: %s\n' "$svc" "$DIGEST"
done
pass "push-bound digests verified for api, web, worker (sha256:, bound to $SHA)"

# --- G3: Registry credentials ---
log "G3: verifying registry credentials"
GH_SCOPES=$(gh api -i user 2>/dev/null | grep -i '^x-oauth-scopes:' | cut -d' ' -f2- | tr -d '\r' || echo "")
case "$GH_SCOPES" in
  *packages*|*write:packages*|*read:packages*) REG_SCOPE=true ;; *) REG_SCOPE=false ;;
esac
if [ "$REG_SCOPE" = true ]; then
  pass "gh token has packages scope: $GH_SCOPES"
else
  warn "gh token lacks packages scope (has: $GH_SCOPES)"
fi

# Check ghcr package existence
PKG_CHECK=$(gh api "user/packages/container/spaartrack" 2>/dev/null && echo "exists" || echo "missing")
if [ "$PKG_CHECK" = "exists" ]; then
  pass "ghcr.io/rbnbrls/spaartrack package exists"
else
  warn "ghcr.io/rbnbrls/spaartrack package does not exist (404)"
fi

# --- G4: Coolify credentials ---
log "G4: verifying Coolify credentials"
COOLIFY_TOKEN="${COOLIFY_DEPLOY_TOKEN:-}"
if [ -z "$COOLIFY_TOKEN" ] && [ -f .env ]; then
  COOLIFY_TOKEN=$(grep '^COOLIFY_DEPLOY_TOKEN=' .env 2>/dev/null | cut -d= -f2- || echo "")
fi
if [ -n "$COOLIFY_TOKEN" ] && [ "${#COOLIFY_TOKEN}" -gt 0 ]; then
  pass "COOLIFY_DEPLOY_TOKEN present (len=${#COOLIFY_TOKEN})"
  COOLIFY_CREDS=true
else
  warn "COOLIFY_DEPLOY_TOKEN absent or empty"
  COOLIFY_CREDS=false
fi

# --- G5: Merge strategy under required_linear_history ---
log "G5: checking merge strategy requirements"
BP_JSON=$(gh api repos/"$REPO"/branches/main/protection 2>/dev/null || echo "{}")
LINEAR_ENABLED=$(echo "$BP_JSON" | jq -r '.required_linear_history.enabled // false')
if [ "$LINEAR_ENABLED" = "true" ]; then
  pass "branch protection requires linear history on main"
  if [ -z "$STRATEGY" ]; then
    fail "linear history enabled — --strategy (squash|rebase) is required (no default)"
    exit 1
  fi
  case "$STRATEGY" in
    squash|rebase) pass "explicit merge strategy: $STRATEGY" ;;
    merge) fail "merge-commit strategy rejected under required_linear_history"; exit 1 ;;
    *) fail "invalid --strategy: $STRATEGY (must be squash|rebase)"; exit 1 ;;
  esac
else
  warn "linear history not required on main"
fi

# --- G6: Dry-run by default when credentials absent ---
log "G6: credential gate / dry-run decision"
CREDS_OK=false
if [ "$REG_SCOPE" = true ] && [ -n "$PKG_CHECK" ] && [ "$COOLIFY_CREDS" = true ]; then
  CREDS_OK=true
  pass "all credentials present (registry scope + package + Coolify token)"
else
  warn "credentials incomplete — dry-run mode enforced"
fi

if [ "$EXECUTE" = true ]; then
  if [ "$CREDS_OK" = true ]; then
    log "EXECUTE mode with credentials: deploy claim ALLOWED"
    printf '\nDEPLOY CLAIM SUCCESS: sha=%s run=%s target=%s strategy=%s\n' "$SHA" "$RUN_ID" "$TARGET" "${STRATEGY:-n/a}"
    exit 0
  else
    fail "EXECUTE requested but credentials incomplete — refusing deploy claim"
    exit 1
  fi
else
  log "dry-run mode (default): no deploy claim made"
  printf '\nDRY-RUN: sha=%s run=%s target=%s strategy=%s creds_ok=%s\n' "$SHA" "$RUN_ID" "$TARGET" "${STRATEGY:-n/a}" "$CREDS_OK"
  exit 0
fi