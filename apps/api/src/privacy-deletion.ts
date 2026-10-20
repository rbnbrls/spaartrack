// User deletion lifecycle for US-0206 (TC-US-0206-B).
//
// The deletion contract is deliberately conservative:
//
//  - The canonical ledger is NEVER physically deleted and never mutated here.
//    `ledger_transaction`/`ledger_entry` are read-only in this flow (ADR-0002,
//    AGENTS.md "no physical ledger delete"). The rows stay, the owning
//    portfolio is archived, and the grants that exposed them are revoked.
//  - Every credential-bearing reference is revoked, not dropped, so the
//    revocation stays auditable.
//  - The whole lifecycle runs in ONE transaction. If any step fails the
//    transaction rolls back and the caller gets an error; the endpoint must
//    never report a deletion that did not happen.
//
// This module only builds the SQL and the receipt. It performs no I/O, so the
// statements can be executed against a real PostgreSQL in a test.

export type PrivacyDeletionSql = { text: string; values: unknown[] };

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

export type PrivacyDeletionPlan = {
  /** Revoke/anonymise statements, in execution order. */
  statements: PrivacyDeletionSql[];
  /** Which statement index feeds which counter in the receipt. */
  counted: Array<{ key: keyof PrivacyDeletionCounts; index: number }>;
  /**
   * Index of the statement that soft-deletes and anonymises the identity row.
   * The route uses it to pick up the updated user for the response.
   */
  identityUpdateIndex: number;
  /**
   * The tombstone insert. It runs AFTER the counted statements and BEFORE the
   * commit, so the tombstone carries the real row counts and the audit event
   * id of the deletion it proves.
   */
  tombstone: (input: { counts: PrivacyDeletionCounts; auditEventId: string }) => PrivacyDeletionSql;
};

/**
 * Build the deletion plan for one principal.
 *
 * Order matters: the identity row is anonymised last so the transaction can
 * still identify the account while it revokes everything that points at it.
 */
