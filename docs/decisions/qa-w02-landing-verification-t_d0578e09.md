# Independent QA verification — W0-2 owner decision artifacts landed on `main`

Card: `t_d0578e09` (independent QA, documentation-durability gate only)
Reviewer profile: `qa`
Review date: 2026-10-20 (CEST)

## Scope of this review

Read-only verification of the two commits that landed the W0-2 owner decision artifacts:

- `a094fb357ff3b55b9a8b3889d05ac5ecab82edd9` — `docs(US-0002): recover W0-2 owner decision artifacts` (6 files)
- `70778e98320c8487a5c6a796f7a5d999f1dba918` — `docs(US-0002): land W0-2 SELL cash-leg determination record and decision index` (2 files)

Baseline: `4fb71c6ab05ea089fc468aae4814d069c37f953b`.

This is NOT W0-2 QA acceptance, NOT financial-policy approval, NOT an implementation
authorization, and NOT a W0-2/W0-3 green gate. No artifact, README, fixture, test, source,
schema, migration, roadmap, backlog or ADR was edited by this review. No push, PR, deploy
or ledger operation was performed.

## Verdict

**Documentation-durability PASS with one non-blocking finding (F-01).**

All seven acceptance criteria PASS on the bytes. One finding is reported for the orchestrator
to schedule; it is a corpus-completeness gap, not a defect in the landing under review.

## Criterion-by-criterion result

| # | Criterion | Verdict |
|---|---|---|
| 1 | 7 owner artifacts byte-identical to source | PASS |
| 2 | `README.md` index factual only | PASS (F-01, non-blocking, disclosed below) |
| 3 | No artifact rewritten/summarized/merged | PASS |
| 4 | Supersession statement accurate | PASS |
| 5 | Traceability citations resolve at landed commit | PASS |
| 6 | Scope containment only `docs/decisions/**` | PASS |
| 7 | Gate integrity (no owner approval / no W0-2 green) | PASS |

---

## Criterion 1 — byte-identity of the 7 owner artifacts: PASS

`git show main:<path> | shasum -a 256`, `shasum -a 256` on the source worktree file, and
`git show main:<path> | cmp -s - <source>` all agree. 7/7 exact SHA-256 match on all three
methods.

| Artifact | SHA-256 (main == source) |
|---|---|
| `w0-2-sell-direction-field-clarification.md` | `3374102eaf545459f5196d6333b09e1d8aa0d10a6610b49846973f54395be759` |
| `w0-2-ledger-policy.md` | `2d505d13ce35f879d0b7e64c15a823dcd4ca2a02b77ee59b85c78a9e52843d3b` |
| `w0-2-calculation-policy.md` | `8ad2fb405d38e7d4d15eedb2bc4c73c2be0a0106441d3e670aab2dad8811c448` |
| `w0-2-policy-reconciliation.md` | `37763f8059aac9e6d9227dc23f0c640649d491c81ac346a3e4b0af02916144ac` |
| `w0-2-ledger-policy-closeout.md` | `934351f42e7bc89e75d0c741cdd53766a32b48479e79b3d62919142924ab50db` |
| `w0-2-ledger-concurrence-rounding-cost-basis-v1.md` | `7bb01c8915a16a5da0f2b68be00dffcde834704e72e5e7293b2d22e5fa5d6414` |
| `w0-2-sell-cash-leg-determination-v1.md` | `c274be04bddecab5a4a25f6ec1122d4dd7b318cc97b94444e3717efac9f2819b` |

`CMP_ALL_IDENTICAL=yes`. All 7 remain byte-identical after a later third commit landed
(`59fd473`, concurrence record): re-hashing all 7 at `main` returned the same digests.

Source worktrees were read-only throughout and are unmodified: all 7 still show
`?? docs/decisions/` (untracked, unchanged) and their file digests are unchanged.

## Criterion 2 — `README.md` index is factual only: PASS (with F-01)

The index has 9 table lines = header + separator + 7 artifact rows; all rows have a
consistent 5-column shape (`awk -F'|' '/^\|/{print NF-2}'` → a single value, `5`).

Row-by-row check of the 4 factual columns against the artifacts' own text:

