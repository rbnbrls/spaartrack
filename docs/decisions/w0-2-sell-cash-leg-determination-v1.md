# W0-2 Ledger determination: the SELL cash leg in `A-BUY-SELL-QUANTITY-001` — v1

Status: **the SELL-leg meaning is DECIDED by the Ledger owner** (canonical financial semantics). The *value* the fixture currently asserts is **NOT DECIDED as a contract change** and requires explicit reciprocal Calculations concurrence before QA may amend the fixture. Documentation-only record. This artifact authorizes no financial implementation, no schema/migration work, no fixture/test edit, no ledger mutation, and no W0-2/W0-3/Wave 2+ or release clearance.

Scope: the exact field `A-BUY-SELL-QUANTITY-001.then.cash_entry_direction_sell` in `fixtures/W0-2-financial-contract-v1.json` (QA worktree `/Users/ruben/spaartrack/.worktrees/t_0a835fa0`), for `US-0002-A` / `TC-US-0002-A` only. It also records the current disposition of the policy questions listed in the task, with responsible owner and the exact answer still required.

---

## 1. Determination

**The field denotes the SELL *cash* leg**: the `ledger_entry` row with `entry_kind = 'CASH'` belonging to the SELL transaction. It is not a position leg, not a fee/tax leg, and not a memo leg.

**Consequence for the asserted value:** under the canonical cash sign rule and the jointly approved D-FEE-TAX-01 convention, the SELL cash leg is a **CREDIT** (proceeds raise cash). The fixture's `cash_entry_direction_sell: "DEBIT"` is therefore **inconsistent with the canonical contract and is a fixture defect**, not an alternative leg and not an approved invariant.

**What this determination does NOT do:** it does not change the fixture or the smoke test (QA owns both), it does not select the replacement value in the contract, and it does not authorize the implementation change implied below. QA may amend the fixture value only after the reciprocal Calculations concurrence required in section 4 is recorded and independently reviewed.

## 2. Evidence

### 2.1 Canonical field definition (not inferred from the field name)

The canonical ledger has two orthogonal columns on `ledger_entry`; "cash entry" is a real canonical concept, not a guess at intent:

- `database/schema.sql:533-555` — `CREATE TABLE ledger_entry`, with `entry_kind text NOT NULL CHECK (entry_kind IN ('CASH', 'POSITION', 'FEE', 'TAX', 'MEMO'))` (`:538`) and `direction text NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT'))` (`:539`).
- `docs/adr/0002-canonical-ledger.md:15` — the canonical cash invariant: *"**cash:** alleen POSTED entries tellen; DEBIT verlaagt, CREDIT verhoogt; geen negatieve cash zonder expliciete loan-account."* DEBIT lowers cash, CREDIT raises cash. This is the only canonical definition of what a ledger direction means for cash.

### 2.2 The fixture's own direction vocabulary is the ADR-0002 cash sign

Four sibling assertions in the same fixture file are consistent only with the ADR-0002 cash sign, so the fixture's unqualified `direction` values already mean "cash sign":

| Fixture field | File:line | Canonical cash entry | Consistent with ADR-0002:15 |
|---|---|---|---|
| `A-CASH-SIGNS-001` DEPOSIT `expected_direction: CREDIT` | `fixtures/W0-2-financial-contract-v1.json:27` | `entry_kind='CASH'`, CREDIT | yes — deposit raises cash |
| `A-CASH-SIGNS-001` WITHDRAWAL `expected_direction: DEBIT` | `:28` | `entry_kind='CASH'`, DEBIT | yes — withdrawal lowers cash |
| `C-PAIRED-TRANSFER-NEUTRALITY-001` `source_direction: DEBIT` | `:125` | TRANSFER_OUT → `entry_kind='CASH'`, DEBIT | yes — outflow leg lowers source cash |
| `C-PAIRED-TRANSFER-NEUTRALITY-001` `destination_direction: CREDIT` | `:126` | TRANSFER_IN → `entry_kind='CASH'`, CREDIT | yes — inflow leg raises destination cash |

