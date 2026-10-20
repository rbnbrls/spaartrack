-- US-0206 (TC-US-0206-B): durable proof of a user deletion request.
--
-- The tombstone records that a deletion was requested and what was revoked.
-- It deliberately does NOT reference app_user(id) with ON DELETE CASCADE: the
-- tombstone must outlive any future physical purge of the identity row, and
-- it must be replayable after a backup restore (see ADR-0005).
--
-- Expand-only: additive table, no column changes on existing tables, safe to
-- apply twice.

CREATE TABLE IF NOT EXISTS spaartrack.user_deletion_tombstone (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  retention_until timestamptz NOT NULL,
  reason text NOT NULL DEFAULT 'USER_REQUESTED',
  revoked_sessions integer NOT NULL DEFAULT 0,
  revoked_totp_factors integer NOT NULL DEFAULT 0,
  consumed_oidc_states integer NOT NULL DEFAULT 0,
  revoked_grants integer NOT NULL DEFAULT 0,
  archived_portfolios integer NOT NULL DEFAULT 0,
  revoked_provider_connections integer NOT NULL DEFAULT 0,
  revoked_connection_scopes integer NOT NULL DEFAULT 0,
  revoked_consent_records integer NOT NULL DEFAULT 0,
  revoked_credential_references integer NOT NULL DEFAULT 0,
  ledger_rows_deleted integer NOT NULL DEFAULT 0,
  audit_event_id uuid,
  actor_id text,
  correlation_id text,
  trace_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_deletion_tombstone_user_idx
  ON spaartrack.user_deletion_tombstone (user_id, deleted_at DESC);

CREATE INDEX IF NOT EXISTS user_deletion_tombstone_retention_idx
  ON spaartrack.user_deletion_tombstone (retention_until);
