# ADR-0001: modulaire monoliet met asynchrone workers

## Status

Accepted

## Besluit

Spaartrack gebruikt één repository en één transactionele PostgreSQL-database met harde modulegrenzen. Imports, broker-sync, marktdata, rapportages, notificaties en agentjobs draaien in workers.

## Bounded contexts (US-0001)

| Context | Verantwoordelijkheid | Primaire boundary |
|---|---|---|
| Ledger | accounts, securities, currencies, actions, idempotency, correction/void, replay | canonical `ledger_transaction`/`ledger_entry` application commands |
| Integrations | provider registry, broker/bank sync, import safety, reconciliation | `packages/integration-contracts` adapters, review/commit/undo |
| Market Data | currencies, FX-rates, prices, security identity, corporate actions | versioned calculation kernel, read-only observations |
| Income | dividends, interest, forecasts, calendar, alerts | `income_event` + metrics projections |
| Performance | TWR, MWRR/IRR, Modified Dietz, CAGR, ROAI, benchmarks | versioned formulas over snapshots + ledger cashflows |
| Money Flow | income, spending, saving, budgets, interne-transfer-neutraliteit | read-only projection over opt-in account scope |
| Tax | lots, taxable income, worksheets, exports | jurisdictioneel begrensde projections |
| Reporting | snapshots, PDF/CSV/XLSX, accountant sharing | rebuildable report runs |
| AI | assistant, proposals, categorisatie, scenario's | expliciete scopes, Confirm/Cancel, audit trail |
| Operations | health, audit, incidents, deployments, backups, feature flags | operationele tabellen, nooit ledger-mutatie |

Non-goals: directe ledger-writes buiten application commands; gedeelde tabellen tussen modules; synchrone provider-calls in requestpad.

## Consequenties

- financiële invariants blijven transactioneel controleerbaar;
- vroege operationele complexiteit van microservices wordt vermeden;
- modules spreken via application services/events en niet via elkaars tabellen;
- horizontale schaal kan later per worker type worden toegevoegd.
