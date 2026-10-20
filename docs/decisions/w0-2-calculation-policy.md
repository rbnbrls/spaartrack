# W0-2 Calculation policy decisions — v1

Status: Calculations-owner documentation handoff. No financial implementation, schema change, migration, fixture/test edit, or release approval is authorized by this document.
Scope: Calculation-owned D-ROUNDING-01 and D-COST-BASIS-01; Calculations' proposal for joint D-FEE-TAX-01. Ledger's separate handoff is `docs/decisions/w0-2-ledger-policy.md` in worktree `/Users/ruben/spaartrack/.worktrees/t_941802f0`.

## Decision summary

| ID | Calculations disposition | Established / proposed | Gate |
|---|---|---|---|
| D-ROUNDING-01 | NOT DECIDED | Storage contracts expose quantity/amount/price scale 12 and FX scale 16; currency metadata exposes `minor_units` 0–8. These define storage/metadata precision only, not calculation precision, rounding mode, intermediate boundaries, or residual allocation. | Human/owner decision required for calculation precision, rounding mode and boundaries, quantity/split treatment, and allocation of residuals. |
| D-COST-BASIS-01 | NOT DECIDED | Existing local API offers FIFO and WAC and defaults to FIFO when method is omitted; this is observed implementation behavior, not an approved default or lot policy. Candidate policy for review: FIFO as default, WAC as explicit alternative; effective-date then UTC `occurred_at` ordering with deterministic transaction-ID tie-break; fees/taxes allocated pro rata to disposed quantity. | Requires explicit approval of default, method selection/version boundary, lot order, split treatment and acquisition/disposal fee/tax allocation. |
| D-FEE-TAX-01 | JOINTLY APPROVED WITHIN EXPLICIT SCOPE; A-case SELL-direction assertion unresolved | Ledger approves gross amount and one-time same-entry cash effects; Calculations approves the specified allocation, versions, and exact FIFO/WAC and price/FX golden outputs below. | The fixture's `A-BUY-SELL-QUANTITY-001.then.cash_entry_direction_sell: DEBIT` conflicts with approved SELL cash CREDIT semantics. Identify which ledger leg that field represents; if it is the cash leg, Ledger and Calculations must jointly reconcile the expected direction. Do not infer or alter the fixture. QA remains gated on resolution and independent review. Default cost-basis method and general rounding remain separate NOT DECIDED choices. |

Historical implementation or golden outputs do not constitute approval by themselves. Ledger explicitly approved the gross amount / one cash effect convention, and its updated artifact acknowledges Calculations' allocation, versions, and exact B-case outputs below. Together the two owner artifacts record joint D-FEE-TAX-01 approval only for the stated scope. D-ROUNDING-01 and D-COST-BASIS-01 remain separate NOT DECIDED choices.

## D-ROUNDING-01 — precision and rounding

**Disposition: NOT DECIDED.** The currently inspected storage contract (`database/schema.sql`) declares `ledger_entry.quantity`, `unit_price`, `amount`, `reporting_amount`, `fee_amount` and `tax_amount` as `numeric(28,12)`; `fx_rate.rate` is `numeric(28,16)`. Currency registry has `minor_units` constrained to 0–8. Existing API serialization uses 12 fractional digits. These are observed storage/serialization facts, not authority to round all currencies to minor units or to choose a rounding mode.

No approved source states calculation working precision, tie-breaking mode, whether to round after each operation or only at outputs, split fractional-share/residual handling, or which lot receives a residual cent/subunit. Thus this document does not authorize a rounding rule. Minimal decision needed: approve (1) working precision and quantization scale by quantity, unit price, native amount, reporting amount and FX; (2) named rounding mode; (3) exact intermediate rounding boundaries; (4) residual allocation for partial FIFO/WAC disposals and fractional split quantities; and (5) serialization/hash canonical form.

Until approved, the fixture's 12-decimal expected strings are exact existing contract examples, not proof of a generally approved rounding rule. Do not change them or claim general replay-hash equality from this handoff.

