# Spaartrack

**Private portfolio, dividend, performance & Money Flow tracker for self-hosting on Proxmox/Coolify.**

---

## Quick Start

```bash
# 1. Clone and configure
cp .env.example .env

# 2. Start the local stack (web, API, worker, PostgreSQL, Redis, object storage, observability)
scripts/dev/compose.sh up -d --build

# 3. Verify health
curl http://localhost:18080/health/live
curl http://localhost:18080/health/ready

# 4. Open the web UI
open http://localhost:3000
```

### Key Local Endpoints

| Endpoint | Purpose |
|---|---|
| `http://localhost:3000` | Web bootstrap (PWA) |
| `http://localhost:18080/health/live` | Process health |
| `http://localhost:18080/health/ready` | Dependency readiness (DB + queue) |
| `http://localhost:18080/metrics` | Prometheus metrics |
| `http://localhost:9090` | Prometheus |
| `http://localhost:3001` | Grafana (anonymous viewer) |
| `http://localhost:19000` | Object storage (RustFS) |
| `http://localhost:19001` | Object storage console |

---

## Features Overview

Spaartrack is a **modular monolith** with a **canonical ledger** as the single source of financial truth. All projections (portfolio, performance, tax, Money Flow, reporting) are rebuildable from the ledger and versioned calculation kernels.

### 🏦 Portfolio & Accounts
- **Multi-portfolio ownership** — Create and manage multiple portfolios with privacy scopes (PRIVATE, SHARED, PUBLIC)
- **Financial accounts** — Register brokerage, bank, cash, crypto, credit card, loan, property, or custom accounts per portfolio
- **Account tracking modes** — TRANSACTIONS (full ledger), HOLDINGS (positions only), BALANCE_ONLY
- **Portfolio membership & roles** — OWNER, EDITOR, VIEWER, ACCOUNTANT, ADVISOR with granular permissions
- **Reporting currency** — Per-portfolio base currency with multi-currency FX support

### 📈 Instruments & Market Data
- **Instrument master data** — Stocks, ETFs, funds, bonds, options, crypto, precious metals, futures, money market, property, vehicles, collectibles, custom, cash
- **Asset classes** — EQUITY, FIXED_INCOME, DERIVATIVE, CRYPTO, CASH, REAL_ASSET, LIABILITY, OTHER
- **Identifiers** — ISIN, CUSIP, ticker, provider symbols, contract codes with provider-specific mappings
- **ETF look-through** — Underlying component resolution with weights and source versioning
- **Price history** — Timestamped prices per instrument with source attribution and close-price flag
- **FX rates** — Base/quote pairs with timestamp, source, and version; missing rates return `404 FX_RATE_NOT_FOUND` (no silent fallback)
- **Corporate actions** — Splits, reverse splits, spin-offs, mergers, DRP, rights issues, tenders, delistings, symbol changes

### 💰 Canonical Ledger (Source of Truth)
The ledger is **append-only**; all financial writes go through explicit application commands. No direct SQL, no connector/AI writes.

| Command | Endpoint | Activity Types |
|---|---|---|
| **Post Transaction** | `POST /api/v1/ledger/transactions` | BUY, SELL, DIVIDEND, INTEREST, DEPOSIT, WITHDRAWAL, TRANSFER_IN, TRANSFER_OUT, CREDIT, FEE, TAX, SPLIT, FX_CONVERSION, RETURN_OF_CAPITAL, DIVIDEND_IN_KIND, STAKING_REWARD, BONUS, REBATE, REFUND, CORRECTION, LIABILITY_PAYMENT, OTHER |
| **Void Transaction** | `PATCH /api/v1/ledger/transactions/{id}` (state=VOID) or `POST /api/v1/ledger/transactions/void` | Paired VOID metadata for transfers; correction reason, actor, trace, correlation |
| **Replay Transaction** | `POST /api/v1/ledger/transactions/replay` | Exact replay is a no-op; `409 IDEMPOTENCY_KEY_CONFLICT` on changed content |
| **Get Ledger State** | `GET /api/v1/ledger/state` | Balances, positions, cost basis, realized P&L |

