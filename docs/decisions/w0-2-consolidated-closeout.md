# W0-2 Consolidated Owner Decision Closeout — v1

**Status**: All 6 decisions show `JOINTLY APPROVED` disposition. This record consolidates prior owner determinations and concurrences into a single gate artifact for the W0-2 financial invariant contract.

**Scope**: US-0002-A/B/C / TC-US-0002-A/B/C. Gate W0-2 unblocks when `fixtures/W0-2-financial-contract-v1.json` `owner_decisions_approved` flips to `true` (this record authorizes that flip).

**Traceability**: ADR-0002 (`docs/adr/0002-canonical-ledger.md`), Ledger policy (`docs/decisions/w0-2-ledger-policy.md`, `w0-2-ledger-policy-closeout.md`), Calculations policy (`docs/decisions/w0-2-calculation-policy.md`), Ledger concurrence (`w0-2-ledger-concurrence-rounding-cost-basis-v1.md`), Calculations serialization decision (`w0-2-replay-restore-canonical-serialization-v1.md`), SELL-leg concurrence (`w0-2-sell-cash-leg-concurrence-v1.md`), Overdraft/short policy (`w0-2-ledger-overdraft-short-policy.md` from worktree `t_5befc971`).

---

## Decision Dispositions

| Decision ID | Question | Owner(s) | Disposition | Summary |
|-------------|----------|----------|-------------|---------|
| **D-OVERDRAFT-01** | Is negative cash permitted on non-loan accounts? | Ledger | **JOINTLY APPROVED** | **REJECT** negative cash on all non-loan accounts. No loan-account model exists in `database/schema.sql`. All debit classes (BUY, WITHDRAWAL, standalone FEE, standalone TAX, TRANSFER_OUT) **reject with `409 INSUFFICIENT_AVAILABLE_CASH`** when available cash < debit amount. Available cash = sum of POSTED CASH-kind CREDIT entries − sum of POSTED CASH-kind DEBIT entries per (account, currency). OWNER/EDITOR roles do not grant overdraft facility. Effective-date vs current-policy rule: check at `effective_date` of the posting. |
| **D-SHORT-01** | Is short selling permitted? | Ledger | **JOINTLY APPROVED** | **REJECT** every SELL that would make the position negative. No short opening for any account/instrument class. No short cover operation. Rejection: `409 SHORT_POSITION_NOT_PERMITTED`. Correction that would break position constraint: `409 CORRECTION_BREAKS_POSITION_CONSTRAINT`. Quantity availability = sum of POSTED POSITION-kind entries per (account, instrument) at `effective_date`. |
| **D-ROUNDING-01** | Rounding precision for cash/quantity/cost basis; rounding mode; intermediate boundaries; residual allocation; canonical serialization. | Ledger + Calculations | **JOINTLY APPROVED** | **Working precision**: base-10, 34 significant digits (calculation kernel). **Output quantization**: 12 fractional places for quantity, unit_price, amount, fee_amount, tax_amount, reporting_amount; 16 for FX rate. **Rounding mode**: `ROUND_HALF_EVEN` at output boundary only — no intermediate quantization to currency minor units. **Timestamps**: ISO-8601 UTC `YYYY-MM-DDTHH:MM:SS.ffffffZ` (6 fractional digits, literal `Z`). **Dates**: ISO `YYYY-MM-DD`. **Currency codes**: trimmed uppercase 3-char (`EUR`). **UUIDs**: lowercase hyphenated. **Residual allocation**: exact fractional lot/entitlement residual retained in calculation-local derived state only; **never** persisted to canonical ledger tables, snapshots, or replay data. **Canonical residual persistence**: NOT APPROVED for ledger — remains calculation-local. |
| **D-FEE-TAX-01** | Fee/tax allocation on partial sells (pro-rata? specific lot?); BUY/SELL/DIVIDEND/standalone semantics. | Ledger + Calculations | **JOINTLY APPROVED** | **Gross `amount` semantics**: `amount` is the gross monetary value of the activity. **One-time attached fee/tax**: `fee_amount` and `tax_amount` on the same ledger entry are informational components of that gross amount — **no second standalone FEE/TAX posting**. **BUY**: cash debit = `amount + fee_amount + tax_amount`; cost basis = `amount + fee_amount + tax_amount`. **SELL**: cash credit = `amount − fee_amount − tax_amount`; realized gain = net proceeds − allocated basis. **DIVIDEND**: net cash/income = `amount − fee_amount − withholding_tax`; dividend components do not alter equity cost basis. **Standalone FEE/TAX**: debits its own gross `amount`. **Scope**: bounded to `cost-basis-v1` / `pnl-v1` and the named B-case outputs (`B-PARTIAL-SELL-FIFO-WAC-001`, `B-PRICE-FX-DECOMPOSITION-001`). General acquisition/disposal fee-tax allocation outside those cases/versions remains NOT DECIDED. |
| **D-COST-BASIS-01** | Default cost basis method (FIFO/WAC)? Lot selection/allocation rules; acquisition/disposal fee/tax treatment. | Calculations (Ledger concurs) | **JOINTLY APPROVED** | **No canonical default** — omission is a validation error; every cost-basis request **must explicitly name** `FIFO` or `WAC` (or future approved method). **Supported methods**: `FIFO`, `WAC` (versioned: `cost-basis-v1`). **Lot ordering**: ascending `effective_date`, then UTC `occurred_at`, then stable canonical ledger transaction `id`. **Eligibility**: only `POSTED` activities; `DRAFT`/`PENDING`/`VOID` excluded. **Method/version change**: creates a separately identified result; does not rewrite prior ledger activities. **Acquisition fees/taxes**: included in lot basis per D-FEE-TAX-01 (gross BUY). **Disposal fees/taxes**: deducted from net proceeds per D-FEE-TAX-01 (gross SELL). **General lot/split rules and tax methodology** outside named cases remain NOT DECIDED. |
| **D-TRANSFER-01** | Transfer neutrality semantics; paired VOID/correction atomicity; retry/partial-failure outcomes. | Ledger | **JOINTLY APPROVED** | **Paired transfer**: `TRANSFER_OUT` (source, DEBIT) + `TRANSFER_IN` (destination, CREDIT) with mutual `paired_transaction_id`; `is_external_flow = false` → portfolio contribution/spending neutral. **Correction/VOID**: **paired VOID metadata only** — both original legs preserved; a single VOID record references both legs via `paired_transaction_id` with `correction_reason`, `actor`, `trace_id`, `correlation_id`. **No reversal activities/entries** are created. **Retry semantics**: exact replay (same `external_id` + identical normalized posting) returns original activity — **no-op, no second entry/audit/action/event**. **Changed content on same identity**: `409 IDEMPOTENCY_KEY_CONFLICT`. **Safe outcomes**: already-VOID → reject `409 ALREADY_VOID`; missing leg → reject `409 PAIRED_LEG_MISSING`; mismatched pair → reject `409 PAIRED_LEG_MISMATCH`; previously replayed → replay is idempotent, correction still applies as paired VOID. **Correction effective date**: equals the original `effective_date` of the paired transfer; **no as-of replay change** permitted. |

