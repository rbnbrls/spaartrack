// Privacy export data access for US-0206 (TC-US-0206-A).
//
// Every statement here is scoped to the authenticated principal. Two rules
// govern this file:
//
//  1. The ledger is READ-ONLY. The export never writes, and the deletion path
//     never physically deletes a ledger row (ADR-0002, AGENTS.md).
//  2. Credential material is never SELECTed. `credential_secret_ref.vault_path`
//     points at the secret store, so it is excluded by the column allow-list
//     even though it is not itself a secret value.
//
// Scope: the bundle is strictly `user-owned` (row ownership by `user_id` or
// by `owner_user_id`). Granted-portfolio data is NOT included: including it
// would expose a third party's financial history through the grantee's export.
// A grantee's export already advertises their own membership via the `grants`
// section, but no portfolio/ledger rows follow for those `portfolio_id`s.
// The `grants` section itself is the grantee's own data (their membership rows).
//
// Excluded from the export by design (and why):
//   - user_session, user_totp_factor, oidc_login_state: carry hashing/
//     encrypted secret material (token_hash, secret_ciphertext/iv/tag,
//     code_hash, state_hash). Exporting the material would violate the
//     \"no credential material by key OR value\" contract. Sessions, factors and
//     OIDC states are transient authentication artefacts that a user can
//     re-create; they do not carry portable personal content.
//   - portfolio_share_link, accountant_share, push_consent: scoped to the
//     owner and already represented in the `grants` / `provider` boundaries;
//     account linking is out of scope for the GDPR Art. 20 portable bundle.
//   - auth_identity IS included (below) because it IS personal data
//     (provider subject + email) and it is PHYSICALLY DELETED on user
//     deletion — a data subject would otherwise never obtain a copy.

export type PrivacyExportRow = Record<string, unknown>;

export type PrivacyExportSection = PrivacyExportRow[];

export type PrivacyExportSections = Record<string, PrivacyExportSection>;

export type QueryRunner = (text: string, values?: unknown[]) => Promise<{ rows: PrivacyExportRow[] }>;

const OWNED_PORTFOLIOS = `SELECT id FROM spaartrack.portfolio WHERE owner_user_id = $1`;
const ACTIVE_GRANTED_PORTFOLIOS_SQL = `SELECT pm.portfolio_id FROM spaartrack.portfolio_member pm WHERE pm.user_id = $1 AND pm.revoked_at IS NULL`;

/**
 * Build every export section. Each query is parameterised by the
 * authenticated user id; there is no way to request another principal's data
 * because the id never comes from the request.
 */