## D-COST-BASIS-01 — method and lot policy

**Disposition: NOT DECIDED.** The `costBasisRoute` in `apps/api/src/index.ts` currently accepts FIFO/WAC and uses FIFO when the method parameter is absent; `tests/smoke/cost-basis-contract.test.mjs` exercises both. The existing behavior is not an owner decision. The backlog refinement and TC-US-0404 require FIFO/WAC cases but do not establish canonical default, jurisdiction scope, or historical version transition.

**Candidate for explicit owner review, not approved under D-COST-BASIS-01:** FIFO default, WAC as an explicitly requested alternative; method and calculation version returned with every result; do not rewrite prior results when a method changes; lot acquisition order by effective date, then UTC occurred-at, then stable transaction ID; splits transform quantity while preserving total lot basis; acquisition fee/tax increase basis; disposal fee/tax reduce proceeds; allocate each lot's remaining basis pro rata to the quantity disposed, assigning any rounding residual only under an approved D-ROUNDING-01 rule. For the explicitly named `FIFO` and `WAC` golden calculations below, Calculations approves calculation outputs under `cost-basis-v1` and P&L outputs under `pnl-v1`; this is not approval of FIFO as the omitted-method default or of broader lot-policy details.

Smallest required decision: choose default (or require explicit method), supported methods and effective/version boundary; approve deterministic tie ordering; and agree fees/taxes/split/residual treatment. Until then no default, lot rule, or fiscal/jurisdiction claim is approved here.

## D-FEE-TAX-01 — Calculations allocation; Ledger cash convention confirmed

**Joint owner decision:** Calculations expressly approves the calculation-side allocation below for the specified contract cases and calculation versions. Ledger's updated owner artifact records reciprocal agreement with the same basis/proceeds/income treatment and exact outputs. The decision is limited to these semantics and cases; it does not include the canonical default cost-basis method or general rounding policy.

**Unresolved contract inconsistency:** The supplied QA fixture `A-BUY-SELL-QUANTITY-001` (`fixtures/W0-2-financial-contract-v1.json`, `then.cash_entry_direction_sell`) asserts `DEBIT`, whereas the jointly approved D-FEE-TAX-01 convention below specifies SELL cash as a CREDIT (gross proceeds less fee/tax). The existing approved sources do not establish whether that fixture field describes the cash leg or a different ledger leg. Do not infer its meaning or change the fixture/test. Smallest required clarification: Ledger and QA identify the exact ledger leg represented by the field; if it is the cash leg, Ledger and Calculations jointly reconcile the expected direction with the approved SELL cash rule and record the decision. Until then the field's meaning/direction and the affected A-case contract approval are NOT DECIDED, and dependent QA/golden readiness remains blocked.

### Approved calculation semantics (`cost-basis-v1` and `pnl-v1`)

- `amount` is gross trade/income consideration, excluding fee and tax, as decided by Ledger.
- `fee_amount` and `tax_amount` are separately identified components attached to the same activity entry, not already included in `amount`; each affects cash exactly once as decided by Ledger. Do not post the same attached fee/tax a second time as standalone FEE/TAX.
- BUY: cash debit = gross amount + fee + tax; acquisition basis = gross amount + acquisition fee + acquisition tax.
- SELL: cash credit = gross amount − fee − tax; realized gain = gross amount − disposal fee − disposal tax − allocated basis.
- DIVIDEND: cash credit/net income = gross dividend amount − fee − withholding tax; dividend fees/tax are separately exposed and do not alter equity cost basis. This agrees with the Ledger cash direction for DIVIDEND; instrument-income calculation remains versioned separately when implemented.
- Totals for fees/taxes remain separately reported as components and must not be added again to cash or P&L after their applicable inclusion above.
- All items are in the activity currency unless the canonical posting explicitly records otherwise. Missing FX remains an explicit calculation error; no implicit rate/inverse is assumed.

### Exact approved outputs for supplied synthetic B cases

