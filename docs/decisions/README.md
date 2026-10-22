# W0-2 owner decision records — index

Documentation-only index of the W0-2 owner decision artifacts landed by task `t_b1ce7c43`, by task `t_c5f78fc3` and by task `t_7312b8b2`.

These artifacts are owner-signed records of W0-2 (Wave 0) financial-policy decisions for
`US-0002` (`US-0002-A`, `US-0002-B`, `US-0002-C`) and their tests
`TC-US-0002`, `TC-US-0002-A`, `TC-US-0002-B`, `TC-US-0002-C`
(`roadmap.md:764`, `roadmap.md:1001-1003`, `test-cases.md:61-64`,
`docs/backlog/b-004-refinement.md:23-25`).

Landing an artifact here preserves it durably. It does not by itself resolve the W0-2 gate,
does not authorize W0-2/W0-3 implementation, and does not authorize Poort B/C or production.
Where an artifact says `NOT DECIDED`, that status stands as written; read the artifact itself
for the authoritative wording.

## Records

| Artifact | Owning task | Date | Version | Decision scope (as stated in the artifact) |
|---|---|---|---|---|
| `w0-2-ledger-policy.md` | `t_941802f0` | 2026-10-18 | v1 | Ledger-owned D-OVERDRAFT-01, D-SHORT-01, D-TRANSFER-01, plus Ledger's side of joint D-FEE-TAX-01. |
| `w0-2-calculation-policy.md` | `t_71035d04` | 2026-10-18 | v1 | Calculation-owned D-ROUNDING-01 and D-COST-BASIS-01, plus Calculations' proposal for joint D-FEE-TAX-01. |
| `w0-2-sell-direction-field-clarification.md` | `t_49297bc1` | 2026-10-18 | v1 | Meaning of the `A-BUY-SELL-QUANTITY-001.then.cash_entry_direction_sell` field; recorded as NOT DECIDED pending owner clarification. |
| `w0-2-policy-reconciliation.md` | `t_ca53a2ba` | 2026-10-18 | v1 | Architecture reconciliation of the Ledger and Calculations owner handoffs against the QA-owned synthetic contract. |
| `w0-2-ledger-policy-closeout.md` | `t_49141da4` | 2026-10-18 | v1 | Owner-decision reconciliation and precise escalation of the remaining unanswered policies. |
| `w0-2-ledger-overdraft-short-policy-v1.md` | `t_cd28cac1` | 2026-10-18 | v1 | Ledger-owner decision record in which D-OVERDRAFT-01 and D-SHORT-01 are both recorded as NOT DECIDED. |
| `w0-2-b-case-fee-tax-calculation-v1.md` | `t_f3b817b0` | 2026-10-18 | v1 | Calculations-owner decision artifact for the bounded US-0002-B / TC-US-0002-B fee/tax cases; it records the reciprocal Ledger + Calculations approval already present in their owner artifacts. |
| `w0-2-ledger-concurrence-rounding-cost-basis-v1.md` | `t_eea535ff` | 2026-10-19 | v1 | Bounded Ledger concurrence on the Calculations D-ROUNDING-01 and D-COST-BASIS-01 proposals only. |
| `w0-2-ledger-overdraft-short-policy-v2.md` | `t_5befc971` | 2026-10-19 | v2 | Ledger-owner decision record in which D-SHORT-01 is DECIDED for the bounded scope (reject any SELL that would make the position negative) and D-OVERDRAFT-01 remains NOT DECIDED. |
| `w0-2-calculation-rounding-cost-basis-v1.md` | `t_61151bb9` | 2026-10-19 | v1 | Calculations-owner decision proposal for D-ROUNDING-01 and D-COST-BASIS-01, requiring Ledger concurrence and independent QA review before the dispositions are treated as an accepted cross-context contract. |
| `w0-2-calculation-rounding-cost-basis-v2.md` | `t_64ce59b3` | 2026-10-19 | v2 | Calculations-owner decision proposal for D-ROUNDING-01 and D-COST-BASIS-01 with bounded Ledger concurrence; supersedes the v1 rounding/cost-basis record because v1 overstated the jointly approved D-FEE-TAX-01 scope. |
| `w0-2-sell-cash-leg-determination-v1.md` | `t_d2bd0b46` | 2026-10-20 | v1 | Ledger determination that the SELL-direction field denotes the SELL cash leg; the contract-value change is NOT DECIDED pending reciprocal Calculations concurrence. |
| `w0-2-sell-cash-leg-concurrence-v1.md` | `t_ff54ddc9` | 2026-10-20 | v1 | Calculations reciprocal concurrence on the SELL cash leg and its CREDIT value; records that no approved B-case output or version changes and that D-OVERDRAFT-01 and D-SHORT-01 are not approved by it. |
| `w0-2-replay-restore-canonical-serialization-v1.md` | `t_5ae31bf2` | 2026-10-20 | v1 | Calculations owner decision for the calculation-record half of D-ROUNDING-01 item 3: the `calc-record-v1` calculation-record serialization and the `ledger-replay-hash-v1` hash-version compatibility rule. The canonical ledger-row byte representation and the restore-equality contract remain NOT DECIDED and are handed to the Ledger owner. |
| `w0-2-sell-leg-owner-input-verification.md` | `t_c28b860a` | 2026-10-20 | v1 | Architecture verification of the SELL cash-leg owner input against the landed record set; records the answer with citations and reports contract-coverage, gate-guard, base-drift and landing-consistency findings. It does not decide policy. |

