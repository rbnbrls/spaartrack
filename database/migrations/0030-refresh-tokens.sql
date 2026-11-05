-- Expand migration: add refresh tokens to user_session for token rotation.
ALTER TABLE spaartrack.user_session
  ADD COLUMN IF NOT EXISTS refresh_token_hash text UNIQUE,
  ADD COLUMN IF NOT EXISTS refresh_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS user_session_refresh_idx
  ON spaartrack.user_session (refresh_token_hash)
  WHERE refresh_token_hash IS NOT NULL AND refresh_expires_at > now();