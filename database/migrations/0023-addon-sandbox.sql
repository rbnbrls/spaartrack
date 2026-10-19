-- US-1606: isolated addon metadata and synthetic sandbox lifecycle (expand/contract, idempotent).
CREATE TABLE IF NOT EXISTS spaartrack.addon_secret_ref (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_id uuid NOT NULL REFERENCES spaartrack.addon_manifest(id) ON DELETE CASCADE,
  secret_name text NOT NULL,
  vault_path text NOT NULL CHECK (vault_path LIKE 'vault://%'),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  revoked_at timestamptz,
  UNIQUE (addon_id, secret_name)
);
CREATE TABLE IF NOT EXISTS spaartrack.addon_event_hook (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_id uuid NOT NULL REFERENCES spaartrack.addon_manifest(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  revoked_at timestamptz,
  UNIQUE (addon_id, event_name)
);
CREATE TABLE IF NOT EXISTS spaartrack.addon_asset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_id uuid NOT NULL REFERENCES spaartrack.addon_manifest(id) ON DELETE CASCADE,
  asset_path text NOT NULL,
  content_type text NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-fA-F]{64}$'),
  UNIQUE (addon_id, asset_path)
);
CREATE TABLE IF NOT EXISTS spaartrack.addon_sandbox_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_id uuid NOT NULL REFERENCES spaartrack.addon_manifest(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'STOPPED' CHECK (status IN ('STOPPED', 'RUNNING', 'REVOKED')),
  permissions jsonb NOT NULL DEFAULT '[]',
  asset_root text NOT NULL,
  ledger_access text NOT NULL DEFAULT 'none' CHECK (ledger_access = 'none'),
  started_at timestamptz,
  stopped_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS addon_sandbox_run_addon_idx ON spaartrack.addon_sandbox_run (addon_id, updated_at DESC);
