# W0-2 Calculations reciprocal concurrence: the SELL cash leg in `A-BUY-SELL-QUANTITY-001` — v1

Status: **the Calculations owner CONCURS on questions 1 and 2** (leg identity and canonical value) and records **no change** to any approved B-case output or version (question 3) and **no approval** of the A-case's other open dependencies (question 4). Documentation-only. This artifact authorizes no financial implementation, no schema/migration work, no fixture/test edit, no ledger mutation, and no W0-2/W0-3/Wave 2+ or release clearance.

Scope: the exact field `A-BUY-SELL-QUANTITY-001.then.cash_entry_direction_sell` in `fixtures/W0-2-financial-contract-v1.json` (QA worktree `/Users/ruben/spaartrack/.worktrees/t_0a835fa0`), for `US-0002-A` / `TC-US-0002-A` only. It answers the four questions posed by the Ledger owner's determination (`t_d2bd0b46`, `docs/decisions/w0-2-sell-cash-leg-determination-v1.md`, SHA-256 `c274be04bddecab5a4a25f6ec1122d4dd7b318cc97b94444e3717efac9f2819b`) and records the Calculations owner's unchanged scope.

The ledger remains the canonical source of truth; calculations remain derived and read-only (`AGENTS.md`; `docs/adr/0002-canonical-ledger.md:9`).

---

## 1. Answers to the four questions

### Question 1 — Does Calculations concur that `A-BUY-SELL-QUANTITY-001.then.cash_entry_direction_sell` denotes the SELL **cash leg** (`entry_kind = 'CASH'`)?

**YES — Calculations concurs.**

Rationale, from the Calculations side, independent of the Ledger determination's framing:

1. **The canonical schema makes "cash entry" a real, orthogonal concept.** `database/schema.sql:538-539` — `ledger_entry.entry_kind text NOT NULL CHECK (entry_kind IN ('CASH','POSITION','FEE','TAX','MEMO'))` and `ledger_entry.direction text NOT NULL CHECK (direction IN ('DEBIT','CREDIT'))` are two separate columns on the same row (verified in this worktree at HEAD `4fb71c6`). A direction value only has canonical meaning for a given entry kind, and for `entry_kind = 'CASH'` that meaning is fixed by ADR-0002:15: *"**cash:** alleen POSTED entries tellen; DEBIT verlaagt, CREDIT verhoogt; geen negatieve cash zonder expliciete loan-account."* (verified verbatim, `docs/adr/0002-canonical-ledger.md:15`).
2. **The fixture's own direction vocabulary is already the ADR-0002 cash sign.** `fixtures/W0-2-financial-contract-v1.json:27` (DEPOSIT → CREDIT), `:28` (WITHDRAWAL → DEBIT), `:125` (TRANSFER_OUT → DEBIT), `:126` (TRANSFER_IN → CREDIT). These four assertions are consistent with each other only under the ADR-0002 cash sign. The transfer pair is the decisive control: in the implementation those two legs really are `CASH`-kind entries — the source leg is inserted with `entryKind`/`direction` computed as `CASH`/`DEBIT` for `TRANSFER_OUT` (`apps/api/src/index.ts:8001-8026`) and the paired destination leg is inserted literally as `entry_kind='CASH', direction='CREDIT'` (`apps/api/src/index.ts:8060-8066`). The fixture's unqualified "direction" therefore already means the cash sign of the cash entry.
3. **The position-leg reading is not canonical and is not stable in the codebase.** ADR-0002:16 defines the quantity sign by activity type (*"BUY verhoogt, SELL verlaagt"*), not by entry direction, and the ledger derives quantity from `activity_type` rather than from `direction`. Worse, the two trade-writing paths contradict each other on the SELL position direction: the generic manual/ledger path writes SELL as `entry_kind='POSITION', direction='DEBIT'` (`apps/api/src/index.ts:8001-8004`), while the option-lifecycle path writes its SELL leg as `entry_kind='POSITION', direction='CREDIT'` (`apps/api/src/option-lifecycle.ts:201-204`, CREDIT at `:203`). A contract value that one canonical write path contradicts cannot be a testable invariant.
4. **A calculation-kernel reason to concur specifically with the cash reading (not merely a naming argument).** The A-case is the only trade case in the `US-0002-A` slice. If `cash_entry_direction_sell` were a position leg, the A-case would contain **no** cash-direction assertion for a trade at all: the trade's cash effect — the very thing the Calculations-owned D-FEE-TAX-01 semantics govern ("BUY: cash debit = gross amount + fee + tax" / "SELL: cash credit = gross amount − fee − tax", `docs/decisions/w0-2-calculation-policy.md:42-43`) — would have no contract anchor in A. The B-cases carry the fee/tax cash semantics in their calculation outputs, but they assert no cash-entry direction. The paired name `cash_entry_direction_buy` (`:55`) is the same field name for the BUY side and its value `DEBIT` is exactly the approved BUY cash effect; treating the SELL field as a *different kind of leg* would make the pair semantically incoherent and would itself be a fixture-naming defect requiring a separate owner decision.
5. **The `DEBIT` value on a SELL is unsupported by any canonical rule.** ADR-0002:15 gives CREDIT for a cash-raising leg, and the jointly approved D-FEE-TAX-01 states *"SELL | Credit `amount - fee_amount - tax_amount`"* (`docs/decisions/w0-2-ledger-policy.md:61`, worktree `t_941802f0`), reciprocally confirmed at `docs/decisions/w0-2-calculation-policy.md:43` (worktree `t_71035d04`) — both verified verbatim. A SELL cash leg that is DEBIT would mean a completed sale removes cash from the account, which no canonical source supports.

