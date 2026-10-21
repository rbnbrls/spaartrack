# Wave 0/1 evidence-gate matrix supplement — 2026-10-19T1940+0200

Snapshot created 19 October 2026, 19:40 CEST; candidate review status rechecked 19:54 CEST. Owner: Architecture. Task: `t_f2d3ca9b`. Source branch `spaartrack/t_f2d3ca9b-wave-0-refresh-evidence-matrix-with-curr`, HEAD `0e09d98dbd1dbefb04dc822b40c1d98328706a37`. This is documentation/evidence status only. It does not accept stories, authorize implementation, approve release, or clear downstream gates. It supplements (does not rewrite or integrate) the QA-approved 18 October matrix.

## Provenance and referenced artifacts

Required guidance read: `AGENTS.md`, `roadmap.md`, `test-cases.md`, ADR-0001 and ADR-0002. This worktree had a pre-existing modified `docs/backlog/b-004-refinement.md`; this task did not change it. Primary and sibling worktrees were not edited.

| Artifact | Exact isolated path/task | SHA-256 and scope |
|---|---|---|
| Prior matrix | `/Users/ruben/spaartrack/.worktrees/t_98730b11/docs/backlog/wave-0-1-evidence-gate-matrix-2026-10-18T2045+0200.md` (`t_0417b101`, QA `t_3c18fd12`) | `d314bde49a1f5287577edf570b2e152067152908d598cb1a2eee3bec14d23310`; 18 Oct structural/gate snapshot |
| B-004 provenance audit | `/Users/ruben/spaartrack/.worktrees/t_f4915e56/docs/backlog/b-004-inventory-provenance-audit-2026-10-19.md` | `abdcf7cc7216a8727e81e7b23cc17ff17da24ecfdd7706426895870ea12ea0a8`; bounded audit approved |
| Calculations v2 | `/Users/ruben/spaartrack/.worktrees/t_64ce59b3/docs/decisions/w0-2-calculation-rounding-cost-basis-v2.md` (`t_64ce59b3`, QA `t_4ccd7cc4`) | `d69f403fcbe34322a3055e2626b28e382d32850330e29decfde490836fd066b6`; documentation only |
| Ledger concurrence | `/Users/ruben/spaartrack/.worktrees/t_eea535ff/docs/decisions/w0-2-ledger-concurrence-rounding-cost-basis-v1.md` | `7bb01c8915a16a5da0f2b68be00dffcde834704e72e5e7293b2d22e5fa5d6414`; bounded concurrence only |
| Ledger overdraft/short v2 | `/Users/ruben/spaartrack/.worktrees/t_5befc971/docs/decisions/w0-2-ledger-overdraft-short-policy.md` | `ed71d3ce9f036c97116d0d25eabe3517c53a0ae40b1faa8ed40c346a73ca9d44`; bounded note QA-approved |
| Historical backlog correction | `/Users/ruben/spaartrack/.worktrees/t_ba7b0968/backlog.md` (`t_ba7b0968`, QA `t_c3391ee9`) | `b137ddd3ef0ce352d453c3f5d15c918d5c7403cac5a04e1c009a64fed8bceb98`; isolated, not integrated |
| Poort A evidence + QA | `/Users/ruben/spaartrack/.worktrees/t_c5da8d06/poort-a-ledger-evidence.md`; `/Users/ruben/spaartrack/.worktrees/t_c5da8d06/poort-a-ledger-evidence-qa-review-t_a8fda884.md` | `031e820fe3e9a1e4e4e32dcffb721ef5e2e9b35591bd9e9be89e5c09f40eaf55`; `f38b589431d26f5e291cdbf59b7176aa3ecb761ec13b1599399aa62ea1dddd64`; partial report / NOT APPROVED review |

