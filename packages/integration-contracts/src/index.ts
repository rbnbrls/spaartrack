export type ConnectionStatus = "CREATED" | "AUTH_PENDING" | "AUTHORIZED" | "SYNCING" | "HEALTHY" | "ERROR" | "RETRYING" | "REVOKED";

export type InstitutionAvailabilityStatus = "AVAILABLE" | "DEGRADED" | "UNAVAILABLE";

export interface BankInstitution {
  institution_id: string;
  provider_slug: "gocardless";
  name: string;
  region: string;
  country_code: string;
  capabilities: readonly string[];
  availability: { status: InstitutionAvailabilityStatus; checked_at: string; message: string };
}

export interface BankConsentRequisition {
  requisition_id: string;
  institution_id: string;
  redirect_uri: string;
  language: string;
  consent_state: "PENDING" | "AUTHORIZED" | "FAILED";
  authorization_url: string;
  calculation_version: "bank-consent-v1";
}

export interface BankAccountSelection {
  id: string;
  account_type: "CURRENT" | "SAVINGS" | "CREDIT_CARD";
  name: string;
  base_currency_code: string;
  selected: boolean;
}

export interface BankBalanceSnapshot {
  account_id: string;
  currency_code: string;
  balance: string;
  as_of: string;
  provider_id: string;
}

export interface BankTransactionCandidate {
  external_id: string;
  account_id: string;
  normalized_amount: string;
  currency_code: string;
  occurred_at: string;
  dedupe_key: string;
}

export interface BankConnectionRevokeResult {
  status: "DISCONNECTED";
  provider_revoke: { called: boolean; status: "REVOKED"; provider: string };
  secret_cleanup: { credential_reference_revoked: boolean; token_material: "not_stored" };
  calculation_version: "bank-connection-revoke-v1";
  ledger_untouched: true;
}

export interface BunqOAuthDeploymentGateResult {
  eligible: boolean;
  oauth_status: "NOT_ACTIVATED" | "BUNQ_OAUTH_DISABLED";
  gate_failures: string[];
  human_approval_required: true;
  calculation_version: "bunq-oauth-deployment-gate-v1";
}

export interface BankReconnectStatus {
  status: "EXPIRED" | "AUTHORIZED" | "PENDING";
  historical_data_preserved: true;
  reconnect_required: boolean;
  calculation_version: "bank-reconnect-v1";
  no_double_counting: true;
}

export interface ProviderAdapter {
  readonly providerKey: string;
  readonly capabilities: readonly string[];
  authorize(input: AuthorizationInput): Promise<AuthorizationResult>;
  sync(input: SyncInput): Promise<SyncResult>;
  revoke(connectionId: string): Promise<void>;
}

export interface AuthorizationInput {
  connectionId: string;
  redirectUri?: string;
  state: string;
}

export interface AuthorizationResult {
  status: ConnectionStatus;
  authorizationUrl?: string;
}

export interface SyncInput {
  connectionId: string;
  cursor?: string;
  asOf?: string;
}

export interface SyncResult {
  cursor?: string;
  externalAccounts: number;
  candidates: number;
  duplicates: number;
  attentionItems: number;
}

export interface ProviderFixturePayload {
  schema_version: string;
  cursor: string;
  accounts: readonly Record<string, unknown>[];
  positions: readonly Record<string, unknown>[];
  activities: readonly Record<string, unknown>[];
  dividends: readonly Record<string, unknown>[];
}

export interface ProviderSyncSummary extends SyncResult {
  status: "SUCCEEDED" | "PARTIAL" | "FAILED";
  syncRunId: string;
  recordsSeen: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsRejected: number;
  rateLimit: { attempts: number; retryAfterSeconds: number };
  calculationVersion: "provider-sync-v1";
  readOnly: true;
}

export interface DegiroImportCandidate {
  row_number: number;
  activity_type: "BUY" | "SELL" | "DIVIDEND" | "FEE" | "TAX" | "OTHER";
  effective_date: string;
  isin?: string;
  quantity?: string;
  price?: string;
  gross_amount: string;
  fee_amount: string;
  tax_amount: string;
  fx_rate: string;
  cash_amount: string;
  currency_code: string;
  balance_after?: string;
  external_id: string;
}

export interface DegiroImportPreview {
  provider: "DEGIRO";
  readOnly: true;
  layout: { parserVersion: "degiro-csv-v1"; status: "MATCHED" | "REVIEW_REQUIRED"; columns: string[] };
  candidates: readonly DegiroImportCandidate[];
  reconciliation: { status: "MATCHED" | "BALANCE_MISMATCH" | "REVIEW_REQUIRED"; statementEndingBalance: string; calculatedBalance: string; difference: string };
}