**Conclusion:** the field denotes the `ledger_entry` row with `entry_kind = 'CASH'` belonging to the SELL transaction. It is not a position, fee/tax or memo leg. This is a *leg-identity* concurrence; it does not by itself select the value (see question 2).

### Question 2 — Does Calculations concur that the canonical value of that leg is **CREDIT** (gross proceeds less attached fee/tax)?

**YES — Calculations concurs, and this is within the Calculations owner's own approved scope.**

Rationale:

1. **It is the Calculations owner's own jointly approved rule.** `docs/decisions/w0-2-calculation-policy.md:43` — *"SELL: cash credit = gross amount − fee − tax; realized gain = gross amount − disposal fee − disposal tax − allocated basis."* Verified verbatim. The reciprocal Ledger statement is `docs/decisions/w0-2-ledger-policy.md:61` — *"SELL | Credit `amount - fee_amount - tax_amount` | gross 240, fee 3, tax 4 => cash increases 233"*. Verified verbatim. The two owner artifacts agree, so the cash effect of a SELL is already decided on both sides; the fixture's `DEBIT` is a **fixture defect relative to the canonical contract**, not an alternative approved value.
2. **ADR-0002:15 fixes the sign.** DEBIT lowers cash, CREDIT raises cash. A SELL raises cash by its net proceeds.
3. **The one-time attached fee/tax rule is preserved.** The credit amount is gross proceeds less the fee/tax attached to that same entry, counted **once** (D-FEE-TAX-01, gross `amount` semantics; no second standalone FEE/TAX posting). For the A-case specifically the SELL carries no `fee_amount`/`tax_amount` (`fixtures/W0-2-financial-contract-v1.json:49`), so the A-case SELL cash leg is a CREDIT of gross `60` — i.e. `60.000000000000` EUR in the fixture's 12-decimal display scale. Only the **direction** is asserted by the fixture field, so no amount field changes.
4. **The BUY sibling stays DEBIT.** `cash_entry_direction_buy: "DEBIT"` (`:55`) already equals the approved BUY cash effect and is **unchanged** by this concurrence. This concurrence covers the SELL field only.

### Question 3 — Does the change of that single A-case assertion alter ANY approved B-case output or version?

**NO. No approved B-case output changes, and no calculation version changes.** The B-case values are re-verified unchanged below.

Why the change cannot reach the B-cases:

- **The A-case change is a direction assertion, not a calculation input.** The B-case outputs derive from `amount`, `quantity`, `unit_price`, `fee_amount`, `tax_amount`, valuation price and FX rates. No B-case value is a function of any cash-entry direction.
- **The cases are separate in the contract.** `A-BUY-SELL-QUANTITY-001` is a *posting/replay* case with its own account (`synthetic-brokerage-eur`); `B-PARTIAL-SELL-FIFO-WAC-001` and `B-PRICE-FX-DECOMPOSITION-001` are *calculation* cases whose `when` is "calculate cost basis / realized and unrealized P&L" and which carry their own `given` inputs. The fixture has no shared-state mechanism between cases.
- **No version moves.** `cost-basis-v1` / `pnl-v1` are unchanged; `common.calculation_version` (`fixtures/W0-2-financial-contract-v1.json:13`) is unchanged; this concurrence introduces no new calculation version and changes no formula, method, rounding rule or fee/tax rule.
- **The D-FEE-TAX-01 scope is unchanged.** The amendment makes the fixture *match* the already-approved bounded D-FEE-TAX-01 semantics; it approves no new fee/tax rule and withdraws none.

**Re-verified B-case values — independently re-derived, all unchanged.** Method: exact base-10 decimal arithmetic (Python `decimal`, 40-digit working precision, `ROUND_HALF_EVEN` at the 12-fractional-digit output boundary — the D-ROUNDING-01 calculation-side convention recorded in `docs/decisions/w0-2-calculation-rounding-cost-basis-v2.md:17-22`), re-derived from the fixture's own synthetic inputs rather than copied from the owner artifacts, then compared value-by-value against the approved figures. Script: `/Users/ruben/.hermes/profiles/calculations/cache/scratch/w02_sellleg_recompute.py`; output `ALL_MATCH=True`, `RESULT=GREEN`, exit 0. 17 of 17 compared values matched exactly.

`B-PARTIAL-SELL-FIFO-WAC-001` — EUR, `cost-basis-v1`:

| Quantity | Re-derived | Approved | Match |
|---|---:|---:|:--:|
| FIFO remaining cost basis | `42.600000000000` | `42.600000000000` | yes |
| FIFO realized gain | `101.600000000000` | `101.600000000000` | yes |
| WAC remaining cost basis | `34.800000000000` | `34.800000000000` | yes |
| WAC realized gain | `93.800000000000` | `93.800000000000` | yes |
| total fees | `6.000000000000` | `6.000000000000` | yes |
| total taxes | `5.000000000000` | `5.000000000000` | yes |
| remaining quantity (both methods) | `3.000000000000` | `3.000000000000` | yes |

Derivation: acquisition bases `103` (= 100+2+1) and `71` (= 70+1+0); pre-sale basis `174`; SELL net proceeds `233` (= 240−3−4). FIFO disposed basis `103 + (2/5)×71 = 131.400000000000`, remaining `174 − 131.4 = 42.600000000000`, realized `233 − 131.4 = 101.600000000000`. WAC disposed basis `174 × (12/15) = 139.200000000000`, remaining `174 − 139.2 = 34.800000000000`, realized `233 − 139.2 = 93.800000000000`.

`B-PRICE-FX-DECOMPOSITION-001` — USD instrument / EUR reporting, `pnl-v1`:

| Quantity | Re-derived | Approved | Match |
|---|---:|---:|:--:|
| realized P&L reporting currency (EUR) | `15.120000000000` | `15.120000000000` | yes |
| price P&L (EUR) | `46.560000000000` | `46.560000000000` | yes |
| FX P&L (EUR) | `12.000000000000` | `12.000000000000` | yes |
| unrealized P&L (EUR) | `58.560000000000` | `58.560000000000` | yes |
| total P&L (EUR) | `73.680000000000` | `73.680000000000` | yes |
| fees total (USD) | `3.000000000000` | `3.000000000000` | yes |
| taxes total (USD) | `2.000000000000` | `2.000000000000` | yes |
| remaining quantity | `6.000000000000` | `6.000000000000` | yes |
| remaining cost basis, transaction currency (USD) | `61.800000000000` | `61.800000000000` | yes |
| realized P&L, transaction currency (USD) | `16.800000000000` | `16.800000000000` | yes |

Derivation: BUY basis `103.000000000000` USD; disposed basis `103 × (4/10) = 41.200000000000`; remaining native basis `61.800000000000`; SELL net proceeds `58.000000000000`; realized transaction-currency `16.800000000000`; reporting `16.8 × 0.9 = 15.120000000000`; market value `6 × 20 = 120.000000000000` USD; price P&L `(120 − 61.8) × 0.8 = 46.560000000000`; FX P&L `120 × (0.9 − 0.8) = 12.000000000000`; unrealized `58.560000000000`; total `73.680000000000`.

