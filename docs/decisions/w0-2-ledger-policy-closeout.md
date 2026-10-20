# W0-2 Ledger policy closeout — v1

Status: Owner-decision reconciliation and precise escalation only. This is documentation, not implementation authorization or W0-2 QA/release acceptance. All remaining unanswered policies below remain visibly NOT DECIDED; no financial behavior is inferred from field names, current code, storage scales, or sample outputs.

## Scope and traceability

This closeout covers US-0002-A/B/C and TC-US-0002-A/B/C only, with Ledger ownership for cash/quantity/transfer semantics and reciprocal Calculations agreement for calculation-owned outputs. The roadmap defines the A/B/C scope at `roadmap.md:911-913`; the exact test contracts are `test-cases.md:61-64`. ADR-0002 (`docs/adr/0002-canonical-ledger.md:9-16`) makes `ledger_transaction` and `ledger_entry` canonical, requires correction/VOID auditability, and gates idempotency, replay, and restore. `AGENTS.md:3,7-22` prohibits direct writes outside the application boundary, physical deletion, and unapproved/untested schema work.

Sources re-inspected:

- QA contract and synthetic fixture: `/Users/ruben/spaartrack/.worktrees/t_0a835fa0/tests/smoke/financial-invariant-contract.test.mjs` and `/Users/ruben/spaartrack/.worktrees/t_0a835fa0/fixtures/W0-2-financial-contract-v1.json`.
- Ledger owner policy: `/Users/ruben/spaartrack/.worktrees/t_941802f0/docs/decisions/w0-2-ledger-policy.md`.
- Calculations owner policy: `/Users/ruben/spaartrack/.worktrees/t_71035d04/docs/decisions/w0-2-calculation-policy.md`.
- Existing reconciliation: `/Users/ruben/spaartrack/.worktrees/t_ca53a2ba/docs/decisions/w0-2-policy-reconciliation.md`.
- Sell-field clarification: `/Users/ruben/spaartrack/.worktrees/t_49297bc1/docs/decisions/w0-2-sell-direction-field-clarification.md`.
- Overdraft/short Ledger addendum: `/Users/ruben/spaartrack/.worktrees/t_cd28cac1/docs/decisions/w0-2-ledger-overdraft-short-policy.md`.

## Disposition inventory

| Policy | Current disposition and authority | Exact unresolved answer / gate |
|---|---|---|
| D-FEE-TAX-01 | JOINTLY APPROVED only within scope in the reciprocal Ledger and Calculations records and task handoffs (`t_941802f0`, `t_71035d04`; Calculations artifact independently reviewed on `t_71035d04`). Gross amount; attached fee/tax represented once on the same activity, not double-posted; BUY cash/basis gross+fee+tax; SELL cash/net proceeds gross-fee-tax and realized gain net proceeds less allocated basis; DIVIDEND net cash/income gross-fee-withholding tax; standalone FEE/TAX debits own gross amount. Named B-case outputs only under `cost-basis-v1` / `pnl-v1`. | This approval does not approve a canonical cost-basis default, general rounding, or the conflicting A-case SELL direction assertion. |
| SELL direction in `A-BUY-SELL-QUANTITY-001` | NOT DECIDED. Fixture says `cash_entry_direction_sell: DEBIT` (`fixtures/W0-2-financial-contract-v1.json:41-59`); joint D-FEE-TAX-01 says SELL cash CREDIT. Neither source establishes which actual ledger leg the fixture field identifies. | Ledger + QA must name the exact entry/leg represented by this field. If it is cash, Ledger + Calculations must explicitly reconcile whether the approved cash rule or A-case expected contract is to be revised; do not edit fixture/test until that decision is recorded and reviewed. If not cash, identify the actual leg and provide the intended entry-contract evidence. `TC-US-0002-A` stays blocked. |
| D-OVERDRAFT-01 | NOT DECIDED; Ledger-owned. Solvent EUR 100 deposit / EUR 20 withdrawal output does not decide insufficient funds. | Ledger owner must select reject or permit by each applicable debit class (BUY, WITHDRAWAL, standalone FEE/TAX, TRANSFER_OUT). If permitted, state eligible account type(s), currency/amount limit, pending/draft reservation treatment, effective-date versus current-policy rule, and authorized existing role(s). If rejected, specify the insufficient-available-cash outcome for each class. Existing OWNER/EDITOR scope does not grant an overdraft facility. See overdraft/short addendum lines 15-19. |
| D-SHORT-01 | NOT DECIDED; Ledger-owned. BUY 10 / SELL 4 -> quantity 6 does not establish oversell behavior. | Ledger owner must select reject or short-open for SELL above available quantity. If short-open: name eligible account/instrument scope and limits, pending/unsettled/effective-date quantity rule, signed quantity and opening basis/realized-P&L treatment, and minimum cover/close plus replay/correction linkage. If reject: state quantity-availability rule and rejection outcome. No role expansion, borrow feature, or corporate-action rule is assumed. See addendum lines 21-25. |
| D-ROUNDING-01 | NOT DECIDED; Calculations + Ledger owners. Storage scale/minor-unit metadata and 12-decimal fixture strings are evidence about storage/examples, not a general computation rule. | Jointly decide working precision by quantity/unit-price/native/reporting/FX value; named rounding mode; intermediate quantization boundaries; split fractional-share and partial-lot residual allocation; canonical serialization/hash form. Until then, generalized arithmetic and hash assertions cannot be approved. |
| D-COST-BASIS-01 | NOT DECIDED; Calculations-owned. Exact named FIFO/WAC cases are approved only within D-FEE-TAX-01 scope; observed FIFO API default is not policy approval. | Calculations owner must choose a canonical default or require explicit method; enumerate supported methods and version/effective boundary; deterministic lot ordering; general fee/tax allocation and split/residual rules (subject to D-ROUNDING-01). No existing FIFO default is presumed approved. |
| D-TRANSFER-01 | PARTIALLY DECIDED; Ledger-owned. Paired transfer is linked, external-flow neutral; corrections must be atomic as a pair, preserve both originals, and audit reason/actor/trace context. | Ledger owner must decide: (1) correction representation—paired VOID metadata only or also reversal activities/entries, and exact reversal signs/types if any; (2) exact retry result/no-op semantics; (3) safe outcomes for already-VOID, missing, mismatched, or previously replayed pair; (4) whether correction effective date may differ and how as-of replay changes. A one-leg correction must never commit; no success result or reversal shape is presumed for unresolved cases. See Ledger policy lines 36-52. |