The transfer pair is decisive as a control: in the implementation the two transfer legs are literally `CASH`-kind entries (`apps/api/src/index.ts:8017-8026` source leg, `:8060-8066` paired destination leg inserted as `entry_kind='CASH', direction='CREDIT'`), and the fixture's `source_direction`/`destination_direction` values are exactly their cash signs. The fixture therefore already uses "direction" to mean the cash sign of the cash entry, and `cash_entry_direction_buy`/`cash_entry_direction_sell` continue that same convention in the same file.

### 2.3 The BUY value corroborates the reading, and DEBIT on a SELL is not defensible on any canonical rule

- `cash_entry_direction_buy: "DEBIT"` (`:55`) is exactly ADR-0002:15 + D-FEE-TAX-01 (BUY lowers cash by gross + fee + tax → DEBIT).
- `cash_entry_direction_sell: "DEBIT"` (`:56`) would mean a sale *removes* cash from the account. No canonical source supports that: ADR-0002:15 gives CREDIT for a cash-raising leg, and the jointly approved D-FEE-TAX-01 states *"SELL | Credit `amount - fee_amount - tax_amount`"* (`docs/decisions/w0-2-ledger-policy.md:61`, worktree `t_941802f0`), reciprocally confirmed at `docs/decisions/w0-2-calculation-policy.md:43` (worktree `t_71035d04`).

### 2.4 The position-leg reading is not canonical and is not stable in the codebase

If the field were the position leg, `DEBIT` would have to be a canonical position-direction rule. It is not:

- ADR-0002:16 defines the quantity rule by activity type, not by entry direction: *"**quantity:** BUY verhoogt, SELL verlaagt"*. The ledger derives quantity sign from `activity_type`, not from `direction` (`apps/api/src/index.ts:3893-3896`; `:2728-2737`; `:7588-7596`).
- The two trade-writing paths in the codebase **contradict each other** on the SELL position direction: the generic manual/ledger path writes SELL as `direction='DEBIT'` with `entry_kind='POSITION'` (`apps/api/src/index.ts:8001-8004`), while the option-lifecycle path writes its SELL leg as `direction='CREDIT'` with `entry_kind='POSITION'` (`apps/api/src/option-lifecycle.ts:198-214`, CREDIT at `:203`). A contract value that one canonical write path contradicts cannot be a testable invariant.
- The option lot reader keys off the position direction, not the activity type, which is exactly why the two paths cannot both be canonical (`apps/api/src/index.ts:5175-5187`: `:5175` `direction === "DEBIT"` ⇒ open a lot, otherwise consume lots).

### 2.5 The DEBIT value's likely provenance — an implementation artefact, not a contract

The value in the fixture matches how the current implementation happens to classify a sale, which is *not* a canonical rule:

- `apps/api/src/index.ts:7600` — the portfolio-snapshot projection lists SELL among `isCashDebit` activities, so the snapshot's `freeCash` falls by the sale amount (`:7603-7604`).
- `apps/api/src/index.ts:6827-6829` — the import-commit path classifies SELL as debit and then **rejects** the whole row because a POSITION-kind activity is blocked (`entryKind === "POSITION"` ⇒ `409 IMPORT_COMMIT_BLOCKED`); imports of BUY/SELL are not postable at all.
- `apps/api/src/index.ts:7755-7776` — the replay totals treat any `is_external_flow` DEBIT entry as external spending (`:7768-7769`). A manually booked BUY/SELL is created with `is_external_flow = true` (`:8014`), so a trade is currently counted as external spending of gross amount. That is an implementation inconsistency with the D-FEE-TAX-01 cash-effect rule, not a definition of a cash direction.

### 2.6 Implementation finding that the A-case contract implies (recorded, not authorized)

The manual ledger path creates **exactly one** `ledger_entry` for a BUY/SELL, and it is a POSITION entry — there is no CASH leg for a trade at all:

- `apps/api/src/index.ts:8001-8004` — `isPosition = ["BUY","SELL","SPLIT"]`, `entryKind = isPosition ? "POSITION" : "CASH"`, `direction = isDebit ? "DEBIT" : "CREDIT"`.
- `apps/api/src/index.ts:8017-8026` — one `INSERT INTO spaartrack.ledger_entry` with that kind/direction.

Consequently the current single-entry trade model cannot satisfy `A-BUY-SELL-QUANTITY-001` as written, and `TC-US-0002-A` as contracted requires the W0-3 implementation to post a **cash leg** for trades (BUY DEBIT, SELL CREDIT) alongside the position leg. Money-flow projections already assume such legs exist: they filter `le.entry_kind = 'CASH'` (`:2325`, `:2415`, `:2492`), so today's trades are invisible to money flow. This is an implementation consequence to schedule, not work authorized here.

