# Spaartrack database model

`schema.sql` is het eerste canonical PostgreSQL-model voor Spaartrack.

## Modelprincipes

- `ledger_transaction` en `ledger_entry` zijn de financiële bron van waarheid.
- Posities, performance, risk, Money Flow en rapportages zijn afleidbaar en opnieuw op te bouwen.
- Providerdata wordt eerst opgeslagen in `raw_provider_payload` en daarna genormaliseerd.
- Integraties gebruiken `external_connection`, `provider_account`, `sync_run` en `sync_checkpoint`.
- Imports gebruiken een preview/review/commit/undo-lifecycle.
- `POSTED`, `PENDING`, `DRAFT` en `VOID` houden mutaties auditbaar zonder records fysiek te verwijderen.
- Tax lots en lot disposals ondersteunen FIFO, LIFO, WAC, HIFO en specific identification.
- Money Flow gebruikt dezelfde ledger maar voegt categorieën, payees, regels, budgets en transfersemantiek toe.
- AI, addons en agenten krijgen scopes en schrijven alleen via application commands; directe productiedatabase-mutaties zijn niet toegestaan.

## Domeinindeling

| Schemaonderdeel | Tabellen |
|---|---|
| Identity | `app_user`, `auth_identity`, `user_session`, `user_preference` |
| Providers | `provider`, `external_connection`, `provider_account`, `sync_run`, `raw_provider_payload` |
| Portfolio | `portfolio`, `portfolio_member`, `financial_account`, `instrument`, `exchange`, `currency` |
| Ledger | `ledger_transaction`, `ledger_entry`, `tax_lot`, `tax_lot_disposal` |
| Market/income | `instrument_price`, `fx_rate`, `corporate_action`, `income_event`, `dividend_forecast` |
| Analytics | `portfolio_snapshot`, `position_snapshot`, `performance_observation`, `risk_metric_snapshot` |
| Imports | `import_file`, `import_session`, `import_row_review`, `import_mapping`, `reconciliation_issue` |
| Money Flow | `category`, `payee`, `transaction_rule`, `budget_plan`, `scheduled_transaction`, `cashflow_forecast` |
| Tax/reporting | `tax_worksheet`, `tax_loss_harvest_candidate`, `report_run`, `portfolio_share_link` |
| Specialistisch | `bond_profile`, `yield_curve_observation`, `option_contract`, `option_lifecycle_event`, scenarios |
| AI/platform | `alert_rule`, `notification`, `addon_manifest`, `ai_access_grant`, `ai_action_proposal`, device tables |
| Operations | `audit_log`, `deployment_release`, `incident`, `incident_event`, `agent_run`, `backup_snapshot` |

## Initialiseren

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/schema.sql
```

Het schema seedt alleen basisvaluta’s. Providers, demo-users, permissions en instrumenten horen via versieerbare application seeds of migrations te worden toegevoegd.

## Volgende migrations

1. Voeg row-level security toe zodra de applicatie-authenticatie is geïmplementeerd.
2. Voeg een echte double-entry balancing constraint toe zodra de precieze debit/credit-semantiek per activity type is vastgelegd.
3. Maak projection rebuild jobs voor snapshots, positions, performance en Money Flow.
4. Voeg partitionering toe voor `ledger_transaction`, `ledger_entry`, `instrument_price`, `fx_rate` en `audit_log` wanneer volume dit rechtvaardigt.
5. Voeg provider-specifieke migrations alleen toe aan adapter-owned tabellen; wijzig de canonical ledger niet per provider.
