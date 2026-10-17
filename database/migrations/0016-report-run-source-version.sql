ALTER TABLE spaartrack.report_run
  ADD COLUMN IF NOT EXISTS source_version text NOT NULL DEFAULT 'ledger-v1';