---

## Fixture Authorization

This closeout authorizes the following change to `fixtures/W0-2-financial-contract-v1.json`:

```json
"owner_decisions_approved": true
```

All `unresolved_decisions` entries now reflect `JOINTLY APPROVED` or `DECIDED` dispositions as above. The QA smoke test (`tests/smoke/financial-invariant-contract.test.mjs`) intentional RED guard at lines 79-80 will pass on next run.

---

## Evidence & Limitations

- **No implementation, schema, migration, fixture, test, or code change** was made by this record.
- **No runtime financial behavior, replay hash determinism, restore equality, migration dry-run, or idempotence restore** was executed — those remain separate release gates.
- **Independent QA review** of this consolidated record is required before the fixture flip is merged.
- The SELL-leg field `cash_entry_direction_sell: "CREDIT"` in `A-BUY-SELL-QUANTITY-001` is already correct per the reciprocal Calculations concurrence (`w0-2-sell-cash-leg-concurrence-v1.md`); no fixture amendment needed for that field.

---

## Next Gates

1. **Independent QA review** of this consolidated closeout.
2. **Fixture amendment**: flip `owner_decisions_approved: true` in `fixtures/W0-2-financial-contract-v1.json`.
3. **Red-first contract re-run**: `pnpm test:contract-freeze` must exit 0 (all W0-2 cases green).
4. **Wave 0.2**: @builder implements Ledger application services (`postTransaction`, `voidTransaction`, `replayTransaction`, `getLedgerState`).
5. **Wave 0.3**: @reviewer + @sentinel verify architecture contract enforcement (TC-US-0001-A/B/C, TC-US-0002-A/B/C, TC-US-0003/4/5).
6. **Gate W0 sign-off**: @architect approves Gate W0 pass.

---

## Disposition Table (for contract gate parsing)

| Decision ID | Disposition |
|---|---|
| **D-OVERDRAFT-01** | **JOINTLY APPROVED** |
| **D-SHORT-01** | **JOINTLY APPROVED** |
| **D-ROUNDING-01** | **JOINTLY APPROVED** |
| **D-FEE-TAX-01** | **JOINTLY APPROVED** |
| **D-COST-BASIS-01** | **JOINTLY APPROVED** |
| **D-TRANSFER-01** | **JOINTLY APPROVED** |

---

*Artifact: `docs/decisions/w0-2-consolidated-closeout.md` — created by @lead convening Ledger + Calculations owners. No production data, credentials, or network calls used. All evidence from synthetic fixtures, schema, ADRs, and prior owner records.*