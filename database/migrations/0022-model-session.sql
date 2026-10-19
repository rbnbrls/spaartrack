-- US-1602: model session registry with vault-only provider keys (expand/contract, idempotent).
CREATE TABLE IF NOT EXISTS spaartrack.model_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES spaartrack.app_user(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model text NOT NULL,
  key_source text NOT NULL CHECK (key_source IN ('BYOK', 'LOCAL')),
  key_material text NOT NULL DEFAULT 'vault-only' CHECK (key_material = 'vault-only'),
  vault_path text NOT NULL,
  session_label text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS model_session_user_idx ON spaartrack.model_session (user_id, created_at DESC);