export function buildPrivacyDeletionPlan(input: {
  userId: string;
  retentionUntil: string;
  actorId: string;
  correlationId: string | null;
  traceId: string | null;
}): PrivacyDeletionPlan {
  const userId = input.userId;
  const statements: PrivacyDeletionSql[] = [];
  const counted: PrivacyDeletionPlan["counted"] = [];

  const add = (key: keyof PrivacyDeletionCounts, text: string, values: unknown[]): void => {
    counted.push({ key, index: statements.length });
    statements.push({ text, values });
  };

  // 1. Revoke every live session.
  add(
    "sessions",
    `UPDATE spaartrack.user_session SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
  // 2. Revoke the TOTP factor so the second factor cannot be re-used.
  add(
    "totp_factors",
    `UPDATE spaartrack.user_totp_factor SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
  // 3. Consume any pending OIDC login state.
  add(
    "oidc_states",
    `UPDATE spaartrack.oidc_login_state SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL`,
    [userId]
  );
  // 4. Revoke every portfolio grant the deleted user HOLDS, and every grant
  //    OTHER users hold ON the deleted user's portfolios. Both must be revoked:
  //    the first removes what the subject can read elsewhere; the second removes
  //    what third parties can still read of the deleted subject's data after the
  //    subject requested deletion (F1).
  add(
    "grants",
    `UPDATE spaartrack.portfolio_member SET revoked_at = now()
      WHERE (user_id = $1 OR portfolio_id IN (SELECT id FROM spaartrack.portfolio WHERE owner_user_id = $1))
        AND revoked_at IS NULL`,
    [userId]
  );
  // 5. Revoke the share links and accountant shares this user handed out.
  add(
    "portfolio_share_links",
    `UPDATE spaartrack.portfolio_share_link SET revoked_at = now() WHERE created_by = $1 AND revoked_at IS NULL`,
    [userId]
  );
  add(
    "accountant_shares",
    `UPDATE spaartrack.accountant_share SET revoked_at = now() WHERE created_by = $1 AND revoked_at IS NULL`,
    [userId]
  );
  // 6. Archive the portfolios this user owns. The ledger inside them is kept;
  //    archiving plus revoked grants is what removes access to it.
  add(
    "owned_portfolios",
    `UPDATE spaartrack.portfolio
        SET status = 'ARCHIVED', privacy_scope = 'PRIVATE', archived_at = now(), updated_at = now()
      WHERE owner_user_id = $1 AND status <> 'DELETED'`,
    [userId]
  );
  // 7. Revoke provider connections. `REVOKED` plus `disconnected_at` is the
  //    documented terminal state; the row itself is kept for audit.
  add(
    "provider_connections",
    `UPDATE spaartrack.external_connection
        SET status = 'REVOKED', disconnected_at = now(), updated_at = now()
      WHERE user_id = $1 AND status NOT IN ('REVOKED', 'DISCONNECTED')`,
    [userId]
  );
  // 8. Revoke the granted scopes on those connections.
  add(
    "connection_scopes",
    `UPDATE spaartrack.connection_scope SET revoked_at = now()
      WHERE connection_id IN (SELECT id FROM spaartrack.external_connection WHERE user_id = $1)
        AND revoked_at IS NULL`,
    [userId]
  );
  // 9. Revoke the consent records behind those connections.
  add(
    "consent_records",
    `UPDATE spaartrack.consent_record SET state = 'REVOKED', revoked_at = now()
      WHERE connection_id IN (SELECT id FROM spaartrack.external_connection WHERE user_id = $1)
        AND state <> 'REVOKED'`,
    [userId]
  );
  // 10. Revoke the credential secret references. The reference row survives so
  //     the revocation is auditable; `vault_path` is never read or written
  //     here, and the material inside the vault is purged by the vault
  //     adapter, not by this flow.
  add(
    "credential_references",
    `UPDATE spaartrack.credential_secret_ref SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
  // 11. Revoke push consents.
  add(
    "push_consents",
    `UPDATE spaartrack.push_consent SET status = 'REVOKED', revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
  // 12. Remove the external identity links. These carry the provider subject
  //     and email, so they are personal data in their own right.
  add(
    "auth_identities",
    `DELETE FROM spaartrack.auth_identity WHERE user_id = $1`,
    [userId]
  );
  // 13. Remove tax-residency rows (country + validity window).
  add(
    "tax_residency",
    `DELETE FROM spaartrack.tax_residency WHERE user_id = $1`,
    [userId]
  );
  // 14. Anonymise the identity row itself. `email` is nulled so the
  //     unique index no longer ties the tombstone to a live address, and the
  //     display name is replaced by a non-identifying marker. The row is NOT
  //     deleted: the ledger and audit trail still reference it.
  const identityUpdateIndex = statements.length;
  statements.push({
    text: `UPDATE spaartrack.app_user
              SET status = 'DELETED', deleted_at = now(), updated_at = now(),
                  email = NULL, display_name = 'Verwijderd gebruiker', tax_residency_country = NULL
            WHERE id = $1 AND status <> 'DELETED'
            RETURNING id, email, display_name, status, locale, timezone, default_currency_code, created_at, updated_at, deleted_at`,
    values: [userId]
  });

  return {
    statements,
    counted,
    identityUpdateIndex,
    tombstone: ({ counts, auditEventId }) => ({
      text: `INSERT INTO spaartrack.user_deletion_tombstone
               (user_id, deleted_at, retention_until, reason, revoked_sessions, revoked_totp_factors,
                consumed_oidc_states, revoked_grants, archived_portfolios, revoked_provider_connections,
                revoked_connection_scopes, revoked_consent_records, revoked_credential_references,
                ledger_rows_deleted, audit_event_id, actor_id, correlation_id, trace_id)
             VALUES ($1, now(), $2::timestamptz, 'USER_REQUESTED', $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $12::uuid, $13, $14, $15)
             RETURNING id`,
      values: [
        userId,
        input.retentionUntil,
        counts.sessions,
        counts.totp_factors,
        counts.oidc_states,
        counts.grants,
        counts.owned_portfolios,
        counts.provider_connections,
        counts.connection_scopes,
        counts.consent_records,
        counts.credential_references,
        auditEventId,
        input.actorId,
        input.correlationId,
        input.traceId
      ]
    })
  };
}

/**
 * The audit event that records the deletion. It is inserted INSIDE the
 * deletion transaction so the audit trail and the deletion commit together:
 * an audit row can never be missing for a committed deletion.
 *
 * `actor_id` is the deleting principal and `user_id` is the subject, so the
 * event stays attributable and discoverable by subject id. `entity_id` is the
 * deleted user, which is the entity the event is about.
 */
export function buildPrivacyDeletionAuditEvent(input: {
  userId: string;
  actorId: string;
  correlationId: string | null;
  traceId: string | null;
}): PrivacyDeletionSql {
  return {
    text: `INSERT INTO spaartrack.audit_log
             (user_id, actor_type, actor_id, action, entity_type, entity_id, after_json, correlation_id, trace_id)
           VALUES ($1::uuid, 'USER', $2, 'DELETE', 'USER', $1::uuid, $3::jsonb, $4, $5)
           RETURNING id`,
    values: [
      input.userId,
      input.actorId,
      JSON.stringify({ reason: "user_deletion_request", method: "soft-delete-and-revoke" }),
      input.correlationId,
      input.traceId
    ]
  };
}