The prior matrix's exact inventory test validates its checkout, not tracker completeness or delivery status. The 19 Oct B-004 audit's source snapshot is `/Users/ruben/spaartrack/.worktrees/t_73233975/docs/backlog/b-004-story-ledger.md` (source HEAD `cf5e8c434f216ebe4507f5ba5039fc32e3bd9e36`, SHA-256 `649e756a028a63f211b7a9cacf1bb36c84e31fb4176fe4d78d5bf74c411c5035`): 133/133 parent rows and 118/118 child links, but only 201/251 TC-US references. The 50 omissions are parent epic TC links for parents with children; zero extra/mislinked TC refs and zero missing/extra child refs. This is the audited source-snapshot tracker gap, not a canonical roadmap/catalog inventory mismatch and not an unqualified current candidate count. Follow-up `t_651f2352` has completed an isolated corrected candidate at `/Users/ruben/spaartrack/.worktrees/t_651f2352/docs/backlog/b-004-story-ledger.md`, SHA-256 `077081849c2b9ea183cc08cc55c9a886914fded3f2a60d02dc5d60b8e4809009`: it reports 133 parent + 118 child TC refs = 251 unique TC-US refs and 12 TC-X refs, with no missing/extra/duplicate/orphan/malformed/mislinked IDs. Independent QA `t_66446e65` is BLOCKED awaiting provenance/status corrections recorded against the candidate; no approval has been granted, and the candidate is NOT QA-approved. The candidate worktree's `roadmap.md` SHA-256 is `708af2255027bf3e298de60b8b77ec9b265d243917852cd6ef66f770d7bd4e23` and `test-cases.md` SHA-256 is `abf8c7eec1ace6c6452a46869cb7b9fad7aa4407b5b3d3815cc7cb454596e4a6`. That roadmap contains source-reported 18 Oct figures of 88/133 and later 123/133 plus 401/401 regression; these are cited only as reported claims from this pinned snapshot, not as independently verified current completion or gate evidence. Neither the audited source snapshot nor corrected candidate is integrated into primary/mainline. Candidate completion does not change W0-2 or any delivery/release gate.

Canonical inventory remains structurally 133 parent stories, 118 child stories, 251 `TC-US-*` rows, 12 `TC-X-*` rows. Counts prove structure only—not implementation or passing tests. The audit notes primary roadmap/test-cases assume-unchanged index flags and worktree snapshot drift; never infer current primary bytes or integration from a sibling hash.

## W0-2 policy dispositions and traceability

Traceability is `US-0002-A/B/C` → `TC-US-0002-A/B/C` (`roadmap.md:953-955`, `test-cases.md:61-64`). Relevant cross-cutting gates include TC-X-003 (idempotency/replay), TC-X-006 (backup/restore including projections/report totals), and TC-X-007 (financial invariants; `test-cases.md:384,387-388`).

- D-FEE-TAX-01: reciprocal approval only for the exact named B cases `B-PARTIAL-SELL-FIFO-WAC-001` and `B-PRICE-FX-DECOMPOSITION-001`, under `cost-basis-v1` / `pnl-v1`. General acquisition/disposal fee-tax allocation beyond those cases is NOT DECIDED.
- D-ROUNDING-01: bounded Ledger concurrence for decimal-string scales, calculation-side 34-digit/ROUND_HALF_EVEN proposal and calculation-local residual handling. Canonical residual persistence, canonical serialization/digest inputs and replay/restore equality remain NOT DECIDED.
- D-COST-BASIS-01: FIFO or WAC must be explicit; no implicit default. Ledger concurrence is scoped to effective-date/UTC occurred-at/stable-ID ordering and POSTED-only eligibility. No broader lot/allocation policy is implied.
- D-SHORT-01: Ledger v2 decides bounded reject-all-shorts: reject SELL that would create negative quantity, with deterministic no-post outcomes. This is documentation approval only; fixture/test remains unchanged.
- D-OVERDRAFT-01: NOT DECIDED; behavior, account/limit/available-cash/reservations/effective-date/role semantics by debit class remain open.
- D-TRANSFER-01: paired neutrality and atomic pair correction/preservation/audit are constraints; reversal/representation, retry, inconsistent/missing/already-void pair and effective-date/as-of edges remain unresolved.
- A-case SELL field: `A-BUY-SELL-QUANTITY-001.then.cash_entry_direction_sell=DEBIT` conflicts with bounded approved SELL cash CREDIT; the exact field/ledger-leg meaning remains NOT DECIDED. Ledger+QA must identify the leg; Ledger+Calculations must reconcile if it is cash.

