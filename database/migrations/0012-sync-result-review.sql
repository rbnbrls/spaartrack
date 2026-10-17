CREATE TABLE IF NOT EXISTS spaartrack.sync_result_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id uuid NOT NULL REFERENCES spaartrack.sync_run(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES spaartrack.external_connection(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('NEW', 'UPDATED', 'DUPLICATE', 'REJECTED', 'ATTENTION')),
  posting_status text NOT NULL DEFAULT 'NOT_POSTED' CHECK (posting_status IN ('NOT_POSTED', 'POSTING_REVIEW', 'POSTED', 'VOID')),
  review_decision text CHECK (review_decision IN ('ACCEPT', 'REJECT', 'IGNORE')),
  payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sync_run_id, external_id)
);

CREATE INDEX IF NOT EXISTS sync_result_item_connection_idx
  ON spaartrack.sync_result_item (connection_id, created_at DESC);