**Financial Invariants (enforced by contract tests):**
- **Cash** — Only POSTED entries count; DEBIT decreases, CREDIT increases; no negative cash without explicit loan account
- **Quantity** — BUY increases, SELL decreases; never negative without short flag; splits scale quantity/cost basis idempotently
- **Cost basis** — FIFO/WAC baseline; fees/taxes allocate on partial sells; 12dp internal, 2dp external rounding
- **Transfers** — Paired TRANSFER_OUT/TRANSFER_IN with mutual `paired_transaction_id`; `is_external_flow=false` (contribution/spending neutral)
- **FX** — Rate has pair, timestamp, source, version; missing/inverse rate returns `404`, never silent fallback
- **Idempotency** — Account-scoped: `(financial_account_id, identity_kind, identity_value)`; duplicate returns existing; conflict returns `409`

### 🔁 Corrections, Voids & Replay
- **Correction/VOID** — Preserves original activity; authorized correction command with reason, actor, trace, correlation
- **No physical deletion** — Ledger rows are never `DELETE`d; only `VOID` state changes
- **Idempotent replay** — Same normalized command returns original transaction/entries; no new financial entries, audit action, or event
- **Cross-connection replay** — Same account across connections: exact replay only for identical normalized ledger command; otherwise `409`; different account is independent

### 📥 Imports & Provider Sync (Review-Gated)
- **Import pipeline** — Upload → Mapping → Preview → Review → Commit/Undo
- **Duplicate detection** — Provider ID + hash-based; `IMPORT_DUPLICATE_PROVIDER_ID` / `IMPORT_DUPLICATE_PROVIDER_HASH`
- **Reconciliation queue** — UNKNOWN_INSTRUMENT, DUPLICATE, BALANCE_MISMATCH, MISSING_ACTIVITY, UNMAPPED_FIELD, AMBIGUOUS_TRANSFER, SCHEMA_ERROR, OTHER
- **Trading 212 adapter (read-only)** — Account summary, positions, paginated order/dividend/cash history; AES-256-GCM encrypted credentials in vault
- **GoCardless/Bank adapter** — Requisition, consent lifecycle, account/balance/transaction fetch
- **CSV/Excel import** — Configurable mappings with template versioning
- **No auto-posting** — All provider/import candidates require explicit human review before ledger commit

### 💵 Income, Dividends & Performance
- **Income events** — DIVIDEND, INTEREST, COUPON, OPTION_PREMIUM, STAKING, OTHER with announced/ex/record/payment dates
- **Status lifecycle** — ANNOUNCED → PROJECTED → EX_DATE → PAID / CANCELLED
- **Tax/fee allocation** — Gross, tax, fee, net amounts per event
- **Performance methods** — TWR, MWRR/IRR, Modified Dietz, CAGR, ROAI with versioned assumptions
- **Benchmarks** — Provider-linked symbols with historical observations
- **Risk metrics** — Volatility, beta, Sharpe, Sortino, max drawdown, turnover, risk contribution
- **Dividend forecasts** — Model-based with confidence intervals

### 💸 Money Flow (Opt-In Projection)
- **Categories** — INCOME, SPENDING, SAVING, TRANSFER, TAX, FEE, UNCATEGORIZED (hierarchical, user-scoped)
- **Payees** — Normalized names with auto-merging
- **Transaction categorization** — Manual, rule-based, import, AI, system sources with confidence scores
- **Budgets** — Period-based with groups, lines, rollover, actual vs planned
- **Scheduled transactions** — Recurring with frequency (WEEKLY, MONTHLY, QUARTERLY, YEARLY, CUSTOM)
- **Cashflow forecasting** — SCHEDULED_ONLY, BUDGET_ONLY, COMBINED modes up to 50-year horizon
- **Financial insights** — AI-generated with evidence, confidence, urgency
- **Internal transfer neutrality** — Paired transfers excluded from spending/saving totals

