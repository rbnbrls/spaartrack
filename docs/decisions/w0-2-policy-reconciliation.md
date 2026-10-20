# W0-2 policy reconciliation — v1

Status: Architecture reconciliation of the Ledger and Calculations owner handoffs against the QA-owned synthetic contract. Documentation only; not a financial implementation authorization or QA acceptance.

Reviewed sources: `roadmap.md` Wave 0/2 gates and US-0002-A/B/C; `AGENTS.md`; `test-cases.md` TC-US-0002-A/B/C; `docs/adr/0001-modular-monolith.md`; `docs/adr/0002-canonical-ledger.md`; Ledger handoff `docs/decisions/w0-2-ledger-policy.md` in worktree `t_941802f0`; Calculations handoff `docs/decisions/w0-2-calculation-policy.md` in worktree `t_71035d04`; and QA fixture/test `fixtures/W0-2-financial-contract-v1.json` / `tests/smoke/financial-invariant-contract.test.mjs` in worktree `t_0a835fa0`.

## Jointly approved scope: D-FEE-TAX-01

Ledger and Calculations reciprocally approve this bounded contract; neither handoff approves policy outside this scope:

- `amount` is gross consideration before attached fee/tax components.
- A fee/tax attached to BUY, SELL, or DIVIDEND is represented once on that activity/entry, not as an additional cash posting. The same component must not also be posted as a standalone FEE/TAX activity.
- BUY cash is debited by gross amount + fee + tax; acquisition basis is gross amount + acquisition fee + acquisition tax.
- SELL cash is credited by gross amount − fee − tax; net proceeds are gross amount − fee − tax; realized gain is net proceeds less allocated basis.
- DIVIDEND cash/net income is gross amount − fee − withholding tax; dividend fee/tax do not change equity cost basis.
- Standalone FEE/TAX debits its own gross amount with attached fee/tax components zero.
- Calculation versions and exact named B-case outputs are scoped to `cost-basis-v1` / `pnl-v1`; they do not determine the default cost-basis method or general rounding.

Approved synthetic examples from the owner artifacts:

| Case | Approved outputs |
|---|---|
| B-PARTIAL-SELL-FIFO-WAC-001 | FIFO: remaining quantity 3.000000000000, remaining basis 42.600000000000, realized gain 101.600000000000. WAC: remaining quantity 3.000000000000, remaining basis 34.800000000000, realized gain 93.800000000000. Fees 6.000000000000; taxes 5.000000000000. |
| B-PRICE-FX-DECOMPOSITION-001 | Under explicit FIFO: remaining native basis 61.800000000000 USD; transaction-currency realized P&L 16.800000000000; reporting realized P&L 15.120000000000 EUR; price P&L 46.560000000000 EUR; FX P&L 12.000000000000 EUR; unrealized P&L 58.560000000000 EUR; total P&L 73.680000000000 EUR. Fees 3.000000000000 USD; taxes 2.000000000000 USD. |
| Dividend arithmetic example | Gross 10.00 − fee 1.00 − withholding tax 2.00 = net cash/income 7.00. This is the owner-artifact example, not a new fixture assertion. |

The owner approvals do not establish universal precision/rounding, omitted-method defaults, general lot/split/residual allocation, or acceptance of every assertion in the QA fixture.

## Remaining NOT DECIDED policy

