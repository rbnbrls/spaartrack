-- Expand migration: TOTP backup codes for account recovery.
CREATE TABLE IF NOT EXISTS spaartrack.user_backup_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES spaartrack.app_user(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_backup_codes_user_idx
  ON spaartrack.user_backup_codes (user_id)
  WHERE used_at IS NULL;