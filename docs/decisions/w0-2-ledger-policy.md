# W0-2 Ledger policy decisions — v1

Status: Ledger-owner documentation handoff; not an implementation authorization.
Scope: Ledger-owned decisions D-OVERDRAFT-01, D-SHORT-01, D-TRANSFER-01, plus Ledger's side of joint D-FEE-TAX-01.
Evidence basis: approved W0-1 contract and the W0-2 synthetic contract v1.0.0. This document deliberately distinguishes approved contract constraints from questions that remain NOT DECIDED. No fixture, test, shared backlog, schema, migration, or product code is changed by this handoff.

## Decision summary

| ID | Ledger disposition | What is established | What remains open |
|---|---|---|---|
| D-OVERDRAFT-01 | NOT DECIDED | A cash posting is scoped to its financial account and currency; an insufficient-balance policy must be made explicit before its dependent case can be approved. | Whether negative cash is permitted, eligible account types, overdraft limit, role authorization, effective-date/as-of rule, and accept/reject results for each debit action. |
| D-SHORT-01 | NOT DECIDED | The supplied BUY 10 / SELL 4 case has expected remaining quantity 6; it does not exercise an insufficient-quantity sale. | Whether short positions are permitted, eligible accounts/roles, effective-date boundary, short quantity/basis, borrow and corporate-action treatment, covering, and insufficient-quantity SELL outcome. |
| D-TRANSFER-01 | PARTIALLY DECIDED; exact correction contract NOT DECIDED | A paired internal transfer has two linked legs, is neutral to external contribution/spending, and correction/VOID is a unit operation that preserves the original activities and is audited. | Exact reversal/correction record shape; behavior for retries and for an already-VOID or otherwise inconsistent pair; precise error/outcome in those cases. |
| D-FEE-TAX-01 | Jointly approved within explicit scope; fixture direction conflict unresolved | Ledger approves gross-amount and one-time same-entry cash treatment; Calculations approves calculation allocation and listed `cost-basis-v1` / `pnl-v1` fixture outcomes. | `A-BUY-SELL-QUANTITY-001` expects SELL cash entry direction `DEBIT`, conflicting with this policy's SELL cash CREDIT; clarify the fixture field's intended ledger leg or revise the approved contract in a separate owner/QA decision. No approval beyond the stated activity/component treatment and named synthetic FIFO/WAC and price/FX cases; default cost-basis and general rounding remain separate undecided decisions. |

No unspecified result in the fixture is deemed approved merely because it has a numeric expected value. Fee/tax-dependent values are approved only to the explicit joint scope and named synthetic cases below; this is not a general approval of cost-basis default or rounding policy.

## D-OVERDRAFT-01 — cash insufficiency

Disposition: NOT DECIDED. Neither ADR-0002, the W0-1 ownership/security contract, roadmap US-0002-A, TC-US-0002-A, nor the supplied contract defines overdraft eligibility or a negative-cash rule. Ledger will not infer a universal reject rule or an account-specific credit facility from the existing account types.

What can be asserted from the current contract: for the synthetic EUR account with opening balance 0, POSTED DEPOSIT 100.00 and POSTED WITHDRAWAL 20.00 produce balance 80.000000000000, external contribution 100.000000000000, external spending 20.000000000000, and non-negative entry magnitudes. A paired transfer is not external contribution or spending. These do not settle whether an otherwise valid debit may take an account below zero.

Smallest required decision before the insufficient-cash branch is testable: for each debit activity (BUY, WITHDRAWAL, FEE, TAX, TRANSFER_OUT), choose whether insufficient available balance is rejected or may post; if permitted, name eligible account types and a limit. Also state (1) whether the rule applies by transaction effective date or current account policy, (2) which server-authorized account role may invoke it, and (3) whether pending/draft reservations count as available cash. No allow/reject response code is approved by this handoff.

Effective-date/account-role constraint: the W0-1 contract requires server-derived identity and active OWNER/EDITOR portfolio/account scope for ledger commands. Unauthenticated commands are denied with 401; out-of-scope, revoked, or insufficient authorization is denied with 403 `PORTFOLIO_ROLE_FORBIDDEN`. That authorization boundary does not grant an overdraft facility, determine an account's credit eligibility, or establish the effective-date rule. No extra role is authorized here.

## D-SHORT-01 — insufficient-quantity SELL

Disposition: NOT DECIDED. TC-US-0002-A's supplied quantity case posts BUY 10 and SELL 4 and expects remaining quantity 6.000000000000; it asserts only that a sell does not increase the position. It does not establish whether SELL quantity greater than available quantity is rejected or opens a short.

