status: CLAIMED
 task: B-001 Coolify development deployment evidence
owner: platform
references: backlog B-001; US-0102–US-0107; roadmap Poort B
files_changed: only new timestamped team evidence/handoff/inbox files; no product, manifest, backlog or roadmap edits
commands_run: read required task docs and scripts; narrow platform contracts, typecheck, standard and full synthetic smoke tests; local Compose, health/readiness, migration dry-run, backup/restore, metrics/log scan and external availability checks. Full exact outputs and failures at `.hermes/team/evidence/20261017T200652Z-platform-B-001.md`.
tests: narrow contracts 16/16; typecheck pass; `npm test` 98 pass/70 skipped; `STACK_SMOKE=1 npm test` 168 pass/1 fail (missing B-004 file).
evidence: `.hermes/team/evidence/20261017T200652Z-platform-B-001.md`
blockers: no .git/source SHA; GitHub repository and Actions API calls returned 404; Coolify hostname DNS unavailable; no remote build/digest/SBOM/deploy evidence; no prior release suitable for rollback rehearsal.
next_agent: qa
next_action: review local evidence, then report to orchestrator; external B-001 remains open/blocked
 timestamp: 20261017T200652Z