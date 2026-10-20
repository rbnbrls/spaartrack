---
title: Spaartrack TDD-testcatalogus
tags: [spaartrack, testing, tdd, roadmap]
---

# Spaartrack — TDD-testcatalogus

Deze catalogus vertaalt alle user stories uit [roadmap.md](roadmap.md) naar minimaal één uitvoerbaar testgeval. Parent stories met children zijn epics en krijgen een contracttest; de children krijgen de atomische acceptatietests. Stories zonder children krijgen direct een acceptatietest.

## Testdoel en uitvoeringsbeleid

- **Traceability:** ieder testgeval verwijst exact naar één `US-*`-ID; de ID is de koppeling naar issue, branch, testcode en release evidence.
- **TDD-volgorde:** eerst test rood schrijven, daarna implementeren, daarna groen maken en regressie draaien.
- **Testlagen:** contract, unit/golden, integration, component, E2E, security en operations worden gekozen op basis van de slice.
- **Financiële waarheid:** assertions vergelijken canonical ledger/projections en niet alleen UI-state.
- **Evidence:** elke geslaagde test bewaart fixture-versie, calculation version, release SHA, testresultaat en eventuele screenshots/logs.
- **Dataveiligheid:** fixtures bevatten synthetische gebruikers, accounts, instrumenten en transacties; echte broker- of bankgeheimen zijn verboden.
- **Status:** alle gevallen starten als `Not implemented`; een release mag alleen slagen wanneer alle blocking tests groen zijn.

## Testgeval-conventie

| Veld | Betekenis |
|---|---|
| Test-ID | `TC-US-####` voor parent/atomic stories of `TC-US-####-X` voor child stories |
| Given | Fixture en beginsituatie |
| When | Eén primaire handeling of systeemtrigger |
| Then | Verifieerbare uitkomst uit de acceptatiecriteria |
| Level | Voorgestelde minimale testlaag; aanvullende regressie is verplicht wanneer de impact groter is |

## Test-fixtures

- `ADR-001`: architectuur-, privacy- en threat-modeldocumenten.
- `ENV-001`: disposable Compose/Coolify omgeving met PostgreSQL, Redis, object storage, API en worker.
- `SEC-001`: twee gebruikers, rollen, sessies, MFA/OIDC en revoke-scenario's.
- `LEDGER-001`: EUR/USD-account met buy, sell, cash movement, dividend, fee, tax, transfer en split.
- `CALC-001`: historische prices, FX-rates, golden cost-basis- en P&L-cases.
- `UI-001`: portfolio, positions, action forms, empty state en mobile viewport.
- `IMPORT-001`: CSV/Sheets-bestanden met valid, warning, error, duplicate en reconciliation rows.
- `PERF-001`: dividend-, benchmark-, calendar- en cashflow-perioden.
- `PROVIDER-001`: Trading 212/DEGIRO fixture responses met success, schema drift, 401, 403 en 429.
- `FLOW-001`: bank-, cash- en creditcardtransacties met transfers, categories, budgets en multi-currency.
- `BANK-001`: GoCardless requisition/account/balance/transaction fixtures en consent lifecycle.
- `REPORT-001`: as-of periods, filters, locale/currency en export artifacts.
- `ANALYTICS-001`: benchmark, risk-free, ETF look-through, targets, scenarios en watchlists.
- `TAX-001`: tax lots, fiscal years, jurisdictions, FX en wash-sale windows.
- `SPECIAL-001`: bonds, options, crypto, metals, futures, FIRE en Monte Carlo seeds.
- `PWA-001`: mobile/offline cache, notification permissions en stale data.
- `AI-001`: scoped read tools, proposals, addon manifests, MCP contracts en sandbox.
- `OPS-001`: synthetic failures, incidents, evidence, verifier findings, release en health windows.

## Testgevallen per delivery slice

### Slice 0

| Test-ID | Story | Level | Given / When / Then |
|---|---|---|---|
| TC-US-0001 | US-0001 | contract — Epic contract | Given fixture ADR-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then ADR bevat Ledger, Integrations, Market Data, Income/Performance, Money Flow, Tax/Reporting, AI en Operations. en alle childuitkomsten zijn consistent. |
| TC-US-0001-A | US-0001-A | contract — atomic | Given fixture ADR-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then ADR benoemt inputs, outputs, invariants en verboden directe writes. |
| TC-US-0001-B | US-0001-B | contract — atomic | Given fixture ADR-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Adaptercontract en provider-specific mapping boundary zijn beschreven. |
| TC-US-0001-C | US-0001-C | contract — atomic | Given fixture ADR-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Portfolio, performance, Money Flow en reporting lezen alleen projections. |
| TC-US-0002 | US-0002 | contract — Epic contract | Given fixture ADR-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Invariants voor cash, quantity, cost basis, transfers, FX en idempotency staan als testbare regels beschreven. en alle childuitkomsten zijn consistent. |
| TC-US-0002-A | US-0002-A | contract — atomic | Given fixture ADR-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Given/when/then cases voor buy, sell, deposit, withdrawal en split bestaan. |
| TC-US-0002-B | US-0002-B | contract — atomic | Given fixture ADR-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Partial sell, fee, tax, FX en realized/unrealized cases zijn expliciet. |
| TC-US-0002-C | US-0002-C | contract — atomic | Given fixture ADR-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Paired transfer en duplicate replay cases zijn reproduceerbaar. |
| TC-US-0003 | US-0003 | contract — Epic contract | Given fixture ADR-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Elk datadomein heeft classificatie, retention, masking en toegangsregel. en alle childuitkomsten zijn consistent. |
| TC-US-0003-A | US-0003-A | contract — atomic | Given fixture ADR-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then User, account, transaction, raw payload en log fields hebben labels. |
| TC-US-0003-B | US-0003-B | contract — atomic | Given fixture ADR-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Iedere PII/raw-data categorie heeft retention en deletion owner. |
| TC-US-0004 | US-0004 | contract — Acceptance | Given fixture ADR-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then `AGENTS.md`, PR-template, commitregel, Definition of Ready en Definition of Done zijn versioned. |
| TC-US-0005 | US-0005 | contract — Acceptance | Given fixture ADR-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Threat model bevat assets, trust boundaries, abuse cases en mitigaties voor auth, integrations, AI en deployment. |
### Slice 1

