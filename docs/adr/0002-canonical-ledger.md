# ADR-0002: canonical ledger als bron van waarheid

## Status

Accepted

## Besluit

ledger_transaction en ledger_entry zijn de financiële bron van waarheid. Portfolio, performance, tax, Money Flow en rapportage zijn rebuildable projections.

## Financiële invariants (US-0002, TC-US-0002 / TC-US-0002-A/B/C)

Testbare regels; elke regel heeft een contracttest in `tests/smoke/ledger-*.test.mjs`:

- **cash:** alleen POSTED entries tellen; DEBIT verlaagt, CREDIT verhoogt; geen negatieve cash zonder expliciete loan-account.
- **quantity:** BUY verhoogt, SELL verlaagt; quantity nooit negatief zonder short-flag; splits schalen quantity/cost-basis idempotent.
- **cost basis:** FIFO/WAC-baseline; fees/taxes alloceren op partial sells; rounding naar 12 decimalen intern, 2 extern.
- **transfers:** paired TRANSFER_OUT/TRANSFER_IN met wederzijdse `paired_transaction_id`; `is_external_flow=false`, dus contribution/spending-neutraal.
- **FX:** rate heeft pair, timestamp, source en versie; ontbrekende/inverse rate geeft `404 FX_RATE_NOT_FOUND`, nooit stille fallback.
- **idempotency:** `external_id` of deterministische account-scoped hash; duplicate retourneert bestaande record; conflict geeft `409`.

## Consequenties

- connectoren en AI krijgen geen directe ledger-write;
- corrections en voids behouden auditability;
- idempotency, replay en restore worden release gates;
- dashboard-state mag nooit de financiële waarheid overschrijven.

## Architecture contract clarification

For the US-0001 contract, reusing the same identity from a different connection/source returns the original transaction and entries when the normalized command is identical; otherwise it returns `409 IDEMPOTENCY_KEY_CONFLICT`. Reusing the same identity in another account is valid and independent. The provider connection/source is provenance, not a uniqueness dimension.
