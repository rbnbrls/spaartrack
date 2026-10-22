# Slice 0 — Contract Freeze & Test Basis: Completion Plan

**Status**: Contracts authored, fixtures defined, tests written (RED by design). Gate W0 not yet passed.

---

## ✅ Already Done (Contract Authoring)

| Artifact | Status | Location |
|----------|--------|----------|
| ADR-0001: Modular monolith | Accepted | `docs/adr/0001-modular-monolith.md` |
| ADR-0002: Canonical ledger | Accepted | `docs/adr/0002-canonical-ledger.md` |
| ADR-0003: Trading 212 boundary | Accepted | `docs/adr/0003-trading212-live-boundary.md` |
| ADR-0004: Identity/auth boundary | Accepted | `docs/adr/0004-identity-authentication.md` |
| ADR-0005: Privacy/retention/restore | Accepted | `docs/adr/0005-privacy-retention-and-restore.md` |
| Financial invariant contract (W0-2) | Authored, RED | `tests/contract-freeze/financial-invariant-contract.test.mjs` |
| Architecture contract (TC-US-0001-A/B/C) | Authored | `tests/smoke/architecture-contract.test.mjs` |
| Synthetic fixtures | Defined | `fixtures/ENV-001.json`, `SEC-001.json`, `LEDGER-001.json`, `CALC-001.json`, `UI-001.json` |
| W0-2 contract fixture | Defined | `fixtures/W0-2-financial-contract-v1.json` |
| Owner decision records | Documented | `docs/decisions/w0-2-*.md` |
| Full traceability (US ↔ TC) | Mapped | `test-cases.md`, `docs/backlog/b-004-refinement.md` |
| AGENTS.md (governance) | Written | `AGENTS.md` |

---

## 🔴 Remaining to Pass Gate W0

### 1. Resolve Owner Decisions (Unblocks W0-2 Contract)

The W0-2 contract test fails by design until these owner decisions are **JOINTLY APPROVED**:

| Decision ID | Question | Owner | Current Status | Required For |
|-------------|----------|-------|----------------|--------------|
| `D-OVERDRAFT-01` | Is negative cash permitted on non-loan accounts? | Ledger | NOT DECIDED | Cash signs (A-CASH-SIGNS-001) |
| `D-SHORT-01` | Is short selling permitted? (Already DECIDED: NO) | Ledger | **DECIDED** | A-SHORT-REJECTION-001 |
| `D-ROUNDING-01` | Rounding precision for cash/quantity/cost basis? | Ledger + Calculations | NOT DECIDED | All A/B/C cases |
| `D-FEE-TAX-01` | Fee/tax allocation on partial sells? | Ledger + Calculations | NOT DECIDED | B-PARTIAL-SELL-FIFO-WAC-001 |
| `D-COST-BASIS-01` | Default cost basis method (FIFO/WAC)? | Calculations | NOT DECIDED | B-PARTIAL-SELL-FIFO-WAC-001 |
| `D-TRANSFER-01` | Transfer neutrality semantics (already in ADR-0002)? | Ledger | PARTIALLY DECIDED | C-PAIRED-TRANSFER-NEUTRALITY-001 |

**Action**: @lead to convene Ledger + Calculations owners for joint approval. Record dispositions in `docs/decisions/` with a new consolidated closeout record.

### 2. Implement Ledger Application Commands (Makes Tests Green)

Once decisions are resolved, @builder implements the application service layer:

| Command | Test Coverage | Depends On |
|---------|---------------|------------|
| `postTransaction` (BUY/SELL/DEPOSIT/WITHDRAWAL/TRANSFER/DIVIDEND/INTEREST/FEE/TAX/SPLIT) | TC-US-0002-A/B/C, TC-US-0001-A | Decisions resolved |
| `voidTransaction` (correction/VOID with reason, actor, trace) | TC-US-0002-C | Decisions resolved |
| `replayTransaction` (idempotent exact replay, conflict detection) | TC-US-0002-C | Decisions resolved |
| `getLedgerState` (balance, quantity, cost basis, P&L projections) | TC-US-0002-A/B/C | Decisions resolved |

**Boundary**: API handlers, workers, imports, connectors, AI tools do NOT write ledger tables. Only application services call the canonical commands.

