# W0-2 Ledger concurrence: rounding and cost basis — v1

Status: bounded Ledger concurrence for Calculations proposals D-ROUNDING-01 and D-COST-BASIS-01 only. This is a documentation decision, not approval of W0-2 overall, the QA owner guard, implementation, W0-3, Wave 2+, or a release. It does not decide the US-0002-A SELL-leg conflict, overdraft, short positions, or transfer edge cases.
Traceability: US-0002-B / TC-US-0002-B. Calculations proposal reviewed: `docs/decisions/w0-2-calculation-rounding-cost-basis-v1.md` (from parent worktree `t_61151bb9`). ADR: `docs/adr/0002-canonical-ledger.md`.

## Decisions

### D-ROUNDING-01

1. Decimal-string boundary and scales — CONCUR, bounded to the stated interfaces. The canonical schema stores ledger-entry quantity, unit price, amount, reporting amount, fee and tax as `numeric(28,12)`, and FX as `numeric(28,16)` (`database/schema.sql`, `ledger_entry`). These scales are compatible with decimal-string inputs and fixed-scale decimal-string calculation outputs at 12 places (or 16 for FX); they do not establish a currency-minor-unit rounding rule. The proposal's base-10, 34-significant-digit calculation working precision and ROUND_HALF_EVEN output quantization are acceptable as a calculation-side proposal, provided canonical ledger writes remain bounded by the existing schema precision and occur only through the authorized application command boundary. This concurrence does not authorize schema changes or ledger writes.

2. Fractional split/lot residuals — CONCUR, calculation-local only. A calculation may retain an exact fractional entitlement/residual in its own versioned derived state while reporting the specified rounded output. Such retained calculation state must not silently mutate canonical ledger activities, create an implicit balancing entry, or imply a new canonical ledger persistence contract. This is not approval to persist an exact rational residual in ledger tables; canonical schema representation and any future ledger-backed persistence remain undecided and require an explicit Ledger-owned proposal and review.

3. Replay/restore canonical serialization — NOT DECIDED. The proposal's fixed-scale decimal strings, UTC timestamp strings, and explicit versioning are suitable candidate serialization requirements, but this Ledger concurrence does not establish the canonical byte representation, included fields, normalization rules, digest inputs, or equality contract for replay/restore. Existing replay code computes `replay_hash` as SHA-256 over `JSON.stringify({ rows, balances, totals })`; its selected rows and aggregation outputs are not, by themselves, a complete canonical-serialization or restore-equality specification (`apps/api/src/index.ts`, ledger replay route). No replay/restore hash or equality claim is made here. A separate Ledger-owned, versioned replay/restore serialization contract must specify field coverage and ordering, decimal/timestamp normalization, and hash-version compatibility before calculation records can be asserted as canonical hash inputs.

### D-COST-BASIS-01

1. Activity ordering — CONCUR for the scoped cost-basis calculation input order: ascending `effective_date`, then `occurred_at` as a UTC instant, then stable canonical ledger transaction ID. `effective_date` remains the explicit business-date/as-of boundary; normalizing `occurred_at` to UTC does not turn it into the effective date. The final ID tie-break prevents ingestion order or local timezone from deciding lot order. This is consistent with the current canonical columns (`effective_date date`, `occurred_at timestamptz`, transaction `id uuid`) and observed ordered ledger reads, but does not impose a broader ordering rule on other projections or change replay semantics.

2. Eligibility — CONCUR for this calculation scope: only `POSTED` ledger activities are eligible; DRAFT, PENDING, and VOID activities are excluded. This is compatible with the canonical replay endpoint's current `state = 'POSTED'` predicate and the cost-basis input query's current POSTED filter. As-of inclusion remains bounded by the supplied inclusive `effective_date`. This does not authorize posting, state transitions, or a change to canonical ledger lifecycle semantics.

3. Explicit method — ACKNOWLEDGED as a Calculations-owned policy: requiring each cost-basis request to explicitly name FIFO or WAC, with no implicit method default, does not conflict with the Ledger contract reviewed here. Ledger does not decide method selection, tax methodology, or the validity of any additional cost-basis method.

## Evidence and limitations

- Read ADR-0002, `test-cases.md` entry `TC-US-0002-B`, the Calculations proposal, canonical schema declarations, and current replay/cost-basis query boundaries.
- Current schema evidence: `ledger_entry` uses `numeric(28,12)` for quantity, unit price and monetary fields and `numeric(28,16)` for FX; `ledger_transaction` has `effective_date`, `occurred_at timestamptz`, `id`, and lifecycle state. This shows storage compatibility for the proposed serialized scales; it does not prove an end-to-end numeric precision, hash, or restore contract.
- Current ordering and POSTED-filter evidence is implementation compatibility only. No runtime calculation, migration dry-run, restore, replay, hash recomputation, or invariant test was executed for this documentation-only concurrence. Consequently there are no executed trace/correlation IDs or replay hash/determinism evidence to report.
- No fixture, test, source, schema, migration, canonical ledger data, ADR, roadmap, or backlog was changed by this decision.

## Gate report

Ledger concurrence is recorded only for the bounded items explicitly marked CONCUR above. Replay/restore canonical serialization and persistence of fractional residual state in the canonical ledger remain NOT DECIDED. W0-2 remains RED/BLOCKED pending the preserved QA owner approval guard, independent QA review, and the other separately tracked policy decisions. This artifact does not approve W0-2 overall or authorize implementation, W0-3, Wave 2+, Poort A/B/C, or release.