## 3. Why the value cannot be changed by Ledger alone

The replacement value is not a free Ledger choice; D-FEE-TAX-01 is a *reciprocal* Ledger+Calculations decision, and the Calculations owner has explicitly kept the A-case field out of its approved scope while leaving the leg identity open (`docs/decisions/w0-2-calculation-policy.md:12`, `:36`, `:76`, worktree `t_71035d04`; `docs/decisions/w0-2-b-case-fee-tax-calculation-v1.md:9`, worktree `t_f3b817b0`). The prior Ledger clarification (`docs/decisions/w0-2-sell-direction-field-clarification.md:12-19`, worktree `t_49297bc1`) asked for exactly this leg identification and left the disposition NOT DECIDED pending it.

## 4. Required next step — explicit reciprocal Calculations concurrence

Because the field is the cash leg, the card's "if it is cash, coordinate explicit reciprocal Calculations concurrence" branch applies. A reciprocal Calculations card has been created for this; it must record, explicitly and in the Calculations owner's own words, whether it concurs that:

1. `A-BUY-SELL-QUANTITY-001.then.cash_entry_direction_sell` denotes the SELL cash leg (`entry_kind='CASH'`);
2. the canonical value of that leg is **CREDIT** (gross proceeds less attached fee/tax) under ADR-0002:15 and D-FEE-TAX-01;
3. the amendment to the fixture changes **no** approved B-case output or version (`cost-basis-v1` / `pnl-v1`, `B-PARTIAL-SELL-FIFO-WAC-001`, `B-PRICE-FX-DECOMPOSITION-001`);
4. the amendment does not silently approve the A-case's other open dependencies (`D-OVERDRAFT-01`, `D-SHORT-01`).

Until that record exists, the A-case assertion stays NOT DECIDED as a contract and QA must not edit the fixture. Sequencing: reciprocal concurrence → QA amends fixture and re-runs the red-first contract → independent QA review.

## 5. Policy questions — current disposition, responsible owner, exact answer still required

The table reflects the **newest** versioned owner records (19 October 2026), not the earlier 18 October handoffs. Nothing below is claimed as solved by a prior limited note.