| Row | Owning task | Date | Version | Scope wording |
|---|---|---|---|---|
| `w0-2-ledger-policy.md` | `t_941802f0` ✓ | 2026-10-18 ✓ | v1 ✓ | matches artifact `Scope:` line 4 |
| `w0-2-calculation-policy.md` | `t_71035d04` ✓ | 2026-10-18 ✓ | v1 ✓ | matches artifact `Scope:` line 4 |
| `w0-2-sell-direction-field-clarification.md` | `t_49297bc1` ✓ | 2026-10-18 ✓ | v1 ✓ | matches artifact `Scope:`/`Status:` lines 3-4 |
| `w0-2-policy-reconciliation.md` | `t_ca53a2ba` ✓ | 2026-10-18 ✓ | v1 ✓ | matches artifact `Status:` line 3 |
| `w0-2-ledger-policy-closeout.md` | `t_49141da4` ✓ | 2026-10-18 ✓ | v1 ✓ | matches artifact `Status:` line 3 |
| `w0-2-ledger-concurrence-rounding-cost-basis-v1.md` | `t_eea535ff` ✓ | 2026-10-19 ✓ | v1 ✓ | matches artifact `Status:`/`Traceability:` lines 3-4 |
| `w0-2-sell-cash-leg-determination-v1.md` | `t_d2bd0b46` ✓ | 2026-10-20 ✓ | v1 ✓ | matches artifact `Status:` line 3 |

Corroboration of the `Owning task` and `Date` columns, independently of the artifacts:

- Board (`kanban.db`, read-only `SELECT`) confirms each owning task id, its assignee and its
  completion date: `t_49141da4`→2026-10-18, `t_49297bc1`→2026-10-18, `t_71035d04`→2026-10-18,
  `t_941802f0`→2026-10-18, `t_ca53a2ba`→2026-10-18, `t_eea535ff`→2026-10-19,
  `t_d2bd0b46`→2026-10-20. Every date in the index matches the board and the source file mtime.
- The artifacts' own `v1` version marker is present in all 7 (title line `— v1`).

No row overstates its artifact. The index introduces no approval language; its header
explicitly says landing "does not by itself resolve the W0-2 gate, does not authorize
W0-2/W0-3 implementation, and does not authorize Poort B/C or production", and that
"Where an artifact says `NOT DECIDED`, that status stands as written".

### F-01 (non-blocking) — landed corpus is not self-consistent on three dispositions

`README.md` (at `70778e9`) `## Supersession` states that `t_d2bd0b46` "answers the one point
that `w0-2-sell-direction-field-clarification.md` recorded as NOT DECIDED", and lists
"D-OVERDRAFT-01, and the D-ROUNDING-01 / D-COST-BASIS-01 / D-TRANSFER-01 residuals" as the
remaining open items.

That is accurate **about the determination artifact itself**. But the determination's §5
table states a **newer** disposition than the six records landed alongside it:

| Landed record | D-SHORT-01 | D-COST-BASIS-01 | D-ROUNDING-01 |
|---|---|---|---|
| `w0-2-ledger-policy.md:12` | `NOT DECIDED` | — | — |
| `w0-2-calculation-policy.md:11` | — | `NOT DECIDED` | `NOT DECIDED` |
| `w0-2-policy-reconciliation.md:34` | `NOT DECIDED` | `NOT DECIDED` | `NOT DECIDED` |
| `w0-2-ledger-policy-closeout.md:25-26` | `NOT DECIDED` | `NOT DECIDED` | `NOT DECIDED` |
| `w0-2-sell-cash-leg-determination-v1.md:91-93` | `DECIDED, bounded` | `DECIDED, bounded` | `PARTIALLY DECIDED` |

The determination is transparent about this: its §5 preamble (line 86) says the table
"reflects the **newest** versioned owner records (19 October 2026), not the earlier
18 October handoffs", and its §8 table (lines 125-136) names every source record with its
SHA-256. I verified each of those cited digests against the actual source bytes — all 12
match, so the determination's evidence table is accurate.

**Why this is not a CHANGES REQUIRED on the landing:** the finding is inherited from the
owner records themselves, not introduced by the landing. The landing copied all 7 artifacts
byte-for-byte (criterion 1), and criterion 3 explicitly forbids rewriting, summarizing or
"improving" them — so a landing-side fix would be out of scope and would violate the
byte-identity requirement. The index did not introduce the inconsistency; it inherits it.

**Consequence for a reader of `main` alone:** the four records that carry the newer
dispositions are **not on `main`** and are still untracked files inside their task
worktrees (verified, all present with the exact digests the determination cites):

