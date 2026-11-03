# W0-2 B-case fee/tax calculation decision — v1

Status: Calculations-owner decision artifact for the bounded US-0002-B / TC-US-0002-B fee/tax cases. It records the reciprocal Ledger + Calculations approval already present in their owner artifacts; it is not financial implementation or release authorization. No fixture, test, product source, schema, migration, shared backlog, or canonical ledger data is changed by this artifact.

## Scope and decision

This decision applies only to the named synthetic B cases below and calculation versions `cost-basis-v1` and `pnl-v1`. The owners agree on gross `amount`, one-time same-entry attached fee/tax treatment, BUY basis, SELL proceeds/realized gain, dividend net income, and the listed exact outputs. The fee/tax components remain separately reportable, but are not an additional cash posting or a second P&L deduction after their applicable inclusion in the formulas below.

It does not select a default cost-basis method or approve general lot ordering, rounding/precision policy, split or residual allocation, overdraft/short behavior, transfer edges, or the unresolved US-0002-A SELL direction field. In particular, the A-case `cash_entry_direction_sell: DEBIT` discrepancy is outside this B-case decision and remains NOT DECIDED under the owner/reconciliation artifacts. No B-case output should be used to infer those policies.

## Versioned formulas and cash/basis semantics

- `amount` is gross trade or dividend consideration before attached fees and taxes.
- For BUY, cash decreases by `gross + fee + tax`; acquisition basis increases by the same `gross + fee + tax`.
- For SELL, cash increases by `gross - fee - tax`; net proceeds equal `gross - fee - tax`; realized gain equals `net proceeds - basis allocated to disposed quantity`.
- For DIVIDEND, cash credit and net income equal `gross - fee - withholding tax`; dividend components do not change equity cost basis.
- Each attached component is represented once on its activity/entry. Do not also post it as standalone FEE/TAX. A standalone FEE or TAX is outside these B cases and follows Ledger's separately documented amount/cash rule.
- Native amounts stay in the activity/instrument currency. Reporting-currency values are converted only with the explicit rates supplied by the price/FX case. A required but missing FX rate must fail explicitly; there is no inverse-rate or implicit-rate assumption.

## Exact synthetic B-case outputs

All numeric strings below preserve the fixture's displayed 12 fractional places. This pins these examples only; it does not approve a generalized working precision, rounding mode, intermediate quantization boundary, or residual rule.

### B-PARTIAL-SELL-FIFO-WAC-001 — EUR

Input sequence as supplied: BUY 10 × EUR 10 (gross 100, fee 2, tax 1); BUY 5 × EUR 14 (gross 70, fee 1, tax 0); SELL 12 × EUR 20 (gross 240, fee 3, tax 4). The fixture has no explicit transaction timestamps or timezone for these B inputs; this decision uses the supplied sequence and does not define a general same-date ordering rule.

Formulas and common totals:

- First BUY basis: `100 + 2 + 1 = 103 EUR`.
- Second BUY basis: `70 + 1 + 0 = 71 EUR`.
- Total pre-sale basis: `103 + 71 = 174 EUR`.
- SELL net proceeds/cash credit: `240 - 3 - 4 = 233 EUR`.
- Fees reported: `2 + 1 + 3 = 6 EUR`; taxes reported: `1 + 0 + 4 = 5 EUR`.

| Explicit method | Disposed basis | Remaining quantity | Remaining basis | Realized gain |
|---|---:|---:|---:|---:|
| FIFO | `103 + (2/5 × 71) = 131.400000000000 EUR` | `3.000000000000` | `42.600000000000 EUR` | `233 - 131.4 = 101.600000000000 EUR` |
| WAC | `174 × (12/15) = 139.200000000000 EUR` | `3.000000000000` | `34.800000000000 EUR` | `233 - 139.2 = 93.800000000000 EUR` |

These values approve FIFO and WAC outputs for their explicitly named method cases only. They do not approve which method is selected when a method is omitted.

### B-PRICE-FX-DECOMPOSITION-001 — USD instrument, EUR reporting

Inputs as supplied: BUY 10 × USD 10 (gross 100, fee 2, tax 1); SELL 4 × USD 15 (gross 60, fee 1, tax 1); valuation price USD 20; cost-basis FX `0.8 EUR/USD`; valuation FX `0.9 EUR/USD`. The B fixture provides these rates as explicit inputs but does not specify an as-of date, observation timestamp, or timezone; this decision performs no market-data lookup or temporal selection.

