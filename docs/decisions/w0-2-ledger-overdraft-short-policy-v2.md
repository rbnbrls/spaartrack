# W0-2 Ledger overdraft and short-position policy — v2

Status: D-SHORT-01 is DECIDED by the Ledger owner for the bounded scope below: reject all SELL commands that would create a negative position; short opening is not permitted. D-OVERDRAFT-01 remains NOT DECIDED. This versioned Ledger-owner record does not authorize implementation, fixture/test edits, schema or migration work, or ledger mutation.

Scope: US-0002-A / TC-US-0002-A, with linked invariant context in US-0002-B/C and TC-US-0002-B/C. The relevant roadmap child stories are `roadmap.md:953-955`; corresponding acceptance rows are `test-cases.md:62-64`. ADR-0002 establishes `ledger_transaction` and `ledger_entry` as canonical, correction/VOID auditability, and replay/restore as gates. Financial changes, if later authorized, must use Ledger application commands/services only.

## Decision summary

| Decision | Disposition | Effective scope | Rationale |
|---|---|---|---|
| D-OVERDRAFT-01 | NOT DECIDED: neither blanket reject nor permit is approved. | Insufficient available cash for BUY, WITHDRAWAL, standalone FEE, standalone TAX, or TRANSFER_OUT in the affected financial account and currency. Attached BUY/SELL/DIVIDEND fee/tax components retain only the already-approved bounded D-FEE-TAX-01 treatment; this note does not redefine it. | The existing solvent deposit/withdrawal vector and the bounded fee/tax convention do not specify credit eligibility, available-cash calculation, limits, timing, or role authority. |
| D-SHORT-01 | DECIDED: reject any SELL that would make the account/instrument position negative; short positions are not supported for any account or instrument in this scope. | All SELL postings under US-0002-A / TC-US-0002-A. Available quantity is the nonnegative POSTED quantity for the same financial account and instrument immediately before the command; DRAFT/PENDING activities and uncommitted/unsettled candidate trades do not increase it. | The bounded contract requires an explicit nonnegative quantity invariant; permitting a short would require a separate, versioned lifecycle/basis/cover policy not in scope. Rejecting prevents unsupported negative positions and has a deterministic no-post result. |

The existing authorization contract requires an authenticated, server-derived principal with active OWNER/EDITOR scope; unauthenticated commands are denied (401), while out-of-scope/revoked/insufficient authorization is denied (403 `PORTFOLIO_ROLE_FORBIDDEN`). This is not permission to overdraft or short. No additional role or financial entitlement is established here.

## D-OVERDRAFT-01 — smallest Ledger-owner decision required

For each debit class (BUY, WITHDRAWAL, standalone FEE, standalone TAX, TRANSFER_OUT), Ledger must explicitly choose:

1. Reject an insufficient-available-cash command, or permit it only for named account types with an explicit currency/amount limit (including whether the limit is zero/none or a defined credit facility).
2. Define available cash: whether POSTED balance alone applies and how PENDING/DRAFT reservations, holds, or unsettled cash affect the amount.
3. State whether eligibility follows the account policy at command/posting time or at the transaction effective date/as-of date.
4. State which existing authorized role(s) may invoke permitted overdraft; do not infer this from OWNER/EDITOR scope.
5. Give the deterministic command result for every debit class at the insufficiency boundary, including stable rejection/error semantics if rejecting, or the resulting balance/limit behavior if permitting.

Until answered, insufficient-cash outcomes for each class are NOT DECIDED. No generic insufficient-funds error code, transaction acceptance, negative-cash default, or limit is asserted by this record.

## D-SHORT-01 — reject short opening

Disposition: DECIDED by the Ledger owner for US-0002-A / TC-US-0002-A. No short position may be opened: for every financial-account type and instrument class, reject a SELL if its quantity exceeds available position quantity. There is no short-eligible account or instrument class, no borrowing/borrow-fee treatment, and no short-opening limit other than zero.

Available quantity is evaluated per `(financial_account_id, instrument_id)` from POSTED activity state immediately before the SELL command. DRAFT/PENDING buys, unsettled candidate trades, and reservations do not count as owned quantity. For deterministic replay, POSTED activities are considered in effective-date order, then UTC `occurred_at`, then stable activity ID as a tie-break. A SELL must be no greater than available quantity; equality is allowed and closes the position to zero. This policy does not decide fractional-quantity precision, split residuals, cost-basis defaults, or other D-ROUNDING-01 / D-COST-BASIS-01 questions.

