# Spaartrack Product Backlog

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

## Product-manager refinement from `docs/backlog`

This section consolidates the feature- and story-bearing backlog artifacts under
`docs/backlog`. `roadmap.md` remains the canonical source for the full product
narrative and parent-story acceptance criteria; this file is the execution
backlog. Evidence reports are not treated as completed product work: a story is
releasable only when its linked `TC-US-*` test and applicable gate are green on
the current branch.

### Prioritisation and sequencing

| Priority | Delivery slice | Decision rule |
|---|---|---|
| P0 | W0 contracts, ledger invariants, privacy/security, release gates | Must close before downstream implementation or release claims. |
| P1 | Goals, forecasts and scoped sharing (`US-1105`–`US-1107`) | First downstream value slice after W0 and upstream read-model contracts. |
| P2 | Analytics and decision support (`US-1201`–`US-1208`) | Read-only, versioned and reproducible; no implicit trade execution. |
| P2 | Tax intelligence (`US-1301`–`US-1307`) | Jurisdiction- and owner-scoped; never general tax advice. |
| P3 | Bonds, options and retirement scenarios (`US-1401`–`US-1408`) | Separate specialist contexts; ledger changes require architecture review. |
| P3 | Sharing, PWA and offline client (`US-1501`–`US-1506`) | Privacy-by-construction; restricted responses omit monetary values server-side. |
| P4 | AI, addons and controlled actions (`US-1601`–`US-1608`) | Read-only first; explicit confirmation, scopes, audit and reversible commands. |
| P4 | Autonomous operations (`US-1701`–`US-1709`) | Last; evidence-driven and never self-activating or production-mutating. |

Status policy: `BLOCKED` means an upstream gate or external evidence is open;
`READY` means contract, owner, dependency, fixture and test are named; `DONE`
requires current implementation and verification evidence. Epic parents remain
traceability gates; atomic rows are the executable work items.

### P0 — W0 architecture, financial and security contracts

| Story | Parent | Owner | Test | Refined outcome |
|---|---|---|---|---|
| US-0001-A | US-0001 | architecture | TC-US-0001-A | Ledger command inputs/outputs, invariants, audit, events and forbidden writes are explicit and ADR-0002-consistent. |
| US-0001-B | US-0001 | architecture | TC-US-0001-B | Provider port, normalization/review boundary, idempotency and failure semantics are explicit; adapters cannot write the ledger. |
| US-0001-C | US-0001 | architecture | TC-US-0001-C | Portfolio, performance, Money Flow and reporting read-model ownership, service boundaries and events are mapped; reads cannot mutate the ledger. |
| US-0002-A | US-0002 | architecture + QA | TC-US-0002-A | Executable cash/quantity matrix covers buy, sell, deposit, withdrawal, split, signs, currency, precision and insufficient/negative state. |
| US-0002-B | US-0002 | architecture + calculations | TC-US-0002-B | Partial-sale cost allocation, fees/taxes, price-vs-FX P&L, rounding and calculation versions are unambiguous and executable. |
| US-0002-C | US-0002 | architecture + ledger | TC-US-0002-C | Transfer neutrality, duplicate conflict/idempotent replay, correction/VOID, deterministic replay and restore equality are asserted. |
| US-0003-A | US-0003 | security | TC-US-0003-A | User, account, activity, raw-payload and log fields have classification, least-privilege access, masking and audit rules. |
| US-0003-B | US-0003 | security | TC-US-0003-B | Each data class has retention/deletion ownership, backup/restore treatment and legal-hold/soft-delete boundaries. |
| US-0004 | US-0004 | architecture | TC-US-0004 | Repository conventions, PR/branch/commit rules and Ready/Done gates are versioned and consistent. |
| US-0005 | US-0005 | security | TC-US-0005 | Threat model covers assets, trust boundaries and mitigations for auth, provider egress, AI/actions, deployment and restore. |

P0 exit: W0 contracts reviewed, RED-first tests are green, synthetic
`ENV-001`, `SEC-001`, `LEDGER-001`, `CALC-001` and `UI-001` packs are versioned,
and every story maps to owner, module, test and exit criterion. The evidence
files record W0-2 as RED/BLOCKED until unresolved ledger policy decisions and
clean-schema/runtime evidence are closed.

### P1 — Goals, forecasting and scoped access

