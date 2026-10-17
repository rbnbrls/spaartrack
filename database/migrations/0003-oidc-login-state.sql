CREATE TABLE IF NOT EXISTS spaartrack.oidc_login_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES spaartrack.app_user(id) ON DELETE CASCADE,
  provider text NOT NULL,
  state_hash text NOT NULL UNIQUE,
  code_hash text NOT NULL,
  redirect_uri text,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS oidc_login_state_active_idx
  ON spaartrack.oidc_login_state (state_hash)
  WHERE consumed_at IS NULL;
