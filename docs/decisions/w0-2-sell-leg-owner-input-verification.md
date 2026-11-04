# W0-2 architecture verification: SELL cash-leg owner input and documentation consistency — v1

Status: **the owner-input request this card was created to collect is ANSWERED**, and the answer is durable on `main`. This artifact verifies that answer's documentation consistency, reports three material gaps found in the QA-owned contract that the answer exposes, and states plainly that the contract-value change is **not yet effective**. Documentation-only record. It does not decide any financial policy, does not approve the W0-2 gate, does not authorize W0-2/W0-3 implementation, schema or migration work, fixture/test edits, or ledger mutation, and it does not rewrite any other owner's record.

Scope: US-0002-A / TC-US-0002-A (the SELL-leg owner-input question), with the affected cross-records of US-0002-B/C / TC-US-0002-B/C inspected read-only for consistency. Supersedes nothing; the six recovered owner records and the Ledger determination keep their own wording.

## 1. The requested decision, and the answer

The exact question asked by the prior architecture clarification (`docs/decisions/w0-2-sell-direction-field-clarification.md:14`) was which ledger entry/leg `A-BUY-SELL-QUANTITY-001.then.cash_entry_direction_sell` describes, and whether it is the SELL cash leg.

**Answer received (Ledger owner, `t_d2bd0b46`):** the field denotes the SELL **cash leg** — the `ledger_entry` row with `entry_kind = 'CASH'` belonging to the SELL transaction. It is not a position leg, not a fee/tax leg, not a memo leg. Because it is the cash leg, the "if it is cash" branch of the clarification applies: explicit reciprocal **Calculations** concurrence is required before QA may amend the fixture.

Artifacts, cited precisely:

| Item | Value |
|---|---|
| Determination artifact | `docs/decisions/w0-2-sell-cash-leg-determination-v1.md` |
| SHA-256 (verified by this card, source worktree and `main`) | `c274be04bddecab5a4a25f6ec1122d4dd7b318cc97b94444e3717efac9f2819b` |
| Landed on `main` in | `70778e98320c8487a5c6a796f7a5d999f1dba918` — `docs(US-0002): land W0-2 SELL cash-leg determination record and decision index` |
| `main` HEAD at verification time | `70778e9` |
| Prior clarification (superseded on this one point, preserved as-is) | `docs/decisions/w0-2-sell-direction-field-clarification.md`, SHA-256 `3374102eaf545459f5196d6333b09e1d8aa0d10a6610b49846973f54395be759` |
| Reciprocal Calculations concurrence (required, still outstanding) | card `t_ff54ddc9` (running) |
| QA fixture amendment + red-first re-run (required, still outstanding) | card `t_0a835fa0` (todo) |

The clarification artifact is retained unchanged: its "NOT DECIDED" status is the audit trail of the question, and the determination supersedes it only on the leg-identity point.

## 2. Documentation-consistency verification of the landed record set

Verified read-only against `main` at `70778e9`. No file was modified.

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | The determination is byte-identical between its source worktree and `main` | **PASS** | `shasum -a 256` on `/Users/ruben/spaartrack/.worktrees/t_d2bd0b46/docs/decisions/w0-2-sell-cash-leg-determination-v1.md` and `git show main:docs/decisions/w0-2-sell-cash-leg-determination-v1.md` both give `c274be04…f2819b` |
| 2 | `docs/decisions/README.md` indexes all seven owner artifacts, with correct owning task id, date, version and scope | **PASS** | Seven rows in the README "Records" table map 1:1 to the seven landed files; owning ids `t_941802f0`, `t_71035d04`, `t_49297bc1`, `t_ca53a2ba`, `t_49141da4`, `t_eea535ff`, `t_d2bd0b46` match the artifacts' own subject matter; every artifact title carries "— v1" (README version column v1 ×7) |
| 3 | The determination's own evidence table is accurate for the landed artifacts | **PASS** | The four hashes the determination quotes for landed records match `git show main:<path> \| shasum -a 256` exactly: `w0-2-ledger-policy.md` `2d505d13…`, `w0-2-calculation-policy.md` `8ad2fb40…`, `w0-2-sell-direction-field-clarification.md` `3374102e…`, `w0-2-ledger-concurrence-rounding-cost-basis-v1.md` `7bb01c89…` |
| 4 | The determination's line citations resolve at `main` HEAD | **PASS** | `database/schema.sql:533` = `CREATE TABLE ledger_entry (`, `:538` = `entry_kind … CHECK (entry_kind IN ('CASH','POSITION','FEE','TAX','MEMO'))`, `:539` = `direction … CHECK (direction IN ('DEBIT','CREDIT'))`; `docs/adr/0002-canonical-ledger.md:15` = the cash sign rule "DEBIT verlaagt, CREDIT verhoogt"; `apps/api/src/index.ts:8001-8004` = the `isPosition`/`isDebit`/`entryKind`/`direction` block; `apps/api/src/option-lifecycle.ts:203` = `direction: "CREDIT",` |
| 5 | The determination's canonical-value citations are reciprocal | **PASS** | `docs/decisions/w0-2-ledger-policy.md:61` = "SELL \| Credit `amount - fee_amount - tax_amount`"; `docs/decisions/w0-2-calculation-policy.md:43` = "SELL: cash credit = gross amount − fee − tax" |
| 6 | The supersession statement in the README and in commit `70778e9` is accurate | **PASS with a gap — see finding D** | The determination supersedes only the SELL-leg question from `t_49297bc1` and overwrites none of the six; it does leave D-OVERDRAFT-01 and the D-ROUNDING-01 / D-COST-BASIS-01 / D-TRANSFER-01 residuals open. The README's own wording is factually true of the determination; it is incomplete about a second-order consequence (finding D) |
| 7 | The README's traceability citations resolve at the landed commit with the right content | **PASS** | `roadmap.md:764` = the US-0002 row; `roadmap.md:1001-1003` = the US-0002-A/B/C rows; `test-cases.md:61-64` = TC-US-0002 and -A/-B/-C; `docs/backlog/b-004-refinement.md:23-25` = the US-0002-A/B/C refinement rows |
| 8 | The determination does not contradict the six recovered records | **CONTRADICTION FOUND — see finding D** | Three landed records state D-SHORT-01 / D-ROUNDING-01 / D-COST-BASIS-01 as "NOT DECIDED"; the determination states them as DECIDED / PARTIALLY DECIDED. The determination discloses that it reflects the newer 19 Oct records; those records are not on `main` |