### 3. Verify Gate W0 Criteria

| Criterion | Verification |
|-----------|--------------|
| Contracts reviewable | ADR-0001/0002 + W0-2 fixture + decision records |
| First tests RED | `pnpm test:contract-freeze` fails on open decisions |
| No new domain interpretation needed | All US-0001..US-0005 traced to TC-US-* with owners |

---

## 📋 Slice 0 Work Breakdown (for Dispatch)

### Wave 0.1 — Decision Closeout (Architecture + Ledger + Calculations owners)
- **Owner**: @lead convenes
- **Output**: Consolidated decision closeout record in `docs/decisions/`
- **Gate**: All 6 decisions show `JOINTLY APPROVED` in latest owner record
- **Evidence**: W0-2 contract fixture `owner_decisions_approved` flips to `true`

### Wave 0.2 — Ledger Application Services Implementation (@builder)
- **Bounded context**: Ledger only
- **Contracts**: `TC-US-0001-A`, `TC-US-0002-A/B/C`, `TC-US-0003` (invariants)
- **Dependencies**: Wave 0.1 complete; ENV-001 stack running
- **Deliverable**: Application service module with commands + unit/golden tests
- **Gate**: `pnpm test:contract-freeze` passes (all W0-2 cases green)

### Wave 0.3 — Architecture Contract Verification (@reviewer + @sentinel)
- **Scope**: TC-US-0001-A/B/C, TC-US-0002-A/B/C, TC-US-0003, TC-US-0004, TC-US-0005
- **Verify**: ADR boundaries enforced, no direct SQL writes, event contract documented
- **Gate**: All Slice 0 contract tests green; architecture review signed off

---

## 🚫 Non-Goals for Slice 0 (Explicit)

- No provider integrations (US-0801+)
- No UI beyond empty state / onboarding (US-0501+)
- No performance/income calculations (US-0401+, US-0701+)
- No Money Flow (US-0901+)
- No Tax/Reporting (US-1101+)
- No AI/Addons (US-1201+)
- No production deployment / Coolify promotion (Poort B/C)

---

## 📦 Dependencies & Sequencing

```
Wave 0.1 (Decisions)
    │
    ▼
Wave 0.2 (Ledger impl) ◄─── ENV-001 stack (compose.yaml already ready)
    │
    ▼
Wave 0.3 (Review + Gate W0)
    │
    ▼
Wave 1 (Delivery runway, Identity/security, Ledger contract parallel)
```

**Critical path**: Wave 0.1 → 0.2 → 0.3. No parallelism in Slice 0 — Ledger is the single write boundary.

---

## 🎯 Acceptance Evidence for Gate W0

1. **Decision closeout**: `docs/decisions/w0-2-consolidated-closeout.md` with all 6 decisions `JOINTLY APPROVED`
2. **Contract tests green**: `pnpm test:contract-freeze` exits 0
3. **Architecture review**: @reviewer signs off TC-US-0001-A/B/C, TC-US-0002-A/B/C, TC-US-0003/4/5
4. **Traceability intact**: Every US-0001..US-0005 maps to TC-US-* with owner/module/exit criteria
5. **No implementation drift**: All ledger writes go through application commands; schema parity test passes

---

## 👥 Team Coordination

| Role | Slice 0 Responsibility |
|------|------------------------|
| **@architect** | Owns this plan, ADR boundaries, cross-context contracts, Gate W0 sign-off |
| **@lead** | Convening owner decisions, unblocking @builder, sprint sequencing |
| **@builder** | Implements Ledger application services (Wave 0.2 only) |
| **@reviewer** | Reviews architecture contract enforcement, ADR compliance |
| **@sentinel** | Security/contract test gatekeeping, no direct SQL writes |
| **@release** | Standby — no release activity until Gate W0 passes |

---

## Next Action

**@lead** — convene Ledger + Calculations owners to resolve the 5 open decisions (D-OVERDRAFT-01, D-ROUNDING-01, D-FEE-TAX-01, D-COST-BASIS-01, D-TRANSFER-01). D-SHORT-01 is already decided.

Once decisions are recorded, **@builder** can start Wave 0.2 implementation against the now-stable contracts.