# W0-2 Calculations owner decision: replay/restore canonical serialization (D-ROUNDING-01 item 3) — v1

Status: **Calculations-side owner decision** for the calculation-record half of D-ROUNDING-01 item 3. This artifact defines (a) the calculation-record serialization that may be asserted as a canonical hash input, and (b) the hash-version compatibility rule. It does **not** decide the canonical byte representation of the ledger rows themselves, nor the restore-equality contract — both are explicitly returned to the Ledger owner in §5.2.

This is a **documentation-only** decision. It changes **no product code, no schema, no migration, no fixture, no test, and no CI configuration**. It does not change the `replay_hash` implementation. It authorizes no implementation.

Traceability: `US-0002-B` / `TC-US-0002-B` (calculation-record side) and `US-0002-C` / `TC-US-0002-C` (replay/restore reproducibility side). Answers the open item in `docs/decisions/w0-2-ledger-concurrence-rounding-cost-basis-v1.md` §D-ROUNDING-01 item 3 (`:14`). Builds on the already-concurred items in the same artifact: `:10` (decimal-string boundary and scales), `:18` (activity ordering), `:20` (POSTED-only eligibility), and on the Calculations-side conventions recorded in `docs/decisions/w0-2-calculation-policy.md:20` (the minimal D-ROUNDING-01 decision that item (5) names "serialization/hash canonical form") and `:78` (replay-hash and restore equality remain NOT VERIFIED), and in the rounding/cost-basis v2 record at `t_64ce59b3/docs/decisions/w0-2-calculation-rounding-cost-basis-v2.md:17` (base-10, 34 significant digits, ROUND_HALF_EVEN) and `:24` (fixed-scale decimal strings; explicit as-of date and timezone; ISO-8601 UTC `Z` timestamps). ADR: `docs/adr/0002-canonical-ledger.md`.

Inspected at `main` HEAD **`366bd0f4685134f57e5ff5146614ca6ddb63904c`** (branch `spaartrack/t_5ae31bf2-w0-2-calculations-owner-decision-d-round`, worktree `/Users/ruben/spaartrack/.worktrees/t_5ae31bf2`). All line references in this artifact are resolved against that SHA. See §6 for the references that had to be re-pointed.

---

## 1. Scope of this decision

The Ledger concurrence left one open item and named its owner: *"A separate Ledger-owned, versioned replay/restore serialization contract must specify field coverage and ordering, decimal/timestamp normalization, and hash-version compatibility before calculation records can be asserted as canonical hash inputs."* (`w0-2-ledger-concurrence-rounding-cost-basis-v1.md:14`).

That contract has two halves, and this card decides only the half Calculations owns:

| Half | Owner | Status here |
|---|---|---|
| **Calculation-record** serialization: the field set, field order, and decimal/timestamp normalization of a *calculation output record*, and the hash-version compatibility rule that governs when two such hashes may be compared. | **Calculations** | **DECIDED** in §2 and §3. |
| **Ledger-row** serialization: the canonical byte representation of the canonical ledger rows themselves, and the restore-equality contract. | **Ledger** | **NOT DECIDED** — explicitly handed back in §5.2 (items L-1 … L-4). |

The distinction is load-bearing and is not a split of convenience. The current route hashes *ledger rows* together with *aggregates* in one `JSON.stringify({ rows, balances, totals })` payload (`apps/api/src/index.ts:7783`). Those two things have different owners and different change cadences, and lumping them into one opaque blob is precisely why the current digest has no stable form. This decision separates them: Calculations fixes the form of the *calculation record* and the *hash envelope*; Ledger fixes the form of the *ledger rows* that the calculation record consumes.

A calculation record may be asserted as a canonical hash input **only** when it conforms to §2 and is hashed under the envelope of §3. Until the Ledger-owned ledger-row form exists, no end-to-end replay hash may be claimed.

---

## 2. D-SER-01 — Calculation-record canonical serialization (`calc-record-v1`)

**Decision.** A calculation record is a JSON object with **exactly** the five top-level members below, in **exactly** this order, and no others. The order is normative: it is part of the form, not an implementation detail. Two records that differ only in member order are *not* the same record.

```
{"record_version":…,"calculation_version":…,"scope":{…},"inputs":{…},"outputs":[…]}
```

| Member | Type | Content |
|---|---|---|
| `record_version` | string | The record-form version. `"calc-record-v1"` for this form. |
| `calculation_version` | string | The calculation-semantics version, e.g. `"ledger-replay-v1"`, `"cost-basis-v1"`, `"pnl-v1"`. |
| `scope` | object | `portfolio_id` (uuid, lowercase), `as_of` (date `YYYY-MM-DD` or `null`), `as_of_timezone` (IANA zone name, e.g. `"UTC"`). All three are **mandatory members**; `null` is an explicit value, never an omitted key. |
| `inputs` | object | The calculation's bound inputs, each a normalized value or an explicit `null`. Members are named per `calculation_version`. |
| `outputs` | array | The calculation outputs, in the order defined by `calculation_version`. Each element is an object with a declared member order. |