## 3. Findings

### Finding A — the disputed field is asserted by no test, so the fixture amendment is currently unverifiable

`cash_entry_direction_sell` appears **only** in the fixture file. A repo-wide search (`grep -rln "cash_entry_direction" /Users/ruben/spaartrack --include=*.mjs --include=*.json --include=*.ts`, excluding `node_modules`) returns exactly one file: `fixtures/W0-2-financial-contract-v1.json`. No test file references it. The same holds for `cash_entry_direction_buy` and for `expected_direction` in `A-CASH-SIGNS-001`.

Proof by mutation (scratch copies only; the QA worktree was never modified): mutating the fixture value `DEBIT` → `CREDIT` leaves the contract outcome **identical** — 5 tests, 4 passed, 1 failed, 0 skipped, exit 1, failing at the same `owner_decisions_approved=false` guard.

Proof that the missing assertion is the only thing missing: a scratch probe adding `assert.equal(getCase("A-BUY-SELL-QUANTITY-001").then.cash_entry_direction_sell, "CREDIT")` fails against the current fixture (`actual: 'DEBIT'`, `expected: 'CREDIT'`) and passes against the same fixture with `CREDIT`. The red-first test that would evidence the amendment therefore has to be **added**, not merely satisfied.

Scope of the gap is wider than this one field: of the 51 expected-output leaf values in the fixture's `then` blocks, **24 are never referenced by the contract test**, including `cash_entry_direction_buy`, `cash_entry_direction_sell`, `expected_direction`, `sell_quantity_must_not_increase_position`, `source_direction`, `destination_direction`, `both_legs_are_external_flow_false`, `exact_replay_returns_original_activity`, `replay_outputs_and_hash_are_deterministic_for_same_ledger_and_version`, `restored_totals_equal_pre_backup_totals` and `restore_database_is_disposable_and_isolated`. The assertions that do exist for case `A-BUY-SELL-QUANTITY-001` are limited to `remaining_quantity` and `decision_dependencies`.

Owner: **QA** (`t_0a835fa0`). Consequence for that card: amending the fixture value alone changes no test outcome, so the amendment must land together with the missing assertions, or the A-case remains unevidenced.

### Finding B — the RED guard is one hand-editable boolean that does not track the decisions

The suite's only RED guard is `fixture.owner_decisions_approved` (`tests/smoke/financial-invariant-contract.test.mjs:79-80`). Setting that flag to `true` in a scratch copy — while all six `D-*` entries remain listed in `unresolved_decisions` — makes the whole suite pass: 5 tests, 5 passed, 0 failed, exit 0.

The gate that is supposed to prevent "policy invented without owner approval" therefore does not derive its state from the owner records; it is a flag a single edit can flip. Combined with finding A, the suite can be green while no owner decision is encoded and the disputed value is wrong.

Owner: **QA** (`t_0a835fa0`), with the Ledger/Calculations owners unaffected.

### Finding C — the QA contract worktree is 19 commits behind and lacks the canonical sources the determination cites

