# Spaartrack Agent Backlog

This is the shared work queue for the Hermes Spaartrack team. The roadmap remains the product and dependency source of truth; this file is the operational queue.

## Completion policy

- Full project completion means every one of the 133 roadmap parent stories and all linked atomic tests/subtasks have current implementation and verification evidence; the local/development/production release gates applicable to the target deployment are green; the final full regression passes; and the board has no open, review, blocked, failed, or unresolved incident work.
- Never interpret `79/133` or `168/168` as project completion: those numbers describe the historical local baseline and its then-current regression run, not the remaining roadmap scope or current machine state.
- Never promise zero incidents. Detect, record, triage, and resolve issues; stop unsafe promotions and clearly expose external access or human approval requirements.
- Keep all roadmap items visible as parent cards or as an auditable linked 133-story tracker with bounded implementation child tasks. Reconcile it after every wave and never silently drop or reclassify a feature.

## Operating rules

- Work in dependency order and by wave; do not jump over a red gate.
- Every task has one owner, one bounded context, one gate, and linked `US-*`/`TC-US-*` references.
- Start implementation with a failing test or a new child test.
- Use synthetic data only. Never commit provider, bank, model, or production credentials.
- The canonical ledger is the only financial write boundary. Use application commands/services; corrections use VOID/correction and audit.
- Agents communicate through `.hermes/team/` handoff files. Write updates atomically as new timestamped entries; do not overwrite another agent's notes.
- A task is not Done until tests, evidence, observability/audit, migration review, and the relevant release gate are recorded.

## Current state

Observed 20 October 2026, ~19:40 CEST by the supervisor run (independent QA audit `t_6af8af27` + orchestrator re-measurement on HEAD `ec0bc1b`).

- **Never interpret `79/133` or `168/168` as project completion.** Those are historical figures from an old baseline; the current audited position is below.
- **Story classification (independent QA audit `t_6af8af27`, 133 roadmap parent stories, HEAD `7df0abc`):** **109 VERIFIED / 24 PARTIAL / 0 MISSING / 0 FAILED.** PARTIAL means the acceptance evidence is a *static marker assertion*, never a behavioural test: `US-0001`–`US-0005`, `US-0101`, `US-0103`, `US-0104`, `US-0107`, `US-0501`–`US-0505`, `US-1106`, `US-1107`, `US-1201`–`US-1205`, `US-1207`, `US-1208`, `US-1604`. The "133/133 Done" claim is therefore **too strong**; the roadmap leading status is being corrected under `t_509568fe`.
- **Regression gate on HEAD `ec0bc1b` (orchestrator re-measurement):** **621 tests / 468 pass / 7 fail / 146 skipped**, exit 1. The 7 failures are **not** product defects — they are a shared-stack collision: the `spaartrack` Compose project is currently running from a card worktree on non-canonical ports (api `18095`, db `55455`, web `30055` instead of `18080`/`55432`/`3000`), so `TC-US-0105-A/B`, `TC-US-0106-A` (3) and the 4 `TC-US-0206` privacy-sql tests fail on connection, not on behaviour. Root cause and fix are card `t_c3c9c910`.
- **Last measured green stack gate** (QA audit, HEAD `7df0abc`): **602 tests / 600 pass / 0 fail / 2 skipped**; default gate **602 / 459 / 0 / 143**; `tsc --noEmit` exit 0; `docker compose config` exit 0 with `SYNTHETIC_FIXTURE_KEY: ""` (fail-closed, per the security ruling `t_06c724c0`).
- **Poort A:** local vertical slice is the baseline; the gate is currently red for the infrastructure reason above, not a story gap.
- **Poort B:** Coolify development deployment, remote CI run, registry promotion and deployment evidence remain open (`US-0102`/`0103`/`0104`). `ci.yml` still has **no** `STACK_SMOKE` (105 of 109 behavioural stories are therefore stack-gated-only and run in neither the default gate nor CI); the `ci.yml` union landing `t_8c391f00` is gated on `t_dc3e1f5b` (container scan, running).
- **Poort C:** blocked by design — production auth, recovery/restore and human release approval are absent.
- **CI-gate gaps (from the audit):** G4 runtime suite not in CI; G6 SAST + container scan missing; G7 7× route-level `CREATE TABLE`; G9 traceability gate proves string presence; G10 roadmap status stale; G11 release identity unbound (`commit_sha=local`); G12 schema drift; G13 restore evidence predates the current schema; G14 local `.env` requirement undocumented.
- **Release gate is now structurally enforced (card `t_1520d8ac`, 20 oktober 2026).** `main` carries branch protection requiring exactly five status checks — `verify`, `security`, `image (api)`, `image (web)`, `image (worker)` — plus `required_linear_history`, `dismiss_stale_reviews` and `enforce_admins`. `infra/policies/release-policy.yaml` is reconciled with that set: the checks that are *enforced* are listed under `requiredChecks`/`enforcedGateCoverage`, and the gates that are **aspirational but not enforced** (financial-golden, integration-contract, e2e, migration-dry-run, restore-replay, staging-smoke, health-window, SAST, container-scan) are listed explicitly under `aspirationalChecks` with an owner. A gate is only a gate when a required check actually fails when it is violated — the remaining aspirational gates are **not** release gates yet.
- **Consequence for the pending push of `main` (human-owner action, verified empirically 20 oktober 2026).** The unpublished `main` is **35 commits ahead** of `origin/main` and that range contains **two merge commits** (`95e0e04`, `9bd8862`). Both rules below were proven on throwaway branches, not assumed: (1) `required_linear_history` rejects any push that introduces a merge commit (`GH006` — "This branch must not contain merge commits"); (2) a push onto a branch with required status checks is rejected until those checks have reported on the pushed commits (`GH006` — "5 of 5 required status checks are expected"). A plain `git push origin main` of the current `main` will therefore be **refused**. The merge commits must be squashed or rebased away first, and the five checks must have run green on the resulting head — which means a **pull request** is now the required path onto `main`, not a direct push.
- No real provider or bank data is allowed in this phase. No release readiness is claimed.