| Test-ID | Story | Level | Given / When / Then |
|---|---|---|---|
| TC-US-0101 | US-0101 | integration — Epic contract | Given fixture ENV-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Eén documented command start web, API, worker, PostgreSQL, Redis en object storage met health checks. en alle childuitkomsten zijn consistent. |
| TC-US-0101-A | US-0101-A | integration — atomic | Given fixture ENV-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Schema initialiseert succesvol met health check en persistent volume. |
| TC-US-0101-B | US-0101-B | integration — atomic | Given fixture ENV-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then API bouwt, start en bereikt PostgreSQL via environment-configuratie. |
| TC-US-0101-C | US-0101-C | integration — atomic | Given fixture ENV-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Worker consumeert één testjob uit Redis en sluit gecontroleerd af. |
| TC-US-0101-D | US-0101-D | integration — atomic | Given fixture ENV-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Upload/download smoke test slaagt zonder cloudcredentials. |
| TC-US-0102 | US-0102 | integration — Epic contract | Given fixture ENV-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Een commit SHA kan naar Coolify development worden gedeployed en is via een releasepagina identificeerbaar. en alle childuitkomsten zijn consistent. |
| TC-US-0102-A | US-0102-A | integration — atomic | Given fixture ENV-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Coolify destination, domain, branch en runtime variables zijn versioned gedocumenteerd. |
| TC-US-0102-B | US-0102-B | integration — atomic | Given fixture ENV-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Deployment toont commit SHA en eindigt met healthy status. |
| TC-US-0102-C | US-0102-C | integration — atomic | Given fixture ENV-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Release record bevat image digest, migration version en timestamp. |
| TC-US-0103 | US-0103 | integration — Acceptance | Given fixture ENV-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Lint, typecheck, unit tests en artifact upload draaien automatisch en blokkeren de PR bij failure. |
| TC-US-0104 | US-0104 | integration — Epic contract | Given fixture ENV-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Image bevat commit SHA, versie, SBOM en digest; promotion gebruikt dezelfde digest. en alle childuitkomsten zijn consistent. |
| TC-US-0104-A | US-0104-A | integration — atomic | Given fixture ENV-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Image label en registry tag verwijzen naar dezelfde commit. |
| TC-US-0104-B | US-0104-B | integration — atomic | Given fixture ENV-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then SBOM wordt als CI-artifact opgeslagen en aan digest gekoppeld. |
| TC-US-0104-C | US-0104-C | integration — atomic | Given fixture ENV-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Coolify development en production verwijzen naar exact dezelfde digest. |
| TC-US-0105 | US-0105 | integration — Epic contract | Given fixture ENV-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Web, API, worker en dependencies hebben afzonderlijke checks met duidelijke failure reason. en alle childuitkomsten zijn consistent. |
| TC-US-0105-A | US-0105-A | integration — atomic | Given fixture ENV-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Liveness faalt alleen bij procesfalen en gebruikt geen databasequery. |
| TC-US-0105-B | US-0105-B | integration — atomic | Given fixture ENV-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Readiness rapporteert afzonderlijk database/queue dependency status. |
| TC-US-0106 | US-0106 | integration — Epic contract | Given fixture ENV-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Elk request en elke job bevat `release`, `service`, `trace_id` en `correlation_id`; PII wordt geredigeerd. en alle childuitkomsten zijn consistent. |
| TC-US-0106-A | US-0106-A | integration — atomic | Given fixture ENV-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Elke API-request bevat trace, correlation, service en release. |
| TC-US-0106-B | US-0106-B | integration — atomic | Given fixture ENV-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Eén job kan van queue tot database-write worden gevolgd. |
| TC-US-0106-C | US-0106-C | integration — atomic | Given fixture ENV-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Tokens, accountnummers en transaction descriptions ontbreken in testlogs. |
| TC-US-0107 | US-0107 | integration — Epic contract | Given fixture ENV-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then PostgreSQL backup, object-storage backup en een restore smoke test leveren bewijs op. en alle childuitkomsten zijn consistent. |
| TC-US-0107-A | US-0107-A | integration — atomic | Given fixture ENV-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Backup job maakt encrypted artifact met checksum en retention metadata. |
| TC-US-0107-B | US-0107-B | integration — atomic | Given fixture ENV-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Restore opent een tijdelijke database met verwacht schema en row counts. |
| TC-US-0107-C | US-0107-C | integration — atomic | Given fixture ENV-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Een raw payload en report kunnen vanuit backup worden teruggelezen. |
### Slice 2

| Test-ID | Story | Level | Given / When / Then |
|---|---|---|---|
| TC-US-0201 | US-0201 | security — Acceptance | Given fixture SEC-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then User lifecycle ondersteunt active, invited, suspended en deleted; email uniqueness wordt afgedwongen. |
| TC-US-0202 | US-0202 | security — Acceptance | Given fixture SEC-001 met een bestaand actief account; when alleen het publieke e-mailadres wordt aangeboden aan de loginroute; then wordt geen sessie uitgegeven; fixture-sessies vereisen een afzonderlijke lokale fixture-authenticator, en sessies blijven gehasht, expirable en revokeable. |
| TC-US-0203 | US-0203 | security — Epic contract | Given fixture SEC-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Tweede factor/OIDC callback is getest met success, failure, replay en revoke. en alle childuitkomsten zijn consistent. |
| TC-US-0203-A | US-0203-A | security — atomic | Given fixture SEC-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Enrolment, success, invalid code en revoke zijn getest. |
| TC-US-0203-B | US-0203-B | security — atomic | Given fixture SEC-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then State, callback, identity mapping en logout zijn getest; synthetic callback weigert sessie-uitgifte bij enrolled TOTP (`TOTP_REQUIRED`). |
| TC-US-0203-C | US-0203-A | security — runtime | Given fixture SEC-001 met een ingeschakelde TOTP-factor; when dezelfde counter/code opnieuw wordt gebruikt of vijf onjuiste codes worden aangeboden; then de replay wordt geweigerd, de factor tijdelijk wordt vergrendeld en geen onbevoegde sessie wordt uitgegeven. |
| TC-US-0201-AUTH | US-0201 | security — runtime | Given SEC-001 met owner, outsider en geen bearer; when user-read/lifecycle endpoints worden aangeroepen; then self is toegestaan, unauthenticated krijgt 401, outsider 403 en suspended/deleted sessions zijn ongeldig. |
| TC-US-0203-OIDC-DEPLOY | US-0203-B | security — executable startup | Given productieconfiguratie met plausibele issuer/client/secret-reference en `OIDC_PROVIDER_VALIDATED=true`, maar zonder echte OIDC adapter; when de API-container start; then startup eindigt non-zero met `PRODUCTION_OIDC_ADAPTER_UNAVAILABLE` en synthetic OIDC wordt niet gepubliceerd als production authentication. |
| TC-US-0204 | US-0204 | security — Acceptance | Given fixture SEC-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Owner, editor, viewer, accountant en advisor worden server-side afgedwongen. |
| TC-US-0205 | US-0205 | security — Acceptance | Given fixture SEC-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Login, permission change, secret access, share, export en revoke maken audit events. |
| TC-US-0206 | US-0206 | security — Epic contract | Given fixture SEC-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then User deletion/export behandelt portfolio, raw payloads, reports, sessions en grants consistent. en alle childuitkomsten zijn consistent. |
| TC-US-0206-A | US-0206-A | security — atomic | Given fixture SEC-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Export bevat user-owned portfolio, ledger, raw references, reports en grants. |
| TC-US-0206-B | US-0206-B | security — atomic | Given fixture SEC-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Soft-delete/revoke verwijdert of anonimiseert data volgens retentionbeleid. |
### Slice 3