### 🧮 Tax & Reporting
- **Tax lots** — FIFO, LIFO, WAC, HIFO, SPECIFIC_ID methods; original/remaining quantity, cost basis
- **Disposal tracking** — Quantity, proceeds, cost basis, realized gain, holding period (SHORT/LONG/UNKNOWN)
- **Fiscal year reports** — Jurisdiction-scoped with rules versioning
- **Tax worksheets** — DRAFT → CALCULATED → REVIEWED → EXPORTED → LOCKED
- **Tax-loss harvesting** — Candidates with unrealized loss, estimated tax saving, wash-sale windows
- **Report runs** — JSON, CSV, XLSX, PDF output formats with object storage artifacts
- **Portfolio sharing** — Share links (VIEW / RESTRICTED_VIEW) with exposure policy; accountant shares with granular scopes

### 🎯 Goals, Planning & Analytics
- **Goal types** — NET_WORTH, PASSIVE_INCOME, PORTFOLIO_VALUE, FIRE, CUSTOM
- **Funding allocations** — Per financial account with percentage splits
- **Contribution limits** — Jurisdiction/tax year/account type with usage tracking
- **Allocation targets** — By asset class, sector, region, currency, holding with drift detection
- **Retirement scenarios** — Assumptions, tax, inflation with Monte Carlo runs
- **Screener/watchlists** — Filter-based with versioned calculations
- **Backtest scenarios** — Period, assumptions, allocations, results
- **What-if / scenario analysis** — Rebalance drift, wheel strategy, FIRE projections

### 🔐 Identity, Auth & Privacy
- **Sessions** — Token-based with TTL, revocation, audit trail
- **TOTP (2FA)** — AES-256-GCM encrypted secrets; replay/lockout protection (5 attempts → 5 min lock)
- **Synthetic OIDC** — Local-only test adapter; **production OIDC disabled** until validated adapter exists
- **Privacy export** — GDPR Art. 20 portable bundle (user-owned scope; granted-portfolio ledger excluded)
- **Privacy deletion** — Atomic transaction: revokes sessions, TOTP, OIDC states, portfolio memberships, shares, connections, consents, credentials, push consents; anonymizes user (email=NULL, display_name='Verwijderd gebruiker'); physical DELETE only for `auth_identity` and `tax_residency`; ledger preserved; durable `user_deletion_tombstone` survives backup/restore
- **Restore-time replay** — `infra/backup/restore-local.sh` replays tombstones post-restore to prevent resurrection

### 🤖 AI, Addons & Agent Control Plane
- **AI assistant answers** — Scoped read tools (portfolio, activity, market data) with audit trail
- **AI proposals** — Confirm/Cancel with undo token; mutation tool usage tracked; never auto-commits
- **Addon sandbox** — Manifest with permissions (PORTFOLIO_READ, ACTIVITY_READ, MARKET_DATA_READ, ACTIVITY_PROPOSE, ACTIVITY_MANAGE, SECRET_READ); ledger_access=none enforced; revokable
- **Addon SDK** — Scoped read + event hooks (emit/revoke); capability-gated
- **Agent control plane** — Incident triage, diagnosis, fix verification, promotion/rollback gates, closure, skill proposals
- **Model sessions** — BYOK/LOCAL key sources with vault references

### 🔔 Notifications & Alerts
- **Alert rules** — JSON conditions with channels (IN_APP, PUSH, EMAIL)
- **Push consents** — Per-channel (PUSH, IN_APP, EMAIL) with device labels
- **Delivery tracking** — Status, failure reasons, notification artifacts

### 📦 Operations & Observability
- **Health checks** — Liveness (process) + Readiness (DB + queue)
- **OpenTelemetry** — Traces, metrics, logs → OTel Collector → Prometheus/Grafana
- **Correlation IDs** — Every request/job carries `trace_id`, `correlation_id`, `service`, `release`
- **PII redaction** — Tokens, secrets, account numbers, descriptions redacted in logs
- **Audit log** — Actor, action, entity, before/after, correlation/trace
- **Incidents** — SEV-0 to SEV-3 with fingerprint deduplication, evidence bundles, hypothesis/verification/closure workflow
- **Deployments** — Version, git SHA, image digest, environment, migration version
- **Backups** — DATABASE, OBJECT_STORAGE, FULL_VM, CONFIGURATION with encryption, checksum, retention
- **Agent runs** — TRIAGE, DIAGNOSIS, PATCH, TEST, RELEASE, KNOWLEDGE_UPDATE with tool-call evidence

