-- Expand migration: portfolio allocation targets; canonical ledger is untouched.
BEGIN;

CREATE TABLE IF NOT EXISTS spaartrack.allocation_target (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES spaartrack.portfolio(id) ON DELETE CASCADE,
  dimension text NOT NULL CHECK (dimension IN ('ASSET_CLASS', 'SECTOR', 'REGION', 'CURRENCY', 'HOLDING')),
  target_key text NOT NULL,
  target_label text NOT NULL,
  target_percentage numeric(7, 4) NOT NULL CHECK (target_percentage >= 0 AND target_percentage <= 100),
  calculation_version text NOT NULL DEFAULT 'allocation-targets-v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portfolio_id, dimension, target_key)
);

CREATE INDEX IF NOT EXISTS allocation_target_portfolio_dimension_idx
  ON spaartrack.allocation_target (portfolio_id, dimension, target_key);

COMMIT;
