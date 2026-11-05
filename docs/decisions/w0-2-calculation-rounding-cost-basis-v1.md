# W0-2 Calculations decisions: rounding and cost basis — v1

Status: Calculations-owner decision proposal for D-ROUNDING-01 and D-COST-BASIS-01; Ledger concurrence and independent QA review are required before these dispositions may be treated as an accepted cross-context contract. Documentation only. No financial implementation, fixture/test change, schema/migration, ledger mutation, or release authorization is made here.
Scope: US-0002-B / TC-US-0002-B only. The two named B-case examples below are included as checks; the decisions do not resolve the SELL-leg conflict in US-0002-A or grant W0-2/W0-3 implementation authority.

## Decision summary

| ID | Calculations disposition | Scope / next gate |
|---|---|---|
| D-ROUNDING-01 | Calculations proposes the deterministic decimal precision, rounding and serialization policy below. | Ledger concurrence is required for canonical numeric input/storage compatibility and for any canonical replay/restore serialization or hash contract. No ledger-side decision is implied. |
| D-COST-BASIS-01 | Calculations decides that a method is required on each cost-basis calculation; no omitted-method default is approved. FIFO and WAC are supported named methods for the scoped contract. | Ledger concurrence is required for the effective-date/POSTED-input ordering boundary against canonical activity semantics. QA must independently review and rerun the preserved contract. |
| D-FEE-TAX-01 | Unchanged: jointly approved only for the exact gross amount, one-time attached fee/tax treatment, formulas, versions and named cases in the referenced owner artifacts. | This note does not broaden that approval. |

## D-ROUNDING-01 — calculation-side precision and rounding proposal

### Internal arithmetic and rounding boundaries

Calculations will parse decimal input strings as base-10 decimal values, never binary floating-point. Calculation working precision is 34 significant decimal digits; arithmetic uses ROUND_HALF_EVEN when a working operation exceeds that precision. Intermediate lot allocation, FX multiplication, addition/subtraction and ratio calculations are not quantized to currency minor units. Quantize only when producing a typed calculation output:

- Quantity and unit price: 12 fractional decimal places.
- Native-currency and reporting-currency monetary outputs: 12 fractional decimal places.
- FX rate outputs: 16 fractional decimal places.
- All output quantization uses ROUND_HALF_EVEN.

These proposed scales match the observed storage/output examples (12 places for quantity/price/amount and 16 for FX), but do not assert that a storage declaration itself establishes calculation policy. Currency `minor_units` is a display convention only; it must not round or feed back into cost basis, P&L, FX, or replay inputs.

### Display and canonical serialization

Calculation/API canonical decimal values are strings, not JSON binary-number values, with fixed trailing zeros at the typed scales above, ASCII decimal point, no grouping separators, and no locale-dependent formatting. Dates/timestamps in a canonical serialized calculation record use ISO-8601 UTC (`Z`); the calculation's as-of date and timezone must be explicit inputs and included in its metadata. User-facing display may localize separators and round currency to the currency's declared `minor_units`, but is a presentation-only transformation and never becomes a calculation or hash input.

For partial-lot allocation, retain the 34-digit decimal result through all lot and P&L arithmetic and round only the resulting typed outputs. When a reported set of rounded lot allocations has a sub-unit residual relative to the rounded aggregate, assign that displayed residual to the last consumed lot in deterministic lot order; the unrounded calculation values and aggregate remain authoritative. For a split, retain the exact rational quantity and unchanged total lot basis in calculation state; serialize quantity to 12 places using ROUND_HALF_EVEN and derive displayed unit basis from the retained total basis and exact quantity. A fractional entitlement/residual must not be silently discarded. How such residual state maps into canonical ledger entries, snapshots, or replay hashes needs Ledger concurrence before any implementation or ledger-backed assertion.

### Synthetic rounding vectors

These are arithmetic contract examples, not changes to `W0-2-financial-contract-v1.json` or assertions that its owner guard is resolved.

