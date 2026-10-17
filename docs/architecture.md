# Spaartrack solution architecture

Spaartrack start als modulaire monoliet met asynchrone workers:

    web/PWA -> API -> application services -> bounded contexts -> PostgreSQL ledger
                                          -> Redis jobs -> worker
    provider adapters/imports -> raw payload -> normalizer -> review -> ledger command
    API/worker -> OpenTelemetry -> collector -> Prometheus/Grafana

Bounded contexts:

- Identity & Access
- Ledger
- Portfolio
- Market Data
- Income & Performance
- Integrations
- Money Flow
- Tax & Reporting
- Notifications
- AI & Addons
- Operations

database/schema.sql is de eerste canonical persistence-laag. database/README.md bevat de modelprincipes en vervolgmigrations.