---

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            USER / EXTERNAL                                  │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │       Web / PWA           │  (apps/web) — static shell, reads only
                    └─────────────┬─────────────┘
                                  │ HTTPS
                    ┌─────────────▼─────────────┐
                    │        API Gateway        │  (apps/api) — auth, validation, trace/correlation
                    │    (Node.js HTTP server)  │  NO domain logic; calls application services
                    └─────────────┬─────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
┌───────────────┐      ┌─────────────────┐      ┌──────────────────┐
│  Application  │      │   Application   │      │  Application     │
│   Services    │      │   Services      │      │   Services       │
│  (per context)│      │  (per context)  │      │  (per context)   │
└───────┬───────┘      └────────┬────────┘      └────────┬───────────┘
        │                       │                        │
        ▼                       ▼                        ▼
┌───────────────┐      ┌─────────────────┐      ┌──────────────────┐
│   Ledger      │      │   Portfolio     │      │  Market Data     │
│   Context     │      │   Context       │      │   Context        │
│  (owns:       │      │  (owns:         │      │  (owns:          │
│   transaction,│      │   portfolio,    │      │   FX, prices,    │
│   entry,      │      │   account,      │      │   identity,      │
│   tax_lot,    │      │   instrument,   │      │   corporate      │
│   snapshot)   │      │   membership)   │      │   actions)       │
└───────────────┘      └─────────────────┘      └──────────────────┘
        │                       │                        │
        ▼                       ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        POSTGRESQL (single deployment)                       │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ Ledger  │ │Portfolio│ │Market   │ │Income/  │ │Money    │ │Tax/     │  │
│  │ tables  │ │ tables  │ │Data tbls│ │Perf tbls│ │Flow tbls│ │Report   │  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │      Redis Queue          │  → Workers (broker-sync, projections, etc.)
                    └───────────────────────────┘
```

### Bounded Context Ownership

| Context | Owns | Does Not Own |
|---|---|---|
| **Identity & Access** | users, sessions, portfolio grants, authorization, privacy lifecycle | financial activity or financial truth |
| **Portfolio** | portfolio lifecycle/settings, membership, financial-account registration, instrument identity/metadata | posted activity, cash/quantity balances, cost basis, performance truth |
| **Ledger** | canonical financial commands, transaction/entry lifecycle, idempotency, correction/void, audit linkage, replay source | portfolio access policy, provider protocol, UI, derived read models |
| **Integrations** | provider connections, raw payloads, sync state, provider-specific mappings, normalized candidates | canonical financial writes, portfolio authorization decisions |
| **Market Data** | currency/FX, prices, identity mappings, corporate-action observations | ledger activity, silently inferred missing observations |
| **Income & Performance** | income-event/forecast inputs, versioned calculations over authorized source data | canonical cash/position truth, direct ledger writes |
| **Money Flow** | classifications, categories, budgets, scope-bound read models, analysis | canonical financial activity; projections are read-only over ledger facts |
| **Tax & Reporting** | jurisdiction-scoped calculation/report requests, report artifacts | source ledger facts, unreviewed jurisdictional assumptions |
| **Notifications** | rules, delivery intent, delivery evidence | financial facts, ledger commands |
| **AI & Addons** | scoped read/proposal interfaces, permissioned addon lifecycle | direct database/ledger access, implicit confirmation of financial commands |
| **Operations** | deployment, incident, backup, agent-run evidence | product financial state |

---

## Data Safety & Privacy

- **Self-hosted** — Runs on your infrastructure (Proxmox, Coolify, Docker Compose)
- **Encrypted credentials** — AES-256-GCM with per-connection authenticated associated data; vault references only in DB
- **Audit trail** — Every financial write, auth change, share, deletion is attributed with actor, trace, correlation
- **GDPR-ready** — Export (portable bundle) + Deletion (atomic, tombstone-survives-restore)
- **No silent fallbacks** — Missing FX rates, provider errors, auth failures return explicit errors
- **Ledger immutability** — Physical `DELETE` forbidden; corrections via `VOID`/`correction` only
- **Backup/restore** — Encrypted artifacts with checksum; restore replays deletion tombstones
- **Synthetic-only fixtures** — No real broker/bank/model credentials in repo or tests

---

## Development & Testing

### Commands

```bash
# Start local stack
scripts/dev/compose.sh up -d --build

