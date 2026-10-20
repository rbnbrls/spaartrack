-- Spaartrack canonical data model
-- Target: PostgreSQL 16+
-- The ledger is append-oriented. Portfolio, performance, tax and Money Flow
-- projections must be rebuildable from these tables and their source payloads.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS spaartrack;
SET search_path TO spaartrack, public;

-- ---------------------------------------------------------------------------
-- Shared primitives
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE app_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INVITED', 'SUSPENDED', 'DELETED')),
  locale text NOT NULL DEFAULT 'nl-NL',
  timezone text NOT NULL DEFAULT 'Europe/Amsterdam',
  default_currency_code char(3) NOT NULL DEFAULT 'EUR',
  tax_residency_country char(2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX app_user_email_uq
  ON app_user (lower(email)) WHERE email IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE currency (
  code char(3) PRIMARY KEY,
  name text NOT NULL,
  minor_units smallint NOT NULL DEFAULT 2 CHECK (minor_units BETWEEN 0 AND 8),
  is_crypto boolean NOT NULL DEFAULT false
);

CREATE TABLE exchange (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mic text UNIQUE,
  name text NOT NULL,
  country_code char(2),
  timezone text,
  currency_code char(3) REFERENCES currency(code),
  metadata jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE app_setting (
  key text PRIMARY KEY,
  value_json jsonb NOT NULL,
  is_secret boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_preference (
  user_id uuid PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  base_currency_code char(3) NOT NULL REFERENCES currency(code),
  date_format text NOT NULL DEFAULT 'DD-MM-YYYY',
  theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark', 'zen')),
  dashboard_config jsonb NOT NULL DEFAULT '{}',
  notification_config jsonb NOT NULL DEFAULT '{}',
  privacy_config jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth_identity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  provider text NOT NULL,
  subject text NOT NULL,
  email text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, subject)
);

CREATE TABLE user_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_totp_factor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES app_user(id) ON DELETE CASCADE,
  secret_ciphertext text NOT NULL,
  secret_iv text NOT NULL,
  secret_tag text NOT NULL,
  algorithm text NOT NULL DEFAULT 'SHA1',
  period_seconds integer NOT NULL DEFAULT 30 CHECK (period_seconds BETWEEN 15 AND 120),
  digits smallint NOT NULL DEFAULT 6 CHECK (digits BETWEEN 6 AND 8),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX user_totp_factor_active_idx
  ON user_totp_factor (user_id) WHERE revoked_at IS NULL;

CREATE TABLE oidc_login_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  provider text NOT NULL,
  state_hash text NOT NULL UNIQUE,
  code_hash text NOT NULL,
  redirect_uri text,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX oidc_login_state_active_idx
  ON oidc_login_state (state_hash) WHERE consumed_at IS NULL;

-- ---------------------------------------------------------------------------
-- Providers, connections and source data
-- ---------------------------------------------------------------------------

CREATE TABLE provider (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  provider_type text NOT NULL CHECK (provider_type IN ('BROKER', 'BANK', 'AGGREGATOR', 'MARKET_DATA', 'IMPORT')),
  api_version text,
  region text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DEGRADED', 'PAUSED', 'RETIRED')),
  capabilities jsonb NOT NULL DEFAULT '{}',
  documentation_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE provider_capability (
  provider_id uuid NOT NULL REFERENCES provider(id) ON DELETE CASCADE,
  capability text NOT NULL,
  supported boolean NOT NULL DEFAULT true,
  details jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (provider_id, capability)
);

CREATE TABLE credential_secret_ref (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  vault_path text NOT NULL,
  secret_kind text NOT NULL CHECK (secret_kind IN ('API_KEY', 'OAUTH_TOKEN', 'SESSION_TOKEN', 'CLIENT_SECRET', 'IMPORT_KEY')),
  key_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz,
  revoked_at timestamptz
);

CREATE TABLE external_connection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES provider(id),
  auth_mode text NOT NULL CHECK (auth_mode IN ('MANUAL_IMPORT', 'API_KEY', 'OAUTH2', 'OPEN_BANKING_REQUISITION', 'OIDC')),
  status text NOT NULL DEFAULT 'CREATED'
    CHECK (status IN ('CREATED', 'AUTH_PENDING', 'AUTHORIZED', 'SYNCING', 'HEALTHY', 'DEGRADED', 'RETRYING', 'EXPIRED', 'REVOKED', 'DISCONNECTED', 'ERROR')),
  display_name text,
  credential_ref_id uuid REFERENCES credential_secret_ref(id),
  consent_expires_at timestamptz,
  last_sync_started_at timestamptz,
  last_sync_completed_at timestamptz,
  last_successful_sync_at timestamptz,
  last_error_code text,
  last_error_message text,
  provider_metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  disconnected_at timestamptz
);

CREATE TABLE connection_scope (
  connection_id uuid NOT NULL REFERENCES external_connection(id) ON DELETE CASCADE,
  scope text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (connection_id, scope)
);

CREATE TABLE consent_record (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES external_connection(id) ON DELETE CASCADE,
  consent_type text NOT NULL CHECK (consent_type IN ('OAUTH', 'OPEN_BANKING', 'DATA_IMPORT', 'SHARING', 'AI_ACCESS')),
  external_consent_id text,
  state text NOT NULL CHECK (state IN ('PENDING', 'AUTHORIZED', 'EXPIRED', 'REVOKED', 'FAILED')),
  scopes jsonb NOT NULL DEFAULT '[]',
  authorized_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE provider_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES external_connection(id) ON DELETE CASCADE,
  external_account_id text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('BROKERAGE', 'INVESTMENT', 'ISA', 'CURRENT', 'SAVINGS', 'CREDIT_CARD', 'LOAN', 'CASH', 'CRYPTO', 'OTHER')),
  name text NOT NULL,
  iban_last4 text,
  base_currency_code char(3) REFERENCES currency(code),
  tracking_mode text NOT NULL DEFAULT 'TRANSACTIONS' CHECK (tracking_mode IN ('TRANSACTIONS', 'HOLDINGS', 'BALANCE_ONLY')),
  is_active boolean NOT NULL DEFAULT true,
  provider_metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connection_id, external_account_id)
);