| ID | Current disposition (newest record) | Responsible owner | Exact answer still required |
|---|---|---|---|
| **D-OVERDRAFT-01** | **NOT DECIDED** — neither blanket reject nor permit approved (`t_5befc971/docs/decisions/w0-2-ledger-overdraft-short-policy.md:11`, `:16-26`) | Ledger owner, with a human/domain owner for account eligibility, limits and role policy | For each debit class (BUY, WITHDRAWAL, standalone FEE, standalone TAX, TRANSFER_OUT): (1) reject on insufficient available cash, or permit only for named account types with an explicit currency/amount limit; (2) definition of available cash — POSTED balance only, and how PENDING/DRAFT reservations, holds and unsettled cash affect it; (3) whether eligibility is decided at command/posting time or at the transaction effective date/as-of date; (4) which server-authorized role may invoke a permitted overdraft (not inferred from OWNER/EDITOR scope); (5) the deterministic command result and stable rejection/limit semantics at the insufficiency boundary. The four synthetic vectors `OVD-BUY-INSUFFICIENT-001`, `OVD-WITHDRAWAL-INSUFFICIENT-001`, `OVD-FEE-TAX-INSUFFICIENT-001`, `OVD-TRANSFER-OUT-INSUFFICIENT-001` (`t_5befc971/...:44-47`) become executable once answered. |
| **D-SHORT-01** | **DECIDED, bounded** — reject every SELL that would make the position negative; no short-open for any account or instrument class; no short cover; `409 SHORT_POSITION_NOT_PERMITTED`; correction guard `CORRECTION_BREAKS_POSITION_CONSTRAINT` (`t_5befc971/...:12`, `:28-36`, vectors `:48-50`) | Ledger (decided); QA to encode and exercise | No further policy answer. Remaining work: QA encodes the decision in the fixture/smoke test and exercises `SHORT-SELL-INSUFFICIENT-001`, `SHORT-UNSUPPORTED-INSTRUMENT-001`, `SHORT-CORRECTION-REPLAY-001`; the `sell_quantity_must_not_increase_position` assertion (fixture `:57`) is compatible. Explicitly still out of scope of that decision: fractional-quantity precision, split residuals, cost-basis defaults. |
| **D-ROUNDING-01** | **PARTIALLY DECIDED** — decided calculation-side: base-10 decimal strings, 34 significant-digit working precision, ROUND_HALF_EVEN, output quantization at 12 fractional places (16 for FX), no intermediate quantization to currency minor units, `minor_units` presentation-only, residual assigned to the last consumed lot, calculation-local exact fractional residual, ordering by effective date → UTC `occurred_at` → stable transaction id, POSTED-only eligibility (`t_64ce59b3/docs/decisions/w0-2-calculation-rounding-cost-basis-v2.md:15-45`; Ledger concurrence `t_eea535ff/docs/decisions/w0-2-ledger-concurrence-rounding-cost-basis-v1.md:8-22`) | Ledger + Calculations jointly for the residual items below | (a) **Canonical residual persistence** — whether an exact fractional lot/entitlement residual may be stored in canonical ledger tables, snapshots or replay data, or must be calculation-local only (Ledger-owned, explicit proposal + review required). (b) **Canonical replay/restore serialization** — the byte representation, included fields, ordering, decimal/timestamp normalization, digest inputs, hash version and the restore-equality contract; the current `replay_hash` is SHA-256 over `JSON.stringify({ rows, balances, totals })` (`apps/api/src/index.ts:7742-7794`) and is not a canonical serialization spec. (c) **External rounding conflict** — ADR-0002:17 states *"rounding naar 12 decimalen intern, 2 extern"*, while the Calculations v2 output boundary quantizes monetary outputs at 12 places and calls `minor_units` presentation-only (`:19-24`); the 2-decimal external rule is not reconciled and must be decided or explicitly withdrawn. |
| **D-COST-BASIS-01** | **DECIDED, bounded** — every result requires an explicit method (FIFO or WAC named; omission is a validation error, no implicit default), with the scoped ordering and POSTED-only eligibility concurred by Ledger (`t_64ce59b3/...:39-45`; `t_eea535ff/...:16-22`) | Calculations (decided); Ledger concurs on ordering/eligibility | No further *default-method* decision is required — the "no implicit default" answer is recorded. Still NOT DECIDED: general acquisition/disposal fee-tax allocation and lot/split rules **outside** the two named B cases and versions, which require reciprocal explicit Ledger + Calculations approval (`t_64ce59b3/...:5`, `:13`, `:60`, `:75`); canonical residual persistence (shared with D-ROUNDING-01); and the tax-methodology question, which stays with Calculations. |
| **D-TRANSFER-01** | **PARTIALLY DECIDED** — decided: paired TRANSFER_OUT/TRANSFER_IN with mutual `paired_transaction_id`, `is_external_flow=false`, contribution/spending neutral, correction/VOID of the pair is one atomic unit that preserves both original legs and records reason and actor for audit (`t_941802f0/docs/decisions/w0-2-ledger-policy.md:36-52`; ADR-0002:18) | Ledger (owner) | (a) the canonical **reversal representation** — paired VOID metadata only, or additional reversal activities/entries, and if the latter their identifiers, signs and amounts; (b) **retry** semantics for an exact retry of a correction; (c) the outcome for an **already-VOID, missing or mismatched** pair; (d) whether a **correction effective date** may differ from the original effective date, and its effect on historical as-of replay; (e) the exact audit action/field names beyond reason, actor and traceability. |
| **D-FEE-TAX-01** | **JOINTLY APPROVED, bounded** — gross `amount`, one-time same-entry attached fee/tax, BUY basis/cash, SELL proceeds/cash, DIVIDEND net income, standalone FEE/TAX, versions `cost-basis-v1`/`pnl-v1`, and the exact named B-case outputs only (`t_941802f0/...:54-71`; `t_71035d04/...:32-72`; narrowed by `t_64ce59b3/...:5`, `:13`) | Ledger + Calculations (reciprocal) | Generalization beyond the named cases/versions is NOT DECIDED and needs explicit reciprocal approval. The A-case SELL field's disposition additionally depends on the section 4 concurrence. |