Also unchanged and explicitly re-confirmed: `A-BUY-SELL-QUANTITY-001.then.remaining_quantity = "6.000000000000"`. The SELL *quantity* sign comes from the activity type (ADR-0002:16), not from the cash-entry direction, so the direction assertion does not feed the quantity invariant. `A-CASH-SIGNS-001` (balance `80.000000000000`, contribution `100.000000000000`, spending `20.000000000000`) is likewise untouched.

### Question 4 — Does the amendment silently approve the A-case's other open dependencies `D-OVERDRAFT-01` and `D-SHORT-01`?

**NO. This concurrence approves neither, and it neither withdraws nor re-opens either.** The amendment is scoped to one direction assertion; it decides nothing about them.

- **`D-OVERDRAFT-01` remains NOT DECIDED** (Ledger owner; latest record `t_5befc971/docs/decisions/w0-2-ledger-overdraft-short-policy.md:11`, `:16-26`). The cash-*sign* rule is separable from the overdraft question: a SELL cash leg is a CREDIT, and a credit leg raises cash — it never creates a negative balance. Whether an under-funded BUY, WITHDRAWAL, standalone FEE, standalone TAX or TRANSFER_OUT is rejected or permitted (available-cash definition, account eligibility and limits, decision timing, role authority, boundary result) is untouched by this concurrence. **Note explicitly:** ADR-0002:15's trailing clause *"geen negatieve cash zonder expliciete loan-account"* presumes a loan-account exception that D-OVERDRAFT-01 has not decided (no loan-account model exists in `database/schema.sql`). The Calculations owner concurs with the **sign** semantics of ADR-0002:15 only, and explicitly does **not** concur with, approve or rely on that loan-account clause. That cross-document inconsistency stays recorded and unresolved (Ledger-owned).
- **`D-SHORT-01` remains exactly as the Ledger owner decided it** (`t_5befc971/...:12`, `:28-36`): reject every SELL that would make the position negative; no short opening for any account or instrument class; no short cover; `409 SHORT_POSITION_NOT_PERMITTED`; correction guard `CORRECTION_BREAKS_POSITION_CONSTRAINT`. This concurrence does not extend, narrow or reinterpret it, and the A-case assertion `sell_quantity_must_not_increase_position: true` remains compatible with it. What remains outstanding for D-SHORT-01 is QA *encoding* of the already-decided disposition — a separate step, not something this concurrence approves.
- **Fixture bookkeeping is not changed by this concurrence.** The A-case's `decision_dependencies` array stays `["D-OVERDRAFT-01", "D-SHORT-01"]` (`fixtures/W0-2-financial-contract-v1.json:59`), asserted verbatim by the QA smoke test (`tests/smoke/financial-invariant-contract.test.mjs:23`). Both entries must remain until the respective owner records authorize removal. Likewise `D-FEE-TAX-01` remains in the fixture's `unresolved_decisions` array: the general acquisition/disposal fee-tax allocation outside the two named B cases and versions is still NOT DECIDED (see §2), so that entry must not be dropped on the strength of this concurrence. The `unresolved_decisions` id list is asserted verbatim by the smoke test (`tests/smoke/financial-invariant-contract.test.mjs:71`).
- **Not decided by this concurrence, explicitly:** D-TRANSFER-01 (Ledger-owned), the residual items of D-ROUNDING-01, the general fee/tax allocation and lot/split rules of D-COST-BASIS-01, and the `owner_decisions_approved` flag (QA-owned; it stays `false` while D-OVERDRAFT-01 is open).

---

## 2. Unchanged Calculations scope (stated so the record is unambiguous)

The following stand exactly as recorded and are **not** widened, narrowed or re-opened by this concurrence.