CREATE TABLE sync_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES external_connection(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED')),
  trigger_type text NOT NULL CHECK (trigger_type IN ('INITIAL', 'SCHEDULED', 'MANUAL', 'RETRY', 'WEBHOOK')),
  cursor_before text,
  cursor_after text,
  window_from timestamptz,
  window_to timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  records_seen integer NOT NULL DEFAULT 0,
  records_created integer NOT NULL DEFAULT 0,
  records_updated integer NOT NULL DEFAULT 0,
  records_duplicate integer NOT NULL DEFAULT 0,
  records_rejected integer NOT NULL DEFAULT 0,
  error_code text,
  error_message text,
  diagnostics jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sync_checkpoint (
  connection_id uuid PRIMARY KEY REFERENCES external_connection(id) ON DELETE CASCADE,
  provider_cursor text,
  last_activity_at timestamptz,
  last_balance_at timestamptz,
  last_position_at timestamptz,
  overlap_window interval NOT NULL DEFAULT interval '2 days',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sync_result_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id uuid NOT NULL REFERENCES sync_run(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES external_connection(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('NEW', 'UPDATED', 'DUPLICATE', 'REJECTED', 'ATTENTION')),
  posting_status text NOT NULL DEFAULT 'NOT_POSTED' CHECK (posting_status IN ('NOT_POSTED', 'POSTING_REVIEW', 'POSTED', 'VOID')),
  review_decision text CHECK (review_decision IN ('ACCEPT', 'REJECT', 'IGNORE')),
  payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sync_run_id, external_id)
);

CREATE INDEX sync_result_item_connection_idx
  ON sync_result_item (connection_id, created_at DESC);

CREATE TABLE raw_provider_payload (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES external_connection(id) ON DELETE SET NULL,
  sync_run_id uuid REFERENCES sync_run(id) ON DELETE SET NULL,
  import_file_id uuid,
  payload_type text NOT NULL CHECK (payload_type IN ('API_RESPONSE', 'WEBHOOK', 'CSV', 'XLSX', 'PDF', 'JSON', 'STATEMENT')),
  provider_endpoint text,
  content_type text,
  object_storage_key text,
  payload_json jsonb,
  checksum_sha256 text NOT NULL,
  schema_version text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  retention_until timestamptz,
  CHECK (payload_json IS NOT NULL OR object_storage_key IS NOT NULL)
);

CREATE TABLE webhook_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider(id),
  connection_id uuid REFERENCES external_connection(id) ON DELETE SET NULL,
  external_event_id text NOT NULL,
  signature_valid boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED', 'QUEUED', 'PROCESSED', 'DUPLICATE', 'REJECTED', 'FAILED')),
  payload_id uuid REFERENCES raw_provider_payload(id),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider_id, external_event_id)
);

-- ---------------------------------------------------------------------------
-- Portfolio and instrument master data
-- ---------------------------------------------------------------------------

CREATE TABLE portfolio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'HIDDEN', 'ARCHIVED', 'DELETED')),
  reporting_currency_code char(3) NOT NULL REFERENCES currency(code),
  privacy_scope text NOT NULL DEFAULT 'PRIVATE' CHECK (privacy_scope IN ('PRIVATE', 'SHARED', 'PUBLIC')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE TABLE portfolio_member (
  portfolio_id uuid NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('OWNER', 'EDITOR', 'VIEWER', 'ACCOUNTANT', 'ADVISOR')),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (portfolio_id, user_id)
);

CREATE INDEX portfolio_member_active_idx
  ON portfolio_member (portfolio_id, user_id) WHERE revoked_at IS NULL;

CREATE TABLE financial_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
  provider_account_id uuid REFERENCES provider_account(id) ON DELETE SET NULL,
  name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('BROKERAGE', 'BANK', 'CASH', 'CREDIT_CARD', 'LOAN', 'CRYPTO', 'PROPERTY', 'CUSTOM')),
  tracking_mode text NOT NULL DEFAULT 'TRANSACTIONS' CHECK (tracking_mode IN ('TRANSACTIONS', 'HOLDINGS', 'BALANCE_ONLY')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'HIDDEN', 'ARCHIVED')),
  institution_name text,
  base_currency_code char(3) REFERENCES currency(code),
  opened_on date,
  closed_on date,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portfolio_id, name)
);

