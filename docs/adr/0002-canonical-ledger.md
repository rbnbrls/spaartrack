# ADR-0002: canonical ledger als bron van waarheid

## Status

Accepted

## Besluit

ledger_transaction en ledger_entry zijn de financiële bron van waarheid. Portfolio, performance, tax, Money Flow en rapportage zijn rebuildable projections.

## Consequenties

- connectoren en AI krijgen geen directe ledger-write;
- corrections en voids behouden auditability;
- idempotency, replay en restore worden release gates;
- dashboard-state mag nooit de financiële waarheid overschrijven.
