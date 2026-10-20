#!/usr/bin/env bash
#
# worktree-bootstrap.sh — make an isolated git worktree self-sufficient for the
# lint/typecheck gate (US-0004 tooling, US-0103 dev release path).
#
# WHY THIS EXISTS
#
# `git worktree add` produces a checkout WITHOUT node_modules/ (it is gitignored,
# .gitignore:5). This repo is a pnpm workspace: `pg` and `@types/pg` are declared
# by apps/api/package.json, so under the isolated pnpm layout they live in
# apps/api/node_modules/ and NOT in the root node_modules/.
#
# A worktree without that link reports a FALSE RED gate:
#
#   apps/api/src/index.ts(5,22): error TS2307: Cannot find module 'pg' or its
#                                corresponding type declarations.
#   apps/api/src/index.ts(1996,45): error TS7006: Parameter 'candidate' implicitly
#                                has an 'any' type.
#   ... 75x TS7006, 4x TS2339, 3x TS2345, 4x TS2307   (86 error lines)
#
# The TS2307 on 'pg' CASCADES: without the pg types every `pool.query` callback
# parameter loses its inferred type and degrades to `implicitly any`. Those 86
# error lines are ONE missing dependency link, not 86 source defects.
#
# A bare worktree has a second trap: with no node_modules, `pnpm typecheck`
# resolves `tsc` from whatever is on PATH — which may be a globally installed,
# unpinned compiler instead of the workspace-pinned typescript. The reported
# compiler version makes that attributable.
#
# WHAT THIS SCRIPT DOES
#
# It provisions the target worktree with the SAME command CI runs
# (pnpm install --frozen-lockfile, .github/workflows/ci.yml:49), so the worktree
# resolves the exact same dependency graph the release gate resolves.
#
# It deliberately does NOT symlink the primary checkout's node_modules into the
# worktree. A whole-directory symlink is a trap: running `pnpm install` in a
# symlinked worktree makes pnpm rewrite the SHARED target in place, which
# mutates the primary checkout (it repoints `typescript` at ../<worktree>/...).
# An isolated `pnpm install --frozen-lockfile` instead clones the packages from
# the shared pnpm store, leaves the primary byte-identical, and costs ~0.4s.
#
# USAGE
#
#   scripts/dev/worktree-bootstrap.sh                 # provision this worktree
#   scripts/dev/worktree-bootstrap.sh <worktree-dir>  # provision another worktree
#   scripts/dev/worktree-bootstrap.sh --check [dir]   # report state, change nothing
#   scripts/dev/worktree-bootstrap.sh --verify [dir]  # provision + run the typecheck gate
#
# With no explicit target, the helper provisions THE WORKTREE IT LIVES IN — not
# the caller's working directory. Run it from the worktree root, or pass the
# target explicitly.
#
# Exit codes: 0 = provisioned/healthy, 1 = failed, 2 = bad usage.

set -euo pipefail

SCRIPT_NAME="$(basename "$0")"

die() {
  printf '%s: %s\n' "$SCRIPT_NAME" "$*" >&2
  exit 1
}

usage() {
  # Print the leading comment block (the header documentation) verbatim.
  awk 'NR<3 {next} /^#/ {sub(/^# ?/, ""); print; next} {exit}' "$0"
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

MODE="provision"
TARGET=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --check) MODE="check" ;;
    --verify) MODE="verify" ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      printf '%s: unknown option %s\n' "$SCRIPT_NAME" "$1" >&2
      usage >&2
      exit 2
      ;;
    *)
      if [ -n "$TARGET" ]; then
        printf '%s: only one target directory may be given\n' "$SCRIPT_NAME" >&2
        exit 2
      fi
      TARGET="$1"
      ;;
  esac
  shift
done

# The default target is the git worktree root that CONTAINS THIS SCRIPT — not
# the caller's working directory.
#
# Defaulting to $PWD is a trap: an agent that runs the helper from a
# subdirectory, or from the primary checkout while intending to provision a
# worktree, would silently provision the WRONG tree and then be told the gate
# is green for a tree that was never provisioned. Resolving from the script's
# own location is unambiguous and matches how the helper is documented.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"

if [ -z "$TARGET" ]; then
  if ! TARGET="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null)"; then
    die "cannot resolve the worktree root from $SCRIPT_DIR (not a git repository?) — pass the target directory explicitly"
  fi
fi

if [ ! -d "$TARGET" ]; then
  die "target directory does not exist: $TARGET"
fi

TARGET="$(cd "$TARGET" && pwd -P)"

# ---------------------------------------------------------------------------
# Locate the primary checkout
#
# The primary checkout is the worktree that owns the repository's common git
# directory (.git). For a linked worktree, `git rev-parse --git-common-dir`
# resolves to the PRIMARY's .git, and its parent is the primary checkout root.
# ---------------------------------------------------------------------------