| Story | Parent | Owner | Test | Refined outcome |
|---|---|---|---|---|
| US-1105-A | US-1105 | reports | TC-US-1105-A | Goal funding shares validate account scope, currency, duplicates and aggregate <=100%; over-allocation rejects atomically. |
| US-1105-B | US-1105 | reports | TC-US-1105-B | Goal balance is reproducible from authorized projections; hidden/unlinked accounts are excluded and source/as-of/version are shown. |
| US-1106-A | US-1106 | reports | TC-US-1106-A | Scheduled-only forecasts define recurrence, cancellation, currency, due dates, horizon and as-of assumptions deterministically. |
| US-1106-B | US-1106 | reports | TC-US-1106-B | Budget-only and combined forecasts identify inputs/versions and never double-count schedules. |
| US-1107 | US-1107 | security | TC-US-1107 | Sharing uses least privilege, expiry, immediate revoke, audit actor/time/correlation and denial after revoke. |

### P2 — Analytics, decisions, tax and reporting intelligence

| Story | Parent | Owner | Test | Refined outcome |
|---|---|---|---|---|
| US-1201-A | US-1201 | analytics | TC-US-1201-A | Volatility/drawdown expose period, observations, missing-data policy, annualization and calculation version. |
| US-1201-B | US-1201 | analytics | TC-US-1201-B | Beta/Sharpe/Sortino expose benchmark/risk-free source, frequency, annualization and limitations. |
| US-1202 | US-1202 | analytics | TC-US-1202 | Holding/category contributions sum under the declared methodology with explicit residual/missing-data handling. |
| US-1203 | US-1203 | analytics | TC-US-1203 | Look-through exposes source/version/as-of, unresolved holdings, stale coverage and overlap methodology. |
| US-1204 | US-1204 | analytics | TC-US-1204 | Scoped targets validate supported dimensions, values, currencies, uniqueness, audit/version and readback. |
| US-1205 | US-1205 | analytics | TC-US-1205 | Rebalance suggestion is read-only and exposes current/target/drift, eligible cash, price/cost/rounding assumptions and limits. |
| US-1206 | US-1206 | analytics | TC-US-1206 | Portfolio comparisons require matching period, currency, valuation and formula versions plus scope isolation. |
| US-1207-A | US-1207 | analytics | TC-US-1207-A | Saved what-if scenario stores allocation, assumptions, source/as-of and output version; reruns are deterministic. |
| US-1207-B | US-1207 | analytics | TC-US-1207-B | Backtest pins price series/as-of, costs, cashflows and formula version and prevents look-ahead leakage. |
| US-1208 | US-1208 | analytics | TC-US-1208 | Screener/watchlist filters validate field/operator/scope and preserve source, as-of and alert linkage. |
| US-1301 | US-1301 | tax | TC-US-1301 | Lots trace source activity, acquisition date, remaining quantity/basis, fees, currency and holding period to canonical entries. |
| US-1302-A | US-1302 | tax | TC-US-1302-A | Lot method and effective/version boundary persist without rewriting ledger history. |
| US-1302-B | US-1302 | tax | TC-US-1302-B | Synthetic input differentiates FIFO/LIFO/WAC/HIFO/specific-ID and rejects unsupported jurisdiction/method combinations. |
| US-1303-A | US-1303 | tax | TC-US-1303-A | Proceeds, basis and fees remain separately visible in original transaction currency with source IDs and method version. |
| US-1303-B | US-1303 | tax | TC-US-1303-B | Acquisition/disposal FX components and rate provenance are separate; missing rates fail explicitly. |
| US-1304 | US-1304 | tax | TC-US-1304 | Explicit fiscal year, jurisdiction and ruleset select a traceable period/report; unsupported rulesets are blocked. |
| US-1305 | US-1305 | tax | TC-US-1305 | Tax-loss candidate estimates state assumptions, loss, holding period, rationale, confidence and limitations without mutation. |
| US-1306 | US-1306 | tax | TC-US-1306 | Related instrument/window evidence, confidence/status and jurisdiction/version are visible; unknown identity is not guessed. |
| US-1307 | US-1307 | tax | TC-US-1307 | Owner-scoped worksheet carries ruleset/version/disclaimer and reproducible inputs; no general tax advice. |

### P3 — Specialist instruments