- BUY basis: `100 + 2 + 1 = 103 USD`.
- Basis disposed: `103 × (4/10) = 41.200000000000 USD`; remaining quantity `6.000000000000`; remaining native basis `61.800000000000 USD`.
- SELL net proceeds/cash credit: `60 - 1 - 1 = 58 USD`.
- Realized transaction-currency P&L: `58 - 41.2 = 16.800000000000 USD`.
- Realized reporting-currency P&L: `16.8 × 0.9 = 15.120000000000 EUR`.
- Remaining market value: `6 × 20 = 120 USD`.
- Price P&L: `(120 - 61.8) × 0.8 = 46.560000000000 EUR`.
- FX P&L: `120 × (0.9 - 0.8) = 12.000000000000 EUR`.
- Unrealized P&L: `46.56 + 12 = 58.560000000000 EUR`.
- Total P&L: `15.12 + 58.56 = 73.680000000000 EUR`.
- Fees reported: `2 + 1 = 3.000000000000 USD`; taxes reported: `1 + 1 = 2.000000000000 USD`.

The price and FX components use the explicit fixture decomposition; native USD amounts and EUR reporting amounts are kept distinct.

### Dividend attached-component example

The reciprocal owner artifacts give a synthetic illustration, not an added fixture assertion: gross dividend `10.00`, fee `1.00`, withholding tax `2.00` gives cash credit and net income `7.00`. No as-of date/timezone is specified or inferred.

## Precision, dates, timezone, and boundaries

The results above are exact expected decimal strings for the supplied values at the fixture's 12-decimal output scale. They are not evidence for rounding at each operation, currency-minor-unit quantization, a tie-breaking mode, or general serialization/hash rules; D-ROUNDING-01 remains NOT DECIDED. The B cases supply no dates/timezones for the listed calculation inputs, and the price/FX case supplies explicit rates but no as-of metadata. No date, timezone, rate source, stale-rate policy, or general effective-date ordering is invented here. Results are deterministic for these stated inputs, selected method, explicit rates, and named versions.

## Sources and traceability

- Story/test: US-0002-B / TC-US-0002-B; `roadmap.md`, `test-cases.md`, and `docs/backlog/b-004-refinement.md`.
- Canonical data boundary: `docs/adr/0002-canonical-ledger.md`; calculation outputs are derived/read-only and do not mutate the ledger.
- Joint policy evidence: `docs/decisions/w0-2-calculation-policy.md` in worktree `t_71035d04` and reciprocal `docs/decisions/w0-2-ledger-policy.md` in worktree `t_941802f0`; both limit D-FEE-TAX-01 to the stated amount/component treatment and named cases/versions.
- Reconciled scope and unresolved decisions: `docs/decisions/w0-2-policy-reconciliation.md` in worktree `t_ca53a2ba`.
- Exact inputs/expected values: `fixtures/W0-2-financial-contract-v1.json` in QA worktree `t_0a835fa0`; existing calculation contracts `tests/smoke/cost-basis-contract.test.mjs`, `tests/smoke/pnl-contract.test.mjs`, and `fixtures/CALC-001.json` were also inspected. CALC-001 is separate supporting context, not authority to extend this decision.

## Reproducible verification and gate

Checks used `TRACE_ID=calc-w02-bcase-20261018` and `CORRELATION_ID=calc-w02-bcase-20261018`.

- RED-first contract evidence, in QA worktree: `node --test tests/smoke/financial-invariant-contract.test.mjs` — 5 total, 4 passed, 1 intentional failure at `owner_decisions_approved=false` (`financial-invariant-contract.test.mjs:80`). This preserves the overall gate as RED; it is not a financial runtime failure or pass.
- Focused calculation contract, in this worktree: `node --test tests/smoke/cost-basis-contract.test.mjs tests/smoke/pnl-contract.test.mjs tests/smoke/financial-golden-contract.test.mjs` — 6 total, 3 passed, 0 failed, 3 runtime-gated skips. No runtime financial stack test was executed.
- Arithmetic was independently recomputed from the stated decimal inputs using exact decimal arithmetic; outputs are enumerated above.
- No runtime ledger posting, migration, restore, replay/hash determinism, or production-data operation was performed. No implementation authorization is granted.

D-FEE-TAX-01 is recorded as jointly approved only for this bounded policy and these exact named outputs. The overall W0-2 QA/release gate remains RED/BLOCKED pending the unresolved owner decisions, the A-case SELL-leg clarification, full contract acceptance, and applicable independent verification. W0-3 remains blocked.