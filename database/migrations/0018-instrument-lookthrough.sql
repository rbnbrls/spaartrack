-- Expand migration: versioned ETF look-through sources; no ledger tables are changed.
BEGIN;

CREATE TABLE IF NOT EXISTS spaartrack.instrument_lookthrough_component (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etf_instrument_id uuid NOT NULL REFERENCES spaartrack.instrument(id) ON DELETE CASCADE,
  underlying_instrument_id uuid REFERENCES spaartrack.instrument(id) ON DELETE SET NULL,
  underlying_name text NOT NULL,
  weight numeric(12, 8) NOT NULL CHECK (weight >= 0 AND weight <= 1),
  resolution_status text NOT NULL CHECK (resolution_status IN ('RESOLVED', 'UNRESOLVED')),
  source text NOT NULL,
  source_version text NOT NULL,
  as_of date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((resolution_status = 'RESOLVED' AND underlying_instrument_id IS NOT NULL) OR (resolution_status = 'UNRESOLVED' AND underlying_instrument_id IS NULL))
);

CREATE INDEX IF NOT EXISTS instrument_lookthrough_lookup_idx
  ON spaartrack.instrument_lookthrough_component (etf_instrument_id, as_of DESC, source_version);

COMMIT;
