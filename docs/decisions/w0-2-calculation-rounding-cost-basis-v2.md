# W0-2 Calculations decisions: rounding and cost basis — v2

Status: Calculations-owner decision proposal for D-ROUNDING-01 and D-COST-BASIS-01, with bounded Ledger concurrence as stated below. This note supersedes `w0-2-calculation-rounding-cost-basis-v1.md` because v1 overstated the jointly approved D-FEE-TAX-01 scope. Documentation only: it does not authorize financial implementation, fixture/test changes, schema/migration work, ledger mutation, or release.

Scope and traceability: `US-0002-B` / `TC-US-0002-B` only. D-FEE-TAX-01 treatment in this note applies solely to the exact named synthetic cases and versions expressly recorded in both the Calculations and Ledger owner artifacts: `B-PARTIAL-SELL-FIFO-WAC-001` and `B-PRICE-FX-DECOMPOSITION-001`, under `cost-basis-v1` / `pnl-v1`. No fee/tax rule is inferred for an unlisted activity, lot, method, case, version, or calculation. Generalized acquisition or disposal fee/tax allocation outside those exact named cases is NOT DECIDED pending explicit reciprocal Calculations and Ledger approval.

## Decision summary

| ID | Calculations disposition | Scope / gate |
|---|---|---|
| D-ROUNDING-01 | Calculations proposes the deterministic decimal arithmetic, output rounding, and serialization treatment below. | Ledger concurs only with the bounded decimal-string scales/interfaces and calculation-local residual handling stated below. Canonical residual persistence and canonical replay/restore serialization remain NOT DECIDED. |
| D-COST-BASIS-01 | A method is required for each calculation; omission is a validation error. FIFO and WAC are supported named methods for this scope; no implicit default is approved. | Ledger concurs with the scoped effective-date/UTC occurrence-time/stable-ID ordering and POSTED-only eligibility described below. This does not decide a default or fee/tax policy beyond the two named D-FEE-TAX-01 cases. |
| D-FEE-TAX-01 | Jointly approved only for the exact two named B cases, their listed synthetic inputs/outputs, and `cost-basis-v1` / `pnl-v1`. | All generalization outside those cases is NOT DECIDED pending explicit reciprocal owner approval. |

## D-ROUNDING-01 — calculation-side precision and rounding proposal

Parse decimal input strings as base-10 decimal values; do not use binary floating-point. Use 34 significant decimal digits of working precision and ROUND_HALF_EVEN when a working operation exceeds that precision. Do not quantize intermediate lot allocation, FX multiplication, addition/subtraction, or ratio calculations to currency minor units. Quantize at the typed calculation-output boundary only:

- Quantity and unit price: 12 fractional decimal places.
- Native-currency and reporting-currency monetary outputs: 12 fractional decimal places.
- FX rate outputs: 16 fractional decimal places.
- Output quantization: ROUND_HALF_EVEN.

Currency `minor_units` is presentation-only; it does not round or feed back into cost basis, P&L, FX, or replay inputs. Canonical decimal outputs are fixed-scale strings with an ASCII decimal point, no grouping separators, and no locale-dependent formatting. Calculation metadata must carry an explicit as-of date and timezone; canonical timestamps use ISO-8601 UTC (`Z`). Display localization is presentation-only.

For partial-lot allocation, retain calculation precision through lot and P&L arithmetic and round typed outputs at the boundary. If rounded displayed lot allocations differ from the rounded aggregate by a sub-unit residual, assign the displayed residual to the last consumed lot in deterministic lot order; unrounded values and aggregate remain authoritative. For splits, retain exact fractional entitlement in calculation-local state, preserve total lot basis, and serialize quantity to 12 places using ROUND_HALF_EVEN. Ledger concurrence is calculation-local only: it does not approve persistence of residual state in canonical ledger tables, snapshots, or replay data. Canonical residual persistence remains NOT DECIDED pending a separate Ledger-owned decision.

Synthetic rounding vectors (arithmetic examples, not fixture edits or general fee/tax policy):

