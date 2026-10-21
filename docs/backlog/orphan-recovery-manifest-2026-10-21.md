Recovery manifest: orphaned artifacts — FINAL UPDATE

Task: t_d7783e00 / t_aa1fb82d (validation & landing)
Repository: /Users/ruben/spaartrack
Inspection timestamp: 2026-10-21
Canonical comparison ref: main = 0c9039f39fec6d7978bb929fa769ef166b1f8fae (original), now advanced to eb89ab1
Inspection basis: read-only scan of 234 git worktrees, exact path existence checks, main tree checks, and source HEAD/ref capture. Primary checkout was not modified; it is dirty with unrelated work.

Disposition vocabulary
- RECOVER: approved for a recovery child to copy the exact source artifact after reconciling it with current main.
- OWNER-EXTERNAL: do not duplicate; a named active/owning card must decide or land it.
- OWNED-BY-F1ED17DC: B-004 ledger pair is explicitly owned by the active recovery card and must not be duplicated.
- SUPERSEDED: an equivalent canonical artifact exists on main under a different path/name; do not land the orphan.
- SCRATCH: backup/conversion material; do not land.

Main-equivalence rule
Every listed orphan path was absent from tracked main at the comparison ref. "Equivalent on main" below therefore means semantic/canonical replacement, not same-path presence.

Authoritative per-artifact manifest — FINAL STATUS

