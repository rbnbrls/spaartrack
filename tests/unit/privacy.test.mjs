import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPrivacyDeletionReceipt,
  buildPrivacyExport,
  isSensitivePrivacyKey,
  normalizePrivacyKey,
  privacyExportJson,
  PRIVACY_DELETION_METHOD,
  PRIVACY_EXPORT_VERSION,
  PRIVACY_RETENTION_POLICY,
  PRIVACY_TOMBSTONE_RETENTION_DAYS
} from "../../apps/api/src/privacy.ts";

test("TC-US-0206-A: sensitive privacy keys are detected by normalized name and suffix", () => {
  for (const key of [
    "token",
    "token_hash",
    "access_token",
    "refreshToken",
    "id_token",
    "secret",
    "secret_value",
    "secret_ciphertext",
    "vault_path",
    "vaultPath",
    "api_key",
    "apiKey",
    "private_key",
    "password",
    "passphrase",
    "authorization",
    "provider_api_key",
    "oauth_token",
    "session_secret"
  ]) {
    assert.equal(isSensitivePrivacyKey(key), true, `${key} must be treated as sensitive`);
  }
  for (const key of [
    "id",
    "email",
    "display_name",
    "status",
    "created_at",
    "iban_last4",
    "checksum_sha256",
    "external_id",
    "key_version",
    "secret_kind",
    "payload_type",
    "object_storage_key",
    "provider_slug",
    // An opaque surrogate key, not credential material: the export must stay
    // able to correlate a connection with the credential reference it uses.
    "credential_ref_id"
  ]) {
    assert.equal(isSensitivePrivacyKey(key), false, `${key} must not be treated as sensitive`);
  }
  assert.equal(normalizePrivacyKey("refreshToken"), "refresh_token");
  assert.equal(normalizePrivacyKey("vault-path"), "vault_path");
  assert.equal(normalizePrivacyKey("vaultPath"), "vault_path");
  assert.equal(normalizePrivacyKey("apiKey"), "api_key");
});

test("TC-US-0206-A: export redaction recursively removes credential material from every section", () => {
  const redacted = privacyExportJson({
    id: "1",
    token_hash: "a".repeat(64),
    nested: { api_key: "leak", safe: "kept" },
    list: [{ vault_path: "/vault/x", keep: 1 }],
    metadata: { client_secret: "leak", password: "leak", ordinary: "kept" }
  });
  assert.equal(JSON.stringify(redacted).includes("token_hash"), false);
  assert.equal(JSON.stringify(redacted).includes("api_key"), false);
  assert.equal(JSON.stringify(redacted).includes("vault_path"), false);
  assert.equal(JSON.stringify(redacted).includes("client_secret"), false);
  assert.equal(JSON.stringify(redacted).includes("password"), false);
  assert.equal(redacted.id, "1");
  assert.equal(redacted.nested.safe, "kept");
  assert.equal(redacted.list[0].keep, 1);
  assert.equal(redacted.metadata.ordinary, "kept");
});

test("TC-US-0206-A: every export section is redacted, not only a hand-picked subset", () => {
  const bundle = buildPrivacyExport({
    userId: "11111111-1111-1111-1111-111111111111",
    generatedAt: "2026-10-20T12:00:00.000Z",
    sections: {
      user: { id: "u", email: "owner@example.test", password: "leak" },
      security: { sessions: [{ token_hash: "leak", revoked_at: null }] },
      portfolios: [{ id: "p", secret_value: "leak" }],
      grants: [{ portfolio_id: "p", credential_ref_id: "c" }],
      connections: [{ id: "c", credential_ref_id: "c", api_key: "leak" }],
      credential_references: [{ id: "c", vault_path: "/vault/x", secret_kind: "API_KEY" }],
      ledger: [{ id: "t", metadata: { authorization: "Bearer leak" } }],
      raw_payloads: [{ id: "p", payload_json: { api_key: "leak", value: 1 } }],
      reports: [{ id: "r", object_storage_key: "reports/r.json" }],
      money_flow: [{ id: "m", private_key: "leak" }]
    }
  });
  const serialized = JSON.stringify(bundle);
  for (const leak of ["password", "token_hash", "secret_value", "api_key", "vault_path", "authorization", "private_key"]) {
    assert.equal(serialized.includes(leak), false, `${leak} must not survive the export`);
  }
  assert.equal(bundle.user_id, "11111111-1111-1111-1111-111111111111");
  assert.equal(bundle.export_version, PRIVACY_EXPORT_VERSION);
  assert.equal(bundle.read_only, true);
  assert.equal(bundle.user.email, "owner@example.test");
  assert.equal(bundle.credential_references[0].secret_kind, "API_KEY");
  assert.equal(bundle.reports[0].object_storage_key, "reports/r.json");
  assert.equal(bundle.raw_payloads[0].payload_json.value, 1);
});