The QA synthetic invariant contract at `/Users/ruben/spaartrack/.worktrees/t_0a835fa0` remains intentional RED: latest recorded evidence is 5 total, 4 pass, 1 `owner_decisions_approved=false` failure, 0 skipped, exit 1. Newer owner notes are not consumed into the fixture/test. Preserve W0-2 RED/BLOCKED; documentation-note approval is not overall QA acceptance.

## Gate matrix — current evidence status

| Gate | Status and evidence | Remaining gate |
|---|---|---|
| W0-1 / US-0001-A/B/C / TC-US-0001-A/B/C | PASS for bounded documentation-contract evidence only, per prior matrix/QA handoffs. | Runtime atomicity, durable events, general replay determinism/hash and restore equality remain unverified. |
| W0-2 / US-0002-A/B/C / TC-US-0002-A/B/C | RED / BLOCKED; preserve intentional 5/4/1/0 QA guard result. | Resolve SELL leg and remaining policies; QA updates/reviews contract and obtains green rerun; execute applicable runtime/security/migration/replay/restore gates. |
| B-004 tracker | Canonical inventory is structural 133/118/251/12. Audited source snapshot: 201/251 TC-US links, 50 missing epic-parent links. Completed isolated candidate `t_651f2352`: 133 parent + 118 child = 251 unique TC-US and 12 TC-X, no mismatches; QA `t_66446e65` blocked awaiting provenance/status corrections, no approval. Neither source snapshot nor candidate integrated into primary/mainline. | Complete provenance/status rework and independent candidate QA; no story completion inferred and no gate status changes. |
| Poort A | Partial evidence only; NOT APPROVED / BLOCKED / NOT GREEN. The evidence report records selected bootstrap, migration, ledger-runtime and plain PostgreSQL restore/replay runs; independent QA rejected completion of its narrow evidence gate. | Encrypted/object-store restore, source-vs-restored replay equality, non-empty projection/report totals, full TC-X-007, retained raw evidence/log/trace checks NOT VERIFIED; callback log redaction and lint/typecheck blockers persist. |
| Poort B | NOT PROVEN / BLOCKED; no later approved candidate-bound remote evidence established by this task. | Fresh SHA-bound remote CI/artifact/deploy, migration/restore, rollback, observability and operator decision. |
| Poort C / production | BLOCKED; no production clearance. | Security/privacy, identity/secrets, restore/runbook/observability and explicit human approval. |
| W0-3, Wave 2+, downstream implementation | NOT AUTHORIZED. | Do not start or promote until dependencies are independently cleared. |

TC-X-006 is not passed by an empty projection/report comparison; TC-X-007 is not passed by a bounded ledger subset. Replay-related TC-X-003 evidence remains subject to exact implementation/contract verification.

## Historical progress and integration boundary

`79/133` and `168/168` are strictly the dated 17 October 2026 historical snapshot, not current completion, regression or release evidence. The QA-approved wording correction exists in isolated `t_ba7b0968`, not this base/mainline. This supplement does not update `backlog.md` or treat that correction as integrated. Approval of any isolated artifact does not merge or promote it.

## Contract and migration impact; verification

No change to ADR-0001/ADR-0002, bounded contexts, application-service boundaries, event contracts, financial invariants, fixtures, schema, migrations or product behavior. No financial policy is decided here. Traceability/reporting impact only: W0-1 US/TC, W0-2 US/TC, B-004 structural inventory and epic-link gap, TC-X-003/006/007. Migration implications: none; no database operation occurred.

Added `tests/smoke/wave-0-1-evidence-matrix-current-2026-10-19.test.mjs`, a focused static status/provenance contract only. Its required red-first run before the supplement existed failed with ENOENT. After the B-004 candidate completion and rechecking QA task `t_66446e65` at 19:54 CEST, this supplement and contract were refreshed; the focused green run, syntax and whitespace results and current hashes are recorded in the task handoff. Candidate QA is blocked on provenance/status corrections; this task also requests independent QA review of this matrix supplement. No financial runtime, migration, restore/replay, provider, deployment, commit, push or production action was performed. Until reviews/gates clear, preserve all blocked statuses and grant no downstream authorization.
