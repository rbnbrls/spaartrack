# W0-2 SELL direction field clarification — v1

Status: NOT DECIDED; owner clarification required. Documentation-only record. This artifact does not approve or amend the QA fixture/test, financial policy, or implementation contract.
Scope: the exact `A-BUY-SELL-QUANTITY-001.then.cash_entry_direction_sell` field in `fixtures/W0-2-financial-contract-v1.json`, for US-0002-A / TC-US-0002-A only.

## Finding

The synthetic fixture states `cash_entry_direction_sell: "DEBIT"` for a SELL of quantity 4 and amount 60. The jointly approved D-FEE-TAX-01 convention states that SELL cash is a CREDIT (gross proceeds less any attached fee/tax). The fixture case lists transactions and expected fields, but does not enumerate ledger entries or define which entry/leg this field describes. Its `cash_entry_direction_*` name suggests a cash leg, but the name alone does not establish the intended canonical leg or authorize changing the approved contract. The evidence therefore does not uniquely settle the field semantics.

No Ledger or QA decision is made here to treat the field as cash or non-cash. The fixture and test remain unchanged; neither value is silently accepted as an approved financial invariant.

## Smallest required clarification

Ledger and QA must answer: **Which exact ledger entry/leg does `cash_entry_direction_sell` describe in `A-BUY-SELL-QUANTITY-001`?** Select and document one of these interpretations, with the actual leg identified:

1. **Cash leg.** Confirm that the field is the SELL cash entry. Its current `DEBIT` assertion conflicts with jointly approved D-FEE-TAX-01 SELL cash CREDIT. Ledger and Calculations must then jointly reconcile and explicitly record the approved direction/contract disposition before the A-case assertion can pass; this artifact does not choose whether or how the assertion is amended.
2. **Non-cash leg.** Name the actual ledger leg represented (not merely “non-cash”), and document why this field records that leg's direction. Ledger and QA must substantiate that mapping from the intended entry contract. Do not change the fixture/test as part of this clarification; any subsequent contract amendment requires a separate explicit decision and review.

Until the exact leg is identified and, if it is cash, Ledger + Calculations reconcile it, the SELL direction field and affected A-case assertion remain NOT DECIDED. TC-US-0002-A and W0-2 remain RED/BLOCKED. No W0-2/W0-3 financial implementation authority is granted.

## Scope boundary and traceability

- US-0002-A / TC-US-0002-A: this artifact addresses only the meaning and disposition gate of the named SELL-direction field. It does not decide insufficient cash, insufficient quantity, split behavior, or any other A-case policy.
- D-FEE-TAX-01 remains jointly approved only within its previously recorded scope: gross amount, one-time attached fee/tax treatment, BUY basis/cash, SELL proceeds/cash, DIVIDEND net income, and the named B-case outputs/versions. This clarification does not expand or withdraw that scope.
- D-OVERDRAFT-01, D-SHORT-01, D-ROUNDING-01, D-COST-BASIS-01, and D-TRANSFER-01 are not resolved or modified by this artifact. Replay hash/general determinism, restore equality, runtime invariants, and migration evidence remain NOT VERIFIED.
- No source code, QA fixture/test, ADR, schema, migration, backlog, or canonical ledger data is changed. Migration status: no migration proposed or run; dry-run, idempotence, restore, and replay evidence are not applicable to this docs-only clarification and remain unverified for the broader gate.

## Evidence reviewed

- `roadmap.md`, Wave 0 gate and US-0002 scope.
- `AGENTS.md`, synthetic-data, TDD, canonical-ledger ownership, and migration constraints.
- `docs/adr/0002-canonical-ledger.md`, canonical transaction/entry ownership and correction/replay gate.
- `test-cases.md`, TC-US-0002-A and adjacent TC-US-0002-B/C traceability.
- `docs/backlog/b-004-refinement.md`, US-0002-A requirement not to invent balancing policy.
- QA synthetic fixture `fixtures/W0-2-financial-contract-v1.json` and `tests/smoke/financial-invariant-contract.test.mjs` in `/Users/ruben/spaartrack/.worktrees/t_0a835fa0`.
- Ledger owner policy `docs/decisions/w0-2-ledger-policy.md` in `/Users/ruben/spaartrack/.worktrees/t_941802f0`; Calculations owner policy `docs/decisions/w0-2-calculation-policy.md` in `/Users/ruben/spaartrack/.worktrees/t_71035d04`; reconciliation `docs/decisions/w0-2-policy-reconciliation.md` in `/Users/ruben/spaartrack/.worktrees/t_ca53a2ba`.

Owner action: Ledger + QA identify and record the exact leg. If cash, Ledger + Calculations record the reconciliation. Next gate: independent QA review against the preserved fixture/test and all remaining policy/runtime gates; no downstream implementation until all are closed.
