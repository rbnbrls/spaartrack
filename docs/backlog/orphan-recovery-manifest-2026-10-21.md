Recovery manifest: orphaned artifacts

Task: t_d7783e00
Repository: /Users/ruben/spaartrack
Inspection timestamp: 2026-10-21 (current run; local clock not used for disposition)
Canonical comparison ref: main = 0c9039f39fec6d7978bb929fa769ef166b1f8fae
Inspection basis: read-only scan of 234 git worktrees, exact path existence checks, main tree checks, and source HEAD/ref capture. Primary checkout was not modified; it is dirty with unrelated work.

Disposition vocabulary
- RECOVER: approved for a recovery child to copy the exact source artifact after reconciling it with current main. This manifest does not itself land files.
- OWNER-EXTERNAL: do not duplicate; a named active/owning card must decide or land it.
- OWNED-BY-F1ED17DC: B-004 ledger pair is explicitly owned by the active recovery card and must not be duplicated here.
- SUPERSEDED: an equivalent canonical artifact exists on main under a different path/name; do not land the orphan.
- SCRATCH: backup/conversion material; do not land.

Main-equivalence rule
Every listed orphan path was absent from tracked main at the comparison ref. “Equivalent on main” below therefore means semantic/canonical replacement, not same-path presence. No orphan is reported as already landed at the exact path.

Authoritative per-artifact manifest