- **D-FEE-TAX-01 — jointly approved, bounded, unchanged.** As recorded in `docs/decisions/w0-2-calculation-policy.md` (worktree `t_71035d04`) and narrowed by `docs/decisions/w0-2-calculation-rounding-cost-basis-v2.md` (worktree `t_64ce59b3`): gross `amount`; one-time same-entry attached fee/tax (no second standalone FEE/TAX posting); BUY basis/cash = gross + fee + tax; SELL proceeds/cash = gross − fee − tax; DIVIDEND net income = gross − fee − withholding tax (dividend components do not alter equity cost basis); standalone FEE/TAX debits its gross `amount`; versions `cost-basis-v1` / `pnl-v1`; and the named B-case outputs only. **General acquisition/disposal fee-tax allocation outside those cases/versions stays NOT DECIDED** and needs separate reciprocal Ledger + Calculations approval. This concurrence narrows nothing and generalizes nothing; it records that the A-case SELL cash direction is the already-approved cash effect, not a new rule.
- **D-ROUNDING-01 — residual items stay open.** (a) *Canonical residual persistence* — whether an exact fractional lot/entitlement residual may be stored in canonical ledger tables, snapshots or replay data, or must remain calculation-local (Ledger-owned; explicit proposal + review required). (b) *Canonical replay/restore serialization* — byte representation, included fields, ordering, decimal/timestamp normalization, digest inputs, hash version and the restore-equality contract; the current `replay_hash` is SHA-256 over `JSON.stringify({ rows, balances, totals })` (`apps/api/src/index.ts:7742-7794`) and is not a canonical serialization spec. The calculation-side decimal/rounding conventions already approved (base-10 decimal strings, 34 significant-digit working precision, `ROUND_HALF_EVEN`, output quantization at 12 fractional places / 16 for FX, no intermediate quantization to currency minor units, `minor_units` presentation-only, residual assigned to the last consumed lot in deterministic lot order, explicit as-of date/timezone, ISO-8601 UTC, ordering by effective date → UTC `occurred_at` → stable transaction id, POSTED-only eligibility) are unchanged and are exactly the conventions used for the re-derivation in question 3. (c) The 2-decimal external rounding rule in ADR-0002:17 remains unreconciled.
- **D-COST-BASIS-01 — stays as recorded.** Every result requires an explicit method; FIFO and WAC are named supported methods; **no implicit default** (omission is a validation error); a method/version change creates a separately identified result and does not rewrite prior ledger activities; lots ordered by effective date → UTC `occurred_at` → stable canonical transaction id; POSTED-only eligibility. **General lot/split rules outside the named cases remain NOT DECIDED**, as does the tax-methodology question, which stays with Calculations.

---

## 3. Precise findings the QA card needs (recorded here; QA owns the fixture and the test)

These are observations from this concurrence, stated so the downstream QA amendment is not done on a false premise. They are **not** fixture edits and this artifact does not make them.

1. **The SELL cash direction is currently not asserted by any test.** A repo-wide search for `cash_entry_direction_sell` returns exactly one occurrence: the fixture itself (`fixtures/W0-2-financial-contract-v1.json:56`). The QA smoke test contains **no** reference to `cash_entry_direction` at all (verified: the search returns no match). Consequence: the defective `DEBIT` value currently passes silently, and after the amendment the corrected `CREDIT` value would also remain unasserted unless QA adds an explicit assertion. To make `TC-US-0002-A` genuinely executable on this field, the QA amendment should add an assertion binding the amended value.
2. **The A-case and B1-case share the instrument id `synthetic-equity-eur`.** `A-BUY-SELL-QUANTITY-001` (`:44`) and `B-PARTIAL-SELL-FIFO-WAC-001` (`:64`) both name it, although the A-case is a posting/replay case with account `synthetic-brokerage-eur` and the B-cases are calculation-only cases with no account. The approved FIFO value `131.400000000000` (= 103 + (2/5)×71) requires that the SELL of 12 consumes the B-case's first lot of 10 units and then 2/5 of its second lot. If a future implementation were to evaluate the A-case and B-case trades as one shared instrument+account ledger with FIFO ordering, the A-case's BUY (10 units, basis 100, no fees/taxes) would precede and be consumed first, giving disposed basis `100 + (2/5)×103 = 141.2`, remaining basis `132.800000000000` and realized `91.800000000000` — different values. **The approved B-case outputs therefore require the calculation cases to be evaluated in isolation** (own portfolio/account/lot set), which is what the fixture's per-case `given` already implies. This concurrence does not authorize any change to the approved B-case values; it records the isolation condition that preserves them.
3. **The current implementation writes only a POSITION entry for a trade — no CASH leg at all.** `apps/api/src/index.ts:8001-8004` sets `entryKind = "POSITION"` for BUY/SELL/SPLIT, and `:8017-8026` inserts exactly that one entry. So the A-case as amended (and as already written for BUY) cannot be satisfied by today's single-entry trade model; `TC-US-0002-A` as contracted implies W0-3 must post a cash leg for trades (BUY DEBIT, SELL CREDIT) alongside the position leg. Money-flow projections already assume such legs exist — they filter `le.entry_kind = 'CASH'` (`apps/api/src/index.ts:2214`, `:2325`, `:2415`, `:2492`) — so today's trades are invisible to money flow. **This is a W0-3 implementation consequence, recorded here and not authorized by this concurrence.** Related implementation inconsistency, recorded by the Ledger owner and confirmed here: a manually booked trade is created with `is_external_flow = true` (`apps/api/src/index.ts:8014`), while the replay totals treat any external-flow DEBIT entry as external spending and any external-flow CREDIT entry as external contribution (`apps/api/src/index.ts:7768-7769`), so a trade currently lands in external spending. That is a Ledger-owned `is_external_flow` semantics question for the trade posting path and is **not** decided here.
4. **Only one field may change.** The QA amendment is authorized by this concurrence to change exactly `A-BUY-SELL-QUANTITY-001.then.cash_entry_direction_sell` from `"DEBIT"` to `"CREDIT"`. `cash_entry_direction_buy` stays `"DEBIT"`; `remaining_quantity` stays `"6.000000000000"`; `sell_quantity_must_not_increase_position` stays `true`; the A-case `decision_dependencies` array stays `["D-OVERDRAFT-01", "D-SHORT-01"]`; the B-case blocks stay byte-identical; `common.calculation_version` stays unchanged; and `owner_decisions_approved` stays `false` while D-OVERDRAFT-01 is open.

---

## 4. Evidence — commands and results

All commands were run read-only with `TRACE_ID=calc-w02-sellleg-concurrence-20261020` and `CORRELATION_ID=calc-w02-sellleg-concurrence-20261020` exported in the shell. No credentials, no production data, no SQL, no ledger mutation, no network. All data is synthetic.