-- Money Flow is an opt-in projection. It records user intent and never replaces
-- or mutates canonical ledger activities.
CREATE TABLE money_flow_account_scope (
  portfolio_id uuid NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  financial_account_id uuid NOT NULL REFERENCES financial_account(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (portfolio_id, user_id, financial_account_id)
);

CREATE INDEX money_flow_account_scope_user_idx
  ON money_flow_account_scope (user_id, portfolio_id);

CREATE TABLE strategy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid REFERENCES portfolio(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (portfolio_id, name)
);

CREATE TABLE instrument (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_type text NOT NULL CHECK (instrument_type IN ('STOCK', 'ETF', 'FUND', 'BOND', 'OPTION', 'CRYPTO', 'PRECIOUS_METAL', 'FUTURE', 'MONEY_MARKET', 'PROPERTY', 'VEHICLE', 'COLLECTIBLE', 'CUSTOM', 'CASH')),
  asset_class text NOT NULL CHECK (asset_class IN ('EQUITY', 'FIXED_INCOME', 'DERIVATIVE', 'CRYPTO', 'CASH', 'REAL_ASSET', 'LIABILITY', 'OTHER')),
  name text NOT NULL,
  short_name text,
  currency_code char(3) REFERENCES currency(code),
  exchange_id uuid REFERENCES exchange(id),
  sector text,
  industry text,
  country_code char(2),
  market_cap_bucket text,
  isin text,
  cusip text,
  ticker text,
  is_listed boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  valuation_source text NOT NULL DEFAULT 'MARKET_DATA' CHECK (valuation_source IN ('MARKET_DATA', 'MANUAL', 'PROVIDER', 'NONE')),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX instrument_isin_uq ON instrument(isin) WHERE isin IS NOT NULL;
CREATE INDEX instrument_search_idx ON instrument (lower(name), lower(ticker));

CREATE TABLE instrument_lookthrough_component (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etf_instrument_id uuid NOT NULL REFERENCES instrument(id) ON DELETE CASCADE,
  underlying_instrument_id uuid REFERENCES instrument(id) ON DELETE SET NULL,
  underlying_name text NOT NULL,
  weight numeric(12, 8) NOT NULL CHECK (weight >= 0 AND weight <= 1),
  resolution_status text NOT NULL CHECK (resolution_status IN ('RESOLVED', 'UNRESOLVED')),
  source text NOT NULL,
  source_version text NOT NULL,
  as_of date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((resolution_status = 'RESOLVED' AND underlying_instrument_id IS NOT NULL) OR (resolution_status = 'UNRESOLVED' AND underlying_instrument_id IS NULL))
);

CREATE INDEX instrument_lookthrough_lookup_idx
  ON instrument_lookthrough_component (etf_instrument_id, as_of DESC, source_version);

CREATE TABLE instrument_identifier (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid NOT NULL REFERENCES instrument(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES provider(id) ON DELETE CASCADE,
  identifier_type text NOT NULL CHECK (identifier_type IN ('TICKER', 'ISIN', 'CUSIP', 'PROVIDER_SYMBOL', 'CONTRACT_CODE')),
  identifier_value text NOT NULL,
  valid_from date,
  valid_to date,
  UNIQUE (provider_id, identifier_type, identifier_value)
);

CREATE TABLE instrument_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider(id) ON DELETE CASCADE,
  provider_symbol text NOT NULL,
  instrument_id uuid REFERENCES instrument(id) ON DELETE SET NULL,
  identifier_type text CHECK (identifier_type IN ('ISIN', 'CUSIP')),
  identifier_value text,
  status text NOT NULL DEFAULT 'UNRESOLVED' CHECK (status IN ('UNRESOLVED', 'RESOLVED', 'REJECTED')),
  created_by uuid REFERENCES app_user(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, provider_symbol)
);

CREATE INDEX instrument_mapping_status_idx
  ON instrument_mapping (status, created_at DESC);

CREATE TABLE instrument_label (
  instrument_id uuid NOT NULL REFERENCES instrument(id) ON DELETE CASCADE,
  label text NOT NULL,
  value text NOT NULL,
  PRIMARY KEY (instrument_id, label)
);

CREATE TABLE instrument_price (
  instrument_id uuid NOT NULL REFERENCES instrument(id) ON DELETE CASCADE,
  price_at timestamptz NOT NULL,
  price numeric(28, 12) NOT NULL CHECK (price >= 0),
  currency_code char(3) NOT NULL REFERENCES currency(code),
  source_provider_id uuid REFERENCES provider(id),
  source text NOT NULL,
  is_close boolean NOT NULL DEFAULT false,
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instrument_id, price_at, source)
);

CREATE TABLE fx_rate (
  base_currency_code char(3) NOT NULL REFERENCES currency(code),
  quote_currency_code char(3) NOT NULL REFERENCES currency(code),
  rate_at timestamptz NOT NULL,
  rate numeric(28, 16) NOT NULL CHECK (rate > 0),
  source_provider_id uuid REFERENCES provider(id),
  source text NOT NULL,
  source_version text NOT NULL DEFAULT 'v1',
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (base_currency_code, quote_currency_code, rate_at, source),
  CHECK (base_currency_code <> quote_currency_code)
);

CREATE TABLE corporate_action (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid NOT NULL REFERENCES instrument(id),
  action_type text NOT NULL CHECK (action_type IN ('SPLIT', 'REVERSE_SPLIT', 'SPINOFF', 'MERGER', 'DRP', 'RIGHTS_ISSUE', 'TENDER', 'DELISTING', 'SYMBOL_CHANGE', 'OTHER')),
  announced_on date,
  ex_date date,
  effective_date date NOT NULL,
  ratio_from numeric(28, 12),
  ratio_to numeric(28, 12),
  successor_instrument_id uuid REFERENCES instrument(id),
  source text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX corporate_action_identity_idx
  ON corporate_action (instrument_id, action_type, effective_date, ratio_from, ratio_to);

-- ---------------------------------------------------------------------------
-- Canonical financial ledger
-- ---------------------------------------------------------------------------

CREATE TABLE ledger_transaction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolio(id) ON DELETE RESTRICT,
  financial_account_id uuid REFERENCES financial_account(id) ON DELETE RESTRICT,
  provider_account_id uuid REFERENCES provider_account(id) ON DELETE SET NULL,
  activity_type text NOT NULL CHECK (activity_type IN ('BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'DEPOSIT', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'CREDIT', 'FEE', 'TAX', 'SPLIT', 'FX_CONVERSION', 'RETURN_OF_CAPITAL', 'DIVIDEND_IN_KIND', 'STAKING_REWARD', 'BONUS', 'REBATE', 'REFUND', 'CORRECTION', 'LIABILITY_PAYMENT', 'OTHER')),
  activity_subtype text,
  state text NOT NULL DEFAULT 'POSTED' CHECK (state IN ('POSTED', 'PENDING', 'DRAFT', 'VOID')),
  occurred_at timestamptz NOT NULL,
  settlement_at timestamptz,
  effective_date date NOT NULL,
  posted_at timestamptz,
  description text,
  external_id text,
  external_hash text,
  source_type text NOT NULL CHECK (source_type IN ('MANUAL', 'IMPORT', 'PROVIDER_API', 'WEBHOOK', 'SYSTEM', 'AI_PROPOSAL')),
  source_provider_id uuid REFERENCES provider(id),
  source_connection_id uuid REFERENCES external_connection(id),
  source_payload_id uuid REFERENCES raw_provider_payload(id),
  import_session_id uuid,
  paired_transaction_id uuid REFERENCES ledger_transaction(id),
  is_external_flow boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz,
  UNIQUE (source_connection_id, external_id),
  UNIQUE (source_connection_id, external_hash)
);

CREATE TABLE ledger_entry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_transaction_id uuid NOT NULL REFERENCES ledger_transaction(id) ON DELETE RESTRICT,
  financial_account_id uuid REFERENCES financial_account(id) ON DELETE RESTRICT,
  instrument_id uuid REFERENCES instrument(id) ON DELETE RESTRICT,
  entry_kind text NOT NULL CHECK (entry_kind IN ('CASH', 'POSITION', 'FEE', 'TAX', 'MEMO')),
  direction text NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
  quantity numeric(28, 12),
  unit_price numeric(28, 12),
  amount numeric(28, 12) NOT NULL,
  currency_code char(3) NOT NULL REFERENCES currency(code),
  reporting_amount numeric(28, 12),
  reporting_currency_code char(3) REFERENCES currency(code),
  fx_rate numeric(28, 16),
  fee_amount numeric(28, 12) NOT NULL DEFAULT 0,
  tax_amount numeric(28, 12) NOT NULL DEFAULT 0,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}',
  CHECK (amount >= 0),
  CHECK (quantity IS NULL OR quantity >= 0),
  CHECK ((entry_kind = 'POSITION' AND instrument_id IS NOT NULL) OR entry_kind <> 'POSITION'),
  CHECK ((entry_kind IN ('CASH', 'POSITION') AND financial_account_id IS NOT NULL) OR entry_kind NOT IN ('CASH', 'POSITION'))
);

CREATE INDEX ledger_transaction_portfolio_date_idx
  ON ledger_transaction (portfolio_id, effective_date, occurred_at);
CREATE INDEX ledger_transaction_source_idx
  ON ledger_transaction (source_provider_id, source_connection_id, external_id);
CREATE UNIQUE INDEX ledger_transaction_account_external_id_idx
  ON ledger_transaction (financial_account_id, external_id)
  WHERE external_id IS NOT NULL;
CREATE UNIQUE INDEX ledger_transaction_account_external_hash_idx
  ON ledger_transaction (financial_account_id, external_hash)
  WHERE external_hash IS NOT NULL;
CREATE INDEX ledger_entry_account_instrument_idx
  ON ledger_entry (financial_account_id, instrument_id);

CREATE TABLE tax_lot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolio(id) ON DELETE RESTRICT,
  financial_account_id uuid NOT NULL REFERENCES financial_account(id) ON DELETE RESTRICT,
  instrument_id uuid NOT NULL REFERENCES instrument(id) ON DELETE RESTRICT,
  acquisition_transaction_id uuid NOT NULL REFERENCES ledger_transaction(id),
  acquired_at timestamptz NOT NULL,
  original_quantity numeric(28, 12) NOT NULL CHECK (original_quantity > 0),
  remaining_quantity numeric(28, 12) NOT NULL CHECK (remaining_quantity >= 0),
  cost_basis_amount numeric(28, 12) NOT NULL,
  currency_code char(3) NOT NULL REFERENCES currency(code),
  method text NOT NULL DEFAULT 'WAC' CHECK (method IN ('FIFO', 'LIFO', 'WAC', 'HIFO', 'SPECIFIC_ID')),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (remaining_quantity <= original_quantity)
);