`docs/decisions/w0-2-sell-cash-leg-determination-v1.md` cites `database/schema.sql:533-555`, `docs/adr/0002-canonical-ledger.md:15`, `apps/api/src/index.ts:8001-8004` / `:8017-8026` / `:8060-8066` and `apps/api/src/option-lifecycle.ts:198-214`. These resolve at `main` HEAD `70778e9` and in the Ledger and Calculations worktrees, which are based on `4fb71c6`.

They do **not** resolve in the QA worktree `t_0a835fa0`, whose HEAD is `cf5e8c4` ("first commit", 2026-10-17 22:26), **19 commits behind `main`**, and which does not contain commit `21eef2d` ("feat(ledger): canonical schema, migraties 0018-0026 en synthetische fixturepacks"). In that worktree:

- `database/schema.sql:533` is `WHERE external_hash IS NOT NULL;` — `CREATE TABLE ledger_entry` is at line 500, and `entry_kind`/`direction` at 505/506;
- `docs/adr/0002-canonical-ledger.md` is the 16-line pre-invariants text — the "Financiële invariants (US-0002, TC-US-0002 / TC-US-0002-A/B/C)" section and the cash sign rule do not exist there at all (`grep -c "verlaagt"` → 0);
- `apps/api/src/index.ts` is 5847 lines, so `:8001` is empty; the trade path is at `:5036-5037`;
- `apps/api/src/option-lifecycle.ts` **does not exist** in that worktree.

The smoke test reads `docs/adr/0002-canonical-ledger.md` from its own worktree root, and its only ADR assertion is the "bron van waarheid" sentence, which is present in both versions — so the suite passes on the stale base while the canonical cash invariant it is meant to pin is absent from the tree being tested.

Owner: **QA** (`t_0a835fa0`), with architecture to confirm the base before the amendment is accepted as evidence.

### Finding D — the landed corpus is not self-consistent about three policy dispositions

The determination's section 5 states **D-SHORT-01 = "DECIDED, bounded"** (reject all shorts, `409 SHORT_POSITION_NOT_PERMITTED`), **D-COST-BASIS-01 = "DECIDED, bounded"** (explicit method required, no implicit default) and **D-ROUNDING-01 = "PARTIALLY DECIDED"**. The six landed records still state the first two as NOT DECIDED:

| Landed record | D-SHORT-01 | D-COST-BASIS-01 |
|---|---|---|
| `w0-2-ledger-policy.md:12` | `NOT DECIDED` | — |
| `w0-2-calculation-policy.md` | — | `NOT DECIDED` |
| `w0-2-policy-reconciliation.md:34` | `NOT DECIDED` | `NOT DECIDED` |
| `w0-2-ledger-policy-closeout.md:25` | `NOT DECIDED` | `NOT DECIDED` |
| `w0-2-sell-cash-leg-determination-v1.md` section 5 | `DECIDED, bounded` | `DECIDED, bounded` |

The determination is transparent about this: its section 5 preamble states the table "reflects the **newest** versioned owner records (19 October 2026), not the earlier 18 October handoffs", and its section 8 table names the superseding records with SHA-256. The gap is that **those superseding records are not on `main`** — four of the nine owner records the determination cites are untracked files that exist only inside their task worktrees:

| Cited owner record | Task | On `main`? |
|---|---|---|
| `w0-2-b-case-fee-tax-calculation-v1.md` | `t_f3b817b0` | **No** |
| `w0-2-ledger-overdraft-short-policy.md` (v1) | `t_cd28cac1` | **No** |
| `w0-2-ledger-overdraft-short-policy.md` (v2, current) | `t_5befc971` | **No** |
| `w0-2-calculation-rounding-cost-basis-v1.md` (superseded) | `t_61151bb9` | **No** |
| `w0-2-calculation-rounding-cost-basis-v2.md` (current) | `t_64ce59b3` | **No** |

All five are still present but untracked in their worktrees, so they carry the same worktree-cleanup risk that the landing card `t_b1ce7c43` was created to eliminate for the six. The README's Supersession section does not mention the D-SHORT-01 / D-ROUNDING-01 / D-COST-BASIS-01 status upgrade, so a reader of `main` alone sees a contradiction with no discoverable resolution.

A related, concrete inconsistency: the QA fixture still lists **D-SHORT-01** as unresolved (`fixtures/W0-2-financial-contract-v1.json:179`) and **D-FEE-TAX-01** as unresolved (`:181`), while the determination records D-SHORT-01 as decided. The smoke test pins the exact six-id list (`tests/smoke/financial-invariant-contract.test.mjs:71`, `assert.deepEqual(ids, ["D-OVERDRAFT-01","D-SHORT-01","D-ROUNDING-01","D-FEE-TAX-01","D-COST-BASIS-01","D-TRANSFER-01"])`), so encoding the decided dispositions requires changing the fixture list **and** that assertion in lockstep.