export async function collectPrivacyExportSections(run: QueryRunner, userId: string): Promise<PrivacyExportSections> {
  // Every section is run sequentially: callers (including the SQL-contract
  // tests) often pass a single pg Client inside BEGIN ... ROLLBACK, and
  // Promise.all over one Client multiplexes queries in a way that makes
  // transaction control brittle. Serial execution is only ~tens of ms slower
  // and stays correct for both pooled and single-connection callers.
  const user = await run(
    `SELECT id, email, display_name, status, locale, timezone, default_currency_code, tax_residency_country, created_at, updated_at, deleted_at
     FROM spaartrack.app_user WHERE id = $1`,
    [userId]
  );
  const portfolios = await run(
    `SELECT id, name, description, status, reporting_currency_code, privacy_scope, created_at, updated_at, archived_at
     FROM spaartrack.portfolio WHERE owner_user_id = $1 ORDER BY created_at`,
    [userId]
  );
  const grants = await run(
    `SELECT portfolio_id, role, created_at, revoked_at
     FROM spaartrack.portfolio_member WHERE user_id = $1 ORDER BY created_at`,
    [userId]
  );
  const financialAccounts = await run(
    `SELECT fa.id, fa.portfolio_id, fa.provider_account_id, fa.name, fa.account_type, fa.tracking_mode,
            fa.status, fa.institution_name, fa.base_currency_code, fa.opened_on, fa.closed_on, fa.created_at, fa.updated_at
     FROM spaartrack.financial_account fa
     WHERE fa.portfolio_id IN (${OWNED_PORTFOLIOS})
     ORDER BY fa.created_at`,
    [userId]
  );
  const ledger = await run(
    `SELECT lt.id, lt.portfolio_id, lt.financial_account_id, lt.activity_type, lt.activity_subtype, lt.state,
            lt.occurred_at, lt.settlement_at, lt.effective_date, lt.description, lt.source_type, lt.external_id,
            lt.is_external_flow, lt.paired_transaction_id, lt.import_session_id, lt.metadata,
            lt.voided_at, lt.created_at, lt.updated_at
     FROM spaartrack.ledger_transaction lt
     WHERE lt.portfolio_id IN (${OWNED_PORTFOLIOS})
     ORDER BY lt.occurred_at, lt.id`,
    [userId]
  );
  const ledgerEntries = await run(
    `SELECT le.id, le.ledger_transaction_id, le.financial_account_id, le.instrument_id, le.entry_kind,
            le.direction, le.quantity, le.unit_price, le.amount, le.currency_code,
            le.fee_amount, le.tax_amount, le.notes
     FROM spaartrack.ledger_entry le
     JOIN spaartrack.ledger_transaction lt ON lt.id = le.ledger_transaction_id
     WHERE lt.portfolio_id IN (${OWNED_PORTFOLIOS})
     ORDER BY le.ledger_transaction_id, le.id`,
    [userId]
  );
  const rawPayloads = await run(
    `SELECT rp.id, rp.connection_id, rp.sync_run_id, rp.import_file_id, rp.payload_type, rp.provider_endpoint,
            rp.content_type, rp.checksum_sha256, rp.schema_version, rp.captured_at, rp.retention_until,
            (rp.object_storage_key IS NOT NULL) AS has_object_storage_reference
     FROM spaartrack.raw_provider_payload rp
     WHERE rp.connection_id IN (SELECT ec.id FROM spaartrack.external_connection ec WHERE ec.user_id = $1)
        OR rp.import_file_id IN (SELECT f.id FROM spaartrack.import_file f WHERE f.user_id = $1)
     ORDER BY rp.captured_at, rp.id`,
    [userId]
  );
  const reports = await run(
    `SELECT rr.id, rr.portfolio_id, rr.report_type, rr.period_start, rr.period_end, rr.filters,
            rr.output_format, rr.source_version, rr.status, rr.artifact_expires_at, rr.error_message,
            rr.created_at, rr.completed_at
     FROM spaartrack.report_run rr WHERE rr.user_id = $1 ORDER BY rr.created_at`,
    [userId]
  );
  const connections = await run(
    `SELECT ec.id, ec.provider_id, p.slug AS provider_slug, p.name AS provider_name, ec.auth_mode, ec.status,
            ec.display_name, ec.credential_ref_id, ec.consent_expires_at, ec.last_sync_started_at,
            ec.last_sync_completed_at, ec.last_successful_sync_at, ec.last_error_code, ec.last_error_message,
            ec.provider_metadata, ec.created_at, ec.updated_at, ec.disconnected_at
     FROM spaartrack.external_connection ec
     JOIN spaartrack.provider p ON p.id = ec.provider_id
     WHERE ec.user_id = $1 ORDER BY ec.created_at`,
    [userId]
  );
  const connectionScopes = await run(
    `SELECT cs.connection_id, cs.scope, cs.granted_at, cs.revoked_at
     FROM spaartrack.connection_scope cs
     WHERE cs.connection_id IN (SELECT ec.id FROM spaartrack.external_connection ec WHERE ec.user_id = $1)
     ORDER BY cs.connection_id, cs.scope`,
    [userId]
  );
  const consentRecords = await run(
    `SELECT cr.id, cr.connection_id, cr.consent_type, cr.external_consent_id, cr.state, cr.scopes,
            cr.authorized_at, cr.expires_at, cr.revoked_at, cr.created_at
     FROM spaartrack.consent_record cr
     WHERE cr.connection_id IN (SELECT ec.id FROM spaartrack.external_connection ec WHERE ec.user_id = $1)
     ORDER BY cr.created_at`,
    [userId]
  );
  // `vault_path` is deliberately NOT selected: it locates the secret in the
  // vault. The export states the reference exists and its lifecycle only.
  const credentialReferences = await run(
    `SELECT csr.id, csr.secret_kind, csr.key_version, csr.created_at, csr.rotated_at, csr.revoked_at
     FROM spaartrack.credential_secret_ref csr WHERE csr.user_id = $1 ORDER BY csr.created_at, csr.id`,
    [userId]
  );
  const providerAccounts = await run(
    `SELECT pa.id, pa.connection_id, pa.external_account_id, pa.account_type, pa.name, pa.iban_last4,
            pa.base_currency_code, pa.tracking_mode, pa.is_active, pa.created_at, pa.updated_at
     FROM spaartrack.provider_account pa
     WHERE pa.connection_id IN (SELECT ec.id FROM spaartrack.external_connection ec WHERE ec.user_id = $1)
     ORDER BY pa.created_at`,
    [userId]
  );
  const importFiles = await run(
    `SELECT f.id, f.portfolio_id, f.provider_id, f.mapping_id, f.filename, f.content_type,
            f.checksum_sha256, f.file_size_bytes, f.parse_status, f.created_at,
            (f.object_storage_key IS NOT NULL) AS has_object_storage_reference
     FROM spaartrack.import_file f WHERE f.user_id = $1 ORDER BY f.created_at`,
    [userId]
  );
  const importSessions = await run(
    `SELECT s.id, s.portfolio_id, s.provider_id, s.import_file_id, s.status, s.parser_version,
            s.rows_seen, s.rows_valid, s.rows_warning, s.rows_error, s.committed_at, s.undone_at, s.created_at
     FROM spaartrack.import_session s WHERE s.user_id = $1 ORDER BY s.created_at`,
    [userId]
  );
  const importRows = await run(
    `SELECT r.id, r.import_session_id, r.row_number, r.status, r.error_codes, r.resolved_values,
            r.resolved_at
     FROM spaartrack.import_row_review r
     JOIN spaartrack.import_session s ON s.id = r.import_session_id
     WHERE s.user_id = $1 ORDER BY r.import_session_id, r.row_number`,
    [userId]
  );
  const incomeEvents = await run(
    `SELECT ie.id, ie.portfolio_id, ie.instrument_id, ie.event_type, ie.status, ie.announced_on, ie.ex_date,
            ie.record_date, ie.payment_date, ie.amount_per_unit, ie.gross_amount, ie.tax_amount, ie.fee_amount,
            ie.net_amount, ie.currency_code, ie.external_id, ie.metadata, ie.created_at
     FROM spaartrack.income_event ie
     WHERE ie.portfolio_id IN (${OWNED_PORTFOLIOS})
     ORDER BY ie.created_at, ie.id`,
    [userId]
  );
  const categories = await run(
    `SELECT c.id, c.parent_id, c.category_type, c.name, c.color, c.is_system, c.is_active
     FROM spaartrack.category c WHERE c.user_id = $1 ORDER BY c.id`,
    [userId]
  );
  const payees = await run(
    `SELECT p.id, p.name, p.normalized_name, p.is_active
     FROM spaartrack.payee p WHERE p.user_id = $1 ORDER BY p.id`,
    [userId]
  );
  const tags = await run(
    `SELECT t.id, t.name, t.color
     FROM spaartrack.transaction_tag t WHERE t.user_id = $1 ORDER BY t.id`,
    [userId]
  );
  const moneyFlowAccountScopes = await run(
    `SELECT mfs.portfolio_id, mfs.financial_account_id, mfs.is_enabled, mfs.created_at, mfs.updated_at
     FROM spaartrack.money_flow_account_scope mfs WHERE mfs.user_id = $1 ORDER BY mfs.portfolio_id, mfs.financial_account_id`,
    [userId]
  );
  const userPreferences = await run(
    `SELECT up.user_id, up.base_currency_code, up.date_format, up.theme, up.updated_at
     FROM spaartrack.user_preference up WHERE up.user_id = $1`,
    [userId]
  );
  // auth_identity is PHYSICALLY DELETED on user deletion, so it must be
  // included in the export: otherwise the data subject never obtains a copy
  // of their OIDC provider linkage that is about to be destroyed.
  // Columns are metadata only — no token material lives here.
  const authIdentities = await run(
    `SELECT id, provider, subject, email, metadata, created_at
     FROM spaartrack.auth_identity WHERE user_id = $1 ORDER BY created_at`,
    [userId]
  );
  // `audit_log.user_id` is uuid while `audit_log.actor_id` is text, so the
  // same parameter needs an explicit cast on each side. Without the casts
  // Postgres raises `operator does not exist: text = uuid` (SQLSTATE 42883)
  // and the whole export fails.
  const auditHistory = await run(
    `SELECT a.id, a.action, a.entity_type, a.entity_id, a.after_json, a.correlation_id, a.trace_id, a.created_at
     FROM spaartrack.audit_log a
     WHERE a.user_id = $1::uuid OR a.actor_id = $1::text
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT 500`,
    [userId]
  );

  return {
    user: user.rows,
    portfolios: portfolios.rows,
    grants: grants.rows,
    financial_accounts: financialAccounts.rows,
    ledger: ledger.rows,
    ledger_entries: ledgerEntries.rows,
    raw_payloads: rawPayloads.rows,
    reports: reports.rows,
    connections: connections.rows,
    connection_scopes: connectionScopes.rows,
    consent_records: consentRecords.rows,
    credential_references: credentialReferences.rows,
    provider_accounts: providerAccounts.rows,
    import_files: importFiles.rows,
    import_sessions: importSessions.rows,
    import_rows: importRows.rows,
    income_events: incomeEvents.rows,
    categories: categories.rows,
    payees: payees.rows,
    tags: tags.rows,
    money_flow_account_scopes: moneyFlowAccountScopes.rows,
    user_preferences: userPreferences.rows,
    auth_identities: authIdentities.rows,
    audit_history: auditHistory.rows
  };
}
/**
 * The section list that the export contract promises. The runtime test
 * asserts this exact set, so a section cannot be silently dropped.
 */
export const PRIVACY_EXPORT_SECTION_NAMES = [
  "user",
  "portfolios",
  "grants",
  "financial_accounts",
  "ledger",
  "ledger_entries",
  "raw_payloads",
  "reports",
  "connections",
  "connection_scopes",
  "consent_records",
  "credential_references",
  "provider_accounts",
  "import_files",
  "import_sessions",
  "import_rows",
  "income_events",
  "categories",
  "payees",
  "tags",
  "money_flow_account_scopes",
  "user_preferences",
  "auth_identities",
  "audit_history"
] as const;