CREATE TABLE tax_lot_disposal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_lot_id uuid NOT NULL REFERENCES tax_lot(id) ON DELETE RESTRICT,
  disposal_transaction_id uuid NOT NULL REFERENCES ledger_transaction(id) ON DELETE RESTRICT,
  quantity numeric(28, 12) NOT NULL CHECK (quantity > 0),
  proceeds_amount numeric(28, 12) NOT NULL,
  cost_basis_amount numeric(28, 12) NOT NULL,
  realized_gain_amount numeric(28, 12) NOT NULL,
  currency_code char(3) NOT NULL REFERENCES currency(code),
  holding_period text CHECK (holding_period IN ('SHORT', 'LONG', 'UNKNOWN')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE portfolio_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
  snapshot_at timestamptz NOT NULL,
  reporting_currency_code char(3) NOT NULL REFERENCES currency(code),
  portfolio_value numeric(28, 12) NOT NULL,
  invested_capital numeric(28, 12) NOT NULL DEFAULT 0,
  free_cash numeric(28, 12) NOT NULL DEFAULT 0,
  net_cash_flow numeric(28, 12) NOT NULL DEFAULT 0,
  realized_pnl numeric(28, 12) NOT NULL DEFAULT 0,
  unrealized_pnl numeric(28, 12) NOT NULL DEFAULT 0,
  dividend_income_gross numeric(28, 12) NOT NULL DEFAULT 0,
  dividend_income_net numeric(28, 12) NOT NULL DEFAULT 0,
  fees numeric(28, 12) NOT NULL DEFAULT 0,
  taxes numeric(28, 12) NOT NULL DEFAULT 0,
  price_data_as_of timestamptz,
  fx_data_as_of timestamptz,
  calculation_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portfolio_id, snapshot_at, calculation_version)
);

CREATE TABLE position_snapshot (
  portfolio_snapshot_id uuid NOT NULL REFERENCES portfolio_snapshot(id) ON DELETE CASCADE,
  financial_account_id uuid REFERENCES financial_account(id),
  instrument_id uuid NOT NULL REFERENCES instrument(id),
  quantity numeric(28, 12) NOT NULL,
  average_cost numeric(28, 12),
  cost_basis numeric(28, 12),
  market_price numeric(28, 12),
  market_value numeric(28, 12),
  reporting_value numeric(28, 12),
  unrealized_pnl numeric(28, 12),
  realized_pnl numeric(28, 12),
  dividends_gross numeric(28, 12) NOT NULL DEFAULT 0,
  dividends_net numeric(28, 12) NOT NULL DEFAULT 0,
  portfolio_weight numeric(12, 8),
  cost_basis_weight numeric(12, 8),
  PRIMARY KEY (portfolio_snapshot_id, financial_account_id, instrument_id)
);

-- ---------------------------------------------------------------------------
-- Income, dividends, performance and market context
-- ---------------------------------------------------------------------------

CREATE TABLE income_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid REFERENCES instrument(id),
  portfolio_id uuid NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('DIVIDEND', 'INTEREST', 'COUPON', 'OPTION_PREMIUM', 'STAKING', 'OTHER')),
  status text NOT NULL CHECK (status IN ('ANNOUNCED', 'PROJECTED', 'EX_DATE', 'PAID', 'CANCELLED')),
  announced_on date,
  ex_date date,
  record_date date,
  payment_date date,
  amount_per_unit numeric(28, 12),
  gross_amount numeric(28, 12),
  tax_amount numeric(28, 12) NOT NULL DEFAULT 0,
  fee_amount numeric(28, 12) NOT NULL DEFAULT 0,
  net_amount numeric(28, 12),
  currency_code char(3) NOT NULL REFERENCES currency(code),
  provider_id uuid REFERENCES provider(id),
  external_id text,
  source_payload_id uuid REFERENCES raw_provider_payload(id),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, external_id)
);

CREATE TABLE benchmark (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  symbol text,
  provider_id uuid REFERENCES provider(id),
  currency_code char(3) REFERENCES currency(code),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (provider_id, symbol)
);

CREATE TABLE benchmark_observation (
  benchmark_id uuid NOT NULL REFERENCES benchmark(id) ON DELETE CASCADE,
  observed_at date NOT NULL,
  index_value numeric(28, 12) NOT NULL,
  currency_code char(3) REFERENCES currency(code),
  PRIMARY KEY (benchmark_id, observed_at)
);

CREATE TABLE performance_observation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
  instrument_id uuid REFERENCES instrument(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  method text NOT NULL CHECK (method IN ('TWR', 'MWRR', 'IRR', 'MODIFIED_DIETZ', 'CAGR', 'ROAI')),
  return_amount numeric(28, 12),
  return_pct numeric(18, 10),
  annualized_return_pct numeric(18, 10),
  net_cash_flow numeric(28, 12) NOT NULL DEFAULT 0,
  benchmark_id uuid REFERENCES benchmark(id),
  benchmark_return_pct numeric(18, 10),
  calculation_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start),
  UNIQUE (portfolio_id, instrument_id, period_start, period_end, method, benchmark_id, calculation_version)
);