| Story | Parent | Owner | Test | Refined outcome |
|---|---|---|---|---|
| US-1401-A | US-1401 | instruments | TC-US-1401-A | Bond issuer, coupon, frequency, maturity and currency validation rejects invalid schedules with source/version. |
| US-1401-B | US-1401 | instruments | TC-US-1401-B | Coupon/principal schedules are dated, deterministic and golden-tested against calendar/day-count rules. |
| US-1402-A | US-1402 | instruments | TC-US-1402-A | Synthetic bond inputs produce versioned YTM, dirty price and accrued interest with conventions and limitations. |
| US-1402-B | US-1402 | instruments | TC-US-1402-B | Duration, convexity and DV01 use the same pinned curve and assumptions. |
| US-1403 | US-1403 | instruments | TC-US-1403 | Curve observations and parallel shifts produce deterministic, as-of/versioned scenarios. |
| US-1404 | US-1404 | instruments | TC-US-1404 | Option contract validates underlying, strike, expiry, multiplier, IV and lifecycle/status with source/version. |
| US-1405-A | US-1405 | instruments + ledger | TC-US-1405-A | OPEN reaches positions/cash/basis through an approved ledger command with quantity, premium and audit evidence. |
| US-1405-B | US-1405 | instruments + ledger | TC-US-1405-B | CLOSE/ROLL links contracts and makes partial close, duplicate, cost-basis and P&L deterministic/auditable. |
| US-1405-C | US-1405 | instruments + ledger | TC-US-1405-C | Exercise/assignment/expiry updates contract, underlying, cash and audit through canonical commands without double-counting. |
| US-1406 | US-1406 | instruments | TC-US-1406 | Put → assignment → covered call → roll/called-away lifecycle links IDs and reconciles cash/positions. |
| US-1407 | US-1407 | instruments | TC-US-1407 | Each supported asset type declares currency, valuation source/as-of and manual/provider status. |
| US-1408-A | US-1408 | instruments | TC-US-1408-A | Retirement scenario persists contribution, return, inflation, tax, horizon and formula assumptions reproducibly. |
| US-1408-B | US-1408 | instruments | TC-US-1408-B | Simulation stores iterations, seed, distributions and output version; same input/seed reproduces output. |
| US-1408-C | US-1408 | instruments | TC-US-1408-C | Sensitivity and sequence-of-returns variants expose assumptions and failure probability. |

### P3 — Sharing, PWA and offline client

| Story | Parent | Owner | Test | Refined outcome |
|---|---|---|---|---|
| US-1501 | US-1501 | security | TC-US-1501 | Share links use opaque IDs, least privilege, expiry and server-side revoke; outsider/revoked access is denied. |
| US-1502 | US-1502 | frontend + security | TC-US-1502 | Restricted responses omit monetary values server-side; percentages/relative fields remain privacy-tested. |
| US-1503 | US-1503 | security | TC-US-1503 | Advisor grants are time-limited, scoped, audited and immediately revocable. |
| US-1504-A | US-1504 | frontend | TC-US-1504-A | Mobile navigation, tables and detail fit the declared viewport without overflow. |
| US-1504-B | US-1504 | frontend | TC-US-1504-B | Import preview, correction and commit controls remain usable on mobile without bypassing safety gates. |
| US-1505-A | US-1505 | frontend + security | TC-US-1505-A | Cache is encrypted, scoped, expiry-bounded and freshness-stamped; revoke clears access. |
| US-1505-B | US-1505 | frontend | TC-US-1505-B | UI labels stale/offline data, blocks unsafe writes and handles conflicts explicitly. |
| US-1506-A | US-1506 | security + frontend | TC-US-1506-A | Notification permissions, scope and revoke are persisted/audited; revoked channels receive nothing. |
| US-1506-B | US-1506 | frontend | TC-US-1506-B | Delivery records link event/channel/status/failure/correlation with synthetic retry evidence. |

### P4 — AI, addons and controlled actions

| Story | Parent | Owner | Test | Refined outcome |
|---|---|---|---|---|
| US-1601-A | US-1601 | ai | TC-US-1601-A | Read-only answers cite period/data-as-of/confidence/source and call no mutation tool. |
| US-1601-B | US-1601 | ai + security | TC-US-1601-B | Retrieval and responses enforce account/category scope server-side. |
| US-1602 | US-1602 | security + ai | TC-US-1602 | Provider keys use vault references only; active model/provider is visible and revocable. |
| US-1603 | US-1603 | ai | TC-US-1603 | Assistant creates a scoped diff/preview; no ledger commit occurs before explicit confirmation. |
| US-1604 | US-1604 | ai + security | TC-US-1604 | Proposal has scope/impact/expiry-bound undo; Confirm/Cancel are explicit, audited, idempotent and reversible. |
| US-1605 | US-1605 | security + ai | TC-US-1605 | Restricted View/View/Propose/Manage capabilities have tested allow/deny boundaries. |
| US-1606-A | US-1606 | ai | TC-US-1606-A | Addon manifest validates name/version/permissions/entrypoints with least privilege. |
| US-1606-B | US-1606 | ai + security | TC-US-1606-B | Addon install/start/stop/revoke is isolated and audited; denied scope/secret/network access fails. |
| US-1607-A | US-1607 | ai | TC-US-1607-A | Typed SDK reads are scope-limited and source-traceable. |
| US-1607-B | US-1607 | ai | TC-US-1607-B | Only granted events are delivered; revoke takes effect and payloads are minimized/audited. |
| US-1608 | US-1608 | security + ai | TC-US-1608 | Public/private moderation and privacy export/delete boundaries are server-enforced cross-user. |