Deterministic rejection: return HTTP 409 with `SHORT_POSITION_NOT_PERMITTED`; do not post a transaction or ledger entry, change cash or position balances, or emit a financial posting event. The rejected command does not reserve an idempotency identity; a later retry is re-evaluated against then-current POSTED holdings. Existing account-scoped idempotency behavior for a successful posting remains unchanged. A non-financial security/operational record of a denied attempt, if required by the established security policy, is outside this vector.

Because no short can exist under this policy, there is no short-cover operation: an ordinary BUY increases a nonnegative long position and does not allocate against a short lot. A correction/VOID preserves the original activity and entries with reason and audit; replay excludes VOID activities and reproduces the same nonnegative position. A correction that would make any later retained POSTED SELL exceed available quantity is rejected atomically with `CORRECTION_BREAKS_POSITION_CONSTRAINT`; original activity/entries and state remain unchanged, and dependent later sells must be corrected first. Exact retries of a successful correction return its original result under the established idempotency contract. This applies regardless of effective date and does not permit physical deletion.

## Synthetic vectors — bounded expected outcomes

All identifiers and values below are synthetic. Overdraft vectors remain decision inputs because D-OVERDRAFT-01 is open. Short-position vectors assert the Ledger-owner rejection policy above; they are not consumed into or used to amend the QA fixture/test in this task.

| Vector | Given / action | Expected result |
|---|---|---|
| `OVD-BUY-INSUFFICIENT-001` | EUR cash account; posted available cash EUR 5.00; no pending reservation; BUY in that account requires EUR 6.00 cash debit. | Reject or permit per explicitly named account eligibility/limit; state command result, resulting posted balance and whether any activity/entry/audit is created. |
| `OVD-WITHDRAWAL-INSUFFICIENT-001` | Same synthetic account and available cash; WITHDRAWAL requests EUR 6.00. | Same decision fields, explicitly for WITHDRAWAL. |
| `OVD-FEE-TAX-INSUFFICIENT-001` | Same synthetic account and available cash; standalone FEE EUR 6.00, then standalone TAX EUR 6.00 as separately evaluated commands. | State result for each class. Do not conflate with an attached fee/tax component already included once in another activity's cash effect. |
| `OVD-TRANSFER-OUT-INSUFFICIENT-001` | Source EUR account has EUR 5.00 available; paired TRANSFER_OUT requests EUR 6.00 to another synthetic account. | State reject/permit and whether a transfer can ever become one-sided; if rejected, no partial transfer may be assumed. If permitted, define account limit and both-leg result. |
| `SHORT-SELL-INSUFFICIENT-001` | Synthetic instrument position is +3 shares in the same brokerage account; all prior position changes are POSTED; SELL requests 4 shares. | Reject HTTP 409 `SHORT_POSITION_NOT_PERMITTED`; no transaction/entry or financial posting event; available position remains `3.000000000000`, cash unchanged, no short lot/negative quantity. Replaying the unchanged POSTED ledger yields the same position. A later identical command retry is re-evaluated and does not claim an idempotency identity. |
| `SHORT-UNSUPPORTED-INSTRUMENT-001` | Synthetic instrument with zero position is outside any short-eligible class; SELL requests 1 share. | Reject HTTP 409 `SHORT_POSITION_NOT_PERMITTED`; no transaction/entry or financial posting event; position remains `0.000000000000`, cash unchanged. All instrument classes are short-ineligible, so this is the same deterministic rule, not a separate conditional policy. |
| `SHORT-CORRECTION-REPLAY-001` | Synthetic POSTED BUY 3 and POSTED SELL 2 leave +1; request correction/VOID of the BUY while retaining the SELL. | Reject correction atomically with `CORRECTION_BREAKS_POSITION_CONSTRAINT`; preserve BUY and SELL and all original entries/states, with no correction commit. After the dependent SELL is corrected/VOIDed first, retrying the BUY correction is permitted through the authorized command; replay excludes VOID activities and yields zero position. Both commands retain trace/correlation and audit evidence as applicable. |

These examples do not approve universal negative balances or any overdraft behavior. The short vectors do approve only the bounded no-short rule and named deterministic rejection results; they do not establish general rounding, lot allocation, split, or tax policy.

## Correction, idempotency, and replay boundaries