## Active queue — Wave B / Poort B first

### B-001 — Coolify development deployment evidence
- Owner: `platform`
- Support: `orchestrator`, `qa`
- References: `US-0102`, `US-0103`, `US-0104`, `US-0105`, `US-0106`, `US-0107`
- Goal: close the external Coolify development and remote CI gaps using the repository's versioned manifests.
- Gate: immutable commit artifact, digest/SBOM evidence, migration/smoke/restore evidence, readiness/observability, and rollback rehearsal.
- Constraint: if external Coolify credentials or access are unavailable, create a blocked evidence report; do not invent a deployment.

### B-002 — Planning/reporting continuation
- Owner: `projections`
- Support: `calculations`, `frontend`, `qa`
- References: `US-1105`, `US-1106`, `US-1107`
- Goal: refine the next report/goal/planning stories into atomic child tasks with contracts and fixtures before implementation.
- Gate: privacy-scoped source-traceable read models and contract tests; no direct ledger writes.

### B-003 — Security and production-readiness review
- Owner: `security`
- Support: `platform`, `qa`, `architecture`
- References: roadmap Poort C and security gates.
- Goal: review the current local baseline for tenant isolation, secret references, audit, restore, and approval boundaries; create blocked findings or test-first fixes.
- Gate: no unclassified blocker before production work is opened.

### B-004 — Contract and backlog refinement
- Owner: `architecture`
- Support: `orchestrator`, `qa`
- References: roadmap Wave 0, dependency sequence, Definition of Ready/Done.
- Goal: turn the remaining 54 parent stories into bounded, dependency-ordered atomic backlog entries and identify missing contract tests/fixtures.
- Gate: every active backlog item has owner, dependency, test, fixture, non-goals, and exit criterion.

### B-005 — Independent regression verification
- Owner: `qa`
- Support: all active owners
- References: all current gates.
- Goal: run the documented local checks, verify the current evidence, and record exact failures or green results in `.hermes/team/evidence/`.
- Gate: exact command output and no fabricated or historical evidence presented as current.

## Later queue — blocked until Poort B and upstream contracts are green

- Money Flow extensions and personal-finance planning beyond US-0910.
- Bank connectivity beyond the local synthetic gate.
- Advanced analytics and decisions: US-1201–US-1208.
- Tax intelligence: US-1301–US-1307.
- Specialist instruments: US-1401–US-1408.
- Sharing and clients: US-1501–US-1506.
- AI, MCP, addons, and controlled actions: US-1601–US-1608.
- Autonomous operations: US-1701–US-1709.

## Handoff format

Each agent writes a new file under `.hermes/team/handoffs/` named `<timestamp>-<agent>-<task>.md` containing:

1. Task and current status (`READY`, `CLAIMED`, `BLOCKED`, `DONE`).
2. Files changed or explicitly `none`.
3. Commands/tests actually run and results.
4. Evidence paths and trace/correlation IDs where applicable.
5. Risks, blockers, and the next agent/action.
6. Exact backlog item to update or hand off.

The orchestrator is the only agent that changes ownership/status in this file after reading the handoff evidence.
