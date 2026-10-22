# W0-2 owner decision records — index

Documentation-only index of the W0-2 owner decision artifacts landed by task `t_b1ce7c43` and by task `t_c5f78fc3`.

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
| `w0-2-ledger-concurrence-rounding-cost-basis-v1.md` | `t_eea535ff` | 2026-10-19 | v1 | Bounded Ledger concurrence on the Calculations D-ROUNDING-01 and D-COST-BASIS-01 proposals only. |
| `w0-2-sell-cash-leg-determination-v1.md` | `t_d2bd0b46` | 2026-10-20 | v1 | Ledger determination that the SELL-direction field denotes the SELL cash leg; the contract-value change is NOT DECIDED pending reciprocal Calculations concurrence. |
| `w0-2-sell-cash-leg-concurrence-v1.md` | `t_ff54ddc9` | 2026-10-20 | v1 | Calculations reciprocal concurrence on the SELL cash leg and its CREDIT value; records that no approved B-case output or version changes and that D-OVERDRAFT-01 and D-SHORT-01 are not approved by it. |
| `w0-2-replay-restore-canonical-serialization-v1.md` | `t_5ae31bf2` | 2026-10-20 | v1 | Calculations owner decision for the calculation-record half of D-ROUNDING-01 item 3: the `calc-record-v1` calculation-record serialization and the `ledger-replay-hash-v1` hash-version compatibility rule. The canonical ledger-row byte representation and the restore-equality contract remain NOT DECIDED and are handed to the Ledger owner. |
| `w0-2-consolidated-closeout.md` | `t_00847306` | 2026-10-22 | v1 | All six W0-2 decisions JOINTLY APPROVED by Ledger and Calculations owners. D-OVERDRAFT-01, D-SHORT-01, D-ROUNDING-01, D-FEE-TAX-01, D-COST-BASIS-01, D-TRANSFER-01. |

## Supersession

The consolidated closeout `w0-2-consolidated-closeout.md` (`t_00847306`) is the canonical record for W0-2 decisions. All six decisions (D-OVERDRAFT-01, D-SHORT-01, D-ROUNDING-01, D-FEE-TAX-01, D-COST-BASIS-01, D-TRANSFER-01) now show JOINTLY APPROVED disposition, superseding the individual artifacts above. The individual artifacts remain for audit trail but the consolidated record is authoritative for the fixture gate.