## Owner reciprocity and independent review

- D-FEE-TAX-01 is the only calculation-related output set jointly approved here. Ledger's policy lines 54-71 records cash/amount semantics and reciprocal Calculations confirmation; Calculations' policy lines 32-72 records its allocation, versions, and exact named B outputs and confirms Ledger concurrence. Independent Calculations artifact review is recorded as documentation-only PASS in QA task `t_71035d04`.
- No reciprocal approval exists for generalized D-ROUNDING-01 or D-COST-BASIS-01. Those stay NOT DECIDED, with the required owner choices above; Ledger does not decide Calculation-owned behavior.
- Independent QA review of the overdraft/short addendum `t_2ff90bbc` is PASS for documentation-only scope. It confirms both remain NOT DECIDED and keeps W0-2 RED; it is not financial QA acceptance.
- Broader independent W0-2 review `t_e2698177` is BLOCKED for QA/release and W0-3. It found the SELL-leg conflict and remaining open decisions; documentation handoffs were reviewed only within scope.

## Verification and gates

Red-first verification, using synthetic contract only:

`TRACE_ID=ledger-w02-closeout-20261018 CORRELATION_ID=ledger-w02-closeout-20261018 node --test tests/smoke/financial-invariant-contract.test.mjs`

Executed in `/Users/ruben/spaartrack/.worktrees/t_0a835fa0`. Actual result: 5 tests; 4 passed (TC-US-0002-A, -B, -C and unresolved-decision inventory); 1 failed intentionally at `tests/smoke/financial-invariant-contract.test.mjs:79-80`; 0 skipped; exit 1. Failure is `owner_decisions_approved=false` versus expected true. Preserve this RED guard; it is not a runtime/product defect or an approval.

Migration status: no schema or migration proposed or changed; no dry-run, idempotence, or restore exercise performed for this docs-only closeout. Migration/restore evidence remains NOT VERIFIED. Replay hash/determinism and restored replay equality: NOT VERIFIED; no replay was run. No ledger command, direct SQL mutation, code, fixture, or test edit was made.

Gate: W0-2 remains RED/BLOCKED and W0-3 remains blocked. No financial implementation, schema/migration change, fixture/test amendment, or ledger mutation is authorized. To reconsider the gate, record the exact Ledger and Calculations answers above where applicable, resolve the A-case leg conflict with QA, then obtain independent QA contract acceptance and separately verify runtime invariants, isolation, migration dry-run/idempotence, restore equality, and deterministic replay/hash.
