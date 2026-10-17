ALTER TABLE spaartrack.report_run
  ADD COLUMN IF NOT EXISTS artifact_expires_at timestamptz;