- `t_5befc971/docs/decisions/w0-2-ledger-overdraft-short-policy.md` → `ed71d3ce…a9d44` (the record that decides D-SHORT-01)
- `t_64ce59b3/docs/decisions/w0-2-calculation-rounding-cost-basis-v2.md` → `d69f403f…066b6`
- `t_f3b817b0/docs/decisions/w0-2-b-case-fee-tax-calculation-v1.md` → `afd31bd5…b088`
- `t_cd28cac1/docs/decisions/w0-2-ledger-overdraft-short-policy.md` → `19a21629…3fc`
- `t_61151bb9/docs/decisions/w0-2-calculation-rounding-cost-basis-v1.md` → `4e977538…4e43`

A reader on `main` sees D-SHORT-01 as `DECIDED` in one record and `NOT DECIDED` in three
others, with no on-`main` record that resolves it. These five files carry the same
worktree-cleanup durability risk this landing exists to eliminate.

**Recommended follow-up (not a gate on this landing):** a durability card to land the four
records the determination cites but which are absent from `main`, and to reconcile the
`D-SHORT-01` / `D-COST-BASIS-01` / `D-ROUNDING-01` status upgrade in the index. The
determination's §5 wording must not be edited to match the older records — the older
records are the stale ones, and the determination is the newer owner record.

## Criterion 3 — no artifact rewritten, summarized, merged or improved: PASS

Byte-identity (criterion 1) is the proof. Additionally verified present in every artifact:

- Its own `Status:` line (line 3 in all 7).
- Its `NOT DECIDED` markers: counts 10 / 8 / 2 / 6 / 8 / 2 / 6 respectively.
- Its own traceability section (ledger-policy `:73`, calculation-policy `:74`,
  clarification `:21`, reconciliation `:45`, closeout `:5`, concurrence `:4`,
  determination `:117`).
- Its own "no implementation authorization" language, e.g. `not an implementation
  authorization` (ledger-policy `:3`), `No financial implementation … is authorized by this
  document` (calculation-policy `:3`), `No implementation authorization.` (determination
  `:114`).

The two called-out artifacts are unchanged in the required way:

- `w0-2-sell-direction-field-clarification.md:3` still reads
  `Status: NOT DECIDED; owner clarification required.`
- `w0-2-sell-cash-leg-determination-v1.md:3` still reads
  `**the SELL-leg meaning is DECIDED by the Ledger owner** … The *value* the fixture currently
  asserts is **NOT DECIDED as a contract change** and requires explicit reciprocal
  Calculations concurrence before QA may amend the fixture.`

## Criterion 4 — supersession statement accurate: PASS

Commit `70778e9` body and `README.md` `## Supersession` both state that `t_d2bd0b46`
supersedes exactly one open point — the question `t_49297bc1` recorded as NOT DECIDED, namely
which ledger entry/leg `A-BUY-SELL-QUANTITY-001.then.cash_entry_direction_sell` describes —
that it overwrites none of the six, and that D-OVERDRAFT-01 and the D-ROUNDING-01 /
D-COST-BASIS-01 / D-TRANSFER-01 residuals stay open.

Verified:

- The determination's §1 (lines 11-15) decides exactly that one point and nothing else; §3
  (line 71) records that the prior clarification "asked for exactly this leg identification
  and left the disposition NOT DECIDED pending it".
- No overwrite: all 6 prior records exist unchanged on `main` with their original digests,
  and `git show --name-status` for both commits shows only `A` (add) — no `M`, no `D`.
- The three residual sets the determination leaves open are restated in its own §5
  (lines 90-95) and §7 (lines 111-115).
- The determination's own §6 (lines 101-105) explicitly records, without fixing, five
  cross-document inconsistencies in ADR-0002 and `roadmap.md`.

## Criterion 5 — traceability citations resolve at the landed commit: PASS

Verified by **line content** at `70778e9`, not by number alone:

- `roadmap.md:764` → `| US-0002 | Als architect wil ik financiële invariants definiëren …` ✓
- `roadmap.md:1001-1003` → `US-0002-A`, `US-0002-B`, `US-0002-C` rows ✓
- `test-cases.md:61-64` → `TC-US-0002`, `TC-US-0002-A`, `TC-US-0002-B`, `TC-US-0002-C` ✓
- `docs/backlog/b-004-refinement.md:23-25` → `US-0002-A`, `US-0002-B`, `US-0002-C` ✓