Smallest required decision: choose reject versus short-open for an insufficient-quantity SELL. If short-open is allowed, specify account/instrument eligibility and effective-date boundary, sign/quantity convention, initial short basis and realized-P&L treatment, borrow costs, split/corporate-action behavior, and covering-trade allocation. If disallowed, specify the command rejection outcome and whether pending/draft buys or unsettled positions affect available quantity. Until that choice, neither acceptance nor rejection is a normative assertion.

The W0-1 authorization boundary still applies: commands require an authenticated, in-scope OWNER/EDITOR; it says nothing about a position's permission to become short. No role-specific short permission or effective-date policy is approved here.

## D-TRANSFER-01 — paired correction and replay

Disposition: approved constraint for unit correction; unresolved details explicitly remain NOT DECIDED.

For synthetic transfer `synthetic-transfer-0002-001`, EUR 25.50 from `synthetic-cash-eur-a` to `synthetic-cash-eur-b`, the contract's accepted posting/replay outcome is:

- source activity `TRANSFER_OUT`, DEBIT; destination activity `TRANSFER_IN`, CREDIT;
- both legs reference each other and both have `is_external_flow=false`;
- portfolio external-contribution delta and external-spending delta are each `0.000000000000`;
- the pair is the atomic correction unit: a request to correct/VOID only one leg must not commit a one-sided financial correction;
- correction preserves both original activities and entries; it records correction reason and actor for audit (and retains trace/correlation context under the W0-1 audit contract).

Atomicity constraint: the two legs' correction state and its audit record must share the required ledger command transaction boundary. A failed command must leave both original legs and their states unchanged; it must not leave one corrected leg. This is an expected contract boundary, not evidence that runtime failure-injection has verified it.

NOT DECIDED: whether correction is represented by paired VOID metadata only or also by new reversal activities/entries; identifiers/types and exact signs/amounts if reversal records exist; the audit action/field names beyond the required reason, actor and traceability; response semantics for an exact retry; and handling where one leg is already VOID, missing, mismatched, or has already been replayed. Replay is read-only and must not itself trigger correction. Until those cases are decided, the test must not assert a newly invented reversal shape or a success response for an inconsistent pair. A human must choose the canonical correction representation and the safe retry/inconsistent-pair outcomes.

Authorization/effective date: the correction command uses the same authenticated scoped OWNER/EDITOR boundary and audit actor as other ledger mutations. Existing contract does not state whether correction effective date can differ from original effective date or how that affects historical as-of replay; this remains NOT DECIDED and must not be silently inferred from wall-clock time.

## D-FEE-TAX-01 — joint fee/tax decision (bounded scope)

Ledger-owner decision: `amount` is the gross trade/income consideration before attached fee and tax components. A fee/tax attached to a BUY, SELL, or DIVIDEND is recorded once as a component on the same activity/ledger entry; it is not a second cash posting. The entry's cash effect is derived once from gross amount and the attached components:

| Activity | Cash effect | Example |
|---|---|---|
| BUY | Debit `amount + fee_amount + tax_amount` | gross 100, fee 2, tax 1 => cash decreases 103 |
| SELL | Credit `amount - fee_amount - tax_amount` | gross 240, fee 3, tax 4 => cash increases 233 |
| DIVIDEND | Credit `amount - fee_amount - tax_amount` | gross 10, fee 1, tax 2 => cash increases 7 |
| Standalone FEE or TAX | Debit its gross `amount`; attached fee/tax components are zero | a separately booked fee of 2 decreases cash by 2 |

The same fee/tax must not be both attached to a trade/income activity and posted again as a standalone FEE/TAX activity. If a source presents it separately, the normalized command must choose one representation before posting. Fee/tax component totals may be reported separately for explanation, but those informational totals do not create extra cash changes. This is Ledger's decision on amount/cash posting semantics.

Unresolved fixture inconsistency: the separate synthetic case `A-BUY-SELL-QUANTITY-001` in `fixtures/W0-2-financial-contract-v1.json` asserts `cash_entry_direction_sell: "DEBIT"` (QA worktree, lines 55–56), while the jointly approved D-FEE-TAX-01 convention above says a SELL cash effect is a CREDIT (gross less fee/tax). The current approved contract does not establish whether that fixture field describes the cash leg or a different ledger leg, nor does it authorize changing the expected direction. Smallest required decision: Ledger and QA must identify the exact leg represented by `cash_entry_direction_sell`; if it is the cash leg, the Ledger and Calculations owners must jointly reconcile the expected direction with D-FEE-TAX-01. Until recorded, that SELL-direction assertion and any dependent contract approval remain NOT DECIDED; do not change the fixture/test or infer leg semantics. This does not withdraw the separately scoped fee/tax amount, cash-effect, basis, proceeds, or P&L agreements above, but the discrepancy blocks QA acceptance of the conflicting fixture case.