| # | Exact orphan path | Source worktree / source HEAD | Owning story or release gate | Equivalent on main | Disposition | Reason / recovery note |
|---:|---|---|---|---|---|---|
| 1 | tests/smoke/us0002-roadmap-evidence-contract.test.mjs | t_4e817634 @ 0e09d98dbd1d | US-0002 | No | RECOVER | Candidate behavioural-evidence artifact; source inspection says roadmap/test-case marker assertions, so recover only with its documentary limitation recorded. |
| 2 | tests/smoke/us-0004-engineering-governance-contract.test.mjs | t_b6e393ea @ cf5e8c434f21 | US-0004 | No | RECOVER | Pair with row 3; static governance/document assertions are not product-behaviour proof. |
| 3 | docs/engineering-governance.md | t_b6e393ea @ cf5e8c434f21 | US-0004 support | No | RECOVER | Required supporting document for row 2; preserve source wording/provenance. |
| 4 | tests/smoke/architecture-contract.test.mjs | probe-eeb43f20 @ 10baf6faf8c1; also t_4aa20f5c @ cf5e8c434f21 | US-0001 / US-0005 | No | RECOVER | Multiple copies exist; implementation owner must select the exact source version after diffing. Static architecture/ADR/roadmap assertions are not behavioural execution. |
| 5 | docs/decisions/w0-2-replay-restore-canonical-serialization-v1.md | probe-eeb43f20 @ 10baf6faf8c1 | replay/restore canonical serialization | No | RECOVER | Decision record; preserve date, provenance, and explicit scope. |
| 6 | tests/smoke/security-threat-model-contract.test.mjs | t_19db1579 @ cf5e8c434f21; competing copies t_2b922bb8, t_53599a26, t_962027d4, t_e8af0bc5 | US-0005 | No | RECOVER | Multiple revisions; select/reconcile exact source. Current inspection classifies it as static threat-model assertions, not runtime security behaviour. |
| 7 | tests/smoke/data-classification-retention-contract.test.mjs | t_24dc837b @ 0e09d98dbd1d; t_5d22bdd6 @ ea65dfdf0c67; other revisions t_2fc64edc, t_a8186ae1, t_ce0f2804, t_e55d6381 | US-0003 | No | RECOVER | Multiple revisions; reconcile against the supporting document. Static content/placeholder checks do not close the PARTIAL classification alone. |
| 8 | docs/security/data-classification-retention-v1.md | t_5d22bdd6 @ ea65dfdf0c67; competing revisions listed in row 7 | US-0003 support | No | RECOVER | Recover the canonical reviewed document together with row 7; preserve provenance. |
| 9 | tests/smoke/oauth-callback-log-redaction-contract.test.mjs | t_6d0960c4 @ 0e09d98dbd1d | TC-US-0106-C / Poort A | No exact equivalent; main has only field-level observability redaction | OWNER-EXTERNAL | Runtime/log-scan verification is owned by t_997e762c (via t_13277cf7). Do not duplicate or claim the callback gate until that owner resolves it. |
| 10 | tests/smoke/oauth-callback-log-redaction.test.mjs | t_dc6d3b32 @ cf5e8c434f21 | TC-US-0106-C / Poort A | No exact equivalent | OWNER-EXTERNAL | Same gate as row 9; second source file must be coordinated with the active verifier, not independently landed. |
| 11 | tests/smoke/ci-workflow-sast.test.mjs | t_22bf2ac6 @ 51db2efd6621 | Poort B release-gate item 6 (SAST) | No; main CI had no SAST/semgrep/codeql hit at inspection | OWNER-EXTERNAL | t_fcd928fa owns the hardened SAST/container-scan CI hotspot. Do not duplicate its workflow/gate landing. |
| 12 | tests/smoke/w0-w1-readiness-gate-matrix-contract.test.mjs | t_69681751 @ 95e0e04f1a2c | W0/W1 safety reconciliation | No | RECOVER | Static matrix/source-count contract; useful evidence but not product behaviour. |
| 13 | docs/backlog/w0-w1-readiness-gate-matrix-2026-10-20.md | t_69681751 @ 95e0e04f1a2c | W0/W1 safety reconciliation | No | RECOVER | Supporting dated evidence record; preserve explicit status and source references. |
| 14 | tests/smoke/w0-fixture-pack-contract.test.mjs | t_77014943 @ a201d5d99f5d | W0-3 fixture packs | No | RECOVER | Fixture/schema/secret-pattern validation is substantive evidence but not end-to-end product behaviour. |
| 15 | docs/backlog/b-004-story-ledger.md | t_f1ed17dc @ 26c23d971e35 (also historical t_651f2352, t_73233975, t_7c3ccaa2, t_8267b4f8, t_c74716e4) | B-004 133-story ledger | No | OWNED-BY-F1ED17DC | t_f1ed17dc owns this exact ledger landing. Do not duplicate; main backlog’s “exists only in worktrees” sentence must be corrected by its owner after landing. |
| 16 | tests/smoke/b004-story-ledger-traceability-contract.test.mjs | t_f1ed17dc @ 26c23d971e35 (historical copies as row 15) | B-004 133-story traceability | No | OWNED-BY-F1ED17DC | Same ownership rule as row 15; preserve ISSUE-05/ledger traceability. |
| 17 | docs/backlog/b-004-evidence-ledger-supplement-2026-10-20.md | t_6eb0ecda @ a201d5d99f5d; t_f3781eaa @ 7ec6b077732a | B-004 supplement | No | RECOVER | Recover the reviewed supplement, preserving date and explicit PARTIAL qualification. |
| 18 | docs/backlog/independent-133-story-traceability-audit.md | t_aad17517 @ cf5e8c434f21 | B-004 independent audit | No | RECOVER | Evidence/audit document; never re-label its 109 VERIFIED + 24 PARTIAL result without the designated re-audit. |
| 19 | docs/backlog/b-004-inventory-provenance-audit-2026-10-19.md | t_f4915e56 @ 0e09d98dbd1d | B-004 F2 inventory provenance | No | RECOVER | Pair with row 20; preserve source inventory and provenance pins. |
| 20 | tests/smoke/b004-inventory-audit-provenance.test.mjs | t_f4915e56 @ 0e09d98dbd1d | B-004 F2 inventory provenance | No | RECOVER | Pair with row 19; retain traceability assertions. |
| 21 | tests/smoke/b004-story-ledger-inventory-contract.test.mjs | t_inventory_contract_20261019 @ 0e09d98dbd1d (branch ref t_bc18a8ab-w0-strengthen-b-004-inventory-completene) | B-004 inventory contract | No | RECOVER | No live card listed as owner in the inventory; recover exact source after reconciling with t_f1ed17dc’s ledger pair. |
| 22 | infra/backup/b003-remediation-evidence.md | t_2e72b409 @ cf5e8c434f21 | B-003 restore evidence | Main has landed implementation evidence at 0c9039f, but not this exact record | RECOVER | Documentation-only evidence; preserve distinction between evidence record and implementation commit. |
| 23 | docs/decisions/qa-w02-landing-verification-t_d0578e09.md | t_d0578e09 @ 70778e98320c | W0-2 landing verification | No | RECOVER | Dated verification record; preserve exact task reference. |
| 24 | docs/adr/0003-identity-authentication.md | t_1b20f3bd @ cf5e8c434f21 (also t_6068c422, t_bd84d889-rebuild) | Identity/authentication ADR | Yes: docs/adr/0004-identity-authentication.md on main | SUPERSEDED | Explicitly superseded by ADR 0004. Do not land ADR 0003; numbering 0004 is canonical on main. |
| 25 | database/migrations/0018-totp-replay-and-lockout.sql | t_1b20f3bd @ cf5e8c434f21 (also t_6068c422, t_bd84d889-rebuild) | TOTP replay/lockout migration | Yes: database/migrations/0028-totp-replay-and-lockout.sql on main | SUPERSEDED | Main already uses 0018 for instrument lookthrough; 0028 is the canonical renumbered migration. Do not land 0018. |
| 26 | apps/web/js/features-early.js.bak | t_ea04ea95 @ c8eac3ae2a7c | ISSUE-12 extraction | Yes, extraction landed as c8eac3a | SCRATCH | Backup artifact; not a product source. |
| 27 | apps/web/js/router.js.bak | t_ea04ea95 @ c8eac3ae2a7c | ISSUE-12 extraction | Yes, extraction landed as c8eac3a | SCRATCH | Backup artifact; not a product source. |
| 28 | tests/helpers/.census.mjs | t_ea04ea95 @ c8eac3ae2a7c | ISSUE-12 extraction | Yes, extraction landed as c8eac3a | SCRATCH | Conversion scratch helper; do not land. |
| 29 | tests/helpers/.convert_tests.py | t_ea04ea95 @ c8eac3ae2a7c | ISSUE-12 extraction | Yes, extraction landed as c8eac3a | SCRATCH | Conversion scratch helper; do not land. |
| 30 | tests/helpers/.convert_tests2.py | t_ea04ea95 @ c8eac3ae2a7c | ISSUE-12 extraction | Yes, extraction landed as c8eac3a | SCRATCH | Conversion scratch helper; do not land. |
| 31 | tests/helpers/.fix_router.py | t_ea04ea95 @ c8eac3ae2a7c | ISSUE-12 extraction | Yes, extraction landed as c8eac3a | SCRATCH | Conversion scratch helper; do not land. |
| 32 | tests/helpers/.symbol_census.py | t_ea04ea95 @ c8eac3ae2a7c | ISSUE-12 extraction | Yes, extraction landed as c8eac3a | SCRATCH | Conversion scratch helper; do not land. |
| 33 | tests/helpers/.wrap_domcontent.py | t_ea04ea95 @ c8eac3ae2a7c | ISSUE-12 extraction | Yes, extraction landed as c8eac3a | SCRATCH | Conversion scratch helper; do not land. |
| 34 | tests/smoke/wave-0-1-evidence-matrix-2026-10-18.test.mjs | t_98730b11 @ cf5e8c434f21 | W0/W1 evidence matrix | No | RECOVER | Broader evidence artifact; do not count as one of the ten behavioural deliverables. |
| 35 | docs/backlog/wave-0-1-evidence-gate-matrix-2026-10-18T2045+0200.md | t_98730b11 @ cf5e8c434f21 | W0/W1 evidence matrix | No | RECOVER | Dated broader evidence record. |
| 36 | docs/backlog/wave-0-1-current-evidence-gate-matrix-2026-10-18.md | t_d074320b @ cf5e8c434f21 | W0/W1 evidence matrix | No | RECOVER | Dated broader evidence record; reconcile revisions rather than land duplicates. |
| 37 | tests/smoke/wave-0-1-evidence-matrix-current-2026-10-19.test.mjs | t_f2d3ca9b @ 0e09d98dbd1d | W0/W1 evidence matrix | No | RECOVER | Current matrix contract; reconcile with rows 34–36. |
| 38 | docs/backlog/wave-0-1-evidence-gate-matrix-2026-10-19T1940+0200.md | t_f2d3ca9b @ 0e09d98dbd1d | W0/W1 evidence matrix | No | RECOVER | Dated broader evidence record; retain provenance. |

