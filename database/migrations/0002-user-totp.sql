-- Expand migration: local TOTP factors are encrypted at rest and revocable.
CREATE TABLE IF NOT EXISTS spaartrack.user_totp_factor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES spaartrack.app_user(id) ON DELETE CASCADE,
  secret_ciphertext text NOT NULL,
  secret_iv text NOT NULL,
  secret_tag text NOT NULL,
  algorithm text NOT NULL DEFAULT 'SHA1',
  period_seconds integer NOT NULL DEFAULT 30 CHECK (period_seconds BETWEEN 15 AND 120),
  digits smallint NOT NULL DEFAULT 6 CHECK (digits BETWEEN 6 AND 8),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS user_totp_factor_active_idx
  ON spaartrack.user_totp_factor (user_id) WHERE revoked_at IS NULL;