Calculations owner `t_71035d04` has explicitly confirmed agreement with the Ledger cash/amount convention and approved the calculation-side treatment: BUY acquisition basis is gross plus acquisition fee and tax; SELL net proceeds are gross less fee and tax, and realized gain is net proceeds less allocated basis; DIVIDEND net income is gross less fee and withholding tax, with dividend components not changing equity cost basis. The Calculations owner approved the specific fixture values under `cost-basis-v1` / `pnl-v1`: partial-sale FIFO remaining basis `42.600000000000`, realized `101.600000000000`; WAC remaining basis `34.800000000000`, realized `93.800000000000`; price/FX case realized P&L `15.120000000000` EUR, price P&L `46.560000000000`, FX P&L `12.000000000000`, unrealized P&L `58.560000000000`, total P&L `73.680000000000` EUR. This acknowledgment is Ledger's record of the calculation owner confirmation; it does not extend to other methods, default method choice, general rounding, or unlisted cases.

Joint decision recorded across Ledger artifact `docs/decisions/w0-2-ledger-policy.md` and Calculations artifact `docs/decisions/w0-2-calculation-policy.md`, with reciprocal owner statements on task cards `t_941802f0` and `t_71035d04`. The decision is limited to the precise semantics and values above. Independent review and QA gate remain pending; no fixture amendment or test approval is implied.

## Traceability and scope

- US-0002-A / TC-US-0002-A: 100.00 deposit / 20.00 withdrawal exact result and BUY/SELL quantity outcome are specified by the fixture, but the SELL direction assertion conflicts with the D-FEE-TAX-01 cash convention and remains unresolved as above; overdraft and insufficient-quantity choices remain open. The roadmap story also names splits, but this W0-2 Ledger decision does not define split ratio/rounding semantics.
- US-0002-B / TC-US-0002-B: Ledger cash effects follow the gross amount and attached-component rules above. Calculations has approved the listed FIFO/WAC and price/FX outputs for named methods/versions. Canonical default method and general rounding remain separate decisions and are not approved here.
- US-0002-C / TC-US-0002-C: paired transfer neutrality and pair correction atomicity/preservation are constrained above. Existing W0-1 idempotency contract defines the account-scoped identity namespace, exact normalized replay returning the original without new entries/audit/event, 409 `IDEMPOTENCY_KEY_CONFLICT` on changed content, and independence across accounts. Those are documented contract outcomes, not runtime evidence. Replay hash algorithm, general deterministic replay, and restore equality remain NOT VERIFIED.

Review sources: `AGENTS.md`; `roadmap.md` US-0002 at lines 674 and 911–913; `test-cases.md` TC-US-0002 and TC-US-0002-A/B/C at lines 61–64; `docs/adr/0002-canonical-ledger.md`; approved W0-1 ownership/idempotency/authorization/correction handoff recorded on parent `t_4aa20f5c` and Ledger re-review `t_e0dd69d3`; `docs/backlog/b-004-refinement.md` W0-2 rows and no-invented-policy constraints; `fixtures/W0-2-financial-contract-v1.json` and `tests/smoke/financial-invariant-contract.test.mjs` in QA worktree `/Users/ruben/spaartrack/.worktrees/t_0a835fa0`; Calculations owner confirmation in `docs/decisions/w0-2-calculation-policy.md` and task card `t_71035d04`. The focused QA contract was run there: 4 passed, 1 failed intentionally at the `owner_decisions_approved=false` RED guard. That is test-gate evidence, not financial behavior or replay/restore evidence.

## Gate and authorization

This is a documentation-only Ledger-owner handoff and bounded joint fee/tax decision record, with the fixture SELL-direction discrepancy explicitly unresolved. It does not authorize financial implementation, direct ledger writes, schema changes, migrations, production data use, or fixture/test edits. No migration dry-run, migration idempotence test, database restore, runtime ledger mutation, replay hash verification, or failure-injection was performed for this handoff. W0-2 QA remains gated on independent review of both owner decision artifacts and the QA contract, and on resolution of the SELL-direction discrepancy. No W0-3 or other downstream financial implementation is authorized.