CREATE TABLE risk_metric_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
  instrument_id uuid REFERENCES instrument(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  volatility numeric(18, 10),
  beta numeric(18, 10),
  sharpe numeric(18, 10),
  sortino numeric(18, 10),
  max_drawdown numeric(18, 10),
  turnover numeric(18, 10),
  risk_contribution numeric(18, 10),
  calculation_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE dividend_forecast (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
  instrument_id uuid NOT NULL REFERENCES instrument(id),
  forecast_period_start date NOT NULL,
  forecast_period_end date NOT NULL,
  forecast_amount_gross numeric(28, 12) NOT NULL,
  forecast_tax numeric(28, 12) NOT NULL DEFAULT 0,
  forecast_amount_net numeric(28, 12),
  currency_code char(3) NOT NULL REFERENCES currency(code),
  model text NOT NULL,
  confidence numeric(5, 4),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE market_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid REFERENCES instrument(id),
  event_type text NOT NULL CHECK (event_type IN ('EX_DIVIDEND', 'DIVIDEND_PAYMENT', 'AGM', 'EARNINGS', 'TRADING_UPDATE', 'CAPITAL_MARKETS_DAY', 'ECONOMIC', 'OTHER')),
  title text NOT NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  source text,
  source_external_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  UNIQUE (source, source_external_id)
);

-- ---------------------------------------------------------------------------
-- Import, mapping and reconciliation
-- ---------------------------------------------------------------------------

CREATE TABLE import_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES provider(id),
  name text NOT NULL,
  document_type text NOT NULL,
  parser_version text NOT NULL,
  mapping_json jsonb NOT NULL,
  template_version integer NOT NULL DEFAULT 1,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE import_file (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  portfolio_id uuid REFERENCES portfolio(id) ON DELETE SET NULL,
  provider_id uuid REFERENCES provider(id),
  mapping_id uuid REFERENCES import_mapping(id),
  filename text NOT NULL,
  content_type text,
  object_storage_key text NOT NULL,
  checksum_sha256 text NOT NULL,
  file_size_bytes bigint,
  parse_status text NOT NULL DEFAULT 'UPLOADED' CHECK (parse_status IN ('UPLOADED', 'PARSING', 'PARSED', 'FAILED', 'DELETED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, checksum_sha256)
);

ALTER TABLE raw_provider_payload
  ADD CONSTRAINT raw_payload_import_file_fk
  FOREIGN KEY (import_file_id) REFERENCES import_file(id) ON DELETE SET NULL;

CREATE TABLE import_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  portfolio_id uuid NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES provider(id),
  import_file_id uuid REFERENCES import_file(id),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PREVIEWED', 'REVIEW_REQUIRED', 'COMMITTED', 'UNDONE', 'FAILED')),
  parser_version text,
  rows_seen integer NOT NULL DEFAULT 0,
  rows_valid integer NOT NULL DEFAULT 0,
  rows_warning integer NOT NULL DEFAULT 0,
  rows_error integer NOT NULL DEFAULT 0,
  committed_at timestamptz,
  undone_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ledger_transaction
  ADD CONSTRAINT ledger_transaction_import_session_fk
  FOREIGN KEY (import_session_id) REFERENCES import_session(id) ON DELETE SET NULL;

CREATE TABLE import_row_review (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_session_id uuid NOT NULL REFERENCES import_session(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  raw_row jsonb NOT NULL,
  normalized_row jsonb,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VALID', 'WARNING', 'ERROR', 'UNSUPPORTED', 'ACCEPTED', 'REJECTED', 'DUPLICATE')),
  error_codes jsonb NOT NULL DEFAULT '[]',
  resolved_values jsonb,
  resolved_by uuid REFERENCES app_user(id),
  resolved_at timestamptz,
  UNIQUE (import_session_id, row_number)
);

CREATE TABLE reconciliation_issue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES external_connection(id) ON DELETE SET NULL,
  sync_run_id uuid REFERENCES sync_run(id) ON DELETE SET NULL,
  import_session_id uuid REFERENCES import_session(id) ON DELETE SET NULL,
  issue_type text NOT NULL CHECK (issue_type IN ('UNKNOWN_INSTRUMENT', 'DUPLICATE', 'BALANCE_MISMATCH', 'MISSING_ACTIVITY', 'UNMAPPED_FIELD', 'AMBIGUOUS_TRANSFER', 'SCHEMA_ERROR', 'OTHER')),
  severity text NOT NULL DEFAULT 'WARNING' CHECK (severity IN ('INFO', 'WARNING', 'ERROR', 'BLOCKING')),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'IGNORED')),
  message text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}',
  resolution jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES app_user(id)
);

-- ---------------------------------------------------------------------------
-- Money Flow, categorisation, budgets and planning
-- ---------------------------------------------------------------------------

CREATE TABLE category (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES app_user(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES category(id) ON DELETE CASCADE,
  category_type text NOT NULL CHECK (category_type IN ('INCOME', 'SPENDING', 'SAVING', 'TRANSFER', 'TAX', 'FEE', 'UNCATEGORIZED')),
  name text NOT NULL,
  color text,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (user_id, parent_id, name)
);

CREATE TABLE payee (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  name text NOT NULL,
  normalized_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE (user_id, normalized_name)
);

CREATE TABLE transaction_category (
  ledger_transaction_id uuid PRIMARY KEY REFERENCES ledger_transaction(id) ON DELETE CASCADE,
  category_id uuid REFERENCES category(id),
  payee_id uuid REFERENCES payee(id),
  confidence numeric(5, 4),
  classification_source text NOT NULL CHECK (classification_source IN ('MANUAL', 'RULE', 'IMPORT', 'AI', 'SYSTEM')),
  reviewed_by uuid REFERENCES app_user(id),
  reviewed_at timestamptz
);

CREATE TABLE transaction_tag (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  UNIQUE (user_id, name)
);

CREATE TABLE ledger_transaction_tag (
  ledger_transaction_id uuid NOT NULL REFERENCES ledger_transaction(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES transaction_tag(id) ON DELETE CASCADE,
  PRIMARY KEY (ledger_transaction_id, tag_id)
);

CREATE TABLE transaction_rule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  name text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  account_id uuid REFERENCES financial_account(id) ON DELETE CASCADE,
  conditions jsonb NOT NULL,
  actions jsonb NOT NULL,
  review_required boolean NOT NULL DEFAULT false,
  last_executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE budget_plan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  portfolio_id uuid REFERENCES portfolio(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  rollover_enabled boolean NOT NULL DEFAULT false,
  benchmark_model text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, portfolio_id, period_start, period_end)
);

CREATE TABLE budget_group (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_plan_id uuid NOT NULL REFERENCES budget_plan(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE (budget_plan_id, name)
);

CREATE TABLE budget_line (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_plan_id uuid NOT NULL REFERENCES budget_plan(id) ON DELETE CASCADE,
  budget_group_id uuid REFERENCES budget_group(id) ON DELETE SET NULL,
  category_id uuid NOT NULL REFERENCES category(id),
  planned_amount numeric(28, 12) NOT NULL,
  rollover_amount numeric(28, 12) NOT NULL DEFAULT 0,
  actual_amount numeric(28, 12) NOT NULL DEFAULT 0,
  currency_code char(3) NOT NULL REFERENCES currency(code),
  UNIQUE (budget_plan_id, category_id)
);

CREATE TABLE scheduled_transaction (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  financial_account_id uuid REFERENCES financial_account(id) ON DELETE SET NULL,
  category_id uuid REFERENCES category(id),
  payee_id uuid REFERENCES payee(id),
  name text NOT NULL,
  amount numeric(28, 12),
  currency_code char(3) REFERENCES currency(code),
  frequency text NOT NULL CHECK (frequency IN ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM')),
  next_due_on date,
  starts_on date,
  ends_on date,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE cashflow_forecast (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  portfolio_id uuid REFERENCES portfolio(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('SCHEDULED_ONLY', 'BUDGET_ONLY', 'COMBINED')),
  horizon_months integer NOT NULL CHECK (horizon_months BETWEEN 1 AND 600),
  assumptions jsonb NOT NULL DEFAULT '{}',
  result jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE financial_insight (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  portfolio_id uuid REFERENCES portfolio(id) ON DELETE CASCADE,
  insight_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  confidence numeric(5, 4),
  urgency text NOT NULL DEFAULT 'INFO' CHECK (urgency IN ('INFO', 'LOW', 'MEDIUM', 'HIGH')),
  evidence jsonb NOT NULL DEFAULT '{}',
  period_start date,
  period_end date,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE goal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  portfolio_id uuid REFERENCES portfolio(id) ON DELETE CASCADE,
  name text NOT NULL,
  goal_type text NOT NULL CHECK (goal_type IN ('NET_WORTH', 'PASSIVE_INCOME', 'PORTFOLIO_VALUE', 'FIRE', 'CUSTOM')),
  target_amount numeric(28, 12),
  target_currency_code char(3) REFERENCES currency(code),
  target_date date,
  expected_annual_return numeric(18, 10),
  monthly_contribution numeric(28, 12),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'ACHIEVED', 'ARCHIVED')),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE goal_funding_allocation (
  goal_id uuid NOT NULL REFERENCES goal(id) ON DELETE CASCADE,
  financial_account_id uuid NOT NULL REFERENCES financial_account(id) ON DELETE CASCADE,
  funding_percentage numeric(7, 4) NOT NULL CHECK (funding_percentage >= 0 AND funding_percentage <= 100),
  PRIMARY KEY (goal_id, financial_account_id)
);

CREATE TABLE contribution_limit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  financial_account_id uuid REFERENCES financial_account(id),
  jurisdiction char(2) NOT NULL,
  tax_year integer NOT NULL,
  account_type text NOT NULL,
  limit_amount numeric(28, 12) NOT NULL,
  used_amount numeric(28, 12) NOT NULL DEFAULT 0,
  currency_code char(3) NOT NULL REFERENCES currency(code),
  UNIQUE (user_id, financial_account_id, jurisdiction, tax_year, account_type)
);

CREATE TABLE debt_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  financial_account_id uuid REFERENCES financial_account(id),
  name text NOT NULL,
  debt_type text NOT NULL CHECK (debt_type IN ('LOAN', 'MORTGAGE', 'CREDIT_CARD', 'OTHER')),
  principal_amount numeric(28, 12) NOT NULL,
  interest_rate numeric(18, 10),
  minimum_payment numeric(28, 12),
  currency_code char(3) NOT NULL REFERENCES currency(code),
  maturity_date date,
  metadata jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE debt_payoff_scenario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_account_id uuid NOT NULL REFERENCES debt_account(id) ON DELETE CASCADE,
  extra_payment numeric(28, 12) NOT NULL DEFAULT 0,
  payoff_date date,
  saved_interest numeric(28, 12),
  result jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tangible_asset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  name text NOT NULL,
  asset_type text NOT NULL,
  tracking_only boolean NOT NULL DEFAULT false,
  currency_code char(3) NOT NULL REFERENCES currency(code),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tangible_asset_valuation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tangible_asset_id uuid NOT NULL REFERENCES tangible_asset(id) ON DELETE CASCADE,
  valued_on date NOT NULL,
  value_amount numeric(28, 12) NOT NULL,
  source text NOT NULL,
  UNIQUE (tangible_asset_id, valued_on)
);

-- ---------------------------------------------------------------------------
-- Tax, reporting and sharing
-- ---------------------------------------------------------------------------

CREATE TABLE tax_residency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  country_code char(2) NOT NULL,
  valid_from date NOT NULL,
  valid_to date,
  metadata jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE tax_year_configuration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  jurisdiction char(2) NOT NULL,
  tax_year integer NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  rules_version text NOT NULL,
  UNIQUE (user_id, jurisdiction, tax_year)
);

CREATE TABLE tax_worksheet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  portfolio_id uuid REFERENCES portfolio(id) ON DELETE CASCADE,
  jurisdiction char(2) NOT NULL,
  tax_year integer NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CALCULATED', 'REVIEWED', 'EXPORTED', 'LOCKED')),
  method text,
  result jsonb NOT NULL DEFAULT '{}',
  calculation_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, portfolio_id, jurisdiction, tax_year)
);