## Supersession

`w0-2-sell-cash-leg-determination-v1.md` (`t_d2bd0b46`) answers the one point that
`w0-2-sell-direction-field-clarification.md` (`t_49297bc1`) recorded as NOT DECIDED — which
ledger entry/leg `cash_entry_direction_sell` describes. It does not overwrite that artifact or
any of the others; it cites `w0-2-ledger-policy.md` (`t_941802f0`) and
`w0-2-calculation-policy.md` (`t_71035d04`) as the reciprocal D-FEE-TAX-01 sources and
`w0-2-ledger-concurrence-rounding-cost-basis-v1.md` (`t_eea535ff`) as the rounding/cost-basis
concurrence. The remaining NOT DECIDED items (D-OVERDRAFT-01, and the D-ROUNDING-01 /
D-COST-BASIS-01 / D-TRANSFER-01 residuals) stay open and are restated in that artifact.

A second-order status upgrade follows from the 19 October 2026 versioned owner records, which
the determination's section 5 table reflects and which are on `main` as well:
`w0-2-ledger-overdraft-short-policy-v2.md` (`t_5befc971`) records D-SHORT-01 as DECIDED for its
bounded scope — reject all SELL commands that would create a negative position; short opening is
not permitted — while D-OVERDRAFT-01 remains NOT DECIDED, and
`w0-2-calculation-rounding-cost-basis-v2.md` (`t_64ce59b3`), with the bounded Ledger concurrence
in `w0-2-ledger-concurrence-rounding-cost-basis-v1.md` (`t_eea535ff`), records the D-ROUNDING-01
and D-COST-BASIS-01 dispositions the determination reports as PARTIALLY DECIDED and DECIDED,
bounded; canonical residual persistence and canonical replay/restore serialization remain NOT
DECIDED there. The 18 October records keep their own wording and are not rewritten:
`w0-2-ledger-overdraft-short-policy-v1.md` (`t_cd28cac1`) still records D-OVERDRAFT-01 and
D-SHORT-01 as NOT DECIDED, and `w0-2-calculation-rounding-cost-basis-v1.md` (`t_61151bb9`) is
the version that `w0-2-calculation-rounding-cost-basis-v2.md` supersedes because v1 overstated
the jointly approved D-FEE-TAX-01 scope. `w0-2-b-case-fee-tax-calculation-v1.md` (`t_f3b817b0`)
is the Calculations record for the bounded B-case fee/tax outputs. Finding D of
`w0-2-sell-leg-owner-input-verification.md` (`t_c28b860a`) recorded these five records as not
on `main` at the `70778e9` verification point; they are landed by `t_7312b8b2`. None of this
decides, reopens, extends or withdraws any policy, and D-OVERDRAFT-01 stays open.

One evidence-table correction, recorded here so the index is not read as a corrupt landing:
the determination's section 8 table quotes SHA-256
`19a21629778fc9f0c31f07e78418498b4635a8edfb9fba406d6755a4222ce3fc` for the v1
overdraft/short record, while the record's actual SHA-256 is
`19a21629778fc9f0c31f07a78418498b4635a8edfb9fba406d6755a4222ce3fc` — the two differ in the
23rd character only. The landed `w0-2-ledger-overdraft-short-policy-v1.md` is byte-identical to
the owner's source file, whose bytes have not changed since 2026-10-18 14:25, so the quoted
value is a transcription error in the determination's evidence table rather than a difference in
the record. The determination is an owner-signed record and is left unchanged here.
