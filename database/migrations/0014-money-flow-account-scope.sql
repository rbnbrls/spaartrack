BEGIN;

CREATE TABLE IF NOT EXISTS spaartrack.money_flow_account_scope (
  portfolio_id uuid NOT NULL REFERENCES spaartrack.portfolio(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES spaartrack.app_user(id) ON DELETE CASCADE,
  financial_account_id uuid NOT NULL REFERENCES spaartrack.financial_account(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (portfolio_id, user_id, financial_account_id)
);

CREATE INDEX IF NOT EXISTS money_flow_account_scope_user_idx
  ON spaartrack.money_flow_account_scope (user_id, portfolio_id);

COMMIT;
