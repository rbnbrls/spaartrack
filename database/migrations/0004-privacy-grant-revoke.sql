ALTER TABLE spaartrack.portfolio_member
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

CREATE INDEX IF NOT EXISTS portfolio_member_active_idx
  ON spaartrack.portfolio_member (portfolio_id, user_id)
  WHERE revoked_at IS NULL;
