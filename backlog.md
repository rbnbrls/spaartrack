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

- Local MacBook release: roadmap records 79/133 parent stories realized.
- Local regression: roadmap records 168/168 smoke tests green at the latest status entry.
- Poort A: local vertical slice is the current baseline.
- Poort B: Coolify development deployment, remote CI run, registry promotion, and deployment evidence remain open.
- No real provider or bank data is allowed in this phase.

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