| Test-ID | Story | Level | Given / When / Then |
|---|---|---|---|
| TC-US-0301 | US-0301 | integration — Acceptance | Given fixture LEDGER-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Portfolio heeft eigenaar, status, privacy scope en reporting currency. |
| TC-US-0302 | US-0302 | integration — Acceptance | Given fixture LEDGER-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Brokerage, bank, cash, creditcard, loan en custom accounts hebben tracking mode en status. |
| TC-US-0303 | US-0303 | integration — Acceptance | Given fixture LEDGER-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Instrument ondersteunt ticker, ISIN/CUSIP, exchange, asset class, currency en custom assets. |
| TC-US-0304 | US-0304 | integration — Epic contract | Given fixture LEDGER-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Elke action heeft datum, account, amount, currency, source en expliciete state. en alle childuitkomsten zijn consistent. |
| TC-US-0304-A | US-0304-A | integration — atomic | Given fixture LEDGER-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then BUY/SELL valideert instrument, quantity, price, currency en account. |
| TC-US-0304-B | US-0304-B | integration — atomic | Given fixture LEDGER-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then DEPOSIT/WITHDRAWAL/TRANSFER heeft source, destination en external-flow flag. |
| TC-US-0304-C | US-0304-C | integration — atomic | Given fixture LEDGER-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then DIVIDEND/INTEREST registreert gross, tax, net en payment date. |
| TC-US-0304-D | US-0304-D | integration — atomic | Given fixture LEDGER-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Fee/tax is gekoppeld aan account/activity en telt niet dubbel in cash. |
| TC-US-0305 | US-0305 | integration — Epic contract | Given fixture LEDGER-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then POSTED, PENDING, DRAFT en VOID beïnvloeden berekeningen volgens één contract; fysieke delete is niet nodig. en alle childuitkomsten zijn consistent. |
| TC-US-0305-A | US-0305-A | integration — atomic | Given fixture LEDGER-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then POSTED/PENDING/DRAFT beïnvloeden projections volgens één state matrix. |
| TC-US-0305-B | US-0305-B | integration — atomic | Given fixture LEDGER-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then VOID maakt correction metadata en behoudt de oorspronkelijke activity. |
| TC-US-0306 | US-0306 | integration — Acceptance | Given fixture LEDGER-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then External id of deterministische fallback-hash is idempotent binnen connection/account. |
| TC-US-0307 | US-0307 | integration — Acceptance | Given fixture LEDGER-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Paired transfer houdt bron/doel bij en is niet als externe inleg of spending geboekt. |
| TC-US-0308 | US-0308 | integration — Acceptance | Given fixture LEDGER-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Replay van dezelfde ledger en source payloads levert dezelfde balances en totals op. |
### Slice 4

| Test-ID | Story | Level | Given / When / Then |
|---|---|---|---|
| TC-US-0401 | US-0401 | unit + golden — Epic contract | Given fixture CALC-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Rates hebben pair, timestamp, source en versie; inverse/ontbrekende rate is expliciet behandeld. en alle childuitkomsten zijn consistent. |
| TC-US-0401-A | US-0401-A | unit + golden — atomic | Given fixture CALC-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then EUR/USD/GBP/CHF kunnen worden gevalideerd en gelabeld. |
| TC-US-0401-B | US-0401-B | unit + golden — atomic | Given fixture CALC-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Pair, timestamp, source en rate worden uniek en herhaalbaar opgeslagen. |
| TC-US-0402 | US-0402 | unit + golden — Acceptance | Given fixture CALC-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Price observation heeft instrument, timestamp, currency, source en captured-at. |
| TC-US-0403 | US-0403 | unit + golden — Acceptance | Given fixture CALC-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Provider symbol, ISIN/CUSIP en unresolved mapping workflow zijn beschikbaar. |
| TC-US-0404 | US-0404 | unit + golden — Acceptance | Given fixture CALC-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Golden cases voor FIFO/WAC-baseline, fees, taxes en partial sells slagen. |
| TC-US-0405 | US-0405 | unit + golden — Epic contract | Given fixture CALC-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Price-, FX-, fee- en taxcomponenten zijn afzonderlijk terug te voeren. en alle childuitkomsten zijn consistent. |
| TC-US-0405-A | US-0405-A | unit + golden — atomic | Given fixture CALC-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then P&L gebruikt quantity, cost basis en valuation price. |
| TC-US-0405-B | US-0405-B | unit + golden — atomic | Given fixture CALC-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then FX-component is apart zichtbaar en gebruikt valuation FX. |
| TC-US-0406 | US-0406 | unit + golden — Epic contract | Given fixture CALC-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Quantity/cost-basis-effect is idempotent en vóór/na snapshots is controleerbaar. en alle childuitkomsten zijn consistent. |
| TC-US-0406-A | US-0406-A | unit + golden — atomic | Given fixture CALC-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Quantity en unit cost wijzigen volgens ratio zonder extra cashflow. |
| TC-US-0406-B | US-0406-B | unit + golden — atomic | Given fixture CALC-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Action heeft type, effective date, source en successor/ratio waar nodig. |
| TC-US-0407 | US-0407 | unit + golden — Acceptance | Given fixture CALC-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Snapshot bevat value, cash, flows, P&L, data-as-of en calculation version. |
| TC-US-0408 | US-0408 | unit + golden — Acceptance | Given fixture CALC-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Multi-currency, dividendtax, fees, transfer, split en restore/replay cases zijn groen. |
### Slice 5

| Test-ID | Story | Level | Given / When / Then |
|---|---|---|---|
| TC-US-0501 | US-0501 | component/E2E — Acceptance | Given fixture UI-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Empty state leidt naar portfolio, account, currency en eerste action. |
| TC-US-0502 | US-0502 | component/E2E — Acceptance | Given fixture UI-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Validatie toont ontbrekende account, instrument, currency, date en amount vóór commit. |
| TC-US-0503 | US-0503 | component/E2E — Acceptance | Given fixture UI-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then KPI’s komen uit ledger/calculation read model, niet uit handmatige UI-state. |
| TC-US-0503-UX | US-0503 | unit/contract — Presentation contract | Given fixture UI-001 en [de canonieke UX-regels](docs/ux-guidelines.md); when de UX-regeltest draait; then informatiehiërarchie, semantische status, toegankelijkheid, responsive states, tabelalternatief en ledger/read-model traceability zijn aantoonbaar. |
| TC-US-0504 | US-0504 | component/E2E — Acceptance | Given fixture UI-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Tabel ondersteunt configureerbare kolommen, open/closed positions en cash als positie. |
| TC-US-0505 | US-0505 | component/E2E — Acceptance | Given fixture UI-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Percentages totaliseren naar 100% volgens expliciete roundingregel. |
| TC-US-0506 | US-0506 | component/E2E — Epic contract | Given fixture UI-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Detail toont identity, cost basis, performance, dividends, calendar en actions. en alle childuitkomsten zijn consistent. |
| TC-US-0506-A | US-0506-A | component/E2E — atomic | Given fixture UI-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Detail toont name, ticker/ISIN, exchange, type en strategy. |
| TC-US-0506-B | US-0506-B | component/E2E — atomic | Given fixture UI-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Detail toont cost basis, price/FX P&L, realized/unrealized en dividends. |
| TC-US-0506-C | US-0506-C | component/E2E — atomic | Given fixture UI-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Calendar-tab toont toekomstige en historische events voor de security. |
| TC-US-0506-D | US-0506-D | component/E2E — atomic | Given fixture UI-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Actions-tab toont chronologische trades met cashimpact. |
| TC-US-0507 | US-0507 | component/E2E — Acceptance | Given fixture UI-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Een datumselectie toont dezelfde berekende portfolio state inclusief data-as-of. |
### Slice 6