`roadmap.md`, `test-cases.md` and `docs/backlog/b-004-refinement.md` are byte-identical at
`70778e9` and at current `main`, so the citations still resolve after the later landing.

Independently spot-checked the determination's own substantive citations, all of which resolve
at `main`: `database/schema.sql:538` (`entry_kind … IN ('CASH','POSITION','FEE','TAX','MEMO')`),
`:539` (`direction … IN ('DEBIT','CREDIT')`),
`docs/adr/0002-canonical-ledger.md:15` (the ADR-0002 cash sign),
`apps/api/src/index.ts:8001-8004` (the `isPosition`/`isDebit`/`entryKind`/`direction` block),
`apps/api/src/option-lifecycle.ts:203` (`direction: "CREDIT"`).

### F-02 (informational, non-blocking) — two stale internal roadmap line citations

Two artifacts cite `roadmap.md` line numbers that were correct in their source worktree
(base `cf5e8c4`) but drifted on `main` after `roadmap.md` was rewritten (+343/-171 lines
between `cf5e8c4` and `4fb71c6`):

- `w0-2-ledger-policy.md:79` cites "`roadmap.md` US-0002 at lines 674" — at `main` line 674 is a
  `US-0606` evidence note; US-0002 is at `:764`.
- `w0-2-ledger-policy-closeout.md:7` cites "`roadmap.md:911-913`" for the US-0002-A/B/C scope —
  at `main` lines 911-913 are `US-1202`/`US-1203`/`US-1204`; the A/B/C rows are at `:1001-1003`.