### P4 — Autonomous operations, release and incident loop

| Story | Parent | Owner | Test | Refined outcome |
|---|---|---|---|---|
| US-1701-A | US-1701 | operations | TC-US-1701-A | Same synthetic root cause inside a grouping window yields one incident; distinct causes remain distinct. |
| US-1701-B | US-1701 | operations | TC-US-1701-B | Incident records severity, service, environment, release and correlation; missing metadata is rejected/marked. |
| US-1702-A | US-1702 | operations + security | TC-US-1702-A | Evidence bundles reference redacted logs/traces/metrics and never contain secret/PII sentinels. |
| US-1702-B | US-1702 | operations + platform | TC-US-1702-B | Commit, digest, SBOM and migration/deploy result bind to one release; mismatch blocks. |
| US-1703 | US-1703 | operations | TC-US-1703 | Diagnostic hypotheses record confidence, affected path, invariant, evidence and proposed regression. |
| US-1704 | US-1704 | operations + QA | TC-US-1704 | Regression fails on the old synthetic revision and passes after the minimal fix; test remains blocking. |
| US-1705-A | US-1705 | QA | TC-US-1705-A | Independent verification reports executed tests, pass/fail and missing coverage, distinguishing stale evidence. |
| US-1705-B | US-1705 | security | TC-US-1705-B | Findings include severity, evidence, owner and blocking status; critical findings prevent promotion. |
| US-1706-A | US-1706 | platform | TC-US-1706-A | Commit/digest/SBOM/migration/staging references match the exact promoted artifact. |
| US-1706-B | US-1706 | operations | TC-US-1706-B | Bounded health window evaluates API, worker, DB, integration and product metrics. |
| US-1707 | US-1707 | platform + security | TC-US-1707 | Rollback approves an image/schema pair; data restore is separately planned, rehearsed and evidenced. |
| US-1708 | US-1708 | operations | TC-US-1708 | Incident closure requires root cause, impact, timeline, fix, tests, release and prevention item. |
| US-1709 | US-1709 | operations + security | TC-US-1709 | Runbook/skill changes are reviewed, scanned and tested before activation with provenance/rollback. |

### Delivery-enabler backlog from the evidence reports

These are not additional user stories; they are cross-cutting release enablers
that must be tracked alongside the stories above because the `docs/backlog`
evidence files identify them as blockers or required reconciliation work.

| ID | Owner | Priority | Outcome / exit criterion |
|---|---|---|---|
| GATE-W0-2 | ledger + architecture + QA | P0 | Resolve SELL cash-leg direction and open overdraft, short, rounding, cost-basis and transfer decisions; rerun the intentional RED contract. |
| GATE-SCHEMA-BOOTSTRAP | ledger + platform | P0 | Make clean `schema.sql` equivalent to incremental migrations, including import-mapping and sync-result objects; prove idempotence and restore/replay equality. |
| GATE-FIXTURE-PACK | architecture + QA | P0 | Reconcile and version `ENV-001`, `SEC-001`, `LEDGER-001`, `CALC-001`, `UI-001` and downstream packs, using synthetic data only. |
| GATE-PRIVACY-LANDING | security + architecture | P0 | Land and independently verify privacy export/delete artifacts, retention boundaries and no-physical-ledger-delete behavior. |
| GATE-POORT-A | platform + ledger + QA | P0 | Produce a coherent clean-bootstrap local run with zero unexplained failures/skips, typecheck/build, health/log scan and restore evidence. |
| GATE-POORT-B | platform + release owner | P0 | Prove protected-branch CI, immutable artifact, registry digest/SBOM, Coolify health, migration/restore, rollback and correlated observability evidence. |
| GATE-TRACEABILITY | architecture + QA | P0 | Reconcile the 133 parent stories and atomic tests without static-marker substitution; keep story, test, owner, status and evidence linked. |
| GATE-ORPHAN-RECOVERY | architecture + owning agents | P1 | Resolve remaining blocked/unlanded orphan artifacts, preserving external ownership and recorded exclusions; do not copy scratch or superseded files. |

