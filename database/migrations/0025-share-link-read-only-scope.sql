-- US-1501: tighten portfolio_share_link scope to read-only VIEW/RESTRICTED_VIEW (expand/contract).
-- Expand: drop legacy check allowing MANAGE, add read-only check idempotently.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'portfolio_share_link_scope_check'
  ) THEN
    ALTER TABLE spaartrack.portfolio_share_link DROP CONSTRAINT portfolio_share_link_scope_check;
  END IF;
END $$;
ALTER TABLE spaartrack.portfolio_share_link
  ADD CONSTRAINT portfolio_share_link_scope_check CHECK (scope IN ('RESTRICTED_VIEW', 'VIEW'));
