BEGIN;

CREATE TABLE IF NOT EXISTS spaartrack.instrument_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES spaartrack.provider(id) ON DELETE CASCADE,
  provider_symbol text NOT NULL,
  instrument_id uuid REFERENCES spaartrack.instrument(id) ON DELETE SET NULL,
  identifier_type text CHECK (identifier_type IN ('ISIN', 'CUSIP')),
  identifier_value text,
  status text NOT NULL DEFAULT 'UNRESOLVED' CHECK (status IN ('UNRESOLVED', 'RESOLVED', 'REJECTED')),
  created_by uuid REFERENCES spaartrack.app_user(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, provider_symbol)
);

ALTER TABLE spaartrack.instrument_mapping ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
CREATE INDEX IF NOT EXISTS instrument_mapping_status_idx
  ON spaartrack.instrument_mapping (status, created_at DESC);

COMMIT;
