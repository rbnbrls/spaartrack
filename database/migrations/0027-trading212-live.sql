-- US-0802 / US-0803. Expand only; credentials and jobs never write canonical ledger.
CREATE TABLE IF NOT EXISTS spaartrack.broker_owner (
 user_id uuid PRIMARY KEY REFERENCES spaartrack.app_user(id),
 password_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS spaartrack.broker_session (
 token_hash text PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES spaartrack.broker_owner(user_id),
 expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS spaartrack.broker_credential (
 connection_id uuid PRIMARY KEY REFERENCES spaartrack.external_connection(id),
 ciphertext text NOT NULL,
 iv text NOT NULL,
 tag text NOT NULL
);
CREATE INDEX IF NOT EXISTS broker_sync_queue_idx ON spaartrack.sync_run(created_at) WHERE status = 'QUEUED';