if ! git -C "$TARGET" rev-parse --git-dir >/dev/null 2>&1; then
  die "target is not a git repository: $TARGET"
fi

COMMON_GIT_DIR="$(git -C "$TARGET" rev-parse --path-format=absolute --git-common-dir)"
PRIMARY="$(cd "$(dirname "$COMMON_GIT_DIR")" && pwd -P)"

if [ ! -d "$PRIMARY" ]; then
  die "primary checkout could not be resolved from the common git dir: $COMMON_GIT_DIR"
fi

if [ ! -f "$PRIMARY/package.json" ]; then
  die "primary checkout has no package.json (looked in $PRIMARY) — is this a spaartrack worktree?"
fi

# ---------------------------------------------------------------------------
# State inspection
# ---------------------------------------------------------------------------

# A worktree is provisioned when the root has the TypeScript toolchain AND
# apps/api has its own `pg`/`@types/pg` links. apps/api/node_modules is the
# piece that is missing in the overwhelming majority of worktrees, and it is
# the one that produces the TS2307/TS7006 cascade.
has_root_toolchain() {
  [ -d "$1/node_modules" ] && [ -x "$1/node_modules/.bin/tsc" ]
}

has_api_pg_types() {
  [ -e "$1/apps/api/node_modules/pg" ] && [ -e "$1/apps/api/node_modules/@types/pg" ]
}

is_provisioned() {
  has_root_toolchain "$1" && has_api_pg_types "$1"
}