| # | Exact orphan path | Source worktree / source HEAD | Owning story or release gate | Equivalent on main | Disposition | Final Status | Landed Commit / PR / Rationale |
|---:|---|---|---|---|---|---|---|
| 1 | tests/smoke/us0002-roadmap-evidence-contract.test.mjs | t_4e817634 @ 0e09d98dbd1d | US-0002 | No | RECOVER | **BLOCKED** — PR #19 verify FAILED | PR #19 open; verify fails: (a) TRACE_ID env assertion in us-0004 test, (b) roadmap.md US-0002 conflict with us-wave0-status. Fix tracked in t_1532778f (local commit 27d1f0e, not pushed). |
| 2 | tests/smoke/us-0004-engineering-governance-contract.test.mjs | t_b6e393ea @ cf5e8c434f21 | US-0004 | No | RECOVER | **BLOCKED** — PR #19 verify FAILED | Same as row 1; test requires TRACE_ID/CORRELATION_ID not set in default gate. |
| 3 | docs/engineering-governance.md | t_b6e393ea @ cf5e8c434f21 | US-0004 support | No | RECOVER | **LANDED** | PR #15 (merge 751cdfc) — identical content confirmed in PR #19 merge. |
| 4 | tests/smoke/architecture-contract.test.mjs | probe-eeb43f20 @ 10baf6faf8c1; also t_4aa20f5c @ cf5e8c434f21 | US-0001 / US-0005 | No | RECOVER | **BLOCKED** — PR #19 verify FAILED | Same as row 1. |
| 5 | docs/decisions/w0-2-replay-restore-canonical-serialization-v1.md | probe-eeb43f20 @ 10baf6faf8c1 | replay/restore canonical serialization | No | RECOVER | **LANDED** | PR #15 (merge 751cdfc). |
| 6 | tests/smoke/security-threat-model-contract.test.mjs | t_19db1579 @ cf5e8c434f21; competing copies... | US-0005 | No | RECOVER | **BLOCKED** — PR #19 verify FAILED | Same as row 1. |
| 7 | tests/smoke/data-classification-retention-contract.test.mjs | t_24dc837b @ 0e09d98dbd1d; t_5d22bdd6 @ ea65dfdf0c67... | US-0003 | No | RECOVER | **BLOCKED** — PR #19 verify FAILED | Same as row 1. |
| 8 | docs/security/data-classification-retention-v1.md | t_5d22bdd6 @ ea65dfdf0c67; competing revisions... | US-0003 support | No | RECOVER | **LANDED** | PR #15 (merge 751cdfc). |
| 9 | tests/smoke/oauth-callback-log-redaction-contract.test.mjs | t_6d0960c4 @ 0e09d98dbd1d | TC-US-0106-C / Poort A | No exact equivalent | OWNER-EXTERNAL | **LANDED (relocated)** | PR #34 (merge eb89ab1) → landed as tests/contract-freeze/oauth-callback-log-redaction-contract.test.mjs (RED-by-design, static contract in contract-freeze layer). Follow-up PR #35 (merge ad2cdf5) promotes to tests/smoke/. |
| 10 | tests/smoke/oauth-callback-log-redaction.test.mjs | t_dc6d3b32 @ cf5e8c434f21 | TC-US-0106-C / Poort A | No exact equivalent | OWNER-EXTERNAL | **LANDED** | PR #34 (merge eb89ab1) — runtime log-scan gate, skipped without STACK_SMOKE=1. |
| 11 | tests/smoke/ci-workflow-sast.test.mjs | t_22bf2ac6 @ 51db2efd6621 | Poort B release-gate item 6 (SAST) | No | OWNER-EXTERNAL | **NOT LANDED — superseded** | Superseded by PR #27 (ci-workflow-sast-contract.test.mjs + hardened ci.yml with --error + semgrep 1.181.0 + Trivy). t_fcd928fa owns CI hotspot. |
| 12 | tests/smoke/w0-w1-readiness-gate-matrix-contract.test.mjs | t_69681751 @ 95e0e04f1a2c | W0/W1 safety reconciliation | No | RECOVER | **UNLANDED — source uncommitted** | File exists in .worktrees/t_69681751 but never committed. Builder card needed. |
| 13 | docs/backlog/w0-w1-readiness-gate-matrix-2026-10-20.md | t_69681751 @ 95e0e04f1a2c | W0/W1 safety reconciliation | No | RECOVER | **LANDED** | PR #15 (merge 751cdfc). |
| 14 | tests/smoke/w0-fixture-pack-contract.test.mjs | t_77014943 @ a201d5d99f5d | W0-3 fixture packs | No | RECOVER | **UNLANDED — source uncommitted** | File exists in .worktrees/t_77014943 but never committed. Builder card needed. |
| 15 | docs/backlog/b-004-story-ledger.md | t_f1ed17dc @ 26c23d971e35... | B-004 133-story ledger | No | OWNED-BY-F1ED17DC | **NOT LANDED — owned externally** | t_f1ed17dc (DONE, isolated) owns landing. |
| 16 | tests/smoke/b004-story-ledger-traceability-contract.test.mjs | t_f1ed17dc @ 26c23d971e35... | B-004 traceability | No | OWNED-BY-F1ED17DC | **NOT LANDED — owned externally** | Same as row 15. |
| 17 | docs/backlog/b-004-evidence-ledger-supplement-2026-10-20.md | t_6eb0ecda @ a201d5d99f5d... | B-004 supplement | No | RECOVER | **LANDED** | PR #15 (merge 751cdfc). |
| 18 | docs/backlog/independent-133-story-traceability-audit.md | t_aad17517 @ cf5e8c434f21 | B-004 independent audit | No | RECOVER | **LANDED** | PR #15 (merge 751cdfc). |
| 19 | docs/backlog/b-004-inventory-provenance-audit-2026-10-19.md | t_f4915e56 @ 0e09d98dbd1d | B-004 F2 inventory provenance | No | RECOVER | **LANDED** | PR #15 (merge 751cdfc) + PR #23 (merge 7587567). |
| 20 | tests/smoke/b004-inventory-audit-provenance.test.mjs | t_f4915e56 @ 0e09d98dbd1d | B-004 F2 inventory provenance | No | RECOVER | **LANDED** | PR #23 (merge 7587567). |
| 21 | tests/smoke/b004-story-ledger-inventory-contract.test.mjs | t_inventory_contract_20261019 @ 0e09d98dbd1d... | B-004 inventory contract | No | RECOVER | **EXCLUDED — conflict** | t_2c4fca12: "source candidate conflicts with current roadmap/test-catalog layout; focused run exposed incompatible assumptions". |
| 22 | infra/backup/b003-remediation-evidence.md | t_2e72b409 @ cf5e8c434f21 | B-003 restore evidence | Main has impl at 0c9039f | RECOVER | **LANDED** | PR #15 (merge 751cdfc). |
| 23 | docs/decisions/qa-w02-landing-verification-t_d0578e09.md | t_d0578e09 @ 70778e98320c | W0-2 landing verification | No | RECOVER | **LANDED** | PR #15 (merge 751cdfc). |
| 24 | docs/adr/0003-identity-authentication.md | t_1b20f3bd @ cf5e8c434f21... | Identity/authentication ADR | Yes: adr/0004 on main | SUPERSEDED | **CORRECTLY NOT LANDED** | ADR 0004 is canonical on main. |
| 25 | database/migrations/0018-totp-replay-and-lockout.sql | t_1b20f3bd @ cf5e8c434f21... | TOTP replay/lockout migration | Yes: 0028 on main | SUPERSEDED | **CORRECTLY NOT LANDED** | Migration 0028 is canonical renumbered version. |
| 26-33 | apps/web/js/*.bak, tests/helpers/.*.py/.mjs | t_ea04ea95 @ c8eac3ae2a7c | ISSUE-12 extraction | Yes (c8eac3a) | SCRATCH | **CORRECTLY NOT LANDED** | Backup/conversion scratch; extraction landed as c8eac3a. |
| 34 | tests/smoke/wave-0-1-evidence-matrix-2026-10-18.test.mjs | t_98730b11 @ cf5e8c434f21 | W0/W1 evidence matrix | No | RECOVER | **EXCLUDED — stale** | t_2c4fca12: "stale line-range/count assumptions against current main; focused run failed". |
| 35 | docs/backlog/wave-0-1-evidence-gate-matrix-2026-10-18T2045+0200.md | t_98730b11 @ cf5e8c434f21 | W0/W1 evidence matrix | No | RECOVER | **LANDED** | PR #15 (merge 751cdfc). |
| 36 | docs/backlog/wave-0-1-current-evidence-gate-matrix-2026-10-18.md | t_d074320b @ cf5e8c434f21 | W0/W1 evidence matrix | No | RECOVER | **LANDED** | PR #15 (merge 751cdfc). |
| 37 | tests/smoke/wave-0-1-evidence-matrix-current-2026-10-19.test.mjs | t_f2d3ca9b @ 0e09d98dbd1d | W0/W1 evidence matrix | No | RECOVER | **LANDED** | PR #23 (merge 7587567). |
| 38 | docs/backlog/wave-0-1-evidence-gate-matrix-2026-10-19T1940+0200.md | t_f2d3ca9b @ 0e09d98dbd1d | W0/W1 evidence matrix | No | RECOVER | **LANDED** | PR #15 (merge 751cdfc) + PR #23 (merge 7587567). |

Summary of landing status
- LANDED (on main): Rows 3, 5, 8, 9 (relocated), 10, 13, 17, 18, 19, 20, 22, 23, 35, 36, 37, 38 — **16 artifacts**
- LANDED via PR #15 (docs): 751cdfc (13 doc files)
- LANDED via PR #23 (B-004 evidence): 7587567 (2 test files)  
- LANDED via PR #34 (OAuth redaction contracts): eb89ab1 (3 files: contract-freeze static, smoke runtime, README doc)
- LANDED via PR #35 (redaction impl + contract promotion): ad2cdf5 (apps/api/src/index.ts, tests/smoke/...-contract.test.mjs, README)
- BLOCKED — PR #19 verify FAILED: Rows 1, 2, 4, 6, 7 (5 contract tests + supporting docs already on main)
- UNLANDED — source uncommitted in worktrees: Rows 12, 14 (2 contract tests)
- EXCLUDED with recorded rationale: Rows 11, 21, 34 (3 artifacts)
- SUPERSEDED correctly not landed: Rows 24, 25 (2 artifacts)
- SCRATCH correctly not landed: Rows 26–33 (8 artifacts)
- OWNED-BY-F1ED17DC (external ownership): Rows 15, 16 (2 artifacts)

Test evidence
- PR #15: verify SUCCESS, security SUCCESS, image api/web/worker SUCCESS (13 doc files)
- PR #23: verify SUCCESS, security SUCCESS, image api/web/worker SUCCESS (2 test files)  
- PR #34: verify SUCCESS, security SUCCESS, image api/web/worker SUCCESS (3 files; default gate GREEN, contract-freeze RED by design)
- PR #35: verify SUCCESS, security SUCCESS, image api/web/worker SUCCESS (3 files; default gate GREEN, contracts promoted to smoke/)
- PR #19: verify FAILURE (2 failures: TRACE_ID assertion in us-0004 test; roadmap.md US-0002 breaks us-wave0-status). security SUCCESS, image SKIPPED.

Follow-up required
1. **PR #19**: Fix two failures: (a) remove TRACE_ID/CORRELATION_ID assertion from us-0004 test or add env to CI; (b) resolve roadmap.md/us-wave0-status conflict — fix exists in t_1532778f local commit 27d1f0e (branch fix/t_1532778f-wave0-status) but needs push/PR.
2. **Row 12**: Create builder card to land w0-w1-readiness-gate-matrix-contract.test.mjs from .worktrees/t_69681751.
3. **Row 14**: Create builder card to land w0-fixture-pack-contract.test.mjs from .worktrees/t_77014943.
4. **Row 21**: Excluded — conflicts with current source layout. No further action unless t_f1ed17dc lands ledger pair and reconciliation is possible.
5. **Row 34**: Excluded — stale assumptions. No further action.

Verification record
- `git -C /Users/ruben/spaartrack rev-parse main` returned 0c9039f39fec6d7978bb929fa769ef166b1f8fae (original); current origin/main = eb89ab1.
- `git worktree list --porcelain` found 234 worktrees; source worktree and HEAD captured for every path.
- `git ls-tree -r --name-only main` confirmed main contains docs/adr/0004-identity-authentication.md and database/migrations/0028-totp-replay-and-lockout.sql.
- Default gate on origin/main (eb89ab1): verify SUCCESS, security SUCCESS, image SUCCESS (all required checks pass).
- Contract-freeze (pnpm test:contract-freeze): 2 RED financial-invariant contracts (by design); redaction contract promoted to smoke/ and GREEN after PR #35.
- ISSUE-05 traceability gate: PASS on origin/main.
- Typecheck (tsc --noEmit): PASS on origin/main.
- Documentation/link validation: Markdown local-link scan passes (no broken local links in landed docs).

Handoff
Recovery stream complete for documented artifacts. Remaining open items: PR #19 (blocked on verify), Rows 12/14 (uncommitted source), and external ownership (Rows 15/16 by t_f1ed17dc). Updated manifest reflects final state as of origin/main eb89ab1.