CREATE TABLE tax_loss_harvest_candidate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_worksheet_id uuid NOT NULL REFERENCES tax_worksheet(id) ON DELETE CASCADE,
  instrument_id uuid NOT NULL REFERENCES instrument(id),
  tax_lot_id uuid REFERENCES tax_lot(id),
  unrealized_loss numeric(28, 12) NOT NULL,
  estimated_tax_saving numeric(28, 12),
  wash_sale_start date,
  wash_sale_end date,
  status text NOT NULL DEFAULT 'CANDIDATE' CHECK (status IN ('CANDIDATE', 'REVIEWED', 'DISMISSED', 'EXECUTED'))
);

CREATE TABLE custom_group (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
  name text NOT NULL,
  group_type text NOT NULL CHECK (group_type IN ('LABEL', 'STRATEGY', 'CATEGORY', 'CUSTOM')),
  UNIQUE (portfolio_id, name)
);

CREATE TABLE custom_group_member (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES custom_group(id) ON DELETE CASCADE,
  instrument_id uuid REFERENCES instrument(id) ON DELETE CASCADE,
  financial_account_id uuid REFERENCES financial_account(id) ON DELETE CASCADE,
  label_value text,
  UNIQUE (group_id, instrument_id, financial_account_id, label_value),
  CHECK (instrument_id IS NOT NULL OR financial_account_id IS NOT NULL OR label_value IS NOT NULL)
);

CREATE TABLE report_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  portfolio_id uuid REFERENCES portfolio(id) ON DELETE CASCADE,
  report_type text NOT NULL,
  period_start date,
  period_end date,
  filters jsonb NOT NULL DEFAULT '{}',
  output_format text NOT NULL CHECK (output_format IN ('JSON', 'CSV', 'XLSX', 'PDF')),
  source_version text NOT NULL DEFAULT 'ledger-v1',
  status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED')),
  object_storage_key text,
  artifact_expires_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE portfolio_share_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES app_user(id),
  access_id text NOT NULL UNIQUE,
  token_hash text,
  scope text NOT NULL DEFAULT 'VIEW' CHECK (scope IN ('RESTRICTED_VIEW', 'VIEW')),
  exposure_policy jsonb NOT NULL DEFAULT '{}',
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE accountant_share (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES app_user(id),
  grantee_email text NOT NULL,
  scope jsonb NOT NULL,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Specialist instruments and scenarios
-- ---------------------------------------------------------------------------

CREATE TABLE bond_profile (
  instrument_id uuid PRIMARY KEY REFERENCES instrument(id) ON DELETE CASCADE,
  issuer_type text CHECK (issuer_type IN ('GOVERNMENT', 'CORPORATE', 'PROVINCIAL', 'MUNICIPAL', 'OTHER')),
  issuer_name text,
  coupon_rate numeric(18, 10),
  coupon_frequency text,
  issue_date date,
  maturity_date date,
  day_count_convention text,
  face_value numeric(28, 12),
  benchmark_spread numeric(18, 10),
  credit_rating text
);

CREATE TABLE yield_curve_observation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code char(3) NOT NULL REFERENCES currency(code),
  observed_on date NOT NULL,
  tenor_days integer NOT NULL CHECK (tenor_days > 0),
  yield_rate numeric(18, 10) NOT NULL,
  source text NOT NULL,
  UNIQUE (currency_code, observed_on, tenor_days, source)
);

CREATE TABLE bond_cashflow (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid NOT NULL REFERENCES instrument(id) ON DELETE CASCADE,
  payment_date date NOT NULL,
  amount numeric(28, 12) NOT NULL,
  currency_code char(3) NOT NULL REFERENCES currency(code),
  cashflow_type text NOT NULL CHECK (cashflow_type IN ('COUPON', 'PRINCIPAL', 'OTHER'))
);

CREATE TABLE option_contract (
  instrument_id uuid PRIMARY KEY REFERENCES instrument(id) ON DELETE CASCADE,
  underlying_instrument_id uuid NOT NULL REFERENCES instrument(id),
  option_type text NOT NULL CHECK (option_type IN ('CALL', 'PUT')),
  strike_price numeric(28, 12) NOT NULL,
  expiry_at timestamptz NOT NULL,
  contract_multiplier numeric(28, 12) NOT NULL DEFAULT 100,
  implied_volatility numeric(18, 10),
  delta numeric(18, 10),
  gamma numeric(18, 10),
  theta numeric(18, 10),
  vega numeric(18, 10),
  rho numeric(18, 10)
);