Coverage classification and scope accounting

The ten named behavioural-deliverable test artifacts are exactly rows 1, 2, 4, 6, 7, 12, 14, 16, 20, and 21: US-0002 roadmap; US-0004 governance; architecture; US-0005 threat model; US-0003 classification/retention; W0/W1 readiness; W0-3 fixture pack; B-004 ledger traceability; B-004 inventory provenance; and B-004 ledger-inventory contract. Supporting documents are rows 3, 5, 8, 13, 17–19, 22–23 and 35–38, not additional behavioural deliverables. This is a recovery scope label, not a claim that each test executes product behaviour. Source inspection found marker/document assertions for rows 1, 2, 4, 6, 7, 12, 16, 20, and 21; row 14 validates fixtures/schema vocabulary and secret patterns but is not end-to-end product behaviour. No PARTIAL story may be reclassified by this manifest.

The two named release-gate deliverables are: (a) OAuth callback log redaction for TC-US-0106-C/Poort A, represented by the two-file pair in rows 9–10; and (b) CI SAST for Poort B item 6, row 11. Both remain external-owner decisions; no landed SHA is claimed here.

Rows 15, 17–19, 22–23 and 34–38 are broader evidence/documentation artifacts. Row 16 remains one of the ten named behavioural-deliverable tests, but is explicitly owned by t_f1ed17dc and is not recoverable by duplicate landing in this stream.