| Test-ID | Story | Level | Given / When / Then |
|---|---|---|---|
| TC-US-0601 | US-0601 | integration — Epic contract | Given fixture IMPORT-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then File type, size, checksum, storage en eigenaar worden gevalideerd. en alle childuitkomsten zijn consistent. |
| TC-US-0601-A | US-0601-A | integration — atomic | Given fixture IMPORT-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Upload bewaart owner, filename, type, size en storage key. |
| TC-US-0601-B | US-0601-B | integration — atomic | Given fixture IMPORT-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Unsupported type, size limit en checksum collision geven een duidelijke fout. |
| TC-US-0602 | US-0602 | integration — Epic contract | Given fixture IMPORT-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Mapping template kan worden opgeslagen, hergebruikt en versieerbaar aangepast. en alle childuitkomsten zijn consistent. |
| TC-US-0602-A | US-0602-A | integration — atomic | Given fixture IMPORT-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Elke verplichte canonical field heeft precies één mapping of expliciete uitzondering. |
| TC-US-0602-B | US-0602-B | integration — atomic | Given fixture IMPORT-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Template heeft provider, document type en parser version. |
| TC-US-0603 | US-0603 | integration — Acceptance | Given fixture IMPORT-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Valid, warning, error en unsupported rows zijn afzonderlijk zichtbaar. |
| TC-US-0604 | US-0604 | integration — Acceptance | Given fixture IMPORT-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Row review bewaart raw row, normalized row, correction, actor en timestamp. |
| TC-US-0605 | US-0605 | integration — Acceptance | Given fixture IMPORT-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Match op provider id/hash toont reden en boekt niet dubbel. |
| TC-US-0606 | US-0606 | integration — Acceptance | Given fixture IMPORT-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Geen gedeeltelijke ledgercommit bij blocking errors; commit result bevat counts. |
| TC-US-0607 | US-0607 | integration — Acceptance | Given fixture IMPORT-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Alle door de batch geboekte activities kunnen veilig worden gevoid; audit blijft bestaan. |
| TC-US-0608 | US-0608 | integration — Acceptance | Given fixture IMPORT-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Unknown instrument, balance mismatch en ambiguous transfer leiden naar review queue. |
### Slice 7

| Test-ID | Story | Level | Given / When / Then |
|---|---|---|---|
| TC-US-0701 | US-0701 | unit + E2E — Acceptance | Given fixture PERF-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Status onderscheidt announced, projected, ex-date en paid. |
| TC-US-0702 | US-0702 | unit + E2E — Acceptance | Given fixture PERF-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Bedragen en formules zijn per instrument en portfolio traceerbaar. |
| TC-US-0703 | US-0703 | unit + E2E — Acceptance | Given fixture PERF-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then TTM gebruikt gerealiseerde payments; PADI gebruikt expliciete forecastregels. |
| TC-US-0704 | US-0704 | unit + E2E — Acceptance | Given fixture PERF-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then YoY en CAGR over configureerbare perioden zijn reproduceerbaar. |
| TC-US-0705 | US-0705 | unit + E2E — Acceptance | Given fixture PERF-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Ex-dividend, payment, AGM, earnings en economic events zijn filterbaar. |
| TC-US-0705-UX | US-0705 | unit + browser — Calendar UX | Given de Calendar / Overview route en de canonieke UX-regels; when de gebruiker maand/week, vorige/volgende/vandaag, eventtypefilter en reset gebruikt; then events zijn gegroepeerd en tabelmatig toegankelijk, lege dagen expliciet, vandaag gemarkeerd en trace/correlation-ID’s zichtbaar zonder browserconsole-errors. |
| TC-US-0706 | US-0706 | unit + E2E — Epic contract | Given fixture PERF-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Elke methode toont periode, cashflows, formula version en limitations. en alle childuitkomsten zijn consistent. |
| TC-US-0706-A | US-0706-A | unit + E2E — atomic | Given fixture PERF-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Cashflows worden tijdgewogen uitgesloten en golden cases slagen. |
| TC-US-0706-B | US-0706-B | unit + E2E — atomic | Given fixture PERF-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Cashflow timing wordt meegenomen en no-solution wordt begrijpelijk gemarkeerd. |
| TC-US-0706-C | US-0706-C | unit + E2E — atomic | Given fixture PERF-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Begin/end value en weighted cashflows worden volgens versioned formula berekend. |
| TC-US-0707 | US-0707 | unit + E2E — Epic contract | Given fixture PERF-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Benchmark observations en cashflow-matched variant zijn niet door elkaar gehaald. en alle childuitkomsten zijn consistent. |
| TC-US-0707-A | US-0707-A | unit + E2E — atomic | Given fixture PERF-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Return, period en currency zijn identiek gedefinieerd. |
| TC-US-0707-B | US-0707-B | unit + E2E — atomic | Given fixture PERF-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Benchmark simuleert dezelfde cashflow dates en amounts. |
| TC-US-0708 | US-0708 | unit + E2E — Acceptance | Given fixture PERF-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Alert rule ondersteunt conditions, channels, pause, test en delivery history. |
### Slice 8

| Test-ID | Story | Level | Given / When / Then |
|---|---|---|---|
| TC-US-0801 | US-0801 | contract/integration — Acceptance | Given fixture PROVIDER-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Provider capabilities, auth mode, API version en status zijn configureerbaar. |
| TC-US-0802 | US-0802 | contract/integration — Acceptance | Given fixture PROVIDER-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then API key/secret blijft in vault; Invest/Stocks ISA mapping en revoke zijn getest. |
| TC-US-0803 | US-0803 | contract/integration — Epic contract | Given fixture PROVIDER-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Positions, activities, dividends, rate limits, retries en sync summary werken met fixtures. en alle childuitkomsten zijn consistent. |
| TC-US-0803-A | US-0803-A | contract/integration — atomic | Given fixture PROVIDER-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Account summary wordt opgeslagen met provider timestamp. |
| TC-US-0803-B | US-0803-B | contract/integration — atomic | Given fixture PROVIDER-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Position snapshot wordt idempotent genormaliseerd. |
| TC-US-0803-C | US-0803-C | contract/integration — atomic | Given fixture PROVIDER-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Trades/dividends/cash activities worden naar review/posting gestuurd. |
| TC-US-0804 | US-0804 | contract/integration — Epic contract | Given fixture PROVIDER-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Layout mapping, ISIN, fees, tax, FX, cash en statement balance worden gereconcilieerd. en alle childuitkomsten zijn consistent. |
| TC-US-0804-A | US-0804-A | contract/integration — atomic | Given fixture PROVIDER-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Parser kiest een versioned layout of opent review. |
| TC-US-0804-B | US-0804-B | contract/integration — atomic | Given fixture PROVIDER-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Trade, dividend, fee, tax en cash rows leveren canonical candidates. |
| TC-US-0804-C | US-0804-C | contract/integration — atomic | Given fixture PROVIDER-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Statement ending balance versus calculated balance toont verschil en status. |
| TC-US-0805 | US-0805 | contract/integration — Acceptance | Given fixture PROVIDER-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then New, updated, duplicate, rejected en attention items zijn zichtbaar vóór/na posting. |
| TC-US-0806 | US-0806 | contract/integration — Acceptance | Given fixture PROVIDER-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then 401/403/429/schema failure creëert status, retry policy en incident evidence. |
### Slice 9