| Vector | Input / boundary | Expected canonical output |
|---|---|---|
| ROUND-HALF-EVEN-ODD-001 | Quantity-like decimal `1.2345678901235`, quantize to 12 places; tie with last retained digit odd. | `1.234567890124` |
| ROUND-HALF-EVEN-EVEN-001 | Quantity-like decimal `1.2345678901225`, quantize to 12 places; tie with last retained digit even. | `1.234567890122` |
| ROUND-FX-HALF-EVEN-001 | FX decimal `0.12345678901234575`, quantize to 16 places; tie with last retained digit odd. | `0.1234567890123458` |
| ROUND-SPLIT-RESIDUAL-001 | Synthetic lot quantity `1`, split ratio `1:3`, total basis EUR `10`. | Internal quantity remains exact `1/3`; serialized quantity `0.333333333333`; total basis remains `10.000000000000`. The sub-12-place entitlement is retained internally and not discarded; Ledger must concur on any canonical persistence/replay representation. |

### Exact Ledger concurrence required for D-ROUNDING-01

Ledger owns canonical ledger schema, posting and replay semantics under ADR-0002. Before this calculation proposal is treated as a shared contract, Ledger must explicitly concur (or return an alternative) on: (1) accepting decimal-string input and these scale boundaries alongside existing canonical precision; (2) the meaning and permitted persistence of split/lot fractional residuals without a ledger mutation or hidden balancing entry; and (3) the exact canonical serialized representation of calculation inputs/outputs included in replay/restore equality or hashes. Until then those ledger-facing implications remain unresolved; no replay/hash determinism or restore equality is claimed.

## D-COST-BASIS-01 — explicit method required

### Method selection and version boundary

A cost-basis result MUST be requested with an explicit method. The supported methods in this scope are `FIFO` and `WAC`; omission is a validation error, not an implicit FIFO choice. The existing endpoint's observed FIFO fallback is not approved policy. Every result identifies both the method and calculation version (`cost-basis-v1`; derived P&L identifies `pnl-v1`). Changing method or calculation version creates a separately identified calculation result; it does not rewrite prior ledger activities or silently replace a historical result. An as-of result is evaluated for an explicitly supplied inclusive effective date; it is read-only and does not alter the canonical ledger.

For determinism within a requested method, candidate acquisition lots are ordered by effective date, then `occurred_at` normalized to UTC, then a stable canonical transaction identifier. Equal keys require deterministic stable identifier ordering; local timezone or ingestion order is not a tie-breaker. Calculations proposes including only Ledger-authorized posted activities in the calculation. Ledger concurrence is required that effective date, UTC occurrence time, stable ID and posted-state eligibility have the stated canonical meanings and that this ordering is compatible with ledger replay; this note does not decide Ledger activity or posting semantics.

### Lot, sale, fee/tax and split treatment

- FIFO consumes the earliest eligible acquisition lot first. WAC pools eligible remaining basis over eligible remaining quantity and allocates that average basis proportionally to the disposed quantity.
- Partial sale basis is allocated in proportion to the disposed quantity using the D-ROUNDING-01 working precision; the unrounded remaining basis is conserved. Serialized quantities and monetary values use the proposed D-ROUNDING-01 output scales.
- Acquisition fees and acquisition taxes increase the basis of that acquisition. Disposal fees and disposal taxes reduce net sale proceeds; realized gain equals gross proceeds less disposal fee/tax less basis allocated to the sold quantity. Fees and taxes remain separately reportable and are not deducted a second time. These statements only restate the jointly approved D-FEE-TAX-01 calculation scope; they do not decide cash postings.
- A split adjusts quantity by its stated ratio while preserving total lot basis and historical lot identity. Fractional entitlement/residual handling follows D-ROUNDING-01; any canonical ledger representation remains subject to Ledger concurrence. No extra cashflow or ledger entry is inferred by this calculation decision.
- FIFO and WAC exact values below are approved only for their named synthetic case/version. This note does not make a tax-jurisdiction, tax-advice, LIFO/HIFO/specific-identification, short-position, overdraft, or other method claim.

### Synthetic partial-sale expected output

`B-PARTIAL-SELL-FIFO-WAC-001` (synthetic EUR): BUY 10 × EUR 10 (gross 100, fee 2, tax 1); BUY 5 × EUR 14 (gross 70, fee 1, tax 0); SELL 12 × EUR 20 (gross 240, fee 3, tax 4). Per the bounded D-FEE-TAX-01 basis/proceeds semantics, acquisition bases are EUR 103 and EUR 71; total pre-sale basis EUR 174; net proceeds EUR 233; reported fees EUR 6 and taxes EUR 5.

| Explicit method | Remaining quantity | Remaining basis | Realized gain |
|---|---:|---:|---:|
| FIFO | `3.000000000000` | `42.600000000000` EUR | `101.600000000000` EUR |
| WAC | `3.000000000000` | `34.800000000000` EUR | `93.800000000000` EUR |

Formula checks: FIFO disposed basis = `103 + (2/5 × 71) = 131.4`; realized = `233 − 131.4 = 101.6`. WAC disposed basis = `174 × (12/15) = 139.2`; realized = `233 − 139.2 = 93.8`. These outputs match the named fixture values and previously approved B-case artifact; they do not resolve the fixture's owner-decision guard or establish a default method.

## Cross-reference: bounded D-FEE-TAX-01 only

This note cross-references `docs/decisions/w0-2-b-case-fee-tax-calculation-v1.md` and the reciprocal Ledger policy `docs/decisions/w0-2-ledger-policy.md`. Their joint approval is limited to gross amount, attached fee/tax represented once, BUY basis/cash formula, SELL proceeds/cash/realized-gain formula, DIVIDEND net income, and the named `cost-basis-v1` / `pnl-v1` B-case outputs. No extra fee/tax allocation, posting direction, cash-entry shape, or generalized tax behavior is authorized here.

## Traceability, evidence and gate

- Exact mapping: `US-0002-B` → `TC-US-0002-B` (`test-cases.md`); cases `B-PARTIAL-SELL-FIFO-WAC-001` and `B-PRICE-FX-DECOMPOSITION-001` in QA-owned synthetic fixture `fixtures/W0-2-financial-contract-v1.json` in worktree `t_0a835fa0`.
- Related contracts read: `docs/adr/0002-canonical-ledger.md`; `docs/decisions/w0-2-calculation-policy.md`; `docs/decisions/w0-2-b-case-fee-tax-calculation-v1.md`; reciprocal `docs/decisions/w0-2-ledger-policy.md`; reconciliation `docs/decisions/w0-2-policy-reconciliation.md`; Ledger closeout and overdraft/short addendum; QA fixture/test. ADR-0002 keeps the ledger canonical and all calculation results derived/read-only.
- RED-first evidence, trace `calc-w02-rounding-cost-20261019`, correlation `calc-w02-rounding-cost-20261019`: `TRACE_ID=calc-w02-rounding-cost-20261019 CORRELATION_ID=calc-w02-rounding-cost-20261019 node --test tests/smoke/financial-invariant-contract.test.mjs` in worktree `t_0a835fa0` returned 5 tests: 4 passed and 1 failed intentionally at `owner_decisions_approved=false` (`financial-invariant-contract.test.mjs:79-80`). Preserve the RED guard; this is contract evidence only, not runtime financial behavior.
- Focused calculation contracts, same trace/correlation: `TRACE_ID=calc-w02-rounding-cost-20261019 CORRELATION_ID=calc-w02-rounding-cost-20261019 node --test tests/smoke/cost-basis-contract.test.mjs tests/smoke/pnl-contract.test.mjs tests/smoke/financial-golden-contract.test.mjs` in this task worktree returned 7 tests: 4 passed, 0 failed, 3 runtime-gated skips. Runtime finance tests were not run.
- Synthetic vectors were recomputed using exact base-10 decimal arithmetic before authoring; their outputs are stated above. No runtime ledger, market-data provider, migration, database, restore, replay, or hash operation was run. There are no executed financial runtime trace records beyond the contract-test trace/correlation IDs stated above.

Compatibility and limitations: No source, fixture, test, schema, migration, ADR, roadmap, backlog, or canonical ledger data was changed. The note is a Calculations proposal pending the exact Ledger concurrence enumerated above and independent QA review. The existing 12-place example strings and current endpoint's FIFO fallback are not, by themselves, proof of these general rules. No implementation, W0-3, Wave 2+, Poort A/B/C, or release is authorized.

Gate report: W0-2 remains RED/BLOCKED. The QA owner guard remains intentionally false; independent QA must review this note and update/rerun the contract without weakening it only after all required decisions are reconciled. Separately unresolved Ledger/QA SELL-leg identification (and Ledger+Calculations reconciliation if cash), Ledger overdraft, short-position and transfer-edge decisions remain blockers. Replay/hash determinism and restore equality remain NOT VERIFIED. No release clearance.