**Member order is declared, not inherited.** The current route relies on `JSON.stringify` over `pg` row objects, whose key order is the result-column order of the `SELECT` list (`apps/api/src/index.ts:7778-7780`; verified: the first row's key order is exactly the projection order — probe P8). A re-ordering of the `SELECT` list would therefore change every hash without any semantic change, and nothing in the payload would record that the form had changed. §2 fixes the order in the form instead.

### 2.1 Decimal normalization

**Decision.** Every decimal value in a calculation record is a **JSON string**, never a JSON number, and is rendered at a **fixed scale**:

- ASCII `.` decimal separator; no grouping separators; no exponent form; no locale-dependent formatting.
- Exactly the declared number of fractional digits, always — trailing zeros are kept (`100.000000000000`, not `100`).
- No leading `+`; no `-0` (negative zero normalizes to `0.000000000000`).
- The value is quantized **once**, at the output boundary, using **ROUND_HALF_EVEN**.
- Quantity, unit price, native-currency amount, reporting-currency amount: **12** fractional places. FX rate: **16** fractional places. These are the scales already concurred (`w0-2-ledger-concurrence-rounding-cost-basis-v1.md:10`) and match the canonical storage scales `numeric(28,12)` / `numeric(28,16)` (`database/schema.sql:540-546`, `:471`).
- Internal working precision is base-10, 34 significant digits, no intermediate quantization to currency minor units — unchanged from the already-concurred convention.

**Why a string, and why fixed scale.** `pg` returns `numeric` as a JavaScript string by default and the route casts to `::text` (probe J1: `amount` arrives as `"100.000000000000"`). A JSON *number* would re-introduce binary floating point at the serialization boundary, and `JSON.stringify` renders numbers with the shortest round-tripping representation, so `100.5` and `100.500000000000` would serialize identically while differing in scale — a silent scale loss. The fixed-scale string removes both hazards and matches the `numeric(28,12)` storage scale exactly (probe H5: `(100.5)::numeric(28,12)::text` → `100.500000000000`, while `(100.5::numeric)::text` → `100.5`).

**Rounding-mode conformance.** The `ROUND_HALF_EVEN` requirement is a *calculation-side* rule and is not satisfied by a bare PostgreSQL `numeric` cast. PostgreSQL's `numeric` cast rounds **half away from zero**: `(0.0000000000005)::numeric(28,12)` → `0.000000000001`, whereas ROUND_HALF_EVEN gives `0.000000000000` (probe P4, F4). The same divergence holds for the aggregate cast `SUM(...)::numeric(28,12)` used by the route (`apps/api/src/index.ts:7757`, `:7768-7769`).

This divergence is **latent, not active, in the current route**: the aggregate's operands are all `numeric(28,12)`, so the sum already carries scale 12 and the cast is a no-op (probe F2: `SUM` of scale-12 operands → `100.500000000000`; probe H6: the tie is only reachable if an operand of scale > 12 is introduced). It becomes active the moment a wider-scale operand — e.g. an `fx_rate numeric(28,16)` term — enters the aggregate. The calculation record therefore must not be produced by relying on a PostgreSQL cast for its rounding; the calculation kernel must quantize with ROUND_HALF_EVEN and the record must state the scale.

### 2.2 Timestamp and date normalization

**Decision.**

- **Instants** (any `timestamptz`): ISO-8601 UTC, **exactly** `YYYY-MM-DDTHH:MM:SS.ffffffZ` — a `T` separator, **six** fractional digits, a literal `Z`. No space separator, no numeric offset, no local-time rendering.
- **Dates** (any `date`, incl. `effective_date`, `as_of`): ISO-8601 `YYYY-MM-DD`.

**The current route's rendering is session-dependent and therefore not canonical.** The route casts `lt.occurred_at::text` and `lt.effective_date::text` (`apps/api/src/index.ts:7743`). PostgreSQL renders `timestamptz::text` in the **session's `TimeZone`** and `date::text` in the **session's `DateStyle`**. The application pins neither: the pool is constructed with only a connection string (`apps/api/src/index.ts:59`) and no `SET TimeZone` / `SET DateStyle` / `options=` parameter exists anywhere in `apps/` or `database/` (verified by search). The consequences are measured, not theoretical:

- `SET TimeZone='UTC'` vs `'Europe/Amsterdam'` on identical ledger content produces **different** `replay_hash` values (probe P2: `683868680e34…` vs `69f9ee4dfcf0…`; the same probe over a wider row set gives five distinct digests for five session settings — probe K4). `occurred_at::text` changes from `2026-10-18 10:00:00+00` to `2026-10-18 12:00:00+02`.
- `SET DateStyle='Postgres, MDY'` vs `'ISO, MDY'` produces **different** `replay_hash` values (probe P3: `41105735afec…` vs `69f9ee4dfcf0…`), with `effective_date::text` changing from `2026-10-18` to `10-18-2026`.

A hash that changes when only the database session's locale settings change is not a hash of the ledger. The canonical instant form required by §2.2 is provably session-independent: `to_char(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')` yields the identical string under all four session timezones and under `DateStyle='Postgres, MDY'` (probe H2, X: 1 distinct result across `UTC`, `Europe/Amsterdam`, `America/New_York`, `Asia/Tokyo`, `Australia/Sydney`), and it agrees with the reference normalizer (probe X: `X_matches_python_reference true`).

### 2.3 Other normalized value types

| Type | Canonical form |
|---|---|
| `uuid` | Lowercase canonical hyphenated form (`2c785f2f-2f5f-4025-add6-6ab35d8b2d0e`). PostgreSQL's `uuid::text` already emits this (probe G10). |
| `char(3)` currency code | Exactly three characters, **trimmed of trailing blanks** and uppercased (`"EUR"`). `char(3)` comparison in PostgreSQL ignores trailing blanks (`'EUR'::char(3) = 'EUR '::char(3)` is true — probe G2), but `::text` of a `char(3)` **strips** them (`'EU '::char(3)::text` → `"EU"`, length 2 — probe I1). The canonical form must therefore be the trimmed value, not the blank-padded one, or the same currency would have two spellings. |
| `boolean` | JSON `true` / `false`. |
| SQL `NULL` | JSON `null`, and the key is **present**. `pg` maps SQL `NULL` to JavaScript `null`, which `JSON.stringify` renders as `null` (probe J3). A key that is *absent* is not the same as a key whose value is `null`; the record form must state which fields are nullable. |
| `jsonb` | If ever included, the normalized `jsonb` text form. PostgreSQL's `jsonb` output **is** canonical — key order is fixed by length then bytewise, so two `jsonb` values that are equal render identically (probe I2: `{"z":1,"a":2,"m":3,"aa":4}` and `{"aa":4,"m":3,"a":2,"z":1}` both render `{"a": 2, "m": 3, "z": 1, "aa": 4}`). Plain `json` is **not** canonical — it preserves input order (probe I3). Only `jsonb` may be included. |
| Free text (`notes`, `description`) | Excluded from the hash input by default. Free text is not a numeric invariant and its presence would make the digest sensitive to editorial changes. Any inclusion must be an explicit, versioned decision. |

### 2.4 What a calculation record must *not* contain

The current digest payload omits nothing that is financially material, and the omission is invisible: `entry_kind`, `fee_amount`, `tax_amount`, `fx_rate`, `reporting_amount`, `reporting_currency_code` are all present in `ledger_entry` (`database/schema.sql:533-555`) but **absent** from the route's projection (`apps/api/src/index.ts:7743-7752`; probe P5 lists the full column set against the projection). Probe K1 proves the consequence against real data: re-running the **exact** route projection against a shadow relation in which `fee_amount`, `tax_amount`, `entry_kind`, `fx_rate` and `reporting_amount` are all overwritten with different values yields a **byte-identical** row set and a **byte-identical** `replay_hash` (`95782ca30014…` in both cases). Probe K2 shows the same for the `balances` aggregate.

A digest that is unchanged when fees, taxes, entry kinds and FX rates change does not witness the calculation it is supposed to witness. The calculation record must therefore carry, for every value it reports, the inputs that determine it — including fee/tax and FX, per the already-approved D-FEE-TAX-01 semantics (`w0-2-ledger-policy.md:56-63`) and the price/FX decomposition (`w0-2-calculation-policy.md:61-65`).

---

## 3. D-SER-02 — Hash-version compatibility (`ledger-replay-hash-v1`)

**Decision.** The hash of a calculation record is computed over an **envelope**, not over the record alone:

```
{"hash_form_version":…,"record":<the calc-record-v1 canonical bytes>}
```

- `hash_form_version` is a mandatory, top-level member of the hashed bytes, with value `"ledger-replay-hash-v1"` for this form.
- The digest is SHA-256 over the UTF-8 bytes of the envelope, lowercase hex.

**The form version lives inside the hashed bytes.** The current route returns `calculation_version: "ledger-replay-v1"` in the response body (`apps/api/src/index.ts:7787`) but that string is **not** part of the hashed payload — the digest is computed over `{rows, balances, totals}` only (`:7783`; probe P1 confirms the digest input's top-level keys are exactly `["rows","balances","totals"]`). A hash therefore carries no record of the form that produced it, and a future change of form would silently produce hashes that are not comparable with the old ones — with nothing in the payload to say so. Binding the version inside the bytes makes every hash self-describing.

### 3.1 The comparability rule

**A hash is comparable only with another hash of the same `hash_form_version` and the same `record_version` and the same `calculation_version`.** Two hashes with different form versions are **incomparable**: they are not equal, and — importantly — they are **not unequal either**. The correct statement is *"these are not comparable"*, never *"these differ"*. A differing digest across versions is a statement about the *forms*, not about the ledger.

This is the reason the version is inside the bytes: two records that are byte-identical under different form versions produce different digests, so equality can never be asserted accidentally across a version boundary (probe V6: the same record under `ledger-replay-hash-v1` → `9ec4e377640f…`, under `ledger-replay-hash-v2` → `c4f525c458e0…`; V6 declares them incomparable, not different).

### 3.2 When the form changes

Any change to the record's member set, member order, decimal scale, rounding mode, timestamp/date rendering, value-type normalization, or the envelope structure **requires a new `hash_form_version`** (and, for record-shape changes, a new `record_version`). A change is a **new form, not a re-baselining**:

- Historic hashes keep their original version. They are **never** recomputed to the new form and are **never** compared against new-form hashes.
- A version bump is a **breaking change** for comparison, and any consumer that compares across versions must first state the comparison is out of scope.
- A new form version does not retroactively invalidate old hashes; it makes them non-comparable with new ones.

**Scope is part of the record, therefore part of the hash.** `as_of` is currently only a **filter** on the rows, never a digest field (probe F8 / P1: `as_of_in_digest false`, `portfolio_in_digest false`). Two replays of the same portfolio at different `as_of` boundaries yield different row sets and therefore different hashes today, but the hashes do not record *which* boundary produced them, and a hash cannot be checked against a stated scope. With `scope` bound into the record (§2), the same ledger at a different `as_of` yields a different, and *self-describing*, digest (probe V5: `9ec4e377640f…` vs `7c380ef83752…`, distinct = true).

### 3.3 Golden vectors for the form

These are arithmetic/serialization contract examples, **not** fixture edits and not assertions that the QA owner guard is resolved. Produced by the reference normalizer `/Users/ruben/.hermes/profiles/calculations/cache/scratch/w02_calc_record_vectors.py` (pure base-10 decimal arithmetic, `decimal` module, 34-digit working precision, ROUND_HALF_EVEN; no database, no network, no credentials; exit 0, `ALL_VECTORS_COMPUTED`).

| Vector | Input | Canonical output |
|---|---|---|
| `CALC-SER-DEC-ODD-001` | `1.2345678901235` → 12 places | `1.234567890124` |
| `CALC-SER-DEC-EVEN-001` | `1.2345678901225` → 12 places | `1.234567890122` |
| `CALC-SER-DEC-FX-001` | `0.12345678901234575` → 16 places | `0.1234567890123458` |
| `CALC-SER-DEC-NEGZERO-001` | `-0.000000000000` → 12 places | `0.000000000000` |
| `CALC-SER-DEC-NOEXP-001` | `1E+3` → 12 places | `1000.000000000000` |
| `CALC-SER-DEC-SCALE-001` | `100` → 12 places | `100.000000000000` |
| `CALC-SER-INST-001` | `2026-01-02T10:00:00.123456` at `+00:00` | `2026-01-02T10:00:00.123456Z` |
| `CALC-SER-INST-002` | `2026-01-02T12:00:00.123456` at `+02:00` | `2026-01-02T10:00:00.123456Z` |
| `CALC-SER-INST-003` | `2026-01-02T05:00:00.000000` at `-05:00` | `2026-01-02T10:00:00.000000Z` |
| `CALC-SER-CUR-001` | `"eur"` | `EUR` |
| `CALC-SER-UUID-001` | `2C785F2F-2F5F-4025-ADD6-6AB35D8B2D0E` | `2c785f2f-2f5f-4025-add6-6ab35d8b2d0e` |

`CALC-SER-INST-002` and `-003` exist to make the point that a wall-clock time is not an instant: the same instant reached from different offsets must render identically. `CALC-SER-DEC-NEGZERO-001` and `-NOEXP-001` cover the two renderings `format(Decimal, "f")` avoids but a naive serializer would emit.

---

## 4. D-SER-03 — Ordering and aggregation determinism (the Ledger's explicit question)

The Ledger concurrence asked whether the route's ordering and aggregation are sufficient for a canonical calculation-record serialization. **Answer: no — but for reasons that are narrower and more fixable than "the ordering is wrong".**

### 4.1 What already holds (do not re-open these)

- **The rows query's `ORDER BY lt.effective_date, lt.occurred_at, lt.id, le.id` is a total order.** `(lt.id, le.id)` is unique over the joined set, so the sort is deterministic and no two rows can be exchanged. Verified: 0 duplicate `(lt.id, le.id)` pairs (probe P7).
- **The aggregates' `GROUP BY … ORDER BY` are total orders** over their grouping keys (`financial_account_id, currency_code` and `currency_code`) (`:7762-7763`, `:7774-7775`).
- **UUID ordering is stable across representations**: ordering by `uuid` and by `uuid::text` give the same sequence (probe H4, 2000 samples: `uuid_order_eq_text_order true`; probe G1 on the account set). So the `::text` projection does not perturb the sort.
- **The `pg` driver does not silently reorder object keys** in a way that could mask a defect: the key order of a returned row is the projection order (probe P8), and the projection order is fixed by the `SELECT` list.
- **The aggregate arithmetic is exact decimal, not floating point**: `SUM` over `numeric` is exact — `0.1 + 0.2` yields exactly `0.300000000000` (probe F3). The route's `::numeric(28,12)::text` output is scale-normalized to 12 places (probe F2, H5).
- **`numeric(28,12)` fails loudly rather than silently on overflow** (probe F5: `numeric field overflow` beyond 16 integer digits). That is the right failure mode for a financial digest.

### 4.2 What is *not* sufficient — four concrete gaps

**(a) Session-dependence of the rendered values.** Established in §2.2 with measurements (probes P2, P3, K4). This is the single largest obstacle: the ordering is total, but the *bytes* it orders are rendered under session settings the application does not pin. A digest over session-rendered text is not a digest of the ledger.

**(b) The digest payload omits financially material fields.** Established in §2.4 with a real-data proof (probe K1: byte-identical hash under mutated fee/tax/entry_kind/fx_rate/reporting_amount; probe K2 for the aggregate). A calculation record must carry the inputs that determine its outputs.

**(c) The aggregates have no `entry_kind` predicate, so their scope is unstated.** The `balances` query sums every entry kind into one signed per-`(financial_account_id, currency_code)` figure (`:7755-7765`), and the `totals` query classifies *any* external-flow leg as contribution or spending regardless of kind (`:7766-7777`). Measured against the local synthetic ledger: the same per-account figure absorbs `CASH` (`+250755.248400000000`), `FEE` (`-1024.220000000000`) and `POSITION` (`-35463.818671124200`) (probe K3 / F6). A balance that silently mixes cash, position notional and fees is not a defined quantity, and a digest over it inherits that ambiguity. **Which** entry kinds belong in a balance is a **Ledger-owned** semantic — this artifact does not choose it. What §2 requires is that the calculation record state the entry-kind scope it was computed over, so the number is interpretable.

**(d) The scope is a filter, not a record.** Established in §3.2 (probe F8).

### 4.3 The calculation-side requirement

Because the Ledger owns the row form, the calculation side requires that the **calculation record** carry, as declared members:

1. the `entry_kind` scope the outputs were computed over;
2. the `state` scope (POSTED-only, per the already-concurred `w0-2-ledger-concurrence-rounding-cost-basis-v1.md:20`);
3. the `as_of` boundary and its timezone (§2 `scope`);
4. the ordering key actually used, so the ordering is an input to the record and not an implicit property of a query;
5. every financially material input to each output (fee, tax, FX, and the base/reporting currency pair), per §2.4.

None of this is new policy: items 1, 2 and 5 restate semantics already approved in D-FEE-TAX-01 and already concurred in D-COST-BASIS-01; item 3 restates the already-concurred "explicit as-of date and timezone" rule (`t_64ce59b3/docs/decisions/w0-2-calculation-rounding-cost-basis-v2.md:24`). What is new is only that they must be **recorded in the hashed bytes** rather than being properties of the SQL that produced them.

---

## 5. What is and is not decided

### 5.1 DECIDED by this artifact (Calculations side)

- **D-SER-01** — the `calc-record-v1` calculation-record serialization: exact member set, normative member order, fixed-scale decimal strings (12 places; 16 for FX), ROUND_HALF_EVEN output quantization, base-10 34-digit working precision, ISO-8601 UTC instant form `…ffffffZ`, ISO `YYYY-MM-DD` date form, and the normalized forms of uuid / char(3) currency / boolean / null / jsonb, with free text excluded by default (§2).
- **D-SER-02** — the `ledger-replay-hash-v1` hash envelope: SHA-256 over `{"hash_form_version":…,"record":<calc-record bytes>}`; the form version is inside the hashed bytes; **a hash is comparable only within the same form version, and hashes of different versions are incomparable — not unequal**; a form change is a new version and never a re-baselining; scope is bound into the record and therefore into the hash; the golden vectors of §3.3 (§3).
- **D-SER-03** — the calculation-side requirement that a calculation record state its entry-kind scope, state scope, as-of boundary and timezone, ordering key, and all financially material inputs (§4).

### 5.2 NOT DECIDED here — explicitly returned to the Ledger owner

These are **Ledger-owned** and remain **NOT DECIDED**. This artifact does not decide, pre-empt, or constrain them beyond naming them:

| # | Open item | Why it is Ledger's |
|---|---|---|
| L-1 | **The canonical byte representation of the ledger rows themselves** — the field set of a ledger row in a digest, its member order, and the per-field normalization of `ledger_transaction` / `ledger_entry` columns (including whether `entry_kind`, `fee_amount`, `tax_amount`, `fx_rate`, `reporting_amount` are in the row or in the calculation record). | The ledger is the canonical source of truth under ADR-0002:9; the row form is a statement about canonical ledger data, not about a calculation output. §2.4 states the *requirement* the row form must meet; it does not specify the form. |
| L-2 | **The restore-equality contract** — what "restored state equals pre-restore state" means, over which scope, with which comparison, and whether a replay hash is a sufficient or a necessary witness. | Restore is a ledger-boundary concern (ADR-0002:26 lists replay and restore as release gates); the current restore path performs no digest comparison at all (`infra/backup/restore-local.sh:45-46` verifies artifact checksums, `:67-68` counts *tables*, and the restore report contains no financial digest — verified by search). |
| L-3 | **The ledger-row digest composition** — whether and how the Ledger-owned row form is combined with the calculation record into one digest, and whether the row form gets its own version identifier. | Follows from L-1. |
| L-4 | **The entry-kind semantics of a balance** — which `entry_kind`s constitute a cash balance, and the treatment of `POSITION` and `FEE`/`TAX` legs. | A ledger semantic. §4.2(c) records the measurement and §4.3 requires only that the scope be *stated*, not which scope is chosen. |

### 5.3 Explicitly untouched by this artifact

- **D-OVERDRAFT-01** — NOT DECIDED (Ledger-owned; latest record `t_5befc971/docs/decisions/w0-2-ledger-overdraft-short-policy.md:11`).
- **D-SHORT-01** — decided by the Ledger owner in the same record; unchanged, not re-opened, not extended.
- **D-TRANSFER-01** — partially decided, exact correction contract NOT DECIDED (Ledger-owned; `w0-2-ledger-policy.md:36-52`).
- **Canonical residual persistence** — still NOT DECIDED (Ledger-owned; `w0-2-ledger-concurrence-rounding-cost-basis-v1.md:12`).
- **ADR-0002:17's 2-decimal external rounding** — still unreconciled; §2.1 concerns the *record* scale (12/16 places) and does not decide the display scale.
- The **`replay_hash` implementation** (`apps/api/src/index.ts:7783`) — **unchanged**. No file in `apps/`, `packages/`, `database/`, `fixtures/`, `tests/`, or CI was modified by this artifact.

---

## 6. Evidence

**HEAD inspected:** `366bd0f4685134f57e5ff5146614ca6ddb63904c`. Branch `spaartrack/t_5ae31bf2-w0-2-calculations-owner-decision-d-round`; worktree `/Users/ruben/spaartrack/.worktrees/t_5ae31bf2`; clean tree before this artifact.

All commands were read-only against the **local synthetic stack** (`docker compose`; `postgres:16-alpine`). `TRACE_ID=calc-w02-replay-serialize-20261020` and `CORRELATION_ID=calc-w02-replay-serialize-20261020` were exported in the shell. No credentials, no production data, no DDL, no DML, no ledger mutation, no network. Probe scripts were copied into the running API container (`/tmp/`) because it is the only environment with both `pg@8.23.1` and the database reachable; they execute `SELECT`/`SET` only.

### 6.1 Primary evidence — the current route, at HEAD `366bd0f`

| Location | Fact |
|---|---|
| `apps/api/src/index.ts:7725` | The replay route: `POST /api/v1/ledger/replay`. |
| `apps/api/src/index.ts:7742-7754` | Rows query: `ORDER BY lt.effective_date, lt.occurred_at, lt.id, le.id`; selects `lt.effective_date::text`, `lt.occurred_at::text` and 8 `ledger_entry` columns. |
| `apps/api/src/index.ts:7755-7765` | Balances query: `SUM(CASE WHEN direction='CREDIT' THEN amount ELSE -amount END)::numeric(28,12)::text`, `GROUP BY le.financial_account_id, le.currency_code`. No `entry_kind` predicate. |
| `apps/api/src/index.ts:7766-7777` | Totals query: external-flow CREDIT → contribution, DEBIT → spending, `GROUP BY le.currency_code`. No `entry_kind` predicate. |
| `apps/api/src/index.ts:7778-7780` | `rows`/`balances`/`totals` are `{...row}` spreads of the driver result objects. |
| **`apps/api/src/index.ts:7783`** | **`const replayHash = createHash("sha256").update(JSON.stringify({ rows, balances, totals })).digest("hex")`** — the digest input is `{rows, balances, totals}`; no version, no scope. |
| `apps/api/src/index.ts:7787` | `calculation_version: "ledger-replay-v1"` — present in the response, absent from the hashed bytes. |
| `apps/api/src/index.ts:59` | `new Pool({ connectionString: process.env.DATABASE_URL })` — no `options=`, no session-setting pinning. |
| `database/schema.sql:502-531` | `ledger_transaction`: `occurred_at timestamptz NOT NULL` (`:510`), `effective_date date NOT NULL` (`:512`), `state` CHECK `('POSTED','PENDING','DRAFT','VOID')` (`:509`). |
| `database/schema.sql:533-555` | `ledger_entry`: `entry_kind` CHECK (`:538`), `direction` CHECK (`:539`), `quantity`/`unit_price`/`amount` `numeric(28,12)` (`:540-542`), `currency_code char(3)` (`:543`), `reporting_amount` (`:544`), `fx_rate numeric(28,16)` (`:546`), `fee_amount`/`tax_amount` (`:547-548`), `metadata jsonb` (`:550`). |
| `database/schema.sql:43-48` | `currency`: `code char(3)`, `minor_units smallint CHECK (minor_units BETWEEN 0 AND 8)`. |
| `database/schema.sql:471` | `fx_rate.rate numeric(28, 16) NOT NULL CHECK (rate > 0)`. |
| `infra/backup/restore-local.sh:45-46`, `:67-68` | Restore verifies artifact checksums and counts **tables**; it computes and compares no financial digest. |

### 6.2 Probe results (all read-only)

| Probe | Question | Result |
|---|---|---|
| P1 | Is scope/version in the digest? | Digest input keys = `["rows","balances","totals"]`; `as_of_in_digest false`, `portfolio_in_digest false`, `version_in_digest false`. |
| P2 | Session `TimeZone` dependence | `UTC` → `683868680e34…`; `Europe/Amsterdam` → `69f9ee4dfcf0…`. **Not equal.** `occurred_at::text`: `2026-10-18 10:00:00+00` vs `2026-10-18 12:00:00+02`. |
| P3 | Session `DateStyle` dependence | `Postgres, MDY` → `41105735afec…`; `ISO, MDY` → `69f9ee4dfcf0…`. **Not equal.** `effective_date::text`: `10-18-2026` vs `2026-10-18`. |
| P4 / F4 | PG numeric cast tie-break | `(0.0000000000005)::numeric(28,12)` → `0.000000000001`; `(0.0000000000015)` → `0.000000000002`; `(-0.0000000000005)` → `-0.000000000001`. Half-**away-from-zero**, not half-even. |
| F2 / H5 | Scale normalization | `(100.5)::numeric(28,12)::text` → `100.500000000000`; `(100.5::numeric)::text` → `100.5`. |
| F3 | Is the aggregate exact decimal? | `SUM` of `0.1 + 0.2` → `0.300000000000`. Exact, not float. |
| F5 | Overflow behaviour | `numeric field overflow` beyond `numeric(28,12)`'s 16 integer digits. Fails loudly. |
| F6 / K3 | Aggregate entry-kind scope | `balances` absorbs `CASH +250755.248400000000`, `FEE -1024.220000000000`, `POSITION -35463.818671124200` into one signed figure. |
| F7 | Totals entry-kind scope | `POSITION` external-flow DEBIT counted as external **spending** (`527753.720000000000`). |
| F8 | Is `as_of` in the digest? | No — it is a filter. Row identity is `(transaction_id, effective_date)`. |
| G2 / I1 | `char(3)` semantics | `'EUR'::char(3) = 'EUR '::char(3)` → true; `'EU '::char(3)::text` → `"EU"` (length 2). Blank-padded vs trimmed differ. |
| G4 / H2 | Canonical instant form | `to_char(ts AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')` → `2026-01-02T10:00:00.123456Z`; **1 distinct result across 5 session timezones and `DateStyle='Postgres, MDY'`**. |
| G7 / G8 | State scope | `POSTED 7295`, `PENDING 79`, `VOID 158`; `POSTED` rows with non-null `voided_at` = 0. |
| G9 | `metadata` non-empty | 4437 rows. `jsonb` output is canonical (I2); `json` is not (I3). |
| G10 | `uuid::text` form | `a1b2c3d4-0000-4000-8000-000000000000` — lowercase, hyphenated, stable. |
| H4 / G1 | UUID ordering stability | `uuid` order == `uuid::text` order (2000 samples). |
| H6 | Is the P4 tie reachable at scale 12? | No — scale-12 operands keep the sum at scale 12, so the cast is a no-op. Divergence is **latent**, activated only by a scale > 12 operand. |
| I1 | `char(3)` text trimming | Trailing blanks stripped by `::text`. |
| I2 / I3 | `jsonb` vs `json` key order | `jsonb` → identical text for equal values; `json` → preserves input order. |
| J1 | Driver raw types | `numeric` → JS **string**; `date`/`timestamptz` → JS `Date`. The route's `::text` casts are what make them strings. |
| J3 | SQL NULL in JSON | `null`, key **present**. |
| J4 | Corpus | 7912 transactions / 7912 entries; 1743 entries carry non-zero fee or tax. |
| **K1** | **Real-data fee/tax/kind/FX collision** | The **exact** route projection over a shadow relation with `fee_amount`, `tax_amount`, `entry_kind`, `fx_rate`, `reporting_amount` all overwritten: rows byte-identical (**true**), hash `95782ca30014…` in both cases, `K1_hashes_equal true`. |
| K2 | Same for the aggregate | `balances` unchanged under mutated fee/tax (`K2_balances_equal true`). |
| K4 | Digest under 5 session settings | 5 distinct digests: `2a5f709eb561…`, `254ecf7f6085…`, `8671a5c0e3c3…`, `24bbfc9f02ad…`, `d6082a08b832…`. |
| P7 | Is the row ORDER BY a total order? | 0 duplicate `(lt.id, le.id)` pairs → yes, total. |
| P8 | Row key order | Exactly the projection order. |
| P5 | Omitted `ledger_entry` columns | `entry_kind, reporting_amount, reporting_currency_code, fx_rate, fee_amount, tax_amount, notes, metadata, ledger_transaction_id`. |
| V1–V7 | Golden vectors of §3.3 | All as tabulated; `ALL_VECTORS_COMPUTED`, exit 0. |
| X | Cross-implementation agreement | Postgres canonical instant == Python reference for all three offset cases (`X_matches_python_reference true`). |

### 6.3 Reproducibility

- Reference normalizer: `/Users/ruben/.hermes/profiles/calculations/cache/scratch/w02_calc_record_vectors.py` — pure base-10 decimal arithmetic, no database, no network. Re-running reproduces §3.3 exactly.
- SQL probes: `/Users/ruben/.hermes/profiles/calculations/cache/scratch/w02_replay_hash_probe{,2,3,4,5,6,7,8}.mjs` — run as `docker compose exec -T api node /tmp/<file> <portfolio_id>`. They execute `SELECT` and session `SET` only; they write nothing.

### 6.4 References re-pointed at the current `main` HEAD

The card asked for every reference to be re-resolved. The following earlier citations **do not resolve** at `366bd0f` and are re-pointed here:

| Stale citation | Where it appears | Resolves at `366bd0f` to | Note |
|---|---|---|---|
| `roadmap.md:911-913` (as "US-0002-A/B/C") | `w0-2-ledger-policy-closeout.md:7`; `w0-2-ledger-policy.md:79` (as "674 and 911–913") | **`roadmap.md:1001-1003`** | At `cf5e8c4` these lines were the US-0002 child stories; `roadmap.md` gained 343 lines since, so they now hold US-1202/1203/1204. `roadmap.md:674` (cited for the US-0002 epic row) is now US-0606 prose; the epic row is at **`roadmap.md:764`**. |
| `docs/decisions/w0-2-calculation-rounding-cost-basis-v1.md` | `w0-2-ledger-concurrence-rounding-cost-basis-v1.md:4` | **`t_61151bb9/docs/decisions/…`** (SHA-256 `4e977538cf8d…`) | Not on `main`. Superseded by **`t_64ce59b3/docs/decisions/w0-2-calculation-rounding-cost-basis-v2.md`** (SHA-256 `d69f403fcbe3…`), also not on `main`; the v2 file exists on the unmerged durability branch `spaartrack/t_7312b8b2-…`. |
| `docs/decisions/w0-2-ledger-overdraft-short-policy.md` | `w0-2-ledger-concurrence…`; `w0-2-sell-cash-leg-concurrence-v1.md:88` | **`t_5befc971/docs/decisions/…`** (SHA-256 `ed71d3ce9f03…`) | Not on `main`. |
| `docs/decisions/w0-2-b-case-fee-tax-calculation-v1.md` | `w0-2-sell-cash-leg-determination-v1.md:71` | **`t_f3b817b0/docs/decisions/…`** (SHA-256 `afd31bd5200b…`) | Not on `main`. |
| `docs/decisions/w0-2-sell-leg-owner-input-verification.md` | — | **`t_c28b860a/docs/decisions/…`** | Not on `main`; exists only on the unmerged durability branch. |

Sources read at `366bd0f` with SHA-256 verified: `w0-2-ledger-concurrence-rounding-cost-basis-v1.md` `7bb01c8915a1…`, `w0-2-calculation-policy.md` `8ad2fb405d38…`, `w0-2-policy-reconciliation.md` `37763f8059aa…`, `w0-2-sell-cash-leg-concurrence-v1.md` `b7cadb11386c…`, `w0-2-ledger-policy.md` `2d505d13ce35…`, `w0-2-ledger-policy-closeout.md` `934351f42e7b…`, `docs/adr/0002-canonical-ledger.md` `d12bd990d161…`, `docs/decisions/README.md` `5b9ac7f256f0…`. Read from other worktrees (not on `main`): rounding/cost-basis **v2** `t_64ce59b3/…` `d69f403fcbe3…` (`:17`, `:24` cited above), rounding/cost-basis **v1** `t_61151bb9/…` `4e977538cf8d…`, overdraft/short **v2** `t_5befc971/…` `ed71d3ce9f03…`, B-case fee/tax **v1** `t_f3b817b0/…` `afd31bd5200b…`.

**Reference collision check.** `docs/decisions/README.md` is edited by one card at a time. At the time of writing, the only branches whose diff against `main` touches that file are `spaartrack/t_7312b8b2-…` (task `t_7312b8b2`, **done** — its six unlanded-record rows are in its branch, not in `main`) and `spaartrack/t_dc3e1f5b-…` (a stale pre-`main` branch whose diff is the whole table). **No running or queued card is editing `docs/decisions/README.md`**, so the single index row required by this card is added without collision.

### 6.5 Limitations

- No replay was executed through the HTTP route, and no `replay_hash` was recomputed by the application. The digests in §6.2 were produced by re-executing the route's **exact** SQL and hash construction against the local synthetic database, not by calling the endpoint. The reconstruction is byte-faithful to `apps/api/src/index.ts:7742-7783` — same three queries, same `JSON.stringify({rows, balances, totals})`, same `createHash("sha256")` — but it is a reconstruction, not an application-level observation.
- No restore was performed, and no restore-equality claim is made or implied.
- The K1/K2 collision proof mutates a **shadow relation in a subquery**, not the canonical ledger. It is a read-only demonstration that the route's projection is blind to those columns; it is not a ledger mutation and nothing was written.
- The evidence is drawn from one local synthetic database with one portfolio (`e5889a29-740a-4153-a4b0-402fc1461b2e`, 8 rows) plus whole-database aggregates. The *structural* findings (omitted columns, session dependence, missing scope, missing version) are properties of the code path and hold for any data; the *measured values* are specific to this synthetic corpus.
- No production, broker, bank or live market data was read. No credential was used. No network call was made.

---

## 7. Gate report

- **W0-2 / US-0002-A,B,C / TC-US-0002-A,B,C: RED / BLOCKED.** This artifact does not make the QA contract green. The QA owner guard `owner_decisions_approved=false` stays in place; it must not be weakened.
- **D-ROUNDING-01 item 3: partially closed.** The **calculation-record** half is decided here (D-SER-01, D-SER-02, D-SER-03). The **ledger-row byte representation** and the **restore-equality contract** remain **NOT DECIDED** and are handed to the Ledger owner as L-1 … L-4. Item 3 is **not** closed.
- **Not verified / not claimed:** replay/restore equality; that any two `replay_hash` values are comparable; that the current `replay_hash` is canonical; runtime financial behaviour of the cost-basis or P&L paths; migration dry-run, reapply/idempotence or restore; that the A-case SELL-leg field is the cash leg.
- **No implementation authorization.** The `replay_hash` implementation is unchanged. No W0-3, Wave 2+, Poort A/B/C or release clearance follows.
- **Next gates:** (1) Ledger owner specifies the canonical ledger-row form and the restore-equality contract (L-1 … L-4), with reciprocal Calculations review; (2) only then may an end-to-end replay hash be asserted, and only under a single named `hash_form_version`; (3) independent QA review of this record; (4) the separate D-OVERDRAFT-01 answer, and the runtime/migration/replay/restore evidence for the broader release gate.
- **Next actions for other owners:** the six unlanded W0-2 records named in §6.4 remain unlanded on `main`; the durability card that carries them (`t_7312b8b2`, done) has not been merged. That is a landing gap, reported here and not repaired by this card.

---

*Artifact: `docs/decisions/w0-2-replay-restore-canonical-serialization-v1.md`, worktree `/Users/ruben/spaartrack/.worktrees/t_5ae31bf2`, branch `spaartrack/t_5ae31bf2-w0-2-calculations-owner-decision-d-round`, inspected at `main` HEAD `366bd0f4685134f57e5ff5146614ca6ddb63904c`. No fixture, test, source, schema, migration, ADR, roadmap, backlog or canonical ledger data was changed by this artifact.*