| Test-ID | Story | Level | Given / When / Then |
|---|---|---|---|
| TC-US-0901 | US-0901 | component/integration — Acceptance | Given fixture FLOW-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Account scope is opt-in en per portfolio/user bewaakt. |
| TC-US-0902 | US-0902 | component/integration — Acceptance | Given fixture FLOW-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Elke activity heeft category type en final-amount accounting. |
| TC-US-0903 | US-0903 | component/integration — Acceptance | Given fixture FLOW-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Paired transfers en creditcard payments zijn zichtbaar maar contribution/spending-neutral. |
| TC-US-0904 | US-0904 | component/integration — Acceptance | Given fixture FLOW-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Parent-child hierarchy, inactive status en bulk reassignment werken. |
| TC-US-0905 | US-0905 | component/integration — Acceptance | Given fixture FLOW-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Normalized payees, tags en bulk edit zijn beschikbaar. |
| TC-US-0906 | US-0906 | component/integration — Acceptance | Given fixture FLOW-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Contains, starts-with, exact, regex, priority en account scope worden toegepast in vaste volgorde. |
| TC-US-0907 | US-0907 | component/integration — Acceptance | Given fixture FLOW-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Rule/import/AI confidence, override en review audit worden opgeslagen. |
| TC-US-0908 | US-0908 | component/integration — Acceptance | Given fixture FLOW-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Maandelijkse budgetten, groepen, rollovers en actual-versus-budget werken. |
| TC-US-0909 | US-0909 | component/integration — Epic contract | Given fixture FLOW-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Income → saving → spending drill-down opent de onderliggende transacties. en alle childuitkomsten zijn consistent. |
| TC-US-0909-A | US-0909-A | component/integration — atomic | Given fixture FLOW-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Income, saving en spending totalen tonen periode en account scope. |
| TC-US-0909-B | US-0909-B | component/integration — atomic | Given fixture FLOW-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Klik op category opent exact gefilterde transactions. |
| TC-US-0909-C | US-0909-C | component/integration — atomic | Given fixture FLOW-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Parent/child totals blijven consistent bij expand/collapse. |
| TC-US-0910 | US-0910 | component/integration — Epic contract | Given fixture FLOW-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Base currency en native currency zijn beide beschikbaar met period-end FX. en alle childuitkomsten zijn consistent. |
| TC-US-0910-A | US-0910-A | component/integration — atomic | Given fixture FLOW-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Period-end FX wordt expliciet toegepast en opgeslagen. |
| TC-US-0910-B | US-0910-B | component/integration — atomic | Given fixture FLOW-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Native amount/currency blijven naast geconverteerde totals beschikbaar. |
### Slice 10

| Test-ID | Story | Level | Given / When / Then |
|---|---|---|---|
| TC-US-1001 | US-1001 | contract/integration — Acceptance | Given fixture BANK-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Institution selection geeft duidelijke regio-, capability- en availabilitystatus. |
| TC-US-1002 | US-1002 | contract/integration — Epic contract | Given fixture BANK-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then State/PKCE/CSRF, callback, consent status en failure path zijn getest. en alle childuitkomsten zijn consistent. |
| TC-US-1002-A | US-1002-A | contract/integration — atomic | Given fixture BANK-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Requisition bevat institution, redirect, language en state. |
| TC-US-1002-B | US-1002-B | contract/integration — atomic | Given fixture BANK-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Valid state/callback zet consent naar authorized; invalid state wordt geweigerd. |
| TC-US-1003 | US-1003 | contract/integration — Acceptance | Given fixture BANK-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Account selection slaat alleen gekozen accounts op en toont rekeningtype/currency. |
| TC-US-1004 | US-1004 | contract/integration — Epic contract | Given fixture BANK-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Incremental window, dedupe, freshness en provider errors zijn zichtbaar. en alle childuitkomsten zijn consistent. |
| TC-US-1004-A | US-1004-A | contract/integration — atomic | Given fixture BANK-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Balance snapshot bevat account, currency, as-of en provider id. |
| TC-US-1004-B | US-1004-B | contract/integration — atomic | Given fixture BANK-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Transactions gebruiken cursor/window, dedupe en normalization. |
| TC-US-1005 | US-1005 | contract/integration — Epic contract | Given fixture BANK-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Requisition/OAuth revoke, local secret cleanup en disconnected status zijn aantoonbaar. en alle childuitkomsten zijn consistent. |
| TC-US-1005-A | US-1005-A | contract/integration — atomic | Given fixture BANK-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Provider revoke wordt aangeroepen en status wordt revoked. |
| TC-US-1005-B | US-1005-B | contract/integration — atomic | Given fixture BANK-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Secret reference wordt revoked en lokale tokenmateriaal is niet meer bruikbaar. |
| TC-US-1006 | US-1006 | contract/integration — Acceptance | Given fixture BANK-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Deployment gate controleert scopes, redirect URI, legal decision en read-only permissions. |
| TC-US-1007 | US-1007 | contract/integration — Acceptance | Given fixture BANK-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Expired status behoudt historische data en vraagt een nieuwe authorization zonder dubbeltelling. |
### Slice 11

| Test-ID | Story | Level | Given / When / Then |
|---|---|---|---|
| TC-US-1101 | US-1101 | E2E — Epic contract | Given fixture REPORT-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Report run is as-of, versioned, statusbaar en source-traceable. en alle childuitkomsten zijn consistent. |
| TC-US-1101-A | US-1101-A | E2E — atomic | Given fixture REPORT-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Run krijgt period, filters, source version en queued status. |
| TC-US-1101-B | US-1101-B | E2E — atomic | Given fixture REPORT-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Artifact key, format, status en expiry zijn beschikbaar. |
| TC-US-1102 | US-1102 | E2E — Acceptance | Given fixture REPORT-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Export respecteert filters, privacy scope en geldige locale/currency formatting. |
| TC-US-1103 | US-1103 | E2E — Epic contract | Given fixture REPORT-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Report gebruikt ledger/source data en markeert schattingen. en alle childuitkomsten zijn consistent. |
| TC-US-1103-A | US-1103-A | E2E — atomic | Given fixture REPORT-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Dividend, interest, tax en source activities zijn traceerbaar. |
| TC-US-1103-B | US-1103-B | E2E — atomic | Given fixture REPORT-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Open/closed selection en transaction filters zijn reproduceerbaar. |
| TC-US-1104 | US-1104 | E2E — Acceptance | Given fixture REPORT-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Target amount/date, expected return, contribution en status zijn configureerbaar. |
| TC-US-1105 | US-1105 | E2E — Epic contract | Given fixture REPORT-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Funding percentages totaliseren maximaal 100% en balance is share-weighted. en alle childuitkomsten zijn consistent. |
| TC-US-1105-A | US-1105-A | E2E — atomic | Given fixture REPORT-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Account shares valideren per goal en totaliseren maximaal 100%. |
| TC-US-1105-B | US-1105-B | E2E — atomic | Given fixture REPORT-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Balance is share-weighted uit gekoppelde account/projecties. |
| TC-US-1105-UX | US-1105 | unit + browser — Goals funding UX | Given de Goals / Financier je doel vanuit accounts-route; when de gebruiker funding voorbereidt, valideert, opslaat en tussen Goals-modules navigeert; then informatiehiërarchie, target-overzicht, loading/error/success states, inline trace/correlation-evidence, keyboard/touch-targets en klikbare moduleflows zijn bruikbaar zonder browserconsole-errors. |
| TC-US-1106 | US-1106 | E2E — Epic contract | Given fixture REPORT-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Scheduled-only, budget-only en combined forecast geven assumptions en result. en alle childuitkomsten zijn consistent. |
| TC-US-1106-A | US-1106-A | E2E — atomic | Given fixture REPORT-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Scheduled-only scenario werkt met horizon en due dates. |
| TC-US-1106-B | US-1106-B | E2E — atomic | Given fixture REPORT-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Budget-only en combined scenario’s bewaren assumptions. |
| TC-US-1107 | US-1107 | E2E — Acceptance | Given fixture REPORT-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Scope, expiry, revoke en audit zijn verplicht. |
### Slice 12

