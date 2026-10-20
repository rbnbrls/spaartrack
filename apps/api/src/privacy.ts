// Privacy export/deletion contract for US-0206 (TC-US-0206 / -A / -B).
//
// This module holds the pure parts of the privacy boundary so they can be
// verified without a database: the recursive export redaction, the export
// bundle assembly, the retention/deletion semantics and the deletion receipt.
// Every database statement stays in the application route; nothing here
// mutates the canonical ledger.

export const PRIVACY_EXPORT_VERSION = "privacy-export-v2";
export const PRIVACY_DELETION_METHOD = "soft-delete-and-revoke";

/** Tombstones are the durable proof of a deletion request. */
export const PRIVACY_TOMBSTONE_RETENTION_DAYS = 365;

/**
 * Keys whose value IS credential material. Matching is on the normalized key
 * name, so `refreshToken`, `refresh_token` and `refresh-token` are all caught.
 */
const EXACT_SENSITIVE_KEYS = new Set([
  "token",
  "token_hash",
  "access_token",
  "refresh_token",
  "id_token",
  "bearer_token",
  "session_token",
  "oauth_token",
  "secret",
  "secret_value",
  "secret_ciphertext",
  "secret_iv",
  "secret_tag",
  "client_secret",
  "api_secret",
  "credential_secret",
  "credential_value",
  "credentials",
  "vault_path",
  "vault_key",
  "api_key",
  "apikey",
  "private_key",
  "encryption_key",
  "signing_key",
  "password",
  "passphrase",
  "authorization",
  "cookie",
  "set_cookie",
  "iban",
  "account_number"
]);

/**
 * Key suffixes that always denote credential material. `secret_kind` is
 * deliberately absent: it names the *kind* of credential, not the credential.
 * `credential_ref_id` is deliberately absent: it is an opaque surrogate key.
 */
const SENSITIVE_KEY_SUFFIXES = [
  "_token",
  "_secret",
  "_password",
  "_passphrase",
  "_private_key",
  "_api_key",
  "_ciphertext",
  "_credential_value",
  "_credential_secret"
];

export function normalizePrivacyKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function isSensitivePrivacyKey(key: string): boolean {
  const normalized = normalizePrivacyKey(key);
  if (EXACT_SENSITIVE_KEYS.has(normalized)) return true;
  return SENSITIVE_KEY_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

/**
 * Recursively drop credential-bearing keys. Applied to every export section,
 * including nested JSONB documents, so a column added later cannot leak by
 * accident. The column allow-list on the SQL side stays the primary control;
 * this is the fail-closed second layer.
 */
export function privacyExportJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(privacyExportJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !isSensitivePrivacyKey(key))
      .map(([key, child]) => [key, privacyExportJson(child)])
  );
}

export type PrivacyExportInput = {
  userId: string;
  generatedAt: string;
  sections: Record<string, unknown[]>;
};

/**
 * Assemble the export bundle. Every section is passed through the redaction
 * layer, so the contract holds for all sections instead of a hand-picked
 * subset. The section index states exactly which sections were exported and
 * how many rows each carried, so a consumer can tell a complete export from a
 * partial one.
 */
export function buildPrivacyExport(input: PrivacyExportInput): Record<string, unknown> {
  const sections: Record<string, unknown> = {};
  const index: Array<{ section: string; rows: number }> = [];
  for (const [name, rows] of Object.entries(input.sections)) {
    const redacted = privacyExportJson(rows);
    sections[name] = redacted;
    index.push({ section: name, rows: Array.isArray(redacted) ? redacted.length : 0 });
  }
  return {
    user_id: input.userId,
    format: "json",
    scope: "user-owned",
    generated_at: input.generatedAt,
    export_version: PRIVACY_EXPORT_VERSION,
    calculation_version: "privacy-export-v2",
    read_only: true,
    complete: true,
    section_index: index,
    retention: PRIVACY_RETENTION_POLICY,
    ...sections
  };
}

/**
 * Retention and deletion semantics that travel with every export so the data
 * subject is told how long each category is kept and what a deletion does.
 */