Owner: **Ledger** and **Calculations** for the record status (their own records), **architecture** for landing the unlanded records durably, **QA** for the fixture/test inventory. No owner record is amended by this artifact.

## 4. The contract-value change is not yet effective

Stated explicitly, as required:

- The fixture still asserts `cash_entry_direction_sell: "DEBIT"` (`fixtures/W0-2-financial-contract-v1.json:56`, verified).
- The canonical value of the SELL cash leg is **CREDIT** (gross proceeds less attached fee/tax) per ADR-0002:15 and the jointly approved D-FEE-TAX-01.
- That value change is **NOT DECIDED as a contract change** until the reciprocal Calculations concurrence on `t_ff54ddc9` is recorded **and** independently reviewed.
- Only then may QA amend the fixture on `t_0a835fa0` — and, per finding A, the amendment must add the missing assertions (not merely change the value) to constitute evidence.
- Independent QA must then reconcile the contract before any finance work.
- Unchanged and still open, each with its named owner: **D-OVERDRAFT-01** (Ledger + human/domain owner), **D-ROUNDING-01** residuals — canonical residual persistence and canonical replay/restore serialization + digest + restore-equality (Ledger + Calculations jointly), **D-COST-BASIS-01** general fee-tax allocation outside the two named B cases (Ledger + Calculations), **D-TRANSFER-01** reversal representation, retry, already-VOID/missing/mismatched pair, correction effective date (Ledger). This determination approves none of them.

## 5. Gate status and verification

**W0-2 / US-0002-A/B/C / TC-US-0002-A/B/C: RED / BLOCKED. W0-3: blocked.** No financial implementation, schema/migration work, fixture/test edit, W0-3, Poort A/B/C or release clearance is authorized by this artifact.

Red-first evidence, preserved read-only in the QA worktree, no fixture/test edit:
`TRACE_ID=arch-w02-ownerinput-20261020 CORRELATION_ID=arch-w02-ownerinput-20261020 node --test tests/smoke/financial-invariant-contract.test.mjs` in `/Users/ruben/spaartrack/.worktrees/t_0a835fa0` → **5 tests, 4 passed, 1 failed, 0 skipped, exit 1**, failing at the intentional `owner_decisions_approved=false` guard (`tests/smoke/financial-invariant-contract.test.mjs:79-80`).

Additional scratch probes (outside the repository; the QA worktree, fixture and test were never modified):

| Probe | Result |
|---|---|
| A: fixture mutated `DEBIT`→`CREDIT`, contract re-run | 5 tests, 4 pass, 1 fail, exit 1 — **identical** to the unmodified run |
| B: `owner_decisions_approved` set to `true`, all six `D-*` still listed unresolved | 5 tests, **5 pass**, 0 fail, exit 0 |
| C: added assertion `cash_entry_direction_sell === "CREDIT"` vs the current `DEBIT` fixture | **1 test, 0 pass, 1 fail** — `actual: 'DEBIT'`, `expected: 'CREDIT'` |
| D: same assertion vs the `CREDIT` fixture | **1 test, 1 pass, 0 fail** |

Migration status: no schema or migration changed or proposed; no dry-run, reapply/idempotence or restore exercise performed or claimed. Replay hash/determinism and restore equality: **NOT VERIFIED** — replay was not run, and the canonical serialization contract is itself undecided (D-ROUNDING-01 residual). No ledger command, no SQL, no credential use.

## 6. Traceability and evidence paths

Stories/tests: `US-0002-A` → `TC-US-0002-A` (the SELL-leg owner input and findings A/B/C/D on the A-case contract); `US-0002-B` → `TC-US-0002-B` and `US-0002-C` → `TC-US-0002-C` (the B/C-case expected-output values are unaffected by the SELL-leg answer — the fixture's B-case values `42.600000000000` / `101.600000000000` (FIFO), `34.800000000000` / `93.800000000000` (WAC), fees `6.000000000000`, taxes `5.000000000000`, and the price/FX set `15.120000000000`, `46.560000000000`, `12.000000000000`, `58.560000000000`, `73.680000000000` EUR, fees `3.000000000000` USD, taxes `2.000000000000` USD are unchanged by this determination, and the reciprocal Calculations concurrence on `t_ff54ddc9` must confirm that independently).

Landed records verified: `docs/decisions/README.md` and the seven owner artifacts at `main` `70778e9`; QA contract in worktree `t_0a835fa0`; determination in worktree `t_d2bd0b46`.

Next gates, unchanged in order: reciprocal Calculations concurrence (`t_ff54ddc9`) → QA fixture amendment **with the missing assertions added** and red-first re-run on the canonical base (`t_0a835fa0`) → independent QA reconciliation → then the D-OVERDRAFT-01 owner answer → runtime, security, migration, replay and restore evidence for the broader release gate.