| Test-ID | Story | Level | Given / When / Then |
|---|---|---|---|
| TC-US-1201 | US-1201 | unit + integration — Epic contract | Given fixture ANALYTICS-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Metrics tonen periode, benchmark/risk-free assumptions en calculation version. en alle childuitkomsten zijn consistent. |
| TC-US-1201-A | US-1201-A | unit + integration — atomic | Given fixture ANALYTICS-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Period, observations, missing-data rule en calculation version zijn zichtbaar. |
| TC-US-1201-B | US-1201-B | unit + integration — atomic | Given fixture ANALYTICS-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Benchmark/risk-free inputs en annualization rule zijn zichtbaar. |
| TC-US-1201-UX | US-1201 | unit + browser — Performance UX | Given de Performance / Risk & benchmark route; when de gebruiker navigeert, rekent en module-controls gebruikt; then Portfolio-filters lekken niet door, page/module labels zijn contextueel, risk evidence toont trace/correlation-ID’s en de browserconsole blijft foutvrij. |
| TC-US-1202 | US-1202 | unit + integration — Acceptance | Given fixture ANALYTICS-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Bijdrage per holding/category totaliseert volgens vastgelegde portfolio-methodiek. |
| TC-US-1203 | US-1203 | unit + integration — Acceptance | Given fixture ANALYTICS-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Look-through source, as-of date en unresolved holdings zijn zichtbaar. |
| TC-US-1204 | US-1204 | unit + integration — Acceptance | Given fixture ANALYTICS-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Targets per asset class, sector, region, currency en holding kunnen worden opgeslagen. |
| TC-US-1205 | US-1205 | unit + integration — Acceptance | Given fixture ANALYTICS-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Suggestie toont current, target, drift, benodigde cash en trade assumptions. |
| TC-US-1206 | US-1206 | unit + integration — Acceptance | Given fixture ANALYTICS-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Allocation, performance, risk en periodeselectie zijn consistent berekend. |
| TC-US-1207 | US-1207 | unit + integration — Epic contract | Given fixture ANALYTICS-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Scenario assumptions, input prices, costs en output worden versioned opgeslagen. en alle childuitkomsten zijn consistent. |
| TC-US-1207-A | US-1207-A | unit + integration — atomic | Given fixture ANALYTICS-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Scenario bewaart changed allocation, assumptions en output version. |
| TC-US-1207-B | US-1207-B | unit + integration — atomic | Given fixture ANALYTICS-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Price series, costs, cashflows en result zijn reproduceerbaar. |
| TC-US-1208 | US-1208 | unit + integration — Acceptance | Given fixture ANALYTICS-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Filters op fundamentals, performance, target en alerts kunnen worden opgeslagen. |
### Slice 13

| Test-ID | Story | Level | Given / When / Then |
|---|---|---|---|
| TC-US-1301 | US-1301 | unit + golden — Acceptance | Given fixture TAX-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Lot bevat acquisition date, quantity, cost basis, fees, currency en holding period. |
| TC-US-1302 | US-1302 | unit + golden — Epic contract | Given fixture TAX-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Zelfde fixture levert methode-specifieke, reproduceerbare disposals op. en alle childuitkomsten zijn consistent. |
| TC-US-1302-A | US-1302-A | unit + golden — atomic | Given fixture TAX-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Selected method is versioned en wordt op nieuwe disposal toegepast. |
| TC-US-1302-B | US-1302-B | unit + golden — atomic | Given fixture TAX-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Zelfde input toont FIFO/LIFO/WAC/HIFO/specific-ID verschillen. |
| TC-US-1303 | US-1303 | unit + golden — Epic contract | Given fixture TAX-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Proceeds, cost basis, fees, FX-resultaat en taxable result zijn apart zichtbaar. en alle childuitkomsten zijn consistent. |
| TC-US-1303-A | US-1303-A | unit + golden — atomic | Given fixture TAX-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Proceeds en cost basis in transaction currency zijn zichtbaar. |
| TC-US-1303-B | US-1303-B | unit + golden — atomic | Given fixture TAX-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Historical versus disposal FX component is apart berekend. |
| TC-US-1304 | US-1304 | unit + golden — Acceptance | Given fixture TAX-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Tax year/jurisdiction configuration bepaalt de periode en output. |
| TC-US-1305 | US-1305 | unit + golden — Acceptance | Given fixture TAX-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Loss, estimated saving, long-term status en rationale zijn zichtbaar. |
| TC-US-1306 | US-1306 | unit + golden — Acceptance | Given fixture TAX-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Relevant window, related instrument en confidence/status worden getoond. |
| TC-US-1307 | US-1307 | unit + golden — Acceptance | Given fixture TAX-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Ruleset, version, disclaimer en owner scope zijn vastgelegd; geen algemeen fiscaal advies. |
### Slice 14

| Test-ID | Story | Level | Given / When / Then |
|---|---|---|---|
| TC-US-1401 | US-1401 | unit + scenario — Epic contract | Given fixture SPECIAL-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Issuer, coupon, frequency, maturity, currency en cashflows zijn beschikbaar. en alle childuitkomsten zijn consistent. |
| TC-US-1401-A | US-1401-A | unit + scenario — atomic | Given fixture SPECIAL-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Issuer, coupon, frequency, maturity en currency zijn valideerbaar. |
| TC-US-1401-B | US-1401-B | unit + scenario — atomic | Given fixture SPECIAL-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Coupon/principal schedule levert dated cashflows op. |
| TC-US-1401-UX | US-1401 | unit + browser — Analytics bond profiles UX | Given de Analytics / Bondprofielen & cashflows-route; when de gebruiker module-overview, reset, synthetic fixture en cashflow generation gebruikt; then page hierarchy, KPI-overview, tabelalternatief, explicit states, touch targets, trace/correlation-evidence en browserconsole zijn foutvrij. |
| TC-US-1402 | US-1402 | unit + scenario — Epic contract | Given fixture SPECIAL-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then YTM, dirty price, accrued interest, duration, convexity en DV01 gebruiken versioned assumptions. en alle childuitkomsten zijn consistent. |
| TC-US-1402-A | US-1402-A | unit + scenario — atomic | Given fixture SPECIAL-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Given price/coupon/maturity levert calculation versioned output. |
| TC-US-1402-B | US-1402-B | unit + scenario — atomic | Given fixture SPECIAL-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Metrics gebruiken dezelfde yield curve en scenario assumptions. |
| TC-US-1402-UX | US-1402 | unit + browser — Bond pricing UX | Given de Analytics / Bondprijs & yield metrics-module; when de gebruiker fixture voorbereidt en metrics berekent; then contextuele labels, versioned assumptions, read-only status en trace/correlation-evidence zijn zichtbaar zonder browserconsole-errors. |
| TC-US-1403 | US-1403 | unit + scenario — Acceptance | Given fixture SPECIAL-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Curve observations en parallel shifts produceren reproduceerbare scenario-output. |
| TC-US-1403-UX | US-1403 | unit + browser — Bond scenarios UX | Given de Analytics / Yield curve & rate scenarios-module; when de gebruiker fixture voorbereidt en een parallel shift uitvoert; then contextuele modulelabels, read-only result, assumptions en trace/correlation-evidence zijn zichtbaar zonder browserconsole-errors. |
| TC-US-1404 | US-1404 | unit + scenario — Acceptance | Given fixture SPECIAL-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Underlying, strike, expiry, multiplier, IV en Greeks hebben lifecycle/status. |
| TC-US-1404-UX | US-1404 | unit + browser — Option contracts UX | Given de Actions / Option contracts & Greeks-route en de canonieke UX-regels; when de gebruiker contracten filtert/reset, een synthetische fixture voorbereidt en Greeks berekent; then de page hierarchy, tabelalternatief, loading/empty/error states, trace/correlation-evidence, keyboard focus en semantische lifecycle-status zijn zichtbaar zonder browserconsole-errors. |
| TC-US-1405 | US-1405 | unit + scenario — Epic contract | Given fixture SPECIAL-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Elke lifecycle event werkt door naar positions, cash, cost basis en audit. en alle childuitkomsten zijn consistent. |
| TC-US-1405-A | US-1405-A | unit + scenario — atomic | Given fixture SPECIAL-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then OPEN event creëert contract quantity en premium/cost basis. |
| TC-US-1405-B | US-1405-B | unit + scenario — atomic | Given fixture SPECIAL-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then CLOSE/ROLL koppelt bron- en doelcontract en berekent P&L. |
| TC-US-1405-C | US-1405-C | unit + scenario — atomic | Given fixture SPECIAL-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Lifecycle event werkt door naar underlying, cash en audit trail. |
| TC-US-1406 | US-1406 | unit + scenario — Acceptance | Given fixture SPECIAL-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Put, assigned shares, covered call, roll en called-away events zijn gekoppeld. |
| TC-US-1407 | US-1407 | unit + scenario — Acceptance | Given fixture SPECIAL-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Instrumenttype, valuation source, currency en manual/provider valuation zijn expliciet. |
| TC-US-1408 | US-1408 | unit + scenario — Epic contract | Given fixture SPECIAL-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Taxes, inflation, Monte Carlo, sensitivity en sequence-of-returns assumptions zijn versioned. en alle childuitkomsten zijn consistent. |
| TC-US-1408-A | US-1408-A | unit + scenario — atomic | Given fixture SPECIAL-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Contributions, return, inflation, taxes en horizon zijn opgeslagen. |
| TC-US-1408-B | US-1408-B | unit + scenario — atomic | Given fixture SPECIAL-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Iterations, seed, distributions en result zijn reproduceerbaar opgeslagen. |
| TC-US-1408-C | US-1408-C | unit + scenario — atomic | Given fixture SPECIAL-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Scenario-output toont aannames en failure probability per variant. |
### Slice 15