| Decision | Current bounded position | Minimum unresolved decision / impact |
|---|---|---|
| D-OVERDRAFT-01 | NOT DECIDED. Cash postings are account/currency scoped; the approved EUR 100 deposit / EUR 20 withdrawal example yields balance 80, contribution 100, spending 20. This does not approve negative cash. | Ledger owner must decide accept/reject for insufficient balance for BUY, WITHDRAWAL, FEE, TAX, and TRANSFER_OUT; if allowed, specify eligible account types/limits, effective-date rule, authorized role, and whether pending/draft reservations reduce available cash. Impacts US-0002-A / TC-US-0002-A. |
| D-SHORT-01 | NOT DECIDED. BUY 10 then SELL 4 leaves quantity 6; this does not decide an oversell. | Ledger owner must choose reject versus short-open for SELL exceeding available quantity. If shorting is allowed, specify eligibility, effective-date rule, quantity/sign and basis/P&L, borrow/corporate-action treatment, and covering allocation; if prohibited, define rejection and pending/unsettled quantity treatment. Impacts US-0002-A / TC-US-0002-A. |
| D-ROUNDING-01 | NOT DECIDED. Storage scales and the fixture's 12-decimal expected strings are observed contract facts/examples only, not a general calculation rule. | Calculations + Ledger owners must decide working precision by quantity/price/native/reporting/FX, rounding mode and intermediate quantization boundaries, split fraction and partial-lot residual allocation, plus canonical serialization/hash form. Impacts US-0002-A/B, split cases, replay/restore assertions, and TC-US-0002-A/B/C. |
| D-COST-BASIS-01 | NOT DECIDED. FIFO and WAC outputs above are approved only for the named cases/versions; existing FIFO default behavior is not policy approval. | Calculations owner must decide whether to define a default or require explicit method; supported methods/version transition boundary, deterministic lot ordering, and general fee/tax, split and residual rules (subject to rounding approval). Impacts US-0002-B / TC-US-0002-B. |
| D-TRANSFER-01 | Partially decided. Paired source DEBIT `TRANSFER_OUT` and destination CREDIT `TRANSFER_IN` are linked, external-flow-neutral; correction/VOID must treat the pair atomically, preserve originals, and audit reason/actor. | Ledger owner must decide correction representation (VOID metadata versus reversal entries), exact retry response, already-VOID/missing/mismatched pair behavior, reversal shape if any, and correction effective-date/as-of replay effects. No success result or reversal shape is approved for these edge cases. Impacts US-0002-C / TC-US-0002-C. |

## Explicit SELL direction conflict — owner action required

QA fixture `A-BUY-SELL-QUANTITY-001` asserts `then.cash_entry_direction_sell: "DEBIT"` (`fixtures/W0-2-financial-contract-v1.json`, `t_0a835fa0`). The jointly approved D-FEE-TAX-01 policy says SELL cash is a CREDIT (gross less fee/tax). The source artifacts do not define whether that fixture field means the cash leg or another ledger leg. This document does not infer its meaning or authorize editing the fixture/test.

Required clarification, with no assumption: Ledger and QA must identify the exact ledger leg represented by `cash_entry_direction_sell`. If it means the cash leg, Ledger and Calculations must jointly reconcile the expected direction with D-FEE-TAX-01 and record the owner decision. Until that happens, the field meaning/direction and affected A-case assertion remain NOT DECIDED; TC-US-0002-A and dependent QA acceptance must remain blocked. Keep the fixture as-is until owners explicitly resolve it.

## Traceability, boundaries, and gate

- US-0002-A / TC-US-0002-A: cash signs/balance and BUY/SELL quantity examples; overdraft and short policy remain open; SELL direction conflict remains unresolved.
- US-0002-B / TC-US-0002-B: partial-sale, fee/tax and price/FX cases; only the named method/version outcomes under D-FEE-TAX-01 are jointly approved. Default cost-basis and general rounding remain open.
- US-0002-C / TC-US-0002-C: paired transfer neutrality and atomic pair correction constraint; transfer correction edge behavior remains open. Existing W0-1 idempotency semantics are not changed by this reconciliation. General replay-hash determinism and restore equality remain NOT VERIFIED.

Architecture boundary: the canonical ledger is the only financial write boundary under ADR-0002. Read models, imports, connectors, UI, AI, and agents may not write ledger tables directly. No shared event/schema/ADR contract is changed here.

Migration implications: none. This handoff changes no schema, migration, fixture, test, or product code; no migration dry-run, restore drill, or runtime ledger behavior is claimed. Any future schema work requires a separately approved backward-compatible expand/contract plan and dry-run/restore evidence.

Gate: both owner decision artifacts received independent documentation-handoff approval, but W0-2 QA remains RED/BLOCKED: `owner_decisions_approved` intentionally remains false while the listed decisions and SELL-leg clarification are unresolved, and runtime/migration/replay/restore evidence is not supplied. W0-3 and financial implementation remain blocked/not authorized. After explicit owner updates, resume independent QA against the preserved red-first contract; do not mark the current intentional RED as a product pass.