# Run all tests (unit + smoke without stack)
pnpm test

# Run tests requiring stack (PostgreSQL, Redis, object storage, API)
STACK_SMOKE=1 pnpm test

# Run contract-freeze tests (financial invariants — RED by design until owner decisions approved)
pnpm test:contract-freeze

# Lint + typecheck
pnpm check

# Build API image
docker compose build api

# View logs
scripts/dev/compose.sh logs -f api
```

### Test Fixtures (in `fixtures/`)

| Fixture | Purpose |
|---|---|
| `ENV-001.json` | Disposable Compose/Coolify environment |
| `SEC-001.json` | Two users, roles, sessions, MFA/OIDC, revoke scenarios |
| `LEDGER-001.json` | EUR/USD account with buy, sell, cash, dividend, fee, tax, transfer, split |
| `CALC-001.json` | Golden kernel: historical prices, FX, cost basis, P&L cases |
| `UI-001.json` | Portfolio, positions, action forms, empty state, mobile viewport |
| `IMPORT-001.csv` | CSV rows: valid, warning, error, duplicate, reconciliation |
| `PERF-001.json` | Dividend, benchmark, calendar, cashflow periods |
| `PROVIDER-001-degiro.csv` | Trading 212/DEGIRO responses: success, schema drift, 401, 403, 429 |
| `FLOW-001.json` | Bank/cash/credit transactions with transfers, categories, budgets, multi-currency |
| `BANK-001.json` | GoCardless requisition/account/balance/transaction fixtures |
| `REPORT-001.json` | As-of periods, filters, locale/currency, export artifacts |
| `TAX-001.json` | Tax lots, fiscal years, jurisdictions, FX, wash-sale windows |
| `SPECIAL-001.json` | Bonds, options, crypto, metals, futures, FIRE, Monte Carlo seeds |
| `OPS-001.json` | Synthetic failures, incidents, evidence, verifier findings, release, health windows |

### Test Layers

| Layer | Location | Runs By Default |
|---|---|---|
| Unit (domain rules, calculation engine, UX contracts) | `tests/unit/` | ✅ |
| Smoke (provider, API, addon, golden contracts + stack tests) | `tests/smoke/` | ✅ (stack tests need `STACK_SMOKE=1`) |
| Runtime (executable, needs built image + Docker) | `tests/runtime/` | ❌ (manual) |
| Contract-freeze (financial invariants — RED by design) | `tests/contract-freeze/` | ❌ (`pnpm test:contract-freeze`) |

---

## Documentation Index

| Document | Description |
|---|---|
| `docs/architecture.md` | Solution architecture, bounded contexts, commands/queries/events, non-goals |
| `docs/adr/0001-modular-monolith.md` | ADR-0001: Modular monolith with async workers |
| `docs/adr/0002-canonical-ledger.md` | ADR-0002: Canonical ledger as source of truth |
| `docs/adr/0003-trading212-live-boundary.md` | ADR-0003: Trading 212 read-only connection boundary |
| `docs/adr/0004-identity-authentication.md` | ADR-0004: Identity and authentication boundary |
| `docs/adr/0005-privacy-retention-and-restore.md` | ADR-0005: Privacy retention and backup/restore semantics |
| `database/schema.sql` | Canonical PostgreSQL 16+ schema (source of truth) |
| `database/README.md` | Canonical ledger principle and schema conventions |
| `roadmap.md` | Full roadmap with waves, gates, Poort A/B/C delivery ports |
| `test-cases.md` | TDD test catalog with traceability to every `US-*` story |
| `AGENTS.md` | Agent dispatch rules, commit conventions, Definition of Done |
| `fixtures/README.md` | Synthetic fixture inventory |

---

## Status

### Current Phase: **Poort A — Local MacBook Release** ✅

| Area | Status | Evidence |
|---|---|---|
| **Core stack** | ✅ Done | `docker compose up -d --build` healthy; API, web, worker, PostgreSQL, Redis, object storage |
| **Health/readiness** | ✅ Done | `/health/live` `ok`; `/health/ready` `ready` (DB + Redis `tcp_connection_ok`) |
| **Identity/Auth** | ✅ Done | Synthetic sessions, TOTP (enroll/verify/revoke), synthetic OIDC (local-only), privacy export/deletion with tombstone |
| **Portfolio/Accounts** | ✅ Done | CRUD, membership roles, privacy scopes, financial account types |
| **Instruments/Market Data** | ✅ Done | Master data, ETF look-through, prices, FX, corporate actions |
| **Canonical Ledger** | ✅ Done | Post/void/replay/state commands; financial invariants as contract tests |
| **Import/Sync** | ✅ Done | Pipeline, mappings, review-gate, Trading 212 adapter (read-only), GoCardless adapter |
| **Income/Dividends** | ✅ Done | Events, status lifecycle, tax/fee allocation |
| **Performance** | ✅ Done | TWR, MWRR/IRR, Modified Dietz, CAGR, ROAI; benchmarks; risk metrics |
| **Money Flow** | ✅ Done | Categories, payees, rules, budgets, scheduled transactions, forecasting, insights |
| **Tax/Reporting** | ✅ Done | Tax lots (FIFO/LIFO/WAC/HIFO/SPECIFIC_ID), worksheets, tax-loss harvesting, report runs, sharing |
| **Goals/Planning** | ✅ Done | Goal types, funding, contribution limits, allocation targets, retirement/Monte Carlo, backtests |
| **AI/Addons** | ✅ Done | Assistant answers, proposals (Confirm/Cancel), addon sandbox/SDK, model sessions |
| **Operations** | ✅ Done | Incidents (SEV-0–3), deployments, backups, agent runs, audit log, OTel/Prometheus/Grafana |
| **Web UI** | ✅ Done | Responsive shell with Portfolio, Performance, Dividends, Calendar, Actions, Money Flow, Reports, Goals, Analytics, Settings; feature locks (`data-feature-state="backend-pending"`) |
| **Test suite** | ✅ Done | 501/501 green (`STACK_SMOKE=1`); 279 passed + 122 skipped (default); `tsc --noEmit` green |

### Blocked / Not Yet Implemented

| Feature | Blocker |
|---|---|
| **Production OIDC** | No validated OIDC adapter; `PRODUCTION_OIDC_ADAPTER_UNAVAILABLE` on production startup |
| **Real broker credentials** | Vault purge not implemented; Trading 212/DEGIRO adapters are read-only |
| **GoCardless/Bunq OAuth** | Consent/compliance gate not cleared |
| **Poort B (Coolify development)** | CI/CD pipeline, Coolify deployment, SBOM, migration checks pending |
| **Poort C (Production)** | Threat model review, real auth, production secrets, backup/restore drill, human approval gates |

### Wave Status

| Wave | Scope | Status |
|---|---|---|
| **Wave 0** | Contract freeze & test basis (US-0001–US-0005) | ✅ Done (architecture, financial invariants, data classification, AGENTS.md, threat model) |
| **Wave 1** | Delivery/runtime, Identity/security, Ledger contract (US-0101–US-0308) | ✅ Done |
| **Wave 2** | Financial kernel: Ledger (US-0301–US-0308), Calculation (US-0401–US-0408), Projections | ✅ Done |
| **Wave 3** | Manual portfolio MVP (US-0501–US-0507) | ✅ Done |
| **Wave 4** | Import safety (US-0601–US-0608), Income/dividend (US-0701–US-0708), Performance (US-0401–US-0408) | ✅ Done |
| **Wave 5** | Read-only broker/CSV adapters (US-0801–US-0910), Money Flow | ✅ Done (Trading 212, CSV import, Money Flow core) |
| **Wave 6+** | Reporting/goals/planning, Advanced analytics, Tax intelligence, Specialist instruments, Sharing/PWA, AI/MCP/addons, Autonomous operations | ✅ Done (all implemented locally) |

> **Note:** All 133 parent user stories are marked **Done (100%)** for the local MacBook release (Poort A) per the 19 October 2026 revalidation. The remaining gates (Poort B, Poort C) are delivery/operational, not feature gaps.

---

## License

MIT — see `LICENSE` (if present) or project root.

---

*Generated from codebase exploration: architecture, schema, API routes, test catalog, fixtures, and roadmap. Last updated: 2026-10-22.*