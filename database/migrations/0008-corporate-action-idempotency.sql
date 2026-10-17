BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS corporate_action_identity_idx
  ON spaartrack.corporate_action (instrument_id, action_type, effective_date, ratio_from, ratio_to);

COMMIT;