CREATE TABLE option_lifecycle_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_instrument_id uuid NOT NULL REFERENCES option_contract(instrument_id),
  ledger_transaction_id uuid REFERENCES ledger_transaction(id),
  event_type text NOT NULL CHECK (event_type IN ('OPEN', 'CLOSE', 'ROLL', 'ASSIGNMENT', 'EXERCISE', 'EXPIRY', 'PARTIAL_CLOSE')),
  occurred_at timestamptz NOT NULL,
  quantity numeric(28, 12) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE backtest_scenario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  portfolio_id uuid REFERENCES portfolio(id) ON DELETE CASCADE,
  name text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  assumptions jsonb NOT NULL,
  allocations jsonb NOT NULL,
  results jsonb,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'RUNNING', 'SUCCEEDED', 'FAILED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE screener_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  portfolio_id uuid REFERENCES portfolio(id) ON DELETE CASCADE,
  name text NOT NULL,
  filters jsonb NOT NULL,
  calculation_version text NOT NULL DEFAULT 'screener-watchlist-v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX screener_watchlist_user_idx ON screener_watchlist (user_id, updated_at DESC);

CREATE TABLE allocation_target (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES portfolio(id) ON DELETE CASCADE,
  dimension text NOT NULL CHECK (dimension IN ('ASSET_CLASS', 'SECTOR', 'REGION', 'CURRENCY', 'HOLDING')),
  target_key text NOT NULL,
  target_label text NOT NULL,
  target_percentage numeric(7, 4) NOT NULL CHECK (target_percentage >= 0 AND target_percentage <= 100),
  calculation_version text NOT NULL DEFAULT 'allocation-targets-v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portfolio_id, dimension, target_key)
);

CREATE INDEX allocation_target_portfolio_dimension_idx
  ON allocation_target (portfolio_id, dimension, target_key);

CREATE TABLE retirement_scenario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  goal_id uuid REFERENCES goal(id) ON DELETE CASCADE,
  assumptions jsonb NOT NULL,
  tax_assumptions jsonb NOT NULL DEFAULT '{}',
  inflation_assumptions jsonb NOT NULL DEFAULT '{}',
  result jsonb,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'RUNNING', 'SUCCEEDED', 'FAILED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE monte_carlo_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retirement_scenario_id uuid NOT NULL REFERENCES retirement_scenario(id) ON DELETE CASCADE,
  iterations integer NOT NULL CHECK (iterations > 0),
  seed bigint,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Notifications, alerts, AI, addons and devices
-- ---------------------------------------------------------------------------

CREATE TABLE alert_rule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  portfolio_id uuid REFERENCES portfolio(id) ON DELETE CASCADE,
  name text NOT NULL,
  alert_type text NOT NULL,
  condition_json jsonb NOT NULL,
  channels jsonb NOT NULL DEFAULT '["IN_APP"]',
  is_active boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  alert_rule_id uuid REFERENCES alert_rule(id) ON DELETE SET NULL,
  notification_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  severity text NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'SUCCESS', 'WARNING', 'ERROR')),
  payload jsonb NOT NULL DEFAULT '{}',
  read_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE addon_manifest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES app_user(id) ON DELETE CASCADE,
  slug text NOT NULL,
  version text NOT NULL,
  manifest_json jsonb NOT NULL,
  status text NOT NULL DEFAULT 'INSTALLED' CHECK (status IN ('INSTALLED', 'DISABLED', 'REVOKED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, slug, version)
);

CREATE TABLE addon_grant (
  addon_id uuid NOT NULL REFERENCES addon_manifest(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  permission text NOT NULL CHECK (permission IN ('PORTFOLIO_READ', 'ACTIVITY_READ', 'MARKET_DATA_READ', 'ACTIVITY_PROPOSE', 'ACTIVITY_MANAGE', 'SECRET_READ')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (addon_id, user_id, permission)
);

CREATE TABLE addon_secret_ref (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_id uuid NOT NULL REFERENCES addon_manifest(id) ON DELETE CASCADE,
  secret_name text NOT NULL,
  vault_path text NOT NULL CHECK (vault_path LIKE 'vault://%'),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  revoked_at timestamptz,
  UNIQUE (addon_id, secret_name)
);

CREATE TABLE addon_event_hook (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_id uuid NOT NULL REFERENCES addon_manifest(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  revoked_at timestamptz,
  UNIQUE (addon_id, event_name)
);

CREATE TABLE addon_asset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_id uuid NOT NULL REFERENCES addon_manifest(id) ON DELETE CASCADE,
  asset_path text NOT NULL,
  content_type text NOT NULL,
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-fA-F]{64}$'),
  UNIQUE (addon_id, asset_path)
);

CREATE TABLE addon_sandbox_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_id uuid NOT NULL REFERENCES addon_manifest(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'STOPPED' CHECK (status IN ('STOPPED', 'RUNNING', 'REVOKED')),
  permissions jsonb NOT NULL DEFAULT '[]',
  asset_root text NOT NULL,
  ledger_access text NOT NULL DEFAULT 'none' CHECK (ledger_access = 'none'),
  started_at timestamptz,
  stopped_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX addon_sandbox_run_addon_idx ON addon_sandbox_run (addon_id, updated_at DESC);

CREATE TABLE push_consent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('PUSH', 'IN_APP', 'EMAIL')),
  status text NOT NULL DEFAULT 'GRANTED' CHECK (status IN ('GRANTED', 'REVOKED')),
  device_label text NOT NULL DEFAULT '',
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX push_consent_user_idx ON push_consent (user_id, created_at DESC);

CREATE TABLE model_session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
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

CREATE INDEX model_session_user_idx ON model_session (user_id, created_at DESC);

CREATE TABLE ai_access_grant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('RESTRICTED_VIEW', 'VIEW', 'PROPOSE', 'MANAGE')),
  allowed_resources jsonb NOT NULL DEFAULT '[]',
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_action_proposal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  grant_id uuid REFERENCES ai_access_grant(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  requested_scope text NOT NULL,
  preview jsonb NOT NULL,
  status text NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'CONFIRMED', 'CANCELLED', 'EXECUTED', 'UNDONE', 'EXPIRED')),
  undo_token_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  executed_at timestamptz,
  undone_at timestamptz
);

CREATE TABLE device_pairing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  device_name text NOT NULL,
  pairing_code_hash text NOT NULL,
  public_key text,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAIRED', 'REVOKED', 'EXPIRED')),
  expires_at timestamptz NOT NULL,
  paired_at timestamptz,
  revoked_at timestamptz
);

CREATE TABLE encrypted_sync_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  device_pairing_id uuid REFERENCES device_pairing(id) ON DELETE SET NULL,
  ciphertext_ref text NOT NULL,
  encryption_version text NOT NULL,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Operations, deployment and incident loop
-- ---------------------------------------------------------------------------

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES app_user(id) ON DELETE SET NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('USER', 'SYSTEM', 'AGENT', 'PROVIDER', 'ADMIN')),
  actor_id text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before_json jsonb,
  after_json jsonb,
  correlation_id text,
  trace_id text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE deployment_release (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  git_sha text NOT NULL,
  image_digest text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('LOCAL', 'PREVIEW', 'STAGING', 'PRODUCTION')),
  status text NOT NULL CHECK (status IN ('BUILT', 'DEPLOYED', 'VERIFIED', 'ROLLED_BACK', 'FAILED')),
  migration_version text,
  deployed_at timestamptz,
  verified_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE incident (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('SEV-0', 'SEV-1', 'SEV-2', 'SEV-3')),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'TRIAGED', 'INVESTIGATING', 'FIX_IN_PROGRESS', 'VERIFYING', 'RESOLVED', 'CLOSED', 'ESCALATED')),
  title text NOT NULL,
  service text,
  environment text,
  affected_release_id uuid REFERENCES deployment_release(id),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  root_cause text,
  impact_summary text,
  evidence jsonb NOT NULL DEFAULT '{}',
  UNIQUE (fingerprint, status)
);

CREATE TABLE incident_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incident(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('ALERT', 'LOG', 'TRACE', 'DEPLOYMENT', 'COMMENT', 'STATUS_CHANGE', 'MITIGATION', 'RELEASE', 'VERIFICATION')),
  actor_type text NOT NULL CHECK (actor_type IN ('SYSTEM', 'AGENT', 'USER')),
  actor_id text,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE agent_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid REFERENCES incident(id) ON DELETE SET NULL,
  user_id uuid REFERENCES app_user(id) ON DELETE SET NULL,
  agent_role text NOT NULL,
  run_type text NOT NULL CHECK (run_type IN ('TRIAGE', 'DIAGNOSIS', 'PATCH', 'TEST', 'RELEASE', 'KNOWLEDGE_UPDATE')),
  status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'BLOCKED', 'CANCELLED')),
  input_context jsonb NOT NULL DEFAULT '{}',
  output_summary jsonb,
  branch_name text,
  pull_request_url text,
  tool_calls jsonb NOT NULL DEFAULT '[]',
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE backup_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type text NOT NULL CHECK (backup_type IN ('DATABASE', 'OBJECT_STORAGE', 'FULL_VM', 'CONFIGURATION')),
  storage_location text NOT NULL,
  checksum_sha256 text NOT NULL,
  encrypted boolean NOT NULL DEFAULT true,
  size_bytes bigint,
  status text NOT NULL CHECK (status IN ('STARTED', 'SUCCEEDED', 'FAILED', 'RESTORED', 'EXPIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  restored_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'
);

-- ---------------------------------------------------------------------------
-- Updated-at triggers and useful read models
-- ---------------------------------------------------------------------------

CREATE TRIGGER app_user_updated_at BEFORE UPDATE ON app_user
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER user_preference_updated_at BEFORE UPDATE ON user_preference
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER provider_updated_at BEFORE UPDATE ON provider
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER external_connection_updated_at BEFORE UPDATE ON external_connection
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER provider_account_updated_at BEFORE UPDATE ON provider_account
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER portfolio_updated_at BEFORE UPDATE ON portfolio
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER financial_account_updated_at BEFORE UPDATE ON financial_account
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER instrument_updated_at BEFORE UPDATE ON instrument
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER ledger_transaction_updated_at BEFORE UPDATE ON ledger_transaction
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER import_mapping_updated_at BEFORE UPDATE ON import_mapping
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER transaction_rule_updated_at BEFORE UPDATE ON transaction_rule
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tax_worksheet_updated_at BEFORE UPDATE ON tax_worksheet
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX external_connection_user_status_idx
  ON external_connection (user_id, status);
CREATE INDEX sync_run_connection_created_idx
  ON sync_run (connection_id, created_at DESC);
CREATE INDEX raw_payload_connection_captured_idx
  ON raw_provider_payload (connection_id, captured_at DESC);
CREATE INDEX portfolio_snapshot_time_idx
  ON portfolio_snapshot (portfolio_id, snapshot_at DESC);
CREATE INDEX income_event_portfolio_payment_idx
  ON income_event (portfolio_id, payment_date);
CREATE INDEX performance_observation_portfolio_period_idx
  ON performance_observation (portfolio_id, period_end DESC);
CREATE INDEX reconciliation_open_idx
  ON reconciliation_issue (portfolio_id, status, severity);
CREATE INDEX ledger_transaction_account_date_idx
  ON ledger_transaction (financial_account_id, effective_date DESC);
CREATE INDEX notification_user_unread_idx
  ON notification (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX audit_entity_idx
  ON audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX incident_open_idx
  ON incident (status, severity, last_seen_at DESC);

CREATE VIEW v_current_open_tax_lots AS
SELECT
  tl.portfolio_id,
  tl.financial_account_id,
  tl.instrument_id,
  SUM(tl.remaining_quantity) AS quantity,
  SUM(tl.cost_basis_amount * tl.remaining_quantity / NULLIF(tl.original_quantity, 0)) AS cost_basis_amount,
  tl.currency_code
FROM tax_lot tl
WHERE tl.remaining_quantity > 0
GROUP BY tl.portfolio_id, tl.financial_account_id, tl.instrument_id, tl.currency_code;

CREATE VIEW v_open_reconciliation_issues AS
SELECT *
FROM reconciliation_issue
WHERE status IN ('OPEN', 'IN_REVIEW');

CREATE VIEW v_unhealthy_connections AS
SELECT
  ec.id,
  ec.user_id,
  p.slug AS provider,
  ec.status,
  ec.last_successful_sync_at,
  ec.last_error_code,
  ec.last_error_message
FROM external_connection ec
JOIN provider p ON p.id = ec.provider_id
WHERE ec.status IN ('DEGRADED', 'EXPIRED', 'REVOKED', 'ERROR')
   OR (ec.last_successful_sync_at IS NOT NULL AND ec.last_successful_sync_at < now() - interval '48 hours');

-- Seed ISO currencies used by the default private deployment.
INSERT INTO currency (code, name, minor_units)
VALUES
  ('EUR', 'Euro', 2),
  ('USD', 'United States Dollar', 2),
  ('GBP', 'Pound Sterling', 2),
  ('CHF', 'Swiss Franc', 2)
ON CONFLICT (code) DO NOTHING;

-- Expand/contract: community content is isolated from the canonical ledger.
CREATE TABLE IF NOT EXISTS community_post (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  visibility text NOT NULL CHECK (visibility IN ('PUBLIC', 'PRIVATE')),
  status text NOT NULL CHECK (status IN ('VISIBLE', 'PRIVATE', 'PENDING', 'REJECTED', 'DELETED')),
  title text NOT NULL,
  body text NOT NULL,
  public_metrics jsonb NOT NULL DEFAULT '{}',
  moderation_reason text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_post_feed_idx ON community_post (status, visibility, created_at DESC);
CREATE INDEX IF NOT EXISTS community_post_owner_idx ON community_post (owner_user_id, created_at DESC);


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