The values below are approved Calculations golden outputs under the agreed fee/tax semantics for `cost-basis-v1` and `pnl-v1`. Values are written at the supplied fixture's 12-decimal display scale; that pins these exact examples only and does not settle the general precision/rounding policy D-ROUNDING-01.

**B-PARTIAL-SELL-FIFO-WAC-001** (EUR): BUY 10 × 10, gross 100, fee 2, tax 1; BUY 5 × 14, gross 70, fee 1, tax 0; SELL 12 × 20, gross 240, fee 3, tax 4. Total BUY basis before sale = 100+2+1+70+1 = 174. SELL gross proceeds 240; net proceeds for realized P&L = 240−3−4 = 233; total reported fees = 6; total reported taxes = 5.

| Explicit method | Disposed basis | Remaining quantity | Remaining basis | Realized gain |
|---|---:|---:|---:|---:|
| FIFO | 131.400000000000 (= 103 + 2/5 × 71) | 3.000000000000 | 42.600000000000 | 101.600000000000 (= 233 − 131.4) |
| WAC | 139.200000000000 (= 174 × 12/15) | 3.000000000000 | 34.800000000000 | 93.800000000000 (= 233 − 139.2) |

This confirms the fixture's exact FIFO/WAC fee/tax expected values under the jointly agreed gross-amount and one-cash-effect semantics. The fee/tax allocation decision is approved for these explicitly named cases; it does not establish an implicit default method.

**B-PRICE-FX-DECOMPOSITION-001** (USD instrument, EUR reporting): BUY 10 × 10, gross 100, fee 2, tax 1; SELL 4 × 15, gross 60, fee 1, tax 1; valuation price 20, cost-basis FX 0.8, valuation FX 0.9. Under explicit FIFO and the approved Calculations fee/tax treatment:

- BUY basis = 103.000000000000; basis disposed = 41.200000000000; remaining quantity = 6.000000000000 and remaining native basis = 61.800000000000.
- SELL net proceeds = 58.000000000000; realized P&L in transaction currency = 58 − 41.2 = 16.800000000000; reporting-currency realized P&L = 16.8 × 0.9 = 15.120000000000.
- Remaining market value = 6 × 20 = 120.000000000000 USD. Price P&L = (120 − 61.8) × 0.8 = 46.560000000000 EUR; FX P&L = 120 × (0.9 − 0.8) = 12.000000000000 EUR; unrealized P&L = 58.560000000000 EUR; total P&L = 73.680000000000 EUR.
- Separately reported fee total = 3.000000000000 USD; tax total = 2.000000000000 USD.

These exact values are approved by Calculations for `pnl-v1`, with Ledger's gross-amount/attached-component cash rule. Dividend gross-to-net example under the jointly agreed convention: gross 10.00, fee 1.00, withholding tax 2.00 → net cash credit and net income 7.00. It illustrates the agreed arithmetic; no dividend case is added to or changed in the fixture by this task.

### Joint decision record and scope boundary

Ledger's artifact `docs/decisions/w0-2-ledger-policy.md` (worktree `/Users/ruben/spaartrack/.worktrees/t_941802f0`) explicitly approves gross `amount`, same-entry attached fee/tax, cash direction/formula for BUY/SELL/DIVIDEND, standalone FEE/TAX handling, and no duplicate representation. Calculations approves BUY basis inclusion; SELL net proceeds and realized gain; dividend net income treatment; versions `cost-basis-v1` / `pnl-v1`; and all exact fee/tax-sensitive B-case outputs above. Ledger's updated artifact reciprocally acknowledges those exact choices. Together the artifacts record joint D-FEE-TAX-01 approval only within this scope. Independent review and release gates still apply; canonical method default and general rounding remain undecided.

## Other supplied cases and traceability

