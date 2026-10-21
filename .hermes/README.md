# Hermes project contract

Deze map bevat de lokale Hermes-agentcontracten uit roadmap.md. Agents leveren versioned artefacts via issues, PR's, testreports, release candidates en incident records.

Autonomiegrenzen:

- read: repository, sanitized diagnostics, logs, traces, metrics;
- propose: issue, patch, test, migration plan, alert tuning;
- execute-sandbox: branch, preview, staging en fake providers;
- execute-production-safe: beperkte allowlisted acties;
- execute-production-change: alleen Release Agent via policy en health gates.

Geen agent krijgt raw secrets, arbitrary production SQL of directe ledger-write toegang.

## Pull-request merge automation

`.github/workflows/hermes-automerge.yml` is the merge boundary for the Hermes
Bots team. It runs as `pull_request_target` without checking out or executing
pull-request code, accepts only non-draft same-repository PRs targeting `main`,
and allowlists the repository owner plus optional usernames in the repository
variable `HERMES_AUTOMERGE_ACTORS` (comma-separated). For an accepted PR it
queues GitHub native squash auto-merge; required branch-protection checks remain
the final gate. Forks, drafts, non-`main` PRs, and non-clean merge states are
left untouched.

Repository settings must keep **Allow auto-merge** enabled and branch
protection must require the full CI gate. The workflow does not bypass failed,
pending, or stale required checks and does not use a personal access token.
