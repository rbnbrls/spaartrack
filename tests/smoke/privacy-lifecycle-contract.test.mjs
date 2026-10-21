import { databaseUrl as resolvedDatabaseUrl } from "../support/local-endpoints.mjs";
import { apiUrl } from "../support/local-endpoints.mjs";
// TC-US-0206 runtime contract: the privacy export and deletion lifecycle.
//
// This is the failing test the B-003 remediation was supposed to have. It
// asserts the properties that were previously unproven:
//
//   - the export returns the caller's OWN data, section by section, and never
//     another principal's;
//   - the export contains no credential material (vault path, token hash,
//     secret values);
//   - the deletion revokes provider connections AND credential secret
//     references, not just sessions and grants;
//   - the deletion never physically deletes a ledger row;
//   - after deletion the old session, the export and the login are all denied;
//   - the deletion leaves a discoverable, attributable audit trail.
//
// All fixtures are synthetic.

import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { PRIVACY_EXPORT_SECTION_NAMES } from "../../apps/api/src/privacy-export.ts";

const require = createRequire(import.meta.url);
const { Pool } = require("../../apps/api/node_modules/pg");

const api = apiUrl;
const databaseUrl = resolvedDatabaseUrl;

const jsonHeaders = { "content-type": "application/json" };
const bearer = (token) => ({ authorization: `Bearer ${token}` });

let pool;
async function query(text, values) {
  if (!pool) pool = new Pool({ connectionString: databaseUrl });
  return pool.query(text, values);
}