| Test-ID | Story | Level | Given / When / Then |
|---|---|---|---|
| TC-US-1501 | US-1501 | E2E/security — Acceptance | Given fixture PWA-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Access id, scope, exposure policy, expiry en revoke werken server-side. |
| TC-US-1502 | US-1502 | E2E/security — Acceptance | Given fixture PWA-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Restricted View geeft percentages/relative data zonder monetary values. |
| TC-US-1503 | US-1503 | E2E/security — Acceptance | Given fixture PWA-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Scope, expiry, audit en immediate revoke zijn getest. |
| TC-US-1504 | US-1504 | E2E/security — Epic contract | Given fixture PWA-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Core portfolio, dividends, Money Flow en import flows werken op mobile viewport. en alle childuitkomsten zijn consistent. |
| TC-US-1504-A | US-1504-A | E2E/security — atomic | Given fixture PWA-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Navigation, portfolio table en position detail zijn responsive. |
| TC-US-1504-B | US-1504-B | E2E/security — atomic | Given fixture PWA-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Preview, row review en commit controls zijn bruikbaar zonder horizontale overflow. |
| TC-US-1505 | US-1505 | E2E/security — Epic contract | Given fixture PWA-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Cache is encrypted/expirable; conflicts en stale data worden expliciet gemarkeerd. en alle childuitkomsten zijn consistent. |
| TC-US-1505-A | US-1505-A | E2E/security — atomic | Given fixture PWA-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Cache is encrypted, scoped en voorzien van freshness timestamp. |
| TC-US-1505-B | US-1505-B | E2E/security — atomic | Given fixture PWA-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then UI toont offline/stale indicator en blokkeert onveilige writes. |
| TC-US-1506 | US-1506 | E2E/security — Epic contract | Given fixture PWA-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Consent, channel preference, delivery failure en revoke zijn traceerbaar. en alle childuitkomsten zijn consistent. |
| TC-US-1506-A | US-1506-A | E2E/security — atomic | Given fixture PWA-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Channel permission en revoke worden opgeslagen en getest. |
| TC-US-1506-B | US-1506-B | E2E/security — atomic | Given fixture PWA-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Notification bevat event, channel, status en delivery failure. |
### Slice 16

| Test-ID | Story | Level | Given / When / Then |
|---|---|---|---|
| TC-US-1601 | US-1601 | contract/security — Epic contract | Given fixture AI-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Assistant antwoordt met source period, confidence en gebruikte read scopes. en alle childuitkomsten zijn consistent. |
| TC-US-1601-A | US-1601-A | contract/security — atomic | Given fixture AI-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Answer citeert period/data-as-of en gebruikt geen mutation tool. |
| TC-US-1601-B | US-1601-B | contract/security — atomic | Given fixture AI-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Answer respecteert account scope en categorieprivacy. |
| TC-US-1601-UX | US-1601 | unit + browser — Money Flow questions UX | Given de Money Flow / Vragen-route en de canonieke UX-regels; when de gebruiker domein, periode, data-as-of, fixture, vraag, reset en mobiele navigatie gebruikt; then de page hierarchy, empty/error states, tabelalternatief, read-only trace/correlation-evidence en browserconsole zijn foutvrij. |
| TC-US-1602 | US-1602 | contract/security — Acceptance | Given fixture AI-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Provider key blijft in vault; model/provider wordt per session zichtbaar en revokeable. |
| TC-US-1603 | US-1603 | contract/security — Acceptance | Given fixture AI-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Assistant maakt preview; ledger wordt niet gewijzigd zonder Confirm. |
| TC-US-1604 | US-1604 | contract/security — Acceptance | Given fixture AI-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Proposal toont diff, scope, impact en undo token; Confirm/Cancel is auditbaar. |
| TC-US-1605 | US-1605 | contract/security — Acceptance | Given fixture AI-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Restricted View, View, Propose en Manage geven alleen hun bedoelde capabilities. |
| TC-US-1606 | US-1606 | contract/security — Epic contract | Given fixture AI-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Manifest, permissions, secrets, events en assets zijn geïsoleerd en revokeable. en alle childuitkomsten zijn consistent. |
| TC-US-1606-A | US-1606-A | contract/security — atomic | Given fixture AI-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Name, version, permissions en entrypoints voldoen aan schema. |
| TC-US-1606-B | US-1606-B | contract/security — atomic | Given fixture AI-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Sandbox start/stop en grants worden geaudit. |
| TC-US-1607 | US-1607 | contract/security — Epic contract | Given fixture AI-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then SDK contracttest voorkomt toegang buiten granted scopes. en alle childuitkomsten zijn consistent. |
| TC-US-1607-A | US-1607-A | contract/security — atomic | Given fixture AI-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then SDK contracttest voorkomt scope-overschrijding. |
| TC-US-1607-B | US-1607-B | contract/security — atomic | Given fixture AI-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Alleen granted events worden geleverd en kunnen worden ingetrokken. |
| TC-US-1608 | US-1608 | contract/security — Acceptance | Given fixture AI-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Public/private boundary, moderation en deletion/export zijn server-side afgedwongen. |
### Slice 17

