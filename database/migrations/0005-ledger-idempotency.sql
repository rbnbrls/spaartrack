-- Expand: make ledger idempotency explicit for local/import/provider actions.
-- Existing source-connection uniqueness remains backward compatible.
CREATE UNIQUE INDEX IF NOT EXISTS ledger_transaction_account_external_id_idx
  ON spaartrack.ledger_transaction (financial_account_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ledger_transaction_account_external_hash_idx
  ON spaartrack.ledger_transaction (financial_account_id, external_hash)
  WHERE external_hash IS NOT NULL;