# The compiler that `pnpm typecheck` will actually use.
#
# In a worktree WITHOUT node_modules, `pnpm typecheck` resolves `tsc` from
# whatever happens to be on PATH. On a developer machine that can be a
# globally installed, unpinned compiler instead of the workspace-pinned one
# (observed: tsc 6.0.3 from an unrelated toolchain, against the pinned
# typescript 5.7). A RED result is then attributable to a compiler swap
# rather than to the source — so the version is always reported.
report_compiler() {
  local dir="$1"
  local version pinned
  if [ -x "$dir/node_modules/.bin/tsc" ]; then
    version="$("$dir/node_modules/.bin/tsc" --version 2>/dev/null | head -1)"
  else
    version="(none — node_modules/.bin/tsc is missing)"
  fi
  printf 'typescript         : %s\n' "${version:-unknown}"
  pinned="$(grep -m1 '"typescript"' "$dir/package.json" 2>/dev/null | sed 's/.*: *"\{0,1\}\([^",]*\).*/\1/')"
  if [ -n "$pinned" ]; then
    printf 'pinned typescript  : %s\n' "$pinned"
  fi
}

report_state() {
  local dir="$1"
  printf 'worktree           : %s\n' "$dir"
  printf 'primary checkout   : %s\n' "$PRIMARY"
  if has_root_toolchain "$dir"; then
    printf 'root node_modules  : present (tsc resolvable)\n'
  else
    printf 'root node_modules  : MISSING (tsc not resolvable)\n'
  fi
  if has_api_pg_types "$dir"; then
    printf 'apps/api pg types  : present\n'
  else
    printf 'apps/api pg types  : MISSING (TS2307/TS7006 cascade expected)\n'
  fi
  report_compiler "$dir"
  if is_provisioned "$dir"; then
    printf 'gate status        : PROVISIONED (typecheck reflects the source)\n'
  else
    printf 'gate status        : NOT PROVISIONED (a RED typecheck here is a provisioning artifact, not a source defect)\n'
  fi
}

if [ "$MODE" = "check" ]; then
  report_state "$TARGET"
  if is_provisioned "$TARGET"; then
    exit 0
  fi
  exit 1
fi

# ---------------------------------------------------------------------------
# Provision
# ---------------------------------------------------------------------------

if is_provisioned "$TARGET"; then
  printf '%s: already provisioned, nothing to do: %s\n' "$SCRIPT_NAME" "$TARGET"
  report_state "$TARGET"
  if [ "$MODE" = "verify" ]; then
    printf '%s: running the typecheck gate\n' "$SCRIPT_NAME"
    ( cd "$TARGET" && pnpm typecheck )
    printf '%s: typecheck gate is GREEN\n' "$SCRIPT_NAME"
  fi
  exit 0
fi

if ! command -v pnpm >/dev/null 2>&1; then
  die "pnpm is not on PATH — install the pinned packageManager from package.json first"
fi

printf '%s: provisioning %s\n' "$SCRIPT_NAME" "$TARGET"
printf '%s: primary checkout (must stay untouched): %s\n' "$SCRIPT_NAME" "$PRIMARY"

# Fingerprint the primary checkout's dependency trees so we can PROVE the
# primary was not mutated by this run.
#
# BOTH trees must be covered:
#   $PRIMARY/node_modules            — the root toolchain (typescript, @types/node)
#   $PRIMARY/apps/api/node_modules  — the `pg` / `@types/pg` links
#
# apps/api/node_modules is a SIBLING of the root node_modules, not a
# subdirectory of it, and it holds precisely the links this card is about.
# Fingerprinting only the root would leave the `pg` link unguarded: repointing
# apps/api/node_modules/pg leaves every file under the root node_modules
# byte-identical, so the root fingerprint would still report "unchanged".
#
# pnpm materialises its dependency graph as SYMLINKS:
#   node_modules/.pnpm/pg@8.23.1/node_modules/pg
#   node_modules/typescript -> .pnpm/typescript@5.7.3/node_modules/typescript
#   apps/api/node_modules/pg -> ../../../node_modules/.pnpm/pg@8.23.1/...
#
# A pnpm run that REPOINTS one of those links mutates the primary checkout's
# dependency graph while leaving every regular file byte-identical. A
# fingerprint built from `find -type f` alone is therefore blind to exactly the
# mutation this guard exists to detect — so both regular files AND symlink
# entries (with their resolved targets) are included.
#
# Portable across macOS (BSD find/shasum) and Linux (GNU find/sha256sum), since
# the same helper is expected to run in CI images too.
fingerprint_dir() {
  local dir="$1"
  if [ ! -d "$dir" ]; then
    printf 'ABSENT\n'
    return 0
  fi
  # `ls -ld` prints the link target for symlinks ("path -> target"), so it
  # captures a retarget that a plain file listing would miss. `ls -ld` is
  # portable across BSD and GNU coreutils alike.
  local listing
  listing="$(find "$dir" \( -type f -o -type l \) -exec ls -ld {} + 2>/dev/null | LC_ALL=C sort)"
  if command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "$listing" | sha256sum | cut -d' ' -f1
  else
    printf '%s' "$listing" | shasum -a 256 | cut -d' ' -f1
  fi
}

# The full provenance fingerprint of the primary checkout: every dependency
# tree that a pnpm run in another worktree could plausibly repoint.
#
# The two per-tree hashes are captured into variables FIRST: nesting the
# substitutions directly inside `printf` would swallow a non-zero exit from
# either fingerprint, and a guard that cannot fail is not a guard.
fingerprint_primary() {
  local root_hash api_hash
  root_hash="$(fingerprint_dir "$PRIMARY/node_modules")"
  api_hash="$(fingerprint_dir "$PRIMARY/apps/api/node_modules")"
  if [ -z "$root_hash" ] || [ -z "$api_hash" ]; then
    die "could not fingerprint the primary checkout's node_modules (root='$root_hash' api='$api_hash')"
  fi
  printf '%s %s' "$root_hash" "$api_hash"
}

# The provenance guard only makes sense when the target is NOT the primary: when
# the operator points the helper at the primary checkout itself, installing there
# is the whole point.
TARGET_IS_PRIMARY=0
if [ "$TARGET" = "$PRIMARY" ]; then
  TARGET_IS_PRIMARY=1
fi

PRIMARY_FINGERPRINT_BEFORE=""
PRIMARY_FINGERPRINT_AFTER=""
if [ "$TARGET_IS_PRIMARY" -eq 0 ]; then
  PRIMARY_FINGERPRINT_BEFORE="$(fingerprint_primary)"
fi

# The exact command CI runs. --frozen-lockfile guarantees the lockfile is never
# rewritten, so this can never commit lockfile churn.
( cd "$TARGET" && pnpm install --frozen-lockfile )

if [ "$TARGET_IS_PRIMARY" -eq 0 ]; then
  PRIMARY_FINGERPRINT_AFTER="$(fingerprint_primary)"
  if [ "$PRIMARY_FINGERPRINT_BEFORE" != "$PRIMARY_FINGERPRINT_AFTER" ]; then
    die "PROVENANCE FAILURE: the primary checkout's node_modules changed during provisioning (before=$PRIMARY_FINGERPRINT_BEFORE after=$PRIMARY_FINGERPRINT_AFTER)"
  fi
  printf '%s: primary node_modules fingerprint unchanged (%s)\n' "$SCRIPT_NAME" "$PRIMARY_FINGERPRINT_AFTER"
fi

if ! is_provisioned "$TARGET"; then
  report_state "$TARGET"
  die "provisioning did not produce a resolvable typecheck toolchain"
fi

printf '%s: provisioned\n' "$SCRIPT_NAME"
report_state "$TARGET"

# ---------------------------------------------------------------------------
# Optional: run the real gate so the operator sees the gate result, not a
# provisioning guess.
# ---------------------------------------------------------------------------

if [ "$MODE" = "verify" ]; then
  printf '%s: running the typecheck gate\n' "$SCRIPT_NAME"
  ( cd "$TARGET" && pnpm typecheck )
  printf '%s: typecheck gate is GREEN\n' "$SCRIPT_NAME"
fi
