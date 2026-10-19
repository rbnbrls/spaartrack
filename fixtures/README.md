# Synthetische fixtures

Fixtures zijn versieerbare, niet-gevoelige input voor unit, contract, integration, golden en E2E tests. Voeg nooit echte bank- of brokerdata toe.

Versioned als `FIXTURE-*.json` met `fixture_id`, semver `version` en synthetische `description`: ENV-001 (disposable omgeving), SEC-001 (identiteit/rollen/sessies), LEDGER-001 (canonieke ledger-acties), CALC-001 (golden kernel), UI-001 (viewport), IMPORT-001 (CSV-rows), PERF-001 (perioden), PROVIDER-001-degiro (broker-responses), SPECIAL-001 (specialistische instrumenten), BANK-001 (bank-sync/consent), TAX-001 (lots/jurisdicties), OPS-001 (incidents/evidence). Alle packs zijn beschreven in test-cases.md.