async function createUser(label) {
  const email = `synthetic-privacy-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const response = await fetch(`${api}/api/v1/users`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ email, display_name: `Synthetic ${label}` })
  });
  assert.equal(response.status, 201, `user creation failed: ${response.status}`);
  const user = await response.json();
  return { ...user, email };
}

async function issueSession(email) {
  const response = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
    method: "POST",
    headers: { ...jsonHeaders, "x-synthetic-fixture-key": "local-test-fixture-only" },
    body: JSON.stringify({ email, ttl_seconds: 300 })
  });
  assert.equal(response.status, 201, `fixture session failed: ${response.status}`);
  return (await response.json()).token;
}

test("TC-US-0206-A-runtime: the export is complete, self-scoped and free of credential material", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const owner = await createUser("export-owner");
  const outsider = await createUser("export-outsider");
  const ownerToken = await issueSession(owner.email);
  const outsiderToken = await issueSession(outsider.email);

  // Build a portfolio with a ledger transaction so the export has real rows.
  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, {
    method: "POST",
    headers: { ...bearer(ownerToken), ...jsonHeaders },
    body: JSON.stringify({ name: "Synthetic Privacy Export Portfolio", reporting_currency_code: "EUR" })
  });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();

  const accountResponse = await fetch(`${api}/api/v1/accounts`, {
    method: "POST",
    headers: { ...bearer(ownerToken), ...jsonHeaders },
    body: JSON.stringify({
      portfolio_id: portfolio.id,
      name: "Synthetic Privacy Export Account",
      account_type: "BROKERAGE",
      tracking_mode: "TRANSACTIONS",
      base_currency_code: "EUR"
    })
  });
  assert.equal(accountResponse.status, 201, `account creation failed: ${accountResponse.status}`);
  const account = await accountResponse.json();

  const transactionResponse = await fetch(`${api}/api/v1/ledger/transactions`, {
    method: "POST",
    headers: { ...bearer(ownerToken), ...jsonHeaders },
    body: JSON.stringify({
      portfolio_id: portfolio.id,
      financial_account_id: account.id,
      activity_type: "DEPOSIT",
      amount: 100,
      currency_code: "EUR",
      description: "Synthetic privacy export transaction",
      occurred_at: "2026-10-20T00:00:00Z",
      effective_date: "2026-10-20"
    })
  });
  assert.equal(transactionResponse.status, 201, `ledger transaction failed: ${transactionResponse.status}`);
  const transaction = await transactionResponse.json();

  const exportResponse = await fetch(`${api}/api/v1/users/export`, { headers: bearer(ownerToken) });
  assert.equal(exportResponse.status, 200, `export failed: ${exportResponse.status}`);
  const bundle = await exportResponse.json();

  // The export must be complete: every promised section is present.
  assert.equal(bundle.complete, true);
  assert.deepEqual(
    bundle.section_index.map((entry) => entry.section).sort(),
    [...PRIVACY_EXPORT_SECTION_NAMES].sort(),
    "the export must carry exactly the contracted sections"
  );

  // And it must actually contain the owner's data, not empty placeholders.
  assert.equal(bundle.ledger.length, 1, "the export must contain the owner's ledger transaction");
  assert.equal(bundle.ledger[0].id, transaction.id);
  assert.equal(bundle.ledger_entries.length >= 1, true, "the export must contain the ledger entries");
  assert.equal(bundle.portfolios.some((item) => item.id === portfolio.id), true);
  assert.equal(bundle.grants.some((item) => item.portfolio_id === portfolio.id && item.role === "OWNER"), true);
  assert.equal(bundle.financial_accounts.some((item) => item.id === account.id), true);
  assert.equal(bundle.user[0].email, owner.email);

  // No credential material may appear anywhere in the bundle.
  const serialized = JSON.stringify(bundle);
  for (const leak of ["vault_path", "token_hash", "secret_ciphertext", "secret_iv", "secret_tag", "state_hash", "code_hash"]) {
    assert.equal(serialized.includes(leak), false, `${leak} must not appear in the export`);
  }
  assert.equal(bundle.credential_references.length, 0);
  assert.equal(bundle.credential_references.some((item) => "vault_path" in item), false);

  // The export is self-scoped: an outsider gets their own bundle, never the
  // owner's portfolio, ledger or account.
  const outsiderResponse = await fetch(`${api}/api/v1/users/export`, { headers: bearer(outsiderToken) });
  assert.equal(outsiderResponse.status, 200);
  const outsiderBundle = await outsiderResponse.json();
  assert.equal(outsiderBundle.user_id, outsider.id);
  assert.equal(outsiderBundle.ledger.length, 0, "the outsider must not see the owner's ledger");
  assert.equal(outsiderBundle.portfolios.some((item) => item.id === portfolio.id), false);
  assert.equal(outsiderBundle.financial_accounts.some((item) => item.id === account.id), false);
  assert.equal(outsiderBundle.audit_history.some((item) => JSON.stringify(item).includes(owner.id)), false);

  // The export records the retention/deletion semantics for the data subject.
  assert.equal(bundle.retention.policy_id, "privacy-retention-v1");
  assert.equal(bundle.retention.ledger.physical_delete_on_user_request, false);
  assert.equal(bundle.retention.deletion.provider_connections, "REVOKED + disconnected_at");
  assert.equal(bundle.retention.deletion.credential_references, "revoked_at");
});

test("TC-US-0206-B-runtime: deletion revokes connections and credential references, preserves the ledger and denies later access", { skip: process.env.STACK_SMOKE !== "1" }, async () => {
  const owner = await createUser("delete-owner");
  const outsider = await createUser("delete-outsider");
  const ownerToken = await issueSession(owner.email);
  const outsiderToken = await issueSession(outsider.email);

  const portfolioResponse = await fetch(`${api}/api/v1/portfolios`, {
    method: "POST",
    headers: { ...bearer(ownerToken), ...jsonHeaders },
    body: JSON.stringify({ name: "Synthetic Privacy Delete Portfolio", reporting_currency_code: "EUR" })
  });
  assert.equal(portfolioResponse.status, 201);
  const portfolio = await portfolioResponse.json();

  const accountResponse = await fetch(`${api}/api/v1/accounts`, {
    method: "POST",
    headers: { ...bearer(ownerToken), ...jsonHeaders },
    body: JSON.stringify({
      portfolio_id: portfolio.id,
      name: "Synthetic Privacy Delete Account",
      account_type: "BROKERAGE",
      tracking_mode: "TRANSACTIONS",
      base_currency_code: "EUR"
    })
  });
  assert.equal(accountResponse.status, 201);
  const account = await accountResponse.json();

  const transactionResponse = await fetch(`${api}/api/v1/ledger/transactions`, {
    method: "POST",
    headers: { ...bearer(ownerToken), ...jsonHeaders },
    body: JSON.stringify({
      portfolio_id: portfolio.id,
      financial_account_id: account.id,
      activity_type: "DEPOSIT",
      amount: 250,
      currency_code: "EUR",
      description: "Synthetic privacy delete transaction",
      occurred_at: "2026-10-20T00:00:00Z",
      effective_date: "2026-10-20"
    })
  });
  assert.equal(transactionResponse.status, 201);
  const transaction = await transactionResponse.json();

  // Give the owner a provider connection with a credential secret reference so
  // the deletion has something to revoke on that boundary.
  const providerSlug = `synthetic-privacy-${Date.now()}`;
  const providerResponse = await fetch(`${api}/api/v1/providers`, {
    method: "POST",
    headers: { ...bearer(ownerToken), ...jsonHeaders },
    body: JSON.stringify({
      slug: providerSlug,
      name: "Synthetic Privacy Provider",
      provider_type: "BROKER",
      auth_mode: "API_KEY",
      status: "ACTIVE",
      capabilities: [{ capability: "READ_TRANSACTIONS", supported: true }]
    })
  });
  assert.equal(providerResponse.status, 201, `provider creation failed: ${providerResponse.status}`);
  const provider = await providerResponse.json();

  const connectionResponse = await fetch(`${api}/api/v1/connections`, {
    method: "POST",
    headers: { ...bearer(ownerToken), ...jsonHeaders },
    body: JSON.stringify({
      provider_slug: providerSlug,
      display_name: "Synthetic Privacy Connection",
      auth_mode: "API_KEY",
      vault_path: "/synthetic/privacy/vault/key",
      scopes: ["read"],
      accounts: [
        { external_account_id: "SYNTHETIC-1", account_type: "INVEST", name: "Synthetic Privacy Account", base_currency_code: "EUR" }
      ]
    })
  });
  assert.equal(connectionResponse.status, 201, `connection creation failed: ${connectionResponse.status}`);
  const connection = await connectionResponse.json();

  const credentialRows = await query(
    `SELECT id, revoked_at FROM spaartrack.credential_secret_ref WHERE user_id = $1`,
    [owner.id]
  );
  assert.equal(credentialRows.rowCount, 1, "the connection must have created a credential secret reference");
  const credentialId = String(credentialRows.rows[0].id);
  assert.equal(credentialRows.rows[0].revoked_at, null);

  const deleteResponse = await fetch(`${api}/api/v1/users/me`, { method: "DELETE", headers: bearer(ownerToken) });
  assert.equal(deleteResponse.status, 200, `deletion failed: ${deleteResponse.status}`);
  const deleted = await deleteResponse.json();
  assert.equal(deleted.status, "DELETED");
  assert.ok(deleted.deleted_at, "the deletion must record when it happened");

  // The receipt states exactly what was revoked.
  const receipt = deleted.deletion;
  assert.equal(receipt.method, "soft-delete-and-revoke");
  assert.equal(receipt.ledger_rows_deleted, 0, "the ledger must never be physically deleted");
  assert.equal(receipt.ledger_preserved, true);
  assert.equal(receipt.revoked.sessions >= 1, true, "the live session must be revoked");
  assert.equal(receipt.revoked.provider_connections, 1, "the provider connection must be revoked");
  assert.equal(receipt.revoked.credential_references, 1, "the credential secret reference must be revoked");
  assert.equal(receipt.revoked.owned_portfolios, 1, "the owned portfolio must be archived");
  assert.equal(receipt.revoked.portfolio_grants >= 1, true, "the portfolio grant must be revoked");
  assert.ok(receipt.audit_event_id, "the deletion must have an audit event");
  assert.ok(receipt.tombstone_id, "the deletion must leave a tombstone");
  assert.ok(receipt.retention_until, "the tombstone must state its retention");

  // Provider connections and credential references are revoked in the store.
  const connectionRow = await query(
    `SELECT status, disconnected_at FROM spaartrack.external_connection WHERE id = $1`,
    [connection.id]
  );
  assert.equal(connectionRow.rows[0].status, "REVOKED");
  assert.ok(connectionRow.rows[0].disconnected_at, "the revoked connection must record when it was disconnected");
  const credentialRow = await query(`SELECT revoked_at FROM spaartrack.credential_secret_ref WHERE id = $1`, [credentialId]);
  assert.ok(credentialRow.rows[0].revoked_at, "the credential secret reference must be revoked");

  // The identity row is anonymised but kept.
  const identityRow = await query(`SELECT status, email, display_name FROM spaartrack.app_user WHERE id = $1`, [owner.id]);
  assert.equal(identityRow.rows[0].status, "DELETED");
  assert.equal(identityRow.rows[0].email, null, "the email must be anonymised on deletion");
  assert.notEqual(identityRow.rows[0].display_name, "Synthetic delete-owner", "the display name must be anonymised on deletion");

  // The ledger history survives the deletion.
  const ledgerRow = await query(
    `SELECT (SELECT count(*) FROM spaartrack.ledger_transaction WHERE id = $1) AS t,
            (SELECT count(*) FROM spaartrack.ledger_entry WHERE ledger_transaction_id = $1) AS e`,
    [transaction.id]
  );
  assert.equal(ledgerRow.rows[0].t, "1", "the ledger transaction must be preserved");
  assert.equal(ledgerRow.rows[0].e, "1", "the ledger entries must be preserved");

  // The tombstone is durable and carries the real counts.
  const tombstoneRow = await query(
    `SELECT user_id, revoked_sessions, revoked_provider_connections, revoked_credential_references, ledger_rows_deleted, audit_event_id
       FROM spaartrack.user_deletion_tombstone WHERE id = $1`,
    [receipt.tombstone_id]
  );
  assert.equal(tombstoneRow.rowCount, 1);
  assert.equal(tombstoneRow.rows[0].user_id, owner.id);
  assert.equal(tombstoneRow.rows[0].revoked_provider_connections, 1);
  assert.equal(tombstoneRow.rows[0].revoked_credential_references, 1);
  assert.equal(tombstoneRow.rows[0].ledger_rows_deleted, 0);
  assert.equal(tombstoneRow.rows[0].audit_event_id, receipt.audit_event_id);

  // The audit trail records the deletion, attributable and traceable.
  const auditRow = await query(
    `SELECT action, entity_type, actor_id, user_id, correlation_id, trace_id FROM spaartrack.audit_log WHERE id = $1`,
    [receipt.audit_event_id]
  );
  assert.equal(auditRow.rowCount, 1);
  assert.equal(auditRow.rows[0].action, "DELETE");
  assert.equal(auditRow.rows[0].entity_type, "USER");
  assert.equal(auditRow.rows[0].actor_id, owner.id);

  // Post-delete access is denied everywhere.
  assert.equal((await fetch(`${api}/api/v1/sessions/me`, { headers: bearer(ownerToken) })).status, 401);
  assert.equal((await fetch(`${api}/api/v1/users/me`, { headers: bearer(ownerToken) })).status, 401);
  assert.equal((await fetch(`${api}/api/v1/users/export`, { headers: bearer(ownerToken) })).status, 401);
  assert.equal((await fetch(`${api}/api/v1/users/${owner.id}`, { headers: bearer(ownerToken) })).status, 401);
  // A deleted user must not be able to obtain a session again. This goes
  // through the FIXTURE route on purpose: the fixture route does hand out a
  // session for a live user (see issueSession above), so a refusal here is
  // caused by the deletion and not by the public route refusing every
  // email-only login. On the public route this assertion would hold for a
  // live user too, and would therefore prove nothing.
  const loginAfterDelete = await fetch(`${api}/api/v1/test-fixtures/sessions`, {
    method: "POST",
    headers: { ...jsonHeaders, "x-synthetic-fixture-key": "local-test-fixture-only" },
    body: JSON.stringify({ email: owner.email, ttl_seconds: 120 })
  });
  assert.equal(loginAfterDelete.status, 401, "a deleted user must not be able to log in again");

  // The outsider must not be able to act as the deleted user either.
  assert.equal((await fetch(`${api}/api/v1/users/${owner.id}`, { headers: bearer(outsiderToken) })).status, 403);
  const outsiderExport = await fetch(`${api}/api/v1/users/export`, { headers: bearer(outsiderToken) });
  assert.equal(outsiderExport.status, 200);
  const outsiderBundle = await outsiderExport.json();
  assert.equal(outsiderBundle.ledger.some((item) => item.id === transaction.id), false, "the outsider must not see the deleted owner's ledger");
});
