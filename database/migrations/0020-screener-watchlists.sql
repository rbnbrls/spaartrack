-- Expand migration: saved screener/watchlist definitions; canonical ledger is untouched.
BEGIN;
CREATE TABLE IF NOT EXISTS spaartrack.screener_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES spaartrack.app_user(id) ON DELETE CASCADE,
  portfolio_id uuid REFERENCES spaartrack.portfolio(id) ON DELETE CASCADE,
  name text NOT NULL,
  filters jsonb NOT NULL,
  calculation_version text NOT NULL DEFAULT 'screener-watchlist-v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS screener_watchlist_user_updated_idx ON spaartrack.screener_watchlist (user_id, updated_at DESC);
COMMIT;