| Vector | Input / boundary | Expected output |
|---|---|---|
| ROUND-HALF-EVEN-ODD-001 | `1.2345678901235`, quantize to 12 places | `1.234567890124` |
| ROUND-HALF-EVEN-EVEN-001 | `1.2345678901225`, quantize to 12 places | `1.234567890122` |
| ROUND-FX-HALF-EVEN-001 | `0.12345678901234575`, quantize to 16 places | `0.1234567890123458` |
| ROUND-SPLIT-RESIDUAL-001 | Quantity `1`, split ratio `1:3`, total basis EUR `10` | Calculation-local exact quantity `1/3`; output quantity `0.333333333333`; total basis `10.000000000000`; fractional entitlement not discarded from calculation-local state. Canonical persistence is NOT DECIDED. |

Ledger concurrence for D-ROUNDING-01 is bounded to decimal-string interfaces/scales compatible with the observed canonical numeric precision, the proposed calculation-side working precision/output rounding, and calculation-local fractional residual handling without hidden ledger mutation or balancing entry. Canonical byte serialization, included fields, normalization, digest inputs, and replay/restore equality are NOT DECIDED. A separate versioned Ledger-owned replay/restore serialization contract is required; no replay/hash determinism or restore equality is claimed.

## D-COST-BASIS-01 — explicit method required

Every result requires an explicit method. FIFO and WAC are supported named methods in this scope; an omitted method is a validation error, not an implicit FIFO choice. Each result identifies its method and calculation version (`cost-basis-v1`; derived P&L uses `pnl-v1`). A method/version change creates a separately identified calculation result and does not rewrite prior ledger activities or silently replace a historical result. An as-of result uses an explicitly supplied inclusive effective date and is read-only.

For a requested method, eligible acquisition lots are ordered by effective date, then `occurred_at` normalized to a UTC instant, then stable canonical transaction ID. Only POSTED activities are eligible; DRAFT, PENDING, and VOID are excluded. Ledger concurrence records this ordering and eligibility for this scoped calculation input only; it does not change ledger lifecycle, posting, or general replay semantics.

FIFO consumes the earliest eligible acquisition lot first. WAC pools eligible remaining basis over eligible remaining quantity and allocates basis proportionally to disposed quantity. Partial-sale basis is allocated proportionally using the D-ROUNDING-01 calculation precision; unrounded remaining basis is conserved. These are cost-basis mechanics, not fee/tax allocation rules. Split handling follows the calculation-local residual rules under D-ROUNDING-01; canonical persistence remains undecided.

### D-FEE-TAX-01 — exact jointly approved B cases only

Both reciprocal owner artifacts record the following fee/tax semantics and outputs only for the named cases/versions listed in this section. For these cases only, `amount` is gross; attached fee/tax components are counted once in the same-entry cash effect (not as an additional standalone posting); the listed BUY basis is gross plus attached fee/tax; and the listed SELL net proceeds are gross less attached fee/tax, with realized gain equal to those net proceeds less the allocated basis. The figures below are case-bound synthetic values, not a generalized policy. In particular, the case-specific fee/tax inputs and arithmetic must not be extrapolated to other acquisitions, disposals, activities, lots, or methods.

#### `B-PARTIAL-SELL-FIFO-WAC-001` — `cost-basis-v1` / `pnl-v1`

Synthetic EUR inputs: BUY 10 × EUR 10 (gross 100, fee 2, tax 1); BUY 5 × EUR 14 (gross 70, fee 1, tax 0); SELL 12 × EUR 20 (gross 240, fee 3, tax 4). For this exact named case only, the jointly approved values are: acquisition bases EUR 103 and EUR 71; pre-sale basis EUR 174; SELL net proceeds EUR 233; separately reported fee total EUR 6 and tax total EUR 5.

| Explicit method | Disposed basis | Remaining quantity | Remaining basis | Realized gain |
|---|---:|---:|---:|---:|
| FIFO | `131.400000000000` (= 103 + 2/5 × 71) | `3.000000000000` | `42.600000000000` EUR | `101.600000000000` EUR (= 233 − 131.4) |
| WAC | `139.200000000000` (= 174 × 12/15) | `3.000000000000` | `34.800000000000` EUR | `93.800000000000` EUR (= 233 − 139.2) |