## 6. Cross-document inconsistencies to reconcile (recorded, not fixed)

These are canonical-doc statements that assert policy the owners have not decided. They are listed so the next owner does not mistake them for approved contract. No ADR, roadmap, backlog, fixture or test is edited by this artifact.

1. `docs/adr/0002-canonical-ledger.md:15` — *"geen negatieve cash zonder expliciete loan-account"* presumes a loan-account/overdraft exception that **D-OVERDRAFT-01 has not decided** (no loan-account model exists in `database/schema.sql`).
2. `docs/adr/0002-canonical-ledger.md:16` — *"quantity nooit negatief zonder short-flag"* presumes a short flag that **D-SHORT-01 has since decided away** (reject all shorts, no short class). The ADR wording is now behind the decision.
3. `docs/adr/0002-canonical-ledger.md:17` — *"rounding naar 12 decimalen intern, 2 extern"* is not reconciled with the Calculations v2 output boundary (section 5, D-ROUNDING-01 (c)).
4. `docs/adr/0002-canonical-ledger.md:13` — each invariant is said to have a contract test in `tests/smoke/ledger-*.test.mjs`; those files are documentation-presence checks (e.g. `tests/smoke/ledger-action-contract.test.mjs:15-26`), not behavioural coverage of the cash/quantity/cost-basis/transfer/FX rules, and they assert no SELL/BUY cash direction.
5. `roadmap.md:764` (US-0002, "Done lokaal 19 oktober 2026") asserts the invariants are testable rules, and the committed `tests/unit/us0002-financial-invariants.test.mjs` at HEAD `4fb71c6` only matches six substrings in ADR text — it loads no fixture and no application behaviour and asserts no expected value, so it passes whenever the rule is merely *mentioned*. The independent evidence audit at `t_2c6e4bbd/us0002-primary-evidence-audit.md:16` records the same finding. Note that the primary tree carries uncommitted `roadmap.md` and `backlog.md` edits, so the US-0002 row sits at a different line there (`:796`); the citation above is the tracked worktree line. Roadmap/backlog edits are outside this card's scope, so this is reported, not amended.

## 7. Gate status

- **W0-2 / US-0002-A/B/C / TC-US-0002-A/B/C: RED / BLOCKED.** The QA contract must stay red until the section 4 reciprocal concurrence is recorded, QA amends the fixture and re-runs the red-first contract, and independent QA reviews the result.
- **Red-first evidence, preserved (read-only, no fixture/test edit):** `TRACE_ID=ledger-w02-sellleg-20261020 CORRELATION_ID=ledger-w02-sellleg-20261020 node --test tests/smoke/financial-invariant-contract.test.mjs`, executed in `/Users/ruben/spaartrack/.worktrees/t_0a835fa0` — 5 tests total, 4 passed, 1 failed intentionally at the `owner_decisions_approved=false` guard (`tests/smoke/financial-invariant-contract.test.mjs:79-80`), 0 skipped, exit 1. This is documentation/gate evidence only, not runtime financial behaviour.
- **D-OVERDRAFT-01 remains open** and continues to block a release-green A-case; D-SHORT-01 is decided but not yet encoded or exercised by QA.
- **Replay hash / general determinism: NOT VERIFIED.** Replay was not run and the canonical serialization contract is itself undecided (D-ROUNDING-01 (b)). **Restore equality: NOT VERIFIED.**
- **Migration status: no schema or migration changed or proposed.** Migration dry-run, reapply/idempotence and restore were not run and are not claimed by this record; the downstream migration gate remains applicable.
- **No implementation authorization.** No W0-3, Wave 2+, Poort A/B/C or release clearance follows from this determination. No direct ledger write, SQL mutation or credential use occurred.
- **Next gates:** reciprocal Calculations concurrence (section 4) → QA fixture amendment and red-first re-run → independent QA review → only then the D-OVERDRAFT-01 owner answer, and after that runtime, security, migration, replay and restore evidence for the broader release gate.

## 8. Traceability and evidence paths

