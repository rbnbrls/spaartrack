-- Expand migration: email verification tokens for user registration.
CREATE TABLE IF NOT EXISTS spaartrack.email_verification_token (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES spaartrack.app_user(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  email text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_verification_token_active_idx
  ON spaartrack.email_verification_token (token_hash)
  WHERE consumed_at IS NULL AND expires_at > now();