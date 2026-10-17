# Migrations

database/schema.sql is de initialisatie voor een lege lokale database. Nieuwe wijzigingen komen als genummerde, idempotente expand/contract migrations in deze map.

Regels:

1. Eén migration heeft een backward-compatible up-pad.
2. Voeg bij iedere migration een dry-run en rollback/recovery-notitie toe.
3. Geen destructive migration zonder backup point, restore test en human approval.
4. Providers mogen adapter-owned tabellen uitbreiden, maar wijzigen geen canonical ledger-semantiek.

De eerste application migration wordt aangemaakt zodra de migratierunner is gekozen; de Compose-bootstrap gebruikt voorlopig database/schema.sql.
