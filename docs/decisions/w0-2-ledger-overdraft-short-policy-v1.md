# W0-2 Ledger overdraft and short-position decisions — v1

Status: D-OVERDRAFT-01 and D-SHORT-01 are NOT DECIDED. This is a Ledger-owner decision record, not implementation or release authorization.
Scope: insufficient cash/overdraft and insufficient-quantity SELL/short-open behavior required by US-0002-A / TC-US-0002-A and the linked US-0002-B/C invariant contract. No other financial policy is decided here.

## Decision summary

| Decision | Ledger disposition | Evidence established | Owner decision still required |
|---|---|---|---|
| D-OVERDRAFT-01 | NOT DECIDED | The supplied A-cash case starts at EUR 0, deposits EUR 100 and withdraws EUR 20, yielding EUR 80, contribution EUR 100, spending EUR 20. This does not test insufficient funds. The linked fee/tax rule only establishes the bounded BUY/SELL/DIVIDEND cash effects and does not establish overdraft permission. | Choose whether an insufficient-cash debit rejects, or may post under an explicitly scoped overdraft. If allowed, specify eligible account types and currency-specific/amount limits; whether pending/draft reservations reduce available cash; whether the policy is selected at command time or transaction effective date/as-of; and which authorized role may invoke it. |
| D-SHORT-01 | NOT DECIDED | The supplied quantity case buys 10 and sells 4, leaving 6. It does not test an oversell. | Choose reject versus short-open when SELL quantity exceeds eligible available quantity. If short-open is allowed, specify eligibility and any quantity/coverage limit, effective-date and pending/unsettled-quantity treatment, and the minimum open → cover/close lifecycle accounting/replay rules. If rejected, define which available-quantity state is checked and the rejection outcome. |

The existing W0-1 authorization boundary requires authenticated, server-derived identity and active OWNER/EDITOR scope for ledger commands, with 401 for unauthenticated and 403 `PORTFOLIO_ROLE_FORBIDDEN` for out-of-scope/revoked/insufficient authorization. This is not an overdraft or short permission and does not decide whether either role has additional financial authority. Owners must explicitly state whether the existing role boundary suffices or a narrower authorization rule is required; do not infer either from the contract.

## D-OVERDRAFT-01 — smallest required owner answer

Ledger owner: for each insufficient-cash debit represented by the current contract—BUY, WITHDRAWAL, standalone FEE/TAX, and paired TRANSFER_OUT—select (a) reject or (b) permit only for explicitly named account type(s) with a stated limit. State whether pending/draft reservations count against available cash, whether policy follows the transaction's effective date or the current account policy, and which existing authorized role(s) may invoke an allowed overdraft. A decision must state the expected result for each applicable debit class; no status/error code, credit facility, negative-balance default, or role expansion is approved by this artifact.

The exact cash sign/magnitude and balance assertions already supplied for solvent transactions remain separate from this unanswered insufficiency rule. Jointly approved D-FEE-TAX-01 remains narrow: gross amount, one-time attached fee/tax treatment, BUY/SELL/DIVIDEND cash semantics and named B-case outputs only.

## D-SHORT-01 — smallest required owner answer

Ledger owner: when a SELL exceeds quantity available under the chosen effective-date and pending/unsettled rules, select (a) reject or (b) permit a short-open. If permitted, name eligible account/instrument scope and any short limit, specify the signed quantity/basis and realized-P&L treatment at opening, and define the minimum cover/close behavior and replay/correction linkage needed so later covering trades cannot be mistaken for ordinary long-position disposals. State whether pending buys or unsettled positions count toward quantity available. If rejected, state the rejection outcome and the available-quantity rule. No shorting default, borrowing feature, or corporate-action policy is approved here.

The BUY 10 / SELL 4 fixture only establishes remaining quantity 6 and that SELL must not increase position quantity. It does not establish oversell acceptance or rejection.

## Traceability and source paths

- US-0002-A / TC-US-0002-A: `roadmap.md:911`, `test-cases.md:62`; current synthetic cases `A-CASH-SIGNS-001` and `A-BUY-SELL-QUANTITY-001` in `/Users/ruben/spaartrack/.worktrees/t_0a835fa0/fixtures/W0-2-financial-contract-v1.json`.
- US-0002-B / TC-US-0002-B: `roadmap.md:912`, `test-cases.md:63`; retained only as linked contract context, not newly decided by this record.
- US-0002-C / TC-US-0002-C: `roadmap.md:913`, `test-cases.md:64`; retained only as linked contract context, not newly decided by this record.
- QA executable invariant contract: `/Users/ruben/spaartrack/.worktrees/t_0a835fa0/tests/smoke/financial-invariant-contract.test.mjs`.
- Ledger policy record: `/Users/ruben/spaartrack/.worktrees/t_941802f0/docs/decisions/w0-2-ledger-policy.md`.
- Calculations policy record: `/Users/ruben/spaartrack/.worktrees/t_71035d04/docs/decisions/w0-2-calculation-policy.md`.
- Owner-policy reconciliation: `/Users/ruben/spaartrack/.worktrees/t_ca53a2ba/docs/decisions/w0-2-policy-reconciliation.md`.
- SELL-field clarification (separate and still unresolved): `/Users/ruben/spaartrack/.worktrees/t_49297bc1/docs/decisions/w0-2-sell-direction-field-clarification.md`.
- Architecture boundary: `AGENTS.md`, `docs/adr/0002-canonical-ledger.md`, and the approved W0-1 contract. Canonical ledger remains the only financial write boundary; mutations must use application commands/services. No direct ledger-table writes are authorized.

The SELL direction assertion in `A-BUY-SELL-QUANTITY-001` remains unresolved: the fixture says DEBIT while the bounded joint D-FEE-TAX-01 policy says SELL cash is CREDIT, and the intended leg is not established. This artifact does not settle that separate clarification. D-ROUNDING-01, D-COST-BASIS-01 and D-TRANSFER-01 retain their existing NOT DECIDED/partially decided status; D-FEE-TAX-01 scope is unchanged.

## Verification, migration, replay and gate

Focused synthetic contract check (trace context set explicitly):

`TRACE_ID=ledger-w02-policy-20261018 CORRELATION_ID=ledger-w02-policy-20261018 node --test tests/smoke/financial-invariant-contract.test.mjs` in `/Users/ruben/spaartrack/.worktrees/t_0a835fa0` returned 5 tests: 4 passed; 1 failed intentionally at `owner_decisions_approved=false` (`tests/smoke/financial-invariant-contract.test.mjs:79-80`). The assertions for TC-US-0002-A/B/C and the unresolved-decision inventory passed; the explicit RED guard remains active. This is contract-gate evidence only, not runtime ledger behavior.

No schema or migration was proposed or run. Migration dry-run, migration idempotence, database restore, replay execution/hash, and deterministic replay are NOT VERIFIED. No ledger command or financial mutation was issued. The task worktree contained no pre-existing changes before this artifact; `git diff --check` passed after authoring it.

Gate: W0-2 remains RED/BLOCKED until the owner answers above are explicit and the separate SELL-leg conflict and other open decisions are reconciled with the QA fixture/test. Independent QA review `t_e2698177` completed its broader W0-2 verification: documentation handoffs passed within scope, but the financial QA/release gate remains BLOCKED. The artifact-specific independent QA follow-up `t_2ff90bbc` remains pending. No W0-2/W0-3 financial implementation authority is granted.