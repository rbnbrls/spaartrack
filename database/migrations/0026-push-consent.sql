-- US-1506: push consent registry with channel preference and revoke (expand/contract, idempotent).
CREATE TABLE IF NOT EXISTS spaartrack.push_consent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES spaartrack.app_user(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('PUSH', 'IN_APP', 'EMAIL')),
  status text NOT NULL DEFAULT 'GRANTED' CHECK (status IN ('GRANTED', 'REVOKED')),
  device_label text NOT NULL DEFAULT '',
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_consent_user_idx ON spaartrack.push_consent (user_id, created_at DESC);