This is an inherited artifact-of-record defect, not a landing defect: correcting it would
require editing the owner artifacts, which criterion 3 forbids and which would break
criterion 1. The determination already documents the same drift class at its own line 105
("the primary tree carries uncommitted `roadmap.md` and `backlog.md` edits, so the US-0002 row
sits at a different line there (`:796`); the citation above is the tracked worktree line") —
I confirmed the US-0002 row is indeed at `:796` in the dirty primary working tree and at
`:764` in the tracked tree. Recommended for the same follow-up card as F-01.

## Criterion 6 — scope containment: PASS

`git diff --name-only 4fb71c6 70778e9` → exactly 8 paths, all `docs/decisions/**`:

```
docs/decisions/README.md
docs/decisions/w0-2-calculation-policy.md
docs/decisions/w0-2-ledger-concurrence-rounding-cost-basis-v1.md
docs/decisions/w0-2-ledger-policy-closeout.md
docs/decisions/w0-2-ledger-policy.md
docs/decisions/w0-2-policy-reconciliation.md
docs/decisions/w0-2-sell-cash-leg-determination-v1.md
docs/decisions/w0-2-sell-direction-field-clarification.md
```

Per-path check across the landing — 0 changed files for each of: `apps/`, `packages/`,
`database/`, `migrations/`, `fixtures/`, `tests/`, `roadmap.md`, `test-cases.md`,
`backlog.md`, `docs/adr/`, `docs/backlog/`, `.github/` (2 CI workflow files exist in the repo
and are untouched).

`git diff --check 4fb71c6 70778e9` → exit 0, clean (also clean per-commit for `a094fb3` and
`70778e9`).

History: `git merge-base --is-ancestor 4fb71c6 main` → true. `git rev-list --count
4fb71c6..70778e9` = 2. No history was amended or rewritten; fast-forward only.

No credentials, secrets, tokens, PII or ledger data in any landed file (scan for
password/secret/api_key/bearer/authorization/private-key/postgres-URI patterns → 0 hits).

## Criterion 7 — gate integrity: PASS

The landed tree does not present itself as owner policy approval or as a W0-2 green gate.

- `README.md:11-14`: "Landing an artifact here preserves it durably. It does not by itself
  resolve the W0-2 gate, does not authorize W0-2/W0-3 implementation, and does not authorize
  Poort B/C or production. Where an artifact says `NOT DECIDED`, that status stands as
  written; read the artifact itself for the authoritative wording."
- `README.md:36-37`: the remaining open items are named as open.
- `70778e9` commit body: "Gate: documentation only. Landing preserves the record of a still-open
  gate; it does not resolve the W0-2 RED gate, does not authorize W0-2/W0-3 implementation,
  Poort B/C or production, and is not owner policy approval where an artifact says NOT DECIDED."
- `a094fb3` commit body: same disclaimer, and "Items marked NOT DECIDED in these artifacts
  remain NOT DECIDED; landing them is not owner policy approval."
- Determination `:109`: "**W0-2 / US-0002-A/B/C / TC-US-0002-A/B/C: RED / BLOCKED.**"
- Determination `:114`: "**No implementation authorization.** No W0-3, Wave 2+, Poort A/B/C or
  release clearance follows from this determination."
- Overstatement scan of all 8 landed files for W0-2-green / gate-passed / release-approved /
  sign-off / policy-approved language → 0 hits.

Gate state verified independently, not inherited: in the QA-owned worktree
`t_0a835fa0`, `fixtures/W0-2-financial-contract-v1.json:17` still reads
`"owner_decisions_approved": false` and the smoke test `:80` still asserts it must become
`true`. The fixture digest is `096a29f8…c50` and the smoke-test digest `d1dc2a84…b71` — both
unchanged from the values recorded in the owner artifacts, so the fixture was not amended by
this landing.

## Independent regression run at the landed tree

Run in this review's own worktree at `70778e9` (clean checkout of the landed commit):

```
node --experimental-strip-types --test tests/unit/*.test.mjs
  → tests 208 | pass 208 | fail 0 | skipped 0 | cancelled 0 | todo 0

node --experimental-strip-types --test tests/smoke/*.test.mjs
  → tests 334 | pass 201 | fail 0 | skipped 133 | cancelled 0 | todo 0
```

Both are green with 0 failures. The 133 skips are the pre-existing runtime-gated tests
(require a live stack) and are unrelated to this docs-only landing.

## What remains RED

This landing changed no gate. Explicitly still open:

1. **W0-2 gate: RED / BLOCKED.** `owner_decisions_approved` remains `false`; the A-case
   assertion stays NOT DECIDED as a contract change.
2. **D-OVERDRAFT-01: open.** Not decided in any landed record; it continues to block a
   release-green A-case.
3. **Reciprocal Calculations concurrence.** The commit body of `70778e9` records it as
   outstanding on `t_ff54ddc9`. *Live status at the end of this review: `t_ff54ddc9` completed
   at 2026-10-20 09:00:32 and its artifact was landed on `main` by a later, separate commit
   `59fd473` ("docs(US-0002): land W0-2 Calculations SELL cash-leg concurrence record"). That
   later landing is out of this card's scope and is independently QA'd on card `t_c6e5e882`.
   The QA fixture card `t_0a835fa0` is still `todo` and the fixture is still unamended.*
4. **Runtime, migration, replay and restore evidence: still NOT VERIFIED.** No migration dry-run,
   no reapply/idempotence check, no restore drill, no replay-hash recomputation and no
   runtime ledger behaviour was exercised by this docs-only landing, and none is claimed by any
   landed artifact.
5. **W0-3 / Wave 2+ / Poort B/C / production:** not authorized by this landing.

## Method notes

- All checks were run read-only against `main` and the source worktrees. The source worktrees
  were not modified, committed or cleaned; all 7 still show `?? docs/decisions/`.
- The primary working tree carries pre-existing uncommitted changes (`backlog.md`,
  `roadmap.md`, `tests/smoke/community-feed-contract.test.mjs`) that are **not** part of this
  landing and were not touched. All citations were therefore verified against the **committed**
  tree via `git show <commit>:<path>`, not against the dirty working tree.
- The landing was re-verified anchored on `70778e9` after further commits landed on `main`
  mid-review. All 7 owner artifacts are unchanged at current `main` (re-hashed after every
  move: 7/7 `UNCHANGED`), and both reviewed commits remain ancestors of `main`
  (`git merge-base --is-ancestor` → true for `a094fb3` and `70778e9`).
- `main` advanced twice during this review: `59fd473` (the W0-2 concurrence landing, card
  `t_c5f78fc3`, independently QA'd on `t_c6e5e882`) and `8db9457` (`fix(US-0103)` — an
  unrelated task touching `.github/workflows/ci.yml` and `tests/smoke/ci-workflow.test.mjs`).
  Those two protected-path changes belong to `8db9457`, **not** to the W0-2 landing under
  review: all three W0-2 commits combined (`4fb71c6..59fd473`) change 9 paths, all
  `docs/decisions/**`, and **0** protected paths.
- Synthetic data only. No credentials, no production data, no ledger operations, no
  push/PR/deploy.