### Inherited foundation and MVP stories referenced by the evidence backlog

The evidence reports also reference the already-defined W1–W5 stories below.
They remain part of the total product backlog; their current implementation
claims are historical until the current gate evidence is re-established.

| Stories | Product capability moved into this backlog |
|---|---|
| US-0005-A | Threat-model child contract covering security assets, trust boundaries, abuse cases and mitigations; treated as a test alias under US-0005, not a new parent story. |
| US-0101-A | Local runtime bootstraps PostgreSQL from the canonical schema and exposes a healthy dependency. |
| US-0102-B; US-0104-A | Commit-identified deployment is healthy and image labels/tags, SBOM and digest identify the same immutable artifact. |
| US-0106-B; US-0106-C | Worker jobs and request logs carry trace/correlation context while redacting tokens, secrets, account numbers and transaction descriptions. |
| US-0107-A | Encrypted PostgreSQL/object-storage backups include checksums and retention metadata. |
| US-0201; US-0202 | User/session lifecycle uses opaque, hashed, expirable and revocable sessions; public email-only login never creates a session. |
| US-0203; US-0203-A; US-0203-B; US-0203-C | Local TOTP and synthetic OIDC support enrolment/callback/revoke, single-use state, replay rejection and lockout; production auth remains separately gated. |
| US-0204; US-0205 | Portfolio roles and server-side authorization plus auditable login, permission, secret, share, export and revoke events. |
| US-0206-A; US-0206-B | User-owned export and retention-compliant soft-delete/revoke; canonical ledger history is never physically deleted. |
| US-0301; US-0303; US-0304; US-0305; US-0306 | Canonical portfolio/instrument/ledger command boundary with BUY, SELL, cash, income, fee/tax, state transitions, VOID correction and account-scoped idempotency. |
| US-0401; US-0402; US-0403; US-0404; US-0405; US-0407 | Currency/FX, market prices, provider identity, FIFO/WAC cost basis, price/FX P&L and rebuildable portfolio snapshots. |
| US-0503; US-0602; US-0603 | Portfolio KPI read model plus versioned import mapping templates, validation and preview without ledger mutation. |
| US-0705; US-0706; US-0708 | Market-event calendar, versioned TWR/MWRR/Modified Dietz comparison and scoped alert rules/delivery evidence. |
| US-0802; US-0803; US-0805 | Read-only Trading 212 connection, incremental sync and explicit review states before any posting. |
| US-0901; US-0908 | Money Flow account scope, budgets, rollover and read-only actual-versus-budget from posted cash entries. |
| US-1004; US-1007 | Bank balances/transactions normalization with raw evidence, dedupe/freshness/error status and expiry-bound reconnect preserving history. |
| US-1103; US-1104 | Fiscal-year-scoped taxable-income/trade report and auditable portfolio net-worth goal configuration/readback. |

Traceability aliases referenced by the evidence documents are retained here as
test links: `TC-US-0005-A`, `TC-US-0101`, `TC-US-0101-A`, `TC-US-0102`,
`TC-US-0102-B`, `TC-US-0103`, `TC-US-0104`, `TC-US-0104-A`, `TC-US-0106-C`,
`TC-US-0107`, `TC-US-0107-A`, `TC-US-0201`, `TC-US-0201-AUTH`, `TC-US-0202`,
`TC-US-0203`, `TC-US-0203-A`, `TC-US-0203-B`, `TC-US-0203-C`,
`TC-US-0203-OIDC-DEPLOY`, `TC-US-0204`, `TC-US-0205`, `TC-US-0206-A`,
`TC-US-0503-UX`, `TC-US-0602`, `TC-US-0705-UX`, `TC-US-0802`, `TC-US-0803`,
`TC-US-0805`, `TC-US-1004`, `TC-US-1007`, `TC-US-1105-UX`, `TC-US-1201-UX`,
`TC-US-1401-UX`, `TC-US-1402-UX`, `TC-US-1403-UX`, `TC-US-1404-UX` and
`TC-US-1601-UX`. They are evidence/test references, not extra product scope.

### Source reconciliation

The detailed story decomposition was moved from
`docs/backlog/b-004-refinement.md`. Status and gate decisions were reconciled
from the B-004 evidence ledger, inventory/provenance audit, W0/W1 readiness
matrices, independent traceability audit and orphan-recovery manifest. Those
source files remain dated evidence records; their historical test counts do not
override current verification.