- Existing canonical rule remains: preserve original activities; corrections/VOID carry reason and audit and do not physically delete ledger history. Any overdraft policy later approved and any correction under the no-short policy must follow this rule.
- The paired-transfer constraint remains a unit correction: both linked legs and audit must share the command transaction boundary. This does not decide whether insufficient cash rejects or whether a particular transfer can overdraw.
- Existing account-scoped idempotency contract remains unchanged for successful postings: identical normalized posting replay returns the original; changed content under the same identity conflicts; another account is independent. A rejected short-opening command creates no activity and reserves no identity; a retry is validated against current POSTED holdings. The exact response/identity behavior for a command rejected for insufficient cash remains open with D-OVERDRAFT-01.
- Replay is read-only and must not create new corrections. Under D-SHORT-01, replay applies POSTED activity in the stated deterministic order, excludes VOID, and must not yield a negative position; same logical ledger/version must yield the same state. Replay hash/determinism and restore equality are NOT VERIFIED by this documentation record.
- No correction of the existing QA fixture or its SELL direction field is authorized here. `A-BUY-SELL-QUANTITY-001.then.cash_entry_direction_sell=DEBIT` remains unresolved against bounded D-FEE-TAX-01 SELL cash CREDIT; Ledger+QA must name the exact leg, and if it is cash Ledger+Calculations must explicitly reconcile it.

## Evidence, verification, and gate

Reviewed:

- `roadmap.md:716,953-955` (US-0002 and child scopes).
- `AGENTS.md:3,7-22` (canonical write boundary, synthetic-only data, correction/VOID, migration safeguards).
- `test-cases.md:61-64` (TC-US-0002 and A/B/C).
- `docs/adr/0002-canonical-ledger.md:9-16`.
- QA synthetic contract and fixture: `/Users/ruben/spaartrack/.worktrees/t_0a835fa0/tests/smoke/financial-invariant-contract.test.mjs` and `/Users/ruben/spaartrack/.worktrees/t_0a835fa0/fixtures/W0-2-financial-contract-v1.json`.
- Ledger/Calculations policies: `/Users/ruben/spaartrack/.worktrees/t_941802f0/docs/decisions/w0-2-ledger-policy.md` and `/Users/ruben/spaartrack/.worktrees/t_71035d04/docs/decisions/w0-2-calculation-policy.md`.
- Reconciliation/clarification: `/Users/ruben/spaartrack/.worktrees/t_ca53a2ba/docs/decisions/w0-2-policy-reconciliation.md` and `/Users/ruben/spaartrack/.worktrees/t_49297bc1/docs/decisions/w0-2-sell-direction-field-clarification.md`.
- Prior Ledger overdraft/short owner handoff: `/Users/ruben/spaartrack/.worktrees/t_cd28cac1/docs/decisions/w0-2-ledger-overdraft-short-policy.md`.

Red-first check (synthetic QA contract; no ledger runtime mutation):

`TRACE_ID=ledger-w02-v2-20261019 CORRELATION_ID=ledger-w02-v2-20261019 node --test tests/smoke/financial-invariant-contract.test.mjs`

Executed in `/Users/ruben/spaartrack/.worktrees/t_0a835fa0`: 5 tests total; 4 passed; 1 failed intentionally at `owner_decisions_approved=false` (`tests/smoke/financial-invariant-contract.test.mjs:79-80`); 0 skipped; exit 1. The A/B/C contract and unresolved-decision inventory checks passed. The QA fixture and test remain unchanged. This is preserved RED gate evidence, not runtime financial evidence; QA must independently update/rerun the red-first contract after all owner decisions close.

Evidence paths: this note `docs/decisions/w0-2-ledger-overdraft-short-policy.md`; QA fixture `/Users/ruben/spaartrack/.worktrees/t_0a835fa0/fixtures/W0-2-financial-contract-v1.json`; QA contract `/Users/ruben/spaartrack/.worktrees/t_0a835fa0/tests/smoke/financial-invariant-contract.test.mjs`. SHA-256 values and diff/check status are captured in the task handoff after final verification. This note adds no fixture/test or implementation change.

Migration status: no schema or migration change proposed or made; migration dry-run, migration reapply/idempotence, restore equality, and runtime isolation are NOT VERIFIED by this task. Replay hash/determinism: NOT VERIFIED; replay was not run. No SQL or application ledger command was issued.

Gate: D-SHORT-01 has a bounded Ledger-owner disposition recorded here, but W0-2 remains RED/BLOCKED. D-OVERDRAFT-01 is open; Calculations-owned D-ROUNDING-01 and D-COST-BASIS-01 and Ledger-owned D-TRANSFER-01 remain open per their owner handoffs. The exact SELL-leg mapping still requires Ledger+QA clarification and, if it is the cash leg, explicit Ledger+Calculations concurrence. QA has not consumed these dispositions into the fixture/test or independently rerun a revised red-first contract. Next gates: owner decisions close, Ledger+QA document the SELL leg (and Ledger+Calculations reconcile if cash), then independent QA updates/reruns and reviews the contract. Independent QA review of this v2 decision note is required. W0-3 and all financial implementation remain unauthorized; no release clearance is implied.