| # | Command (run in `/Users/ruben/spaartrack/.worktrees/t_ff54ddc9` unless stated) | Result |
|---|---|---|
| 1 | `git status --short --untracked-files=all`; `git branch --show-current`; `git log --oneline -1`; `git worktree list` | Clean tree; branch `wt/t_ff54ddc9`; HEAD `4fb71c6` |
| 2 | `sed -n '530,556p' database/schema.sql` | `ledger_entry` DDL confirmed: `entry_kind` CHECK at `:538`, `direction` CHECK at `:539`, `CHECK (amount >= 0)` |
| 3 | `sed -n '7995,8030p' apps/api/src/index.ts` | `:8001` `isPosition = ["BUY","SELL","SPLIT"]`; `:8002` `isDebit` includes `SELL`; `:8003` `entryKind`; `:8004` `direction`; `:8014` `!isTransfer` → `is_external_flow`; `:8017-8026` single `ledger_entry` INSERT |
| 4 | `sed -n '8055,8070p' apps/api/src/index.ts` | `:8060-8066` paired destination leg inserted as `entry_kind='CASH', direction='CREDIT'` |
| 5 | `sed -n '195,218p' apps/api/src/option-lifecycle.ts` | `:201-204` option SELL leg `entry_kind: "POSITION"`, `direction: "CREDIT"` at `:203` — contradicts the generic path |
| 6 | `sed -n '5170,5190p' apps/api/src/index.ts` | `:5175` option-lot reader branches on `direction === "DEBIT"` to open a lot — proves the two write paths cannot both be canonical |
| 7 | `sed -n '6820,6832p' apps/api/src/index.ts` | Import path: SELL classified debit, `entryKind === "POSITION"` ⇒ `409 IMPORT_COMMIT_BLOCKED` |
| 8 | `sed -n '7755,7776p' apps/api/src/index.ts` | `:7768-7769` replay totals: external-flow DEBIT ⇒ spending, CREDIT ⇒ contribution |
| 9 | `grep -n "entry_kind = 'CASH'" apps/api/src/index.ts` | `:2214`, `:2325`, `:2415`, `:2492` — money-flow projections filter CASH-kind legs |
| 10 | `grep -n "isCashDebit" apps/api/src/index.ts` | `:7600` SELL listed as cash debit; `:7604` `freeCash -= amount` — implementation artefact, not a canonical rule |
| 11 | `sed -n '15p;16p' docs/adr/0002-canonical-ledger.md` | ADR-0002:15 cash sign rule and ADR-0002:16 quantity rule, verbatim |
| 12 | `sed -n '61p' <t_941802f0>/docs/decisions/w0-2-ledger-policy.md` | SELL row, verbatim: `\| SELL \| Credit \`amount - fee_amount - tax_amount\` \| gross 240, fee 3, tax 4 => cash increases 233 \|` |
| 13 | `sed -n '43p' <t_71035d04>/docs/decisions/w0-2-calculation-policy.md` | `- SELL: cash credit = gross amount − fee − tax; realized gain = gross amount − disposal fee − disposal tax − allocated basis.` |
| 14 | `grep -rn "cash_entry_direction_sell" .` (tracked repo) and in the QA worktree `fixtures/` + `tests/` | Exactly one occurrence, the fixture line `:56`; **no** occurrence in any test file |
| 15 | `grep -n "cash_entry_direction" <t_0a835fa0>/tests/smoke/financial-invariant-contract.test.mjs` | No match — the field is not asserted by the QA contract |
| 16 | `shasum -a 256` over the 8 cited owner/QA artifacts | Ledger determination `c274be04…f2819b`; calc policy `8ad2fb40…c448`; calc rounding v2 `d69f403f…66b6`; ledger policy `2d505d13…3d3b`; ledger overdraft/short v2 `ed71d3ce…9d44`; SELL-direction clarification `3374102e…e759`; QA fixture `096a29f8…41c50`; QA smoke test `d1dc2a84…3b71` — **all match the values recorded in the owner artifacts** |
| 17 | `python3 /Users/ruben/.hermes/profiles/calculations/cache/scratch/w02_sellleg_recompute.py` | 17/17 derived values match the approved values; `ALL_MATCH=True`; `RESULT=GREEN`; exit 0 |
| 18 | `node --test tests/smoke/financial-invariant-contract.test.mjs` **in the QA worktree `/Users/ruben/spaartrack/.worktrees/t_0a835fa0`** (read-only; no fixture/test edit) | 5 tests, 4 pass, 1 fail, 0 skipped, exit 1 — failing only at the intentional `owner_decisions_approved=false` guard (`tests/smoke/financial-invariant-contract.test.mjs:79-80`). QA worktree `git status --short --untracked-files=all` before and after the run shows only the two pre-existing untracked QA files; nothing changed. |

**Reproducibility note.** Command 17 is the only artifact-producing command; its script is retained at `/Users/ruben/.hermes/profiles/calculations/cache/scratch/w02_sellleg_recompute.py`. It is pure decimal arithmetic over the fixture's synthetic inputs — no database, no network, no credentials — and re-running it reproduces the same table.

---

## 5. Gate status

- **W0-2 / US-0002-A,B,C / TC-US-0002-A,B,C: RED / BLOCKED.** This concurrence does not make the QA contract green. The QA contract must stay red until QA amends the fixture, re-runs the red-first contract, and independent QA reviews the result.
- **The SELL-leg field disposition is now reciprocal.** The Ledger owner determined the leg (`t_d2bd0b46`); the Calculations owner concurs on both the leg identity and the canonical CREDIT value (this artifact). The reciprocal leg of the determination is therefore **closed**, subject to independent QA review of this record. QA may amend `fixtures/W0-2-financial-contract-v1.json` — one field only, per §3.4 — after this record is reviewed.
- **`owner_decisions_approved` stays `false`.** D-OVERDRAFT-01 is still NOT DECIDED, so the release-green guard must remain in place.
- **Not verified / not claimed here:** runtime financial behaviour of any calculation; replay hash determinism; restore equality; migration dry-run, reapply/idempotence and restore; the money-flow and `is_external_flow` consequences of adding a trade cash leg (Ledger-owned, W0-3). Command 17 is arithmetic over the approved formulas on synthetic inputs, **not** execution of the application's cost-basis/P&L runtime.
- **No implementation authorization.** No W0-3, Wave 2+, Poort A/B/C or release clearance follows. No direct ledger write, SQL mutation or credential use occurred; the ledger was read only through source and schema files.
- **Next gates:** independent QA review of this concurrence → QA fixture amendment (one field) + red-first re-run → independent QA review of the amended contract → only then the D-OVERDRAFT-01 owner answer, and after that runtime, security, migration, replay and restore evidence for the broader release gate.

