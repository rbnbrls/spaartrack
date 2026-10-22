#!/usr/bin/env bash
# Remove selected files from one synthetic task worktree.
# Bash 3.2 compatibility: do not expand an empty array under set -u.
set -euo pipefail

usage() {
  printf 'usage: %s [--apply] TASK_WORKTREE [PATH ...]\n' "$(basename "$0")" >&2
  printf 'default mode is dry-run; --apply is required for deletion\n' >&2
}

apply=0
if [ "$#" -gt 0 ] && [ "$1" = "--apply" ]; then
  apply=1
  shift
fi
if [ "$#" -lt 1 ]; then
  usage
  exit 2
fi

task_root="$1"
shift
if [ ! -d "$task_root" ]; then
  printf 'cleanup: task worktree does not exist: %s\n' "$task_root" >&2
  exit 2
fi
task_root="$(cd "$task_root" && pwd -P)"
task_name="$(basename "$task_root")"
case "$task_name" in
  t_[A-Za-z0-9]*|task-[A-Za-z0-9]*) ;;
  *) printf 'cleanup: refusing non-task worktree: %s\n' "$task_root" >&2; exit 2 ;;
esac

# Keep durable agent handoffs/evidence/status/inbox outside this helper's scope.
is_protected() {
  case "$1" in
    */.hermes/team/handoffs|*/.hermes/team/handoffs/*|*/.hermes/team/evidence|*/.hermes/team/evidence/*|*/.hermes/team/status|*/.hermes/team/status/*|*/.hermes/team/inbox|*/.hermes/team/inbox/*) return 0 ;;
    *) return 1 ;;
  esac
}

path_count="$#"
paths=("$@")
index=1
while [ "$index" -le "$path_count" ]; do
  # Indexed access works on Bash 3.2 even when the path array is empty.
  requested="${paths[$((index - 1))]}"
  case "$requested" in
    ..|../*|*/../*|*/..) printf 'cleanup: refusing parent traversal: %s\n' "$requested" >&2; exit 2 ;;
  esac
  case "$requested" in
    /*) candidate="$requested" ;;
    *) candidate="$task_root/$requested" ;;
  esac

  case "$candidate" in
    "$task_root"|"$task_root"/*) ;;
    *) printf 'cleanup: refusing path outside task worktree: %s\n' "$requested" >&2; exit 2 ;;
  esac
  candidate="$(printf '%s' "$candidate" | sed 's#//*#/#g')"
  if is_protected "$candidate"; then
    printf 'cleanup: refusing protected durable path: %s\n' "$requested" >&2
    exit 2
  fi

  if [ "$apply" -eq 1 ]; then
    if [ -e "$candidate" ] || [ -L "$candidate" ]; then
      printf 'cleanup: deleting %s\n' "$candidate"
      rm -rf "$candidate"
    else
      printf 'cleanup: absent %s\n' "$candidate"
    fi
  else
    printf 'cleanup: dry-run would delete %s\n' "$candidate"
  fi
  index=$((index + 1))
done

if [ "$apply" -eq 0 ]; then
  printf 'cleanup: dry-run (pass --apply to delete)\n'
fi