| Test-ID | Story | Level | Given / When / Then |
|---|---|---|---|
| TC-US-1701 | US-1701 | chaos/operations — Epic contract | Given fixture OPS-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Fingerprint, severity, release, service en correlation data worden gegroepeerd. en alle childuitkomsten zijn consistent. |
| TC-US-1701-A | US-1701-A | chaos/operations — atomic | Given fixture OPS-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Zelfde oorzaak binnen grouping window maakt geen tweede incident. |
| TC-US-1701-B | US-1701-B | chaos/operations — atomic | Given fixture OPS-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Incident bevat severity, service, environment en release. |
| TC-US-1702 | US-1702 | chaos/operations — Epic contract | Given fixture OPS-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Logs, traces, metrics, deploys, migrations, runbooks en PII-redaction zijn gekoppeld. en alle childuitkomsten zijn consistent. |
| TC-US-1702-A | US-1702-A | chaos/operations — atomic | Given fixture OPS-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Evidence verwijst naar redacted exemplars met correlation ID. |
| TC-US-1702-B | US-1702-B | chaos/operations — atomic | Given fixture OPS-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Release, commit, image digest en migration result zijn gekoppeld. |
| TC-US-1703 | US-1703 | chaos/operations — Acceptance | Given fixture OPS-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Hypothesis bevat confidence, affected path, invariant en voorgestelde regression test. |
| TC-US-1704 | US-1704 | chaos/operations — Acceptance | Given fixture OPS-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Test faalt op de oude commit en slaagt na de kleinste fix. |
| TC-US-1705 | US-1705 | chaos/operations — Epic contract | Given fixture OPS-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Verifier werkt met fresh context en kan PR/release blokkeren. en alle childuitkomsten zijn consistent. |
| TC-US-1705-A | US-1705-A | chaos/operations — atomic | Given fixture OPS-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Verifier rapporteert pass/fail en ontbrekende tests onafhankelijk. |
| TC-US-1705-B | US-1705-B | chaos/operations — atomic | Given fixture OPS-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Findings hebben severity, evidence, owner en blocking status. |
| TC-US-1706 | US-1706 | chaos/operations — Epic contract | Given fixture OPS-001 en alle child-contracten groen; when de volledige slice-contracttest draait; then Commit SHA, image digest, SBOM, migration result en Coolify development evidence matchen exact. en alle childuitkomsten zijn consistent. |
| TC-US-1706-A | US-1706-A | chaos/operations — atomic | Given fixture OPS-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Commit, image digest, SBOM en Coolify development result matchen. |
| TC-US-1706-B | US-1706-B | chaos/operations — atomic | Given fixture OPS-001 met alleen de benodigde data; when de childhandeling wordt uitgevoerd; then Window controleert API, worker, DB, integration en product-SLO metrics. |
| TC-US-1707 | US-1707 | chaos/operations — Acceptance | Given fixture OPS-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Alleen policy-approved image/schema combinations mogen rollbacken; data restore staat apart. |
| TC-US-1708 | US-1708 | chaos/operations — Acceptance | Given fixture OPS-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Root cause, impact, timeline, fix, test, release en prevention item zijn verplicht. |
| TC-US-1709 | US-1709 | chaos/operations — Acceptance | Given fixture OPS-001 met de minimale geldige beginsituatie; when de actor de beschreven handeling uitvoert; then Skill change gaat door review, security scan en test voordat hij actief wordt. |
## Cross-cutting release-gates

Deze tests zijn aanvullend op de story-traceability en blokkeren iedere web-facing release:

| Test-ID | Scenario | Verwachting |
|---|---|---|
| TC-X-001 | Tenant-isolatie | User A kan geen portfolio, raw payload, report, grant, secret reference of Money Flow-data van User B lezen of muteren. |
| TC-X-002 | Authorization matrix | Owner/editor/viewer/accountant/advisor en revoked/expired links krijgen exact de bedoelde server-side rechten. |
| TC-X-003 | Idempotency/replay | Dezelfde provider activity, import batch, bank cursor en webhook meerdere keren verwerken verandert de eindstand slechts één keer. |
| TC-X-004 | Auditability | Login, permission change, secret access, share, export, revoke, proposal confirm/cancel en incident changes hebben actor, timestamp, scope en correlation ID. |
| TC-X-005 | Secret and PII redaction | Secrets, tokens, rekeningnummers en transactieomschrijvingen verschijnen niet in logs, traces, errors, artifacts of screenshots. |
| TC-X-006 | Backup/restore | PostgreSQL, object storage en audit/ledger data herstellen in een sandbox en geven dezelfde balances, projections en report totals. |
| TC-X-007 | Financial invariant regression | Cash, quantity, cost basis, transfers, FX, income, tax, split en calculation-version invariants blijven groen na iedere migratie. |
| TC-X-008 | Import atomicity | Eén blocking importfout commit geen enkele ledgermutation; correction, retry, undo en void blijven auditable. |
| TC-X-009 | Provider resilience | Timeouts, 401/403, 429, malformed payloads en revoked consent leveren veilige status, bounded retry en incident evidence. |
| TC-X-010 | AI mutation safety | Assistant en addons kunnen alleen granted read scopes gebruiken; writes vereisen preview, expliciete Confirm, audit en undo-token. |
| TC-X-011 | Release integrity | Commit SHA, image digest, SBOM, migration result en Coolify development evidence horen bij hetzelfde artifact voordat productie wordt geactiveerd. |
| TC-X-012 | Production health window | API, worker, database, integrations, product-SLO's, error rate en rollback signaleren binnen de afgesproken window correct. |

## Definition of Test Done

Een storytest is pas done wanneer de test reproduceerbaar is in CI, de synthetische fixture versioned is, de verwachte uitkomst expliciet is, negatieve paden waar relevant zijn afgedekt, evidence is opgeslagen en de test aan de juiste release gate is gekoppeld.

### US-0802 / US-0803 — echte Trading 212-adapter (20 oktober 2026)

| Test | Story | Dekking | Acceptatie |
|---|---|---|---|
| TC-US-0802-live | US-0802 | unit | AES-GCM ciphertext onthult geen credentials; owner/connection-binding en tag-tampering worden gecontroleerd; scrypt accepteert uitsluitend het juiste wachtwoord. |
| TC-US-0802-settings | US-0802 | unit + GUI | Settings opent Trading 212, passwordvelden starten leeg, login blijft behouden na reload, secrets worden na submit gewist, status en ontkoppelen werken. |
| TC-US-0802-live-auth | US-0802 | runtime | Broker-owner kan niet via passwordless demo-login/OIDC worden geïmpersoneerd; broker-token werkt uitsluitend op de broker-boundary. |
| TC-US-0803-live | US-0803 | unit/contract | Alleen GET, vaste hosts, Basic-auth en tracecontext; alle pagina's, order/fill-identiteiten, 401/403/429, schema drift, onveilige paginalinks, revoke vóór volgend request en retry-reset zijn getest met synthetische responses. |
| TC-US-0803-live-runtime | US-0803 | geïsoleerde integration + GUI | Duurzame job, owner-isolatie, advisory lock, crash-reclaim, idempotente replay, transactionele snapshot/checkpoint, revoke tijdens run, audit en ongewijzigde ledger; echte provider wordt nooit aangeroepen door tests. |