Stories/tests: `US-0002-A` → `TC-US-0002-A` (this determination); `US-0002-B` → `TC-US-0002-B` and `US-0002-C` → `TC-US-0002-C` (D-ROUNDING-01, D-COST-BASIS-01, D-TRANSFER-01 dispositions and the B-case non-regression requirement). Roadmap rows `roadmap.md:1001-1003`; refinement catalog `docs/backlog/b-004-refinement.md:23-25`; `test-cases.md:61-64`; cross-cutting gates `test-cases.md:393,396,397` (TC-X-003, TC-X-006, TC-X-007); ADR `docs/adr/0002-canonical-ledger.md:9-20`.

Owner records reviewed (isolated worktree paths, SHA-256):

| Artifact | Path | SHA-256 |
|---|---|---|
| Ledger policy v1 | `t_941802f0/docs/decisions/w0-2-ledger-policy.md` | `2d505d13ce35f879d0b7e64c15a823dcd4ca2a02b77ee59b85c78a9e52843d3b` |
| Calculations policy v1 | `t_71035d04/docs/decisions/w0-2-calculation-policy.md` | `8ad2fb405d38e7d4d15eedb2bc4c73c2be0a0106441d3e670aab2dad8811c448` |
| B-case fee/tax calculation v1 | `t_f3b817b0/docs/decisions/w0-2-b-case-fee-tax-calculation-v1.md` | `afd31bd5200b0941582cb91aa9fc281497baaf5a0a3a03c7e222e9cacf89b088` |
| SELL-direction clarification v1 | `t_49297bc1/docs/decisions/w0-2-sell-direction-field-clarification.md` | `3374102eaf545459f5196d6333b09e1d8aa0d10a6610b49846973f54395be759` |
| Ledger overdraft/short v1 | `t_cd28cac1/docs/decisions/w0-2-ledger-overdraft-short-policy.md` | `19a21629778fc9f0c31f07e78418498b4635a8edfb9fba406d6755a4222ce3fc` |
| Ledger overdraft/short v2 (current) | `t_5befc971/docs/decisions/w0-2-ledger-overdraft-short-policy.md` | `ed71d3ce9f036c97116d0d25eabe3517c53a0ae40b1faa8ed40c346a73ca9d44` |
| Calculations rounding/cost-basis v1 (superseded) | `t_61151bb9/docs/decisions/w0-2-calculation-rounding-cost-basis-v1.md` | `4e977538cf8dea0d7c01be0b552b15a015beae3716c2263bf68438f9b5f84e43` |
| Calculations rounding/cost-basis v2 (current) | `t_64ce59b3/docs/decisions/w0-2-calculation-rounding-cost-basis-v2.md` | `d69f403fcbe34322a3055e2626b28e382d32850330e29decfde490836fd066b6` |
| Ledger concurrence rounding/cost-basis v1 | `t_eea535ff/docs/decisions/w0-2-ledger-concurrence-rounding-cost-basis-v1.md` | `7bb01c8915a16a5da0f2b68be00dffcde834704e72e5e7293b2d22e5fa5d6414` |
| Ledger policy closeout | `t_49141da4/docs/decisions/w0-2-ledger-policy-closeout.md` | `934351f42e7bc89e75d0c741cdd53766a32b48479e79b3d62919142924ab50db` |
| Policy reconciliation | `t_ca53a2ba/docs/decisions/w0-2-policy-reconciliation.md` | `37763f8059aac9e6d9227dc23f0c640649d491c81ac346a3e4b0af02916144ac` |
| US-0002 primary evidence audit | `t_2c6e4bbd/us0002-primary-evidence-audit.md` | (read-only audit, not a decision) |

QA contract under review (unmodified): `t_0a835fa0/fixtures/W0-2-financial-contract-v1.json` SHA-256 `096a29f84a58917db7345f767f5d7549bbcd196571b1aa894c4c2e9145841c50`; `t_0a835fa0/tests/smoke/financial-invariant-contract.test.mjs` SHA-256 `d1dc2a84fb51ec57ddb3c87b9235f457698e3d022b8609ec8f624cceb5693b71`.

This artifact: `docs/decisions/w0-2-sell-cash-leg-determination-v1.md` in worktree `/Users/ruben/spaartrack/.worktrees/t_d2bd0b46` (branch `spaartrack/t_d2bd0b46-w0-2-ledger-resolve-sell-leg-ambiguity-o`). Its SHA-256 is recorded in the task handoff. No fixture, test, source, schema, migration, ADR, roadmap, backlog or canonical ledger data was changed.