The formulas and fee/tax inclusion above describe these exact named inputs and outputs only. They do not approve generalized acquisition-fee/tax capitalization or disposal-fee/tax proceeds allocation outside this case/version.

#### `B-PRICE-FX-DECOMPOSITION-001` — `cost-basis-v1` / `pnl-v1`

Synthetic USD instrument / EUR reporting inputs: BUY 10 × 10 (gross 100, fee 2, tax 1); SELL 4 × 15 (gross 60, fee 1, tax 1); valuation price 20; basis FX 0.8 and valuation FX 0.9. For this exact named case only, the reciprocal approved outputs are:

- BUY basis `103.000000000000` USD; disposed basis `41.200000000000` USD; remaining quantity `6.000000000000`; remaining native basis `61.800000000000` USD.
- SELL net proceeds `58.000000000000` USD; realized transaction-currency P&L `16.800000000000` USD; reporting realized P&L `15.120000000000` EUR.
- Remaining market value `120.000000000000` USD; price P&L `46.560000000000` EUR; FX P&L `12.000000000000` EUR; unrealized P&L `58.560000000000` EUR; total P&L `73.680000000000` EUR.
- Separately reported fee total `3.000000000000` USD; tax total `2.000000000000` USD.

These values are scoped to this case's stated inputs, explicit FIFO method, and versions only. Missing FX is an explicit calculation error; no implicit inverse rate is assumed. The case does not establish a general fee/tax rule for other multi-currency calculations.

#### Boundary of joint approval

The reciprocal owner artifacts are `t_71035d04/docs/decisions/w0-2-calculation-policy.md` and `t_941802f0/docs/decisions/w0-2-ledger-policy.md`. Their D-FEE-TAX-01 concurrence is limited to the exact named B cases and values above, including the stated gross amount / one-time same-entry cash effect and calculation outputs for those cases under `cost-basis-v1` / `pnl-v1`. This v2 note carries no generalized acquisition or disposal fee/tax allocation rule. Any such rule outside these named case/version boundaries is explicitly NOT DECIDED until Calculations and Ledger record reciprocal, explicit approval of the proposed scope and affected values.

## Traceability, evidence, compatibility, and gate

- Exact traceability: `US-0002-B` → `TC-US-0002-B` (`test-cases.md`); the roadmap describes the story as partial sell, fee, tax, FX, and realized/unrealized cases being explicit.
- Related contract: `docs/adr/0002-canonical-ledger.md`; the ledger remains the canonical source and calculations remain derived/read-only.
- Reciprocal D-FEE-TAX-01 scope: the Calculations and Ledger artifacts cited above. Ledger's separate concurrence for D-ROUNDING-01/D-COST-BASIS-01 is `t_eea535ff/docs/decisions/w0-2-ledger-concurrence-rounding-cost-basis-v1.md`; it leaves canonical residual persistence and replay/restore serialization NOT DECIDED.
- Synthetic-only examples. No broker, bank, production, or live market data is used. No fixture, test, source, schema, migration, canonical ledger data, roadmap, backlog, or ADR is changed by this note.
- Verification trace/correlation IDs: `TRACE_ID=calc-w02-fee-tax-scope-v2-20261019` and `CORRELATION_ID=calc-w02-fee-tax-scope-v2-20261019`. Focused contract and whitespace-check commands/results are recorded on the task handoff; contract results do not constitute runtime financial behavior.
- No migration dry-run, database operation, runtime financial calculation, replay/hash verification, or restore equality test is claimed unless separately recorded as executed evidence.

Gate: W0-2 remains RED/BLOCKED. Preserve the QA-owned `owner_decisions_approved=false` guard. No implementation, W0-3, Wave 2+, Poort A/B/C, or release clearance is authorized. This note does not resolve the A-case SELL-leg discrepancy, overdraft, transfer, or any separate decision. Migration, runtime financial, replay, and restore evidence remain NOT VERIFIED unless actually executed.