export const PRIVACY_RETENTION_POLICY = {
  policy_id: "privacy-retention-v1",
  ledger: {
    classification: "vertrouwelijk - financieel",
    retention: "portfoliolevensduur; archiveren in plaats van wissen",
    physical_delete_on_user_request: false,
    note: "het ledger blijft behouden als correctie/void-historie; de gebruikerskoppeling wordt geanonimiseerd"
  },
  raw_payload: {
    classification: "beperkt - bronmateriaal",
    retention_days: 30,
    physical_delete_on_user_request: false,
    note: "referenties en checksums worden geexporteerd; broninhoud volgt de bronretentie"
  },
  audit_log: {
    classification: "intern - observeerbaar",
    retention: "langer dan operationele logs",
    physical_delete_on_user_request: false,
    note: "audit-events blijven staan om de verwijdering te kunnen aantonen"
  },
  identity: {
    classification: "intern - identificeerbaar",
    retention: "accountlevensduur + soft-delete",
    physical_delete_on_user_request: false,
    note: "e-mail en weergavenaam worden bij verwijdering geanonimiseerd"
  },
  deletion: {
    method: PRIVACY_DELETION_METHOD,
    ledger_rows_deleted: 0,
    sessions: "revoked_at",
    totp_factors: "revoked_at",
    oidc_states: "consumed_at",
    portfolio_grants: "revoked_at (subject-held and grants on subject-owned portfolios)",
    portfolio_share_links: "revoked_at",
    accountant_shares: "revoked_at",
    owned_portfolios: "ARCHIVED + privacy_scope PRIVATE, hidden from non-ACTIVE member reads",
    provider_connections: "REVOKED + disconnected_at",
    connection_scopes: "revoked_at",
    consent_records: "REVOKED + revoked_at",
    credential_references: "revoked_at",
    push_consents: "REVOKED + revoked_at",
    user_profile: "email/display_name/tax_residency_country geanonimiseerd",
    auth_identities: "verwijderd",
    tax_residency: "verwijderd",
    tombstone: "user_deletion_tombstone (replayable on restore)"
  }
} as const;

export type PrivacyDeletionCounts = {
  sessions: number;
  totp_factors: number;
  oidc_states: number;
  grants: number;
  portfolio_share_links: number;
  accountant_shares: number;
  owned_portfolios: number;
  provider_connections: number;
  connection_scopes: number;
  consent_records: number;
  credential_references: number;
  push_consents: number;
  auth_identities: number;
  tax_residency: number;
};

/**
 * Build the deletion receipt. The receipt is the caller's evidence that the
 * deletion really happened and what it covered.
 */
export function buildPrivacyDeletionReceipt(input: {
  method?: string;
  counts: PrivacyDeletionCounts;
  auditEventId: string;
  tombstoneId: string;
  retentionUntil: string;
  traceId?: string | null;
  correlationId?: string | null;
}): Record<string, unknown> {
  return {
    method: input.method ?? PRIVACY_DELETION_METHOD,
    ledger_rows_deleted: 0,
    ledger_preserved: true,
    revoked: {
      sessions: input.counts.sessions,
      totp_factors: input.counts.totp_factors,
      oidc_states: input.counts.oidc_states,
      portfolio_grants: input.counts.grants,
      portfolio_share_links: input.counts.portfolio_share_links,
      accountant_shares: input.counts.accountant_shares,
      owned_portfolios: input.counts.owned_portfolios,
      provider_connections: input.counts.provider_connections,
      connection_scopes: input.counts.connection_scopes,
      consent_records: input.counts.consent_records,
      credential_references: input.counts.credential_references,
      push_consents: input.counts.push_consents
    },
    anonymized: {
      user_profile: true,
      auth_identities_removed: input.counts.auth_identities,
      tax_residency_removed: input.counts.tax_residency
    },
    credential_material_purged_from_vault: false,
    audit_event_id: input.auditEventId,
    tombstone_id: input.tombstoneId,
    retention_until: input.retentionUntil,
    trace_id: input.traceId ?? null,
    correlation_id: input.correlationId ?? null
  };
}