test("TC-US-0206-B: the deletion receipt states what was revoked and that the ledger is preserved", () => {
  const receipt = buildPrivacyDeletionReceipt({
    counts: {
      sessions: 2,
      totp_factors: 1,
      oidc_states: 1,
      grants: 3,
      portfolio_share_links: 1,
      accountant_shares: 1,
      owned_portfolios: 1,
      provider_connections: 1,
      connection_scopes: 2,
      consent_records: 1,
      credential_references: 1,
      push_consents: 1,
      auth_identities: 1,
      tax_residency: 1
    },
    auditEventId: "22222222-2222-2222-2222-222222222222",
    tombstoneId: "33333333-3333-3333-3333-333333333333",
    retentionUntil: "2027-10-20T12:00:00.000Z",
    traceId: "trace-privacy",
    correlationId: "corr-privacy"
  });
  assert.equal(receipt.method, PRIVACY_DELETION_METHOD);
  assert.equal(receipt.ledger_rows_deleted, 0);
  assert.equal(receipt.ledger_preserved, true);
  assert.equal(receipt.revoked.sessions, 2);
  assert.equal(receipt.revoked.provider_connections, 1);
  assert.equal(receipt.revoked.credential_references, 1);
  assert.equal(receipt.revoked.consent_records, 1);
  assert.equal(receipt.revoked.connection_scopes, 2);
  assert.equal(receipt.revoked.portfolio_share_links, 1);
  assert.equal(receipt.revoked.accountant_shares, 1);
  assert.equal(receipt.revoked.push_consents, 1);
  assert.equal(receipt.anonymized.user_profile, true);
  assert.equal(receipt.anonymized.auth_identities_removed, 1);
  assert.equal(receipt.anonymized.tax_residency_removed, 1);
  assert.equal(receipt.credential_material_purged_from_vault, false);
  assert.equal(receipt.audit_event_id, "22222222-2222-2222-2222-222222222222");
  assert.equal(receipt.tombstone_id, "33333333-3333-3333-3333-333333333333");
  assert.equal(receipt.retention_until, "2027-10-20T12:00:00.000Z");
  assert.equal(receipt.trace_id, "trace-privacy");
  assert.equal(receipt.correlation_id, "corr-privacy");
});

test("TC-US-0206-B: retention policy states that the ledger is never physically deleted", () => {
  assert.equal(PRIVACY_RETENTION_POLICY.ledger.physical_delete_on_user_request, false);
  assert.equal(PRIVACY_RETENTION_POLICY.audit_log.physical_delete_on_user_request, false);
  assert.equal(PRIVACY_RETENTION_POLICY.raw_payload.retention_days, 30);
  assert.equal(PRIVACY_RETENTION_POLICY.deletion.ledger_rows_deleted, 0);
  assert.equal(PRIVACY_RETENTION_POLICY.deletion.provider_connections, "REVOKED + disconnected_at");
  assert.equal(PRIVACY_RETENTION_POLICY.deletion.credential_references, "revoked_at");
  assert.equal(PRIVACY_RETENTION_POLICY.deletion.tombstone, "user_deletion_tombstone (replayable on restore)");
  assert.equal(PRIVACY_RETENTION_POLICY.deletion.portfolio_grants, "revoked_at (subject-held and grants on subject-owned portfolios)");
  assert.equal(PRIVACY_RETENTION_POLICY.deletion.owned_portfolios, "ARCHIVED + privacy_scope PRIVATE, hidden from non-ACTIVE member reads");
  assert.ok(PRIVACY_TOMBSTONE_RETENTION_DAYS > 0);
});

test("TC-US-0206-A: the export bundle indexes every exported section with its row count", () => {
  const bundle = buildPrivacyExport({
    userId: "11111111-1111-1111-1111-111111111111",
    generatedAt: "2026-10-20T12:00:00.000Z",
    sections: {
      user: [{ id: "u" }],
      portfolios: [{ id: "p1" }, { id: "p2" }],
      ledger: [],
      reports: [{ id: "r" }]
    }
  });
  assert.equal(bundle.complete, true);
  assert.deepEqual(bundle.section_index, [
    { section: "user", rows: 1 },
    { section: "portfolios", rows: 2 },
    { section: "ledger", rows: 0 },
    { section: "reports", rows: 1 }
  ]);
  assert.equal(bundle.retention.policy_id, "privacy-retention-v1");
});