Verification record

- `git -C /Users/ruben/spaartrack rev-parse main` returned 0c9039f39fec6d7978bb929fa769ef166b1f8fae.
- `git worktree list --porcelain` found 234 worktrees; source worktree and HEAD were captured for every inventory path above.
- `git ls-tree -r --name-only main` confirmed main contains docs/adr/0004-identity-authentication.md and database/migrations/0028-totp-replay-and-lockout.sql, and does not contain the orphan paths at their listed names.
- `git -C /Users/ruben/spaartrack status --short --branch` showed the primary checkout dirty with unrelated files; it was not modified.
- No source worktree, branch, commit, or application file was altered by this manifest task.
- The parent inventory describes 39 distinct product paths, while expansion of its explicit rows and the `wave-0-1-*` wildcard produced 38 unique paths (38 numbered rows here); no additional `wave-0-1` path exists in the 234-worktree scan. This count discrepancy is recorded for orchestrator reconciliation rather than hidden or guessed.

Handoff

Recovery children may use this file as authoritative scope. They must preserve exact source versions where selected, report any competing revision choice, avoid rows marked OWNER-EXTERNAL/OWNED-BY-F1ED17DC/SUPERSEDED/SCRATCH, and attach their own landed SHA plus focused-test evidence. The current manifest itself has no landed SHA and makes no VERIFIED transition claim.