---

## 6. Traceability and evidence paths

Stories/tests: `US-0002-A` → `TC-US-0002-A` (this concurrence); `US-0002-B` → `TC-US-0002-B` (B-case non-regression, question 3); `US-0002-C` → `TC-US-0002-C` (unaffected, recorded for completeness). Roadmap rows `roadmap.md:1001-1003` (child stories) and `roadmap.md:764` (epic row — the epic row's "Done lokaal 19 oktober 2026" claim rests on a documentation-presence test only; see §6 note). Refinement catalog `docs/backlog/b-004-refinement.md:23-25`; acceptance rows `test-cases.md:61-64`; cross-cutting gates `test-cases.md:393,396,397` (TC-X-003, TC-X-006, TC-X-007); ADR `docs/adr/0002-canonical-ledger.md:9-20`.

Owner records reviewed (isolated worktree paths, SHA-256 verified by command 16):

| Artifact | Path | SHA-256 |
|---|---|---|
| Ledger SELL-leg determination v1 (received) | `t_d2bd0b46/docs/decisions/w0-2-sell-cash-leg-determination-v1.md` | `c274be04bddecab5a4a25f6ec1122d4dd7b318cc97b94444e3717efac9f2819b` |
| Calculations policy v1 (D-FEE-TAX-01 approval) | `t_71035d04/docs/decisions/w0-2-calculation-policy.md` | `8ad2fb405d38e7d4d15eedb2bc4c73c2be0a0106441d3e670aab2dad8811c448` |
| Calculations rounding/cost-basis v2 (scope narrowing) | `t_64ce59b3/docs/decisions/w0-2-calculation-rounding-cost-basis-v2.md` | `d69f403fcbe34322a3055e2626b28e382d32850330e29decfde490836fd066b6` |
| Ledger policy v1 (reciprocal D-FEE-TAX-01) | `t_941802f0/docs/decisions/w0-2-ledger-policy.md` | `2d505d13ce35f879d0b7e64c15a823dcd4ca2a02b77ee59b85c78a9e52843d3b` |
| Ledger overdraft/short v2 (current) | `t_5befc971/docs/decisions/w0-2-ledger-overdraft-short-policy.md` | `ed71d3ce9f036c97116d0d25eabe3517c53a0ae40b1faa8ed40c346a73ca9d44` |
| SELL-direction field clarification v1 | `t_49297bc1/docs/decisions/w0-2-sell-direction-field-clarification.md` | `3374102eaf545459f5196d6333b09e1d8aa0d10a6610b49846973f54395be759` |
| QA contract fixture (unmodified) | `t_0a835fa0/fixtures/W0-2-financial-contract-v1.json` | `096a29f84a58917db7345f767f5d7549bbcd196571b1aa894c4c2e9145841c50` |
| QA contract test (unmodified) | `t_0a835fa0/tests/smoke/financial-invariant-contract.test.mjs` | `d1dc2a84fb51ec57ddb3c87b9235f457698e3d022b8609ec8f624cceb5693b71` |

**Note on the roadmap epic row.** `roadmap.md:764` marks US-0002 "Done lokaal 19 oktober 2026" on the strength of `tests/unit/us0002-financial-invariants.test.mjs`, which (verified here) loads only ADR-0002 text, matches six invariant substrings and asserts **no** expected value. It therefore cannot witness the SELL cash direction and is not evidence for this determination. Roadmap edits are outside this card's scope; reported, not amended.

This artifact: `docs/decisions/w0-2-sell-cash-leg-concurrence-v1.md` in worktree `/Users/ruben/spaartrack/.worktrees/t_ff54ddc9` (branch `wt/t_ff54ddc9`). Its SHA-256 is recorded in the task handoff. No fixture, test, source, schema, migration, ADR, roadmap, backlog or canonical ledger data was changed by this artifact.