- **US-0002-A / TC-US-0002-A:** cash-sign case A-CASH-SIGNS-001 expects EUR 100 deposit and EUR 20 withdrawal → balance 80.000000000000, contribution 100.000000000000, spending 20.000000000000, nonnegative entry magnitudes. This does not decide overdraft or short-sale policy (Ledger-owned). A-BUY-SELL-QUANTITY-001 expects BUY 10 / SELL 4 → remaining 6.000000000000, but its `cash_entry_direction_sell: DEBIT` conflicts with D-FEE-TAX-01's SELL cash CREDIT rule. The intended ledger leg is unresolved as described above; the affected assertion and dependent QA remain gated. Split fractional quantity/residual remains subject to D-ROUNDING-01.
- **US-0002-B / TC-US-0002-B:** B-PARTIAL-SELL-FIFO-WAC-001 and B-PRICE-FX-DECOMPOSITION-001 fee/tax allocations and exact outputs above are approved under the explicit FIFO/WAC methods and versions noted. Their final contract/release readiness still depends on separate D-COST-BASIS-01 and D-ROUNDING-01 decisions and independent QA review; do not silently treat the default method or general rounding policy as decided.
- **US-0002-C / TC-US-0002-C:** paired EUR 25.50 transfer has neutral portfolio external contribution/spending; exact idempotency conflict and VOID/replay/restore contract comes from the supplied QA fixture and W0-1 ledger boundary. Calculations does not own Ledger posting/correction policy. Replay hash algorithm and general restore equality remain NOT VERIFIED; this handoff does not claim their runtime proof.

## Sources reviewed

- `roadmap.md` (Wave 0/Wave 2 gates; US-0404/0405, US-0408 and calculation evidence).
- `AGENTS.md` (canonical ledger is read-only to calculations; synthetic-only; schema/implementation restrictions).
- `test-cases.md` lines 61–64 (TC-US-0002 and A/B/C acceptance text); lines 140–148 (TC-US-0404/0405/0406/0407/0408).
- `docs/adr/0001-modular-monolith.md`; `docs/adr/0002-canonical-ledger.md`.
- `docs/architecture.md` and `docs/backlog/b-004-refinement.md` W0-2 ownership/gating constraints.
- `database/schema.sql` (numeric scales and currency minor-unit metadata); `apps/api/src/index.ts` cost-basis/P&L paths (observed behavior only, not approval).
- `tests/smoke/cost-basis-contract.test.mjs`, `tests/smoke/pnl-contract.test.mjs`, `tests/smoke/financial-golden-contract.test.mjs`, and `fixtures/CALC-001.json`.
- QA-owned `fixtures/W0-2-financial-contract-v1.json` and `tests/smoke/financial-invariant-contract.test.mjs` in `/Users/ruben/spaartrack/.worktrees/t_0a835fa0`.
- Ledger-owned `docs/decisions/w0-2-ledger-policy.md` in worktree `/Users/ruben/spaartrack/.worktrees/t_941802f0`, updated with explicit Ledger owner approval of gross amount/single attached-component cash effects, reciprocal acknowledgement of Calculations' approved basis/proceeds/income treatment, versions and listed golden outputs, and the matching unresolved A-case SELL-direction discrepancy.

## Evidence, gate and authorization

The QA contract was executed in its own worktree with `node --test tests/smoke/financial-invariant-contract.test.mjs`: 5 tests total, 4 passed and 1 intentionally failed at the `owner_decisions_approved=false` guard. This is red-first contract evidence, not runtime financial behavior. No calculation runtime, restore, migration dry-run, ledger mutation, or financial fixture alteration was performed by this task.

D-ROUNDING-01 and D-COST-BASIS-01 remain NOT DECIDED pending explicit policy approval, with the smallest required decisions identified above. D-FEE-TAX-01 is jointly approved only for the documented gross amount/same-entry cash treatment, calculation allocation, `cost-basis-v1` / `pnl-v1`, and exact listed B-case outputs; the A-case SELL direction discrepancy and intended ledger leg remain NOT DECIDED. Independent review and QA contract review remain required; relevant QA/golden readiness stays blocked until the inconsistency is reconciled and reviews are recorded. This artifact authorizes no financial implementation, schema/migration work, direct ledger mutation, fixture/test edits, or downstream financial implementation.